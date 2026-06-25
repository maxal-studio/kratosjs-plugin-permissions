import type { ResourceHooks, HookContext } from '@maxal_studio/kratosjs';

/**
 * Serializes a name into a role format:
 * - Convert to lowercase
 * - Replace spaces with underscores
 * - Remove numbers
 * - Remove all special characters (keep only letters and underscores)
 */
const serializeRole = (name: string | undefined): string => {
	if (!name || typeof name !== 'string') return '';

	// Convert to lowercase
	let role = name.toLowerCase();

	// Replace spaces with underscores
	role = role.replace(/\s+/g, '_');

	// Remove numbers
	role = role.replace(/\d+/g, '');

	// Remove all special characters except letters and underscores
	role = role.replace(/[^a-z_]/g, '');

	// Remove multiple consecutive underscores
	role = role.replace(/_+/g, '_');

	// Remove leading/trailing underscores
	role = role.replace(/^_+|_+$/g, '');

	return role;
};

/**
 * AdminPermissions resource hooks
 * Automatically serializes the role from the name
 */
export const adminPermissionsHooks: ResourceHooks = {
	beforeCreate: [
		async (ctx: HookContext) => {
			if (ctx.input.data?.[0]) {
				const data = ctx.input.data[0];
				// If role is not provided or is empty, generate it from name
				if (data.name && (!data.role || data.role.trim() === '')) {
					data.role = serializeRole(data.name);
				} else if (data.role) {
					// If role is provided, ensure it's properly serialized
					data.role = serializeRole(data.role);
				}
			}
		},
	],
	beforeUpdate: [
		async (ctx: HookContext) => {
			console.log('beforeUpdate', ctx.input.data);
			if (ctx.input.data?.[0]) {
				const data = ctx.input.data[0];
				// If name is being updated and role is not explicitly set, regenerate role from name
				if (data.name) {
					// Only auto-generate role if it's not being explicitly updated
					if (!data.role || data.role.trim() === '') {
						data.role = serializeRole(data.name);
					} else {
						// If role is provided, ensure it's properly serialized
						data.role = serializeRole(data.role);
					}
				} else if (data.role) {
					// If only role is being updated, ensure it's properly serialized
					data.role = serializeRole(data.role);
				}
			}
		},
	],
};
