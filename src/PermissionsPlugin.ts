import { Plugin, Panel, AuthUser, PanelMetadata, KratosJsRequest, KratosJsResponse } from '@maxal_studio/kratosjs';
import { PermissionsPage } from './PermissionsPage';
import {
	getPermissionsForRole,
	filterFormSchema,
	filterTableSchema,
	filterPageBlocks,
	hasPageAccess,
	filterRecords,
	canRunAction,
	isSuperAdmin,
	setSuperAdminRoleIds,
	addSuperAdminRoleId,
} from './permissionsHelper';
import { getPermissions, savePermissions, getAllRoles, getStructure } from './permissionsController';
import { createAdminPermissionsEntity, type IAdminPermissions } from './entities/AdminPermissions';
import type { EntitySchema } from '@mikro-orm/core';
import { Migration20250103000002CreateAdminPermissions } from './migrations/sql/Migration20250103000002CreateAdminPermissions';
import { AdminPermissionsResource } from './AdminPermissionsResource';
// Translations
import en from './lang/en';
import sq from './lang/sq';

// Store panel reference for PermissionsPage and permissionsHelper
let panelInstance: Panel | null = null;
// Store the driver-specific AdminPermissions entity so controllers/helpers can
// pass the entity reference to MikroORM (v7 no longer accepts string entity names)
let entityInstance: EntitySchema<IAdminPermissions> | null = null;

/**
 * Options for the permissions plugin.
 */
export interface PermissionsPluginOptions {
	/**
	 * AdminPermissions role ids whose users bypass every permission check.
	 * Ids can be added later (e.g. from a seeder) via {@link PermissionsPlugin.markSuperAdminRole}.
	 * As a default, a role whose slug is `admin` is always treated as super admin.
	 */
	superAdminRoleIds?: Array<string | number>;
	/**
	 * Name of the user entity the `role` relation is attached to. Defaults to `User`.
	 */
	userEntityName?: string;
}

/**
 * Permissions Plugin
 * Controls access to resources and pages based on user roles.
 * Driver-agnostic: builds the AdminPermissions entity for the active driver
 * and only registers SQL migrations on SQL drivers.
 *
 * On register the plugin attaches a nullable `role` ManyToOne relation
 * (User -> AdminPermissions) to the app's user entity, so users reference a role
 * by id rather than storing a role string.
 */
export class PermissionsPlugin extends Plugin {
	private readonly options: PermissionsPluginOptions;

	constructor(options: PermissionsPluginOptions = {}) {
		super();
		this.options = options;
	}

	getName(): string {
		return 'permissions';
	}

	/**
	 * Mark an AdminPermissions role id as a super admin (bypasses every check).
	 * Useful from a seeder once the role's generated id is known.
	 */
	static markSuperAdminRole(id: string | number): void {
		addSuperAdminRoleId(id);
	}

	async register(panel: Panel): Promise<void> {
		panelInstance = panel;

		if (this.options.superAdminRoleIds) {
			setSuperAdminRoleIds(this.options.superAdminRoleIds);
		}

		const driver = panel.getDriverKind();
		const AdminPermissions = createAdminPermissionsEntity(driver);
		entityInstance = AdminPermissions;

		// Register translations
		panel.registerTranslations('permissions', { en, sq });

		panel.registerEntities([AdminPermissions]);
		if (driver === 'sql') {
			panel.registerMigrations([Migration20250103000002CreateAdminPermissions]);
		}

		// Attach the `role` relation (User -> AdminPermissions) to the app's user entity.
		this.patchUserEntity(panel, AdminPermissions);

		panel.registerCustomField('set-all');
		panel.registerCustomField('toggle-full-access');
		panel.registerCustomField('toggle-all');
		panel.registerCustomBlock('permissions-editor');

		// Register the permissions page
		panel.registerPage(PermissionsPage);

		AdminPermissionsResource.entity = AdminPermissions;
		panel.registerResource(AdminPermissionsResource);

		// Register metadata filter hook
		panel.registerMetadataFilterHook(async (metadata: PanelMetadata, user?: AuthUser) => {
			if (!user || !user.role) {
				// No user or role - return empty metadata (deny all)
				return {
					...metadata,
					resources: [],
					pages: [],
				};
			}

			// Super admins see everything
			if (await isSuperAdmin(user)) {
				return metadata;
			}

			const permissions = await getPermissionsForRole(user.role);

			// Filter resources based on permissions
			const filteredResources = metadata.resources.filter(resource => {
				const resourcePermission = permissions.resources[resource.slug];
				return resourcePermission && resourcePermission.access === true;
			});

			// Filter pages based on permissions
			const filteredPages = metadata.pages.filter(page => {
				const pagePermission = permissions.pages[page.slug];
				return pagePermission && pagePermission.access === true;
			});

			return {
				...metadata,
				resources: filteredResources,
				pages: filteredPages,
			};
		});

		// Register form schema filter hook
		panel.registerFormSchemaFilterHook(async (schema: any, resourceSlug: string, user?: AuthUser) => {
			if (!user || !user.role) {
				// No user or role - return empty schema (deny all)
				return {
					...schema,
					components: [],
				};
			}

			return await filterFormSchema(schema, user, resourceSlug);
		});

		// Register table schema filter hook
		panel.registerTableSchemaFilterHook(async (schema: any, resourceSlug: string, user?: AuthUser) => {
			if (!user || !user.role) {
				// No user or role - return empty schema (deny all)
				return {
					...schema,
					columns: [],
					actions: [],
					bulkActions: [],
					widgets: [],
				};
			}

			return await filterTableSchema(schema, user, resourceSlug);
		});

		// Register page blocks filter hook
		panel.registerPageBlocksFilterHook(async (blocks: any[], pageSlug: string, user?: AuthUser) => {
			if (!user || !user.role) {
				// No user or role - return empty blocks (deny all)
				return [];
			}

			return await filterPageBlocks(blocks, user, pageSlug);
		});

		// Register page access check hook
		panel.registerPageAccessCheckHook(async (pageSlug: string, user?: AuthUser) => {
			if (!user || !user.role) {
				return false;
			}

			return await hasPageAccess(user, pageSlug);
		});

		// Register data filter hook
		panel.registerDataFilterHook(
			async (
				records: any[],
				resourceSlug: string,
				operation: 'create' | 'read' | 'update' | 'delete' | 'list' | 'findById',
				user?: AuthUser,
			) => {
				if (!user || !user.role) {
					// No user or role - return empty array (deny all)
					return [];
				}

				// Pass panel instance to filterRecords so it can access form schema
				return await filterRecords(records, resourceSlug, operation, user, panel);
			},
		);

		// Register capabilities filter hook to override canCreate/canEdit/canDelete/canView based on permissions
		panel.registerCapabilitiesFilterHook(
			async (
				capabilities: {
					canCreate: boolean;
					canEdit: boolean;
					canDelete: boolean;
					canView: boolean;
				},
				resourceSlug: string,
				user?: AuthUser,
			) => {
				if (!user || !user.role) {
					// No user or role - deny all capabilities
					return {
						canCreate: false,
						canEdit: false,
						canDelete: false,
						canView: false,
					};
				}

				// Super admins keep all capabilities (respect resource-level flags)
				if (await isSuperAdmin(user)) {
					return capabilities;
				}

				// Check permissions for this role
				const permissions = await getPermissionsForRole(user.role);
				const resourcePermission = permissions.resources[resourceSlug];

				// If no permissions exist or resource access is denied, deny all capabilities
				if (!resourcePermission || !resourcePermission.access) {
					return {
						canCreate: false,
						canEdit: false,
						canDelete: false,
						canView: false,
					};
				}

				// Override capabilities based on permissions (but respect resource-level flags)
				// If resource-level flag is false, permission can't enable it
				return {
					canCreate: capabilities.canCreate && resourcePermission.create === true,
					canEdit: capabilities.canEdit && resourcePermission.update === true,
					canDelete: capabilities.canDelete && resourcePermission.delete === true,
					canView: capabilities.canView && resourcePermission.read === true,
				};
			},
		);

		// Register action access check hook to authorize custom/bulk/header action and export execution.
		// Per-action permission (same map the table-schema filter uses to hide buttons): hiding is not enough.
		panel.registerActionAccessCheckHook(async (actionName: string, resourceSlug: string, user?: AuthUser) => {
			return canRunAction(user, resourceSlug, actionName);
		});

		panel.registerRoute('get', '/permissions/data', async (req: KratosJsRequest, res: KratosJsResponse) => {
			// Attach panel to request for controller
			req.panel = panel;
			await getPermissions(req, res);
		});

		panel.registerRoute('post', '/permissions/save', async (req: KratosJsRequest, res: KratosJsResponse) => {
			// Attach panel to request for controller
			req.panel = panel;
			await savePermissions(req, res);
		});

		panel.registerRoute('get', '/permissions/roles', async (req: KratosJsRequest, res: KratosJsResponse) => {
			// Attach panel to request for controller
			req.panel = panel;
			await getAllRoles(req, res);
		});

		panel.registerRoute('get', '/permissions/structure', async (req: KratosJsRequest, res: KratosJsResponse) => {
			req.panel = panel;
			await getStructure(req, res);
		});
	}

	/**
	 * Attach a nullable `role` ManyToOne relation (User -> AdminPermissions) to the
	 * app's user entity, so users reference a role by id. Runs during register(),
	 * before the ORM is initialized, by locating the user entity on the registered
	 * resources. No-op (with a warning) if the user entity cannot be found.
	 */
	private patchUserEntity(panel: Panel, adminPermissions: EntitySchema<IAdminPermissions>): void {
		const userEntityName = this.options.userEntityName ?? 'User';

		let userEntity: any | undefined;
		for (const registered of panel.getResources().values()) {
			const entity = (registered.resourceClass as any).entity;
			const name = entity?.name ?? entity?.meta?.className;
			if (entity && name === userEntityName) {
				userEntity = entity;
				break;
			}
		}

		if (!userEntity) {
			console.warn(
				`[PermissionsPlugin] Could not find a '${userEntityName}' entity to attach the role relation. ` +
					`Register the user's resource before the permissions plugin, or pass { userEntityName }.`,
			);
			return;
		}

		// Avoid double-patching (e.g. multiple panels / hot reload)
		if (userEntity.__kratosRolePatched || userEntity.meta?.properties?.role) {
			return;
		}

		// Note: addProperty(name, type, options) takes the relation target via `type`
		// (or `options.entity`); the target goes in options here, type stays undefined.
		userEntity.addProperty('role', undefined, {
			kind: 'm:1',
			entity: () => adminPermissions,
			nullable: true,
		});
		userEntity.__kratosRolePatched = true;
	}

	/**
	 * Get the panel instance (for use in PermissionsPage)
	 */
	static getPanel(): Panel | null {
		return panelInstance;
	}

	/**
	 * Get the driver-specific AdminPermissions entity (registered during register()).
	 */
	static getEntity(): EntitySchema<IAdminPermissions> {
		if (!entityInstance) {
			throw new Error('PermissionsPlugin is not registered');
		}
		return entityInstance;
	}
}
