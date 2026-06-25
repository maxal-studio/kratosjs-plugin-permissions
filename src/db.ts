import type { EntityManager, EntitySchema } from '@mikro-orm/core';
import { PermissionsPlugin } from './PermissionsPlugin';
import type { IAdminPermissions } from './entities/AdminPermissions';

export function getPermissionsEm(): EntityManager {
	const panel = PermissionsPlugin.getPanel();
	if (!panel) {
		throw new Error('PermissionsPlugin is not registered');
	}
	return panel.getEm();
}

/**
 * Get the driver-specific AdminPermissions entity reference to pass to MikroORM.
 */
export function getPermissionsEntity(): EntitySchema<IAdminPermissions> {
	return PermissionsPlugin.getEntity();
}
