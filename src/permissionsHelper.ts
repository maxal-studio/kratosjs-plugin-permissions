import { AuthUser, Panel } from '@maxal_studio/kratosjs';
import { IAdminPermissions, ResourcePermission, PagePermission } from './entities/AdminPermissions';
import { getPermissionsEm, getPermissionsEntity } from './db';
import { traverseComponent } from './structureHelper';

/**
 * Default deny permissions (used when no permissions found for a role)
 */
const DEFAULT_DENY_PERMISSIONS = {
	resources: {},
	pages: {},
};

/**
 * Role ids (stringified) that are treated as super admins: they bypass all
 * permission checks. Populated from PermissionsPlugin options and/or at runtime
 * via {@link addSuperAdminRoleId} (e.g. from a seeder once the role id is known).
 */
const superAdminRoleIds = new Set<string>();

/** Replace the configured super-admin role ids. */
export function setSuperAdminRoleIds(ids: Array<string | number>): void {
	superAdminRoleIds.clear();
	for (const id of ids) {
		if (id !== null && id !== undefined) {
			superAdminRoleIds.add(String(id));
		}
	}
}

/** Add a single super-admin role id (e.g. after seeding the default admin role). */
export function addSuperAdminRoleId(id: string | number): void {
	if (id !== null && id !== undefined) {
		superAdminRoleIds.add(String(id));
	}
}

/**
 * Load a single AdminPermissions record by its primary key (the value stored on
 * the user's `role` relation). Returns null when not found or on error.
 */
async function loadRoleById(roleId: string | number): Promise<IAdminPermissions | null> {
	try {
		return await getPermissionsEm().findOne<IAdminPermissions>(getPermissionsEntity(), roleId as any);
	} catch (error) {
		console.error(`[PermissionsPlugin] Error loading role ${roleId}:`, error);
		return null;
	}
}

/**
 * Whether the given user is a super admin (bypasses every permission check).
 * A role is super-admin when its id is in the configured set, or — as a sensible
 * default — when the role record's slug is `admin`.
 */
export async function isSuperAdmin(user: AuthUser | undefined): Promise<boolean> {
	const roleId = user?.role;
	if (roleId === null || roleId === undefined || roleId === '') {
		return false;
	}
	if (superAdminRoleIds.has(String(roleId))) {
		return true;
	}
	const record = await loadRoleById(roleId);
	return !!record && record.role === 'admin';
}

/**
 * Get permissions for a role id (the value stored on the user's `role` relation)
 * from the database. Returns default deny permissions if not found.
 */
export async function getPermissionsForRole(roleId: string | number | undefined): Promise<{
	resources: Record<string, ResourcePermission>;
	pages: Record<string, PagePermission>;
}> {
	if (roleId === null || roleId === undefined || roleId === '') {
		return DEFAULT_DENY_PERMISSIONS;
	}

	const permissions = await loadRoleById(roleId);
	if (!permissions) {
		return DEFAULT_DENY_PERMISSIONS;
	}

	return {
		resources: permissions.resources || {},
		pages: permissions.pages || {},
	};
}

/**
 * Normalize field/column permission to a specific value
 * Handles boolean, string, and object formats
 */
export function normalizeFieldPermission(
	permission: Record<string, 'hidden' | 'readonly' | 'editable'> | boolean | string | undefined,
	fieldName: string,
): 'hidden' | 'readonly' | 'editable' {
	if (permission === undefined || permission === null) {
		return 'hidden'; // Deny by default
	}

	// Boolean format
	if (typeof permission === 'boolean') {
		return permission ? 'editable' : 'hidden';
	}

	// String format
	if (typeof permission === 'string') {
		if (permission === 'all' || permission === 'true') {
			return 'editable';
		}
		if (permission === 'none' || permission === 'false') {
			return 'hidden';
		}
		// If it's a specific permission value, return it
		if (permission === 'hidden' || permission === 'readonly' || permission === 'editable') {
			return permission;
		}
		return 'hidden'; // Unknown string, deny by default
	}

	// Object format - check specific field
	if (typeof permission === 'object') {
		const fieldPermission = permission[fieldName];
		if (fieldPermission === 'hidden' || fieldPermission === 'readonly' || fieldPermission === 'editable') {
			return fieldPermission;
		}
		return 'hidden'; // Field not in object, deny by default
	}

	return 'hidden'; // Unknown format, deny by default
}

/**
 * Check if user has access to a resource operation
 */
export async function hasResourceAccess(
	user: AuthUser | undefined,
	resourceSlug: string,
	operation: 'create' | 'read' | 'update' | 'delete',
): Promise<boolean> {
	if (!user || !user.role) {
		return false;
	}

	// Super admins bypass every check
	if (await isSuperAdmin(user)) {
		return true;
	}

	const permissions = await getPermissionsForRole(user.role);
	const resourcePermission = permissions.resources[resourceSlug];

	if (!resourcePermission) {
		return false; // Deny by default
	}

	if (!resourcePermission.access) {
		return false;
	}

	switch (operation) {
		case 'create':
			return resourcePermission.create === true;
		case 'read':
			return resourcePermission.read === true;
		case 'update':
			return resourcePermission.update === true;
		case 'delete':
			return resourcePermission.delete === true;
		default:
			return false;
	}
}

/**
 * Whether a user's role may execute a specific action (custom/bulk/header/export)
 * on a resource. Admin is always allowed; otherwise the action must be granted in
 * the role's per-action permissions. Used by the panel's actionAccessCheck hook.
 */
export async function canRunAction(
	user: AuthUser | undefined,
	resourceSlug: string,
	actionName: string,
): Promise<boolean> {
	if (!user || !user.role) {
		return false;
	}
	if (await isSuperAdmin(user)) {
		return true;
	}
	const permissions = await getPermissionsForRole(user.role);
	return hasActionAccess(permissions, user.role, resourceSlug, actionName);
}

/**
 * Get field permission for a specific field (internal version with pre-fetched permissions)
 */
function hasFieldAccess(
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
	resourceSlug: string,
	fieldName: string,
): 'hidden' | 'readonly' | 'editable' {
	// If role is 'admin', allow everything
	if (userRole === 'admin') {
		return 'editable';
	}

	const resourcePermission = permissions.resources[resourceSlug];

	if (!resourcePermission || !resourcePermission.access) {
		return 'hidden';
	}

	return normalizeFieldPermission(resourcePermission.fields, fieldName);
}

/**
 * Get column permission for a specific column (internal version with pre-fetched permissions)
 */
function hasColumnAccess(
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
	resourceSlug: string,
	columnName: string,
): 'hidden' | 'readonly' | 'editable' {
	if (userRole === 'admin') {
		return 'editable';
	}

	const resourcePermission = permissions.resources[resourceSlug];

	if (!resourcePermission || !resourcePermission.access) {
		return 'hidden';
	}

	return normalizeFieldPermission(resourcePermission.columns, columnName);
}

/**
 * Check if user has access to a specific action (with pre-fetched permissions)
 */
function hasActionAccess(
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
	resourceSlug: string,
	actionName: string,
): boolean {
	if (userRole === 'admin') {
		return true;
	}

	const resourcePermission = permissions.resources[resourceSlug];

	if (!resourcePermission || !resourcePermission.access) {
		return false;
	}

	// Handle both array and object formats for actions
	if (!resourcePermission.actions) {
		return false; // No actions allowed by default
	}

	// If actions is an array, check if it includes the action name
	if (Array.isArray(resourcePermission.actions)) {
		return resourcePermission.actions.includes(actionName);
	}

	// If actions is an object, check if the action name exists and is true
	if (typeof resourcePermission.actions === 'object') {
		return resourcePermission.actions[actionName] === true;
	}

	return false;
}

/**
 * Check if user has access to a specific widget (with pre-fetched permissions)
 */
function hasWidgetAccess(
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
	resourceSlug: string,
	widgetName: string,
): boolean {
	if (userRole === 'admin') {
		return true;
	}

	const resourcePermission = permissions.resources[resourceSlug];

	if (!resourcePermission || !resourcePermission.access) {
		return false;
	}

	// Handle both array and object formats for widgets
	if (!resourcePermission.widgets) {
		return false; // No widgets allowed by default
	}

	// If widgets is an array, check if it includes the widget name
	if (Array.isArray(resourcePermission.widgets)) {
		return resourcePermission.widgets.includes(widgetName);
	}

	// If widgets is an object, check if the widget name exists and is true
	if (typeof resourcePermission.widgets === 'object') {
		return resourcePermission.widgets[widgetName] === true;
	}

	return false;
}

/**
 * Check if user has access to a page
 */
export async function hasPageAccess(user: AuthUser | undefined, pageSlug: string): Promise<boolean> {
	if (!user || !user.role) {
		return false;
	}

	// Super admins bypass every check
	if (await isSuperAdmin(user)) {
		return true;
	}

	const permissions = await getPermissionsForRole(user.role);
	const pagePermission = permissions.pages[pageSlug];

	if (!pagePermission) {
		return false; // Deny by default
	}

	return pagePermission.access === true;
}

/**
 * Recursively filter a single component by permissions (handles .schema, .components, .tabs)
 */
function filterComponentByPermissions(
	component: any,
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
	resourceSlug: string,
): any | null {
	// Field with name: apply permission
	if (component.name) {
		const permission = hasFieldAccess(permissions, userRole, resourceSlug, component.name);
		if (permission === 'hidden') {
			return null;
		}
		if (permission === 'readonly') {
			return { ...component, readOnly: true };
		}
	}

	// Nested .schema (Section, Group, Repeater); remove section if no fields left
	if (component.schema && Array.isArray(component.schema)) {
		const filtered = component.schema
			.map((nested: any) => filterComponentByPermissions(nested, permissions, userRole, resourceSlug))
			.filter((c: any) => c !== null);
		if (filtered.length === 0) {
			return null;
		}
		return { ...component, schema: filtered };
	}

	// Nested .components; remove container if no fields left
	if (component.components && Array.isArray(component.components)) {
		const filtered = component.components
			.map((nested: any) => filterComponentByPermissions(nested, permissions, userRole, resourceSlug))
			.filter((c: any) => c !== null);
		if (filtered.length === 0) {
			return null;
		}
		return { ...component, components: filtered };
	}

	// Tabs: each tab has its own schema; remove tabs with no fields left after filtering
	if (component.tabs && Array.isArray(component.tabs)) {
		const filteredTabs = component.tabs
			.map((tab: any) => {
				const tabSchema = tab?.schema;
				if (!tabSchema || !Array.isArray(tabSchema)) {
					return { ...tab, schema: [] };
				}
				const filtered = tabSchema
					.map((nested: any) => filterComponentByPermissions(nested, permissions, userRole, resourceSlug))
					.filter((c: any) => c !== null);
				return { ...tab, schema: filtered };
			})
			.filter((tab: any) => tab.schema && tab.schema.length > 0);
		if (filteredTabs.length === 0) {
			return null;
		}
		return { ...component, tabs: filteredTabs };
	}

	return component;
}

/**
 * Filter form schema based on permissions (includes fields inside tabs and nested components)
 */
export async function filterFormSchema(schema: any, user: AuthUser | undefined, resourceSlug: string): Promise<any> {
	if (!schema || !schema.components) {
		return schema;
	}

	if (!user || !user.role) {
		return {
			...schema,
			components: [],
		};
	}

	// Super admins bypass every check
	if (await isSuperAdmin(user)) {
		return schema;
	}

	const permissions = await getPermissionsForRole(user.role);

	const filteredComponents = schema.components
		.map((component: any) => filterComponentByPermissions(component, permissions, user.role!, resourceSlug))
		.filter((c: any) => c !== null);

	return {
		...schema,
		components: filteredComponents,
	};
}

/**
 * Filter table schema based on permissions
 */
export async function filterTableSchema(schema: any, user: AuthUser | undefined, resourceSlug: string): Promise<any> {
	if (!schema) {
		return schema;
	}

	if (!user || !user.role) {
		return {
			...schema,
			columns: [],
			actions: [],
			bulkActions: [],
			widgets: [],
		};
	}

	// Super admins bypass every check
	if (await isSuperAdmin(user)) {
		return schema;
	}

	// Fetch permissions once for all column checks
	const permissions = await getPermissionsForRole(user.role);

	// Filter columns
	if (schema.columns && Array.isArray(schema.columns)) {
		const filteredColumns = schema.columns.map((column: any) => {
			if (column.name) {
				const permission = hasColumnAccess(permissions, user.role!, resourceSlug, column.name);
				if (permission === 'hidden') {
					return null; // Remove column
				}
				if (permission === 'readonly') {
					return { ...column, readOnly: true };
				}
			}
			return column;
		});
		schema.columns = filteredColumns.filter((c: any) => c !== null);
	}

	// Filter actions
	if (schema.actions && Array.isArray(schema.actions)) {
		const filteredActions = schema.actions.map((action: any) => {
			if (action.name) {
				const hasAccess = hasActionAccess(permissions, user.role!, resourceSlug, action.name);
				return hasAccess ? action : null;
			}
			return action;
		});
		schema.actions = filteredActions.filter((a: any) => a !== null);
	}

	// Filter bulk actions
	if (schema.bulkActions && Array.isArray(schema.bulkActions)) {
		const filteredBulkActions = schema.bulkActions.map((action: any) => {
			if (action.name) {
				const hasAccess = hasActionAccess(permissions, user.role!, resourceSlug, action.name);
				return hasAccess ? action : null;
			}
			return action;
		});
		schema.bulkActions = filteredBulkActions.filter((a: any) => a !== null);
	}

	// Filter header actions
	if (schema.headerActions && Array.isArray(schema.headerActions)) {
		const filteredHeaderActions = schema.headerActions.map((action: any) => {
			if (action.name) {
				const hasAccess = hasActionAccess(permissions, user.role!, resourceSlug, action.name);
				return hasAccess ? action : null;
			}
			return action;
		});
		schema.headerActions = filteredHeaderActions.filter((a: any) => a !== null);
	}

	// Filter widgets
	if (schema.widgets && Array.isArray(schema.widgets)) {
		const filteredWidgets = schema.widgets.map((widget: any) => {
			if (widget.name) {
				const hasAccess = hasWidgetAccess(permissions, user.role!, resourceSlug, widget.name);
				return hasAccess ? widget : null;
			}
			return widget;
		});
		schema.widgets = filteredWidgets.filter((w: any) => w !== null);
	}

	// Filter tabs (using already fetched permissions)
	if (schema.tabs && Array.isArray(schema.tabs)) {
		const resourcePermission = permissions.resources[resourceSlug];

		if (!resourcePermission || !resourcePermission.access) {
			// No access - hide all tabs
			schema.tabs = [];
		} else if (resourcePermission.tabs) {
			const tabsPermission = resourcePermission.tabs;
			if (Array.isArray(tabsPermission)) {
				// Only show tabs that are in the permissions array
				schema.tabs = schema.tabs.filter((tab: any) => tabsPermission.includes(tab.key));
			}
		}
		// If tabs permission is not set but access is granted, show all tabs (default behavior)
	}

	return schema;
}

/**
 * Filter page blocks based on permissions (internal version with pre-fetched permissions)
 */
function filterPageBlocksInternal(
	blocks: any[],
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
	pageSlug: string,
): any[] {
	if (!blocks || !Array.isArray(blocks)) {
		return blocks;
	}

	// If role is 'admin', allow everything
	if (userRole === 'admin') {
		return blocks;
	}

	const pagePermission = permissions.pages[pageSlug];

	if (!pagePermission || !pagePermission.access) {
		return []; // No access to page
	}

	const blockPermissions = pagePermission.blocks || {};

	const filteredBlocks = blocks.map((block: any, index: number) => {
		// Use title as the primary identifier (as requested)
		// If no title, use widget.label or widget.name for widgets
		let identifier = block.title;

		// If no title, try to generate one from other properties
		if (!identifier) {
			if (block.type === 'widget' && block.widget) {
				// For widgets, prefer label over name
				identifier = block.widget.label || block.widget.name;
			} else {
				identifier =
					block.form?.name || // Form name
					block.table?.resource || // Table resource slug
					block.id || // Explicit ID
					block.name || // Explicit name
					String(index); // Fallback to index
			}
		}

		// Check block permission by identifier
		const blockPermission = blockPermissions[identifier];

		// Determine if block should be visible
		let isVisible = true;
		if (blockPermission !== undefined) {
			isVisible = blockPermission === true || blockPermission === 'visible';
		}

		if (!isVisible) {
			return null; // Remove block
		}

		// Recursively filter blocks in tabs
		if (block.type === 'tabs' && block.tabs && Array.isArray(block.tabs)) {
			const filteredTabs = block.tabs.map((tab: any) => {
				if (tab.blocks && Array.isArray(tab.blocks)) {
					return {
						...tab,
						blocks: filterPageBlocksInternal(tab.blocks, permissions, userRole, pageSlug),
					};
				}
				return tab;
			});
			return {
				...block,
				tabs: filteredTabs,
			};
		}

		return block;
	});

	return filteredBlocks.filter((b: any) => b !== null);
}

/**
 * Filter page blocks based on permissions
 */
export async function filterPageBlocks(blocks: any[], user: AuthUser | undefined, pageSlug: string): Promise<any[]> {
	if (!blocks || !Array.isArray(blocks)) {
		return blocks;
	}

	if (!user || !user.role) {
		return []; // No blocks if not authenticated
	}

	// Super admins bypass every check
	if (await isSuperAdmin(user)) {
		return blocks;
	}

	// Fetch permissions once for all block checks
	const permissions = await getPermissionsForRole(user.role);

	return filterPageBlocksInternal(blocks, permissions, user.role, pageSlug);
}

/**
 * Get form schema field names for a resource (includes fields inside tabs and nested components)
 */
function getFormSchemaFieldNames(panel: Panel | null, resourceSlug: string): Set<string> {
	if (!panel) {
		return new Set();
	}

	try {
		const resources = panel.getResources();
		const registered = resources.get(resourceSlug);
		if (!registered) {
			return new Set();
		}

		const ResourceClass = registered.resourceClass;
		const formBuilderOrSchema = ResourceClass.form();
		const formSchema = (formBuilderOrSchema as any).toJSON
			? (formBuilderOrSchema as any).toJSON()
			: formBuilderOrSchema;

		const fieldNames = new Set<string>();
		const formComponents = formSchema?.components as any[] | undefined;
		if (formComponents && Array.isArray(formComponents)) {
			for (const component of formComponents) {
				traverseComponent(component, comp => {
					if (comp.name) {
						fieldNames.add(comp.name);
					}
				});
			}
		}
		// Include table extraFields and populate paths so their column permissions are applied when filtering records
		const tableSchema = ResourceClass.table().toJSON?.() ?? ResourceClass.table();
		const table = tableSchema as any;
		if (Array.isArray(table?.extraFields)) {
			for (const name of table.extraFields) {
				if (typeof name === 'string' && name) {
					fieldNames.add(name);
				}
			}
		}
		if (Array.isArray(table?.populate)) {
			for (const item of table.populate) {
				const path = item?.path ?? item;
				if (typeof path === 'string' && path) {
					fieldNames.add(path);
				}
			}
		}
		return fieldNames;
	} catch (error) {
		console.error(`[PermissionsPlugin] Error getting form schema for ${resourceSlug}:`, error);
	}

	return new Set();
}

/**
 * Filter a single record by removing hidden fields based on permissions
 */
function filterRecordFields(
	record: any,
	resourceSlug: string,
	operation: 'create' | 'read' | 'update' | 'delete' | 'list' | 'findById',
	fieldNames: Set<string>,
	permissions: {
		resources: Record<string, ResourcePermission>;
		pages: Record<string, PagePermission>;
	},
	userRole: string,
): any {
	if (!record || typeof record !== 'object') {
		return record;
	}

	const filteredRecord: any = {};

	// Always include system fields (_id, createdAt, updatedAt, etc.)
	const systemFields = ['_id', 'id', 'createdAt', 'updatedAt', '__v'];

	// Process each field in the record
	for (const [key, value] of Object.entries(record)) {
		// Always include system fields
		if (systemFields.includes(key)) {
			filteredRecord[key] = value;
			continue;
		}

		// Only filter fields that are defined in the form schema
		// This prevents filtering out fields that might be added by hooks or other sources
		if (!fieldNames.has(key)) {
			// Field not in schema - include it (might be a computed field or added by hooks)
			filteredRecord[key] = value;
			continue;
		}

		if (operation === 'list') {
			const permission = hasColumnAccess(permissions, userRole, resourceSlug, key);
			if (permission === 'hidden') {
				// Field is hidden - skip it
				continue;
			}
		} else {
			// Check field permission
			const permission = hasFieldAccess(permissions, userRole, resourceSlug, key);
			if (permission === 'hidden') {
				// Field is hidden - skip it
				continue;
			}
		}

		// Field is visible (readonly or editable) - include it
		filteredRecord[key] = value;
	}

	return filteredRecord;
}

/**
 * Filter records based on permissions
 * Removes hidden fields from records based on field-level permissions, similar to schema filtering
 */
export async function filterRecords(
	records: any[],
	resourceSlug: string,
	operation: 'create' | 'read' | 'update' | 'delete' | 'list' | 'findById',
	user: AuthUser | undefined,
	panel?: Panel | null,
): Promise<any[]> {
	if (!user || !user.role) {
		// No user or role - deny all records
		return [];
	}

	// Super admins bypass every check
	if (await isSuperAdmin(user)) {
		return records;
	}

	// Map operation to resource operation for access check
	let resourceOperation: 'create' | 'read' | 'update' | 'delete' = 'read';
	if (operation === 'list' || operation === 'findById') {
		resourceOperation = 'read';
	} else if (operation === 'create') {
		resourceOperation = 'create';
	} else if (operation === 'update') {
		resourceOperation = 'update';
	} else if (operation === 'delete') {
		resourceOperation = 'delete';
	}

	// Check if user has access to the resource operation
	const hasAccess = await hasResourceAccess(user, resourceSlug, resourceOperation);
	if (!hasAccess) {
		// No access - return empty array
		return [];
	}

	// Get permissions to check field-level access (fetch once for all records)
	const permissions = await getPermissionsForRole(user.role);
	const resourcePermission = permissions.resources[resourceSlug];

	// If no resource permission or no access, return empty array
	if (!resourcePermission || !resourcePermission.access) {
		return [];
	}

	// Get form schema field names to know which fields to filter
	// This ensures we only filter fields that are defined in the form schema
	const formSchemaFieldNames = getFormSchemaFieldNames(panel || null, resourceSlug);

	// Filter each record by removing hidden fields (using pre-fetched permissions)
	const filteredRecords = records.map(record => {
		return filterRecordFields(record, resourceSlug, operation, formSchemaFieldNames, permissions, user.role!);
	});

	return filteredRecords;
}
