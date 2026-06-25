import {
	BaseResource,
	FormBuilder,
	TableBuilder,
	TextInput,
	Textarea,
	TextColumn,
	HiddenInput,
	FormContext,
	ActionHandler,
	Action,
	t,
} from '@maxal_studio/kratosjs';
import { adminPermissionsHooks } from './adminPermissionsHooks';

export class AdminPermissionsResource extends BaseResource {
	static slug = 'admin-roles';
	// Assigned by PermissionsPlugin.register() — the entity is built per driver
	static entity: any;

	static get label() {
		return t('permissions:label');
	}

	static get pluralLabel() {
		return t('permissions:plural');
	}

	static icon = 'Shield';

	static get navigationGroup() {
		return t('permissions:navGroup');
	}

	static navigationSort = 100;
	static globallySearchableAttributes = ['name', 'role', 'description'];

	static recordTitleAttribute = (record: any) => record.name || record.role;

	static form() {
		return FormBuilder.make().schema([
			HiddenInput.make('role').hidden((context: FormContext) => context.operation === 'view'),
			TextInput.make('role')
				.label(t('permissions:resource.fields.role'))
				.hidden((context: FormContext) => context.operation !== 'view'),
			TextInput.make('name').label(t('permissions:resource.fields.name')).required().min(2).max(100),
			Textarea.make('description')
				.label(t('permissions:resource.fields.description'))
				.required()
				.rows(4)
				.placeholder(t('permissions:resource.fields.description_ph')),
		]);
	}

	static table() {
		return TableBuilder.make()
			.searchable()
			.paginate(10)
			.striped()
			.defaultSort('createdAt', 'desc')
			.columns([
				TextColumn.make('id').label(t('permissions:resource.fields.id')).sortable().toggleable(true, true),
				TextColumn.make('role').label(t('permissions:resource.fields.role')).sortable().width('200').searchable().badge().colors({
					default: 'secondary',
				}),
				TextColumn.make('name').label(t('permissions:resource.fields.name')).sortable().width('200').searchable(),
				TextColumn.make('description').label(t('permissions:resource.fields.description')).searchable(),
				TextColumn.make('updatedAt').label(t('permissions:resource.fields.updated')).sortable().dateTime(),
				TextColumn.make('createdAt').label(t('permissions:resource.fields.created')).sortable().since(),
			])
			.actions([
				Action.make('editPermissions')
					.label(t('permissions:resource.actions.edit_permissions'))
					.icon('ShieldUser')
					.color('text-green-600'),
			]);
	}

	static actions(): Record<string, ActionHandler> {
		return {
			editPermissions: async (data: { records?: any[] }) => {
				const { records = [] } = data;
				if (records.length === 0) {
					return { success: false, message: t('permissions:resource.messages.no_role_selected') };
				}
				if (records[0].role === 'admin') {
					return {
						success: true,
						message: t('permissions:resource.messages.admin_full_access'),
					};
				}
				return {
					redirect: `/page/permissions?role=${records[0].role}`,
					success: true,
				};
			},
		};
	}

	static hooks() {
		return adminPermissionsHooks;
	}
}
