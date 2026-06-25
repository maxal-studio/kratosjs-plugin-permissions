import { EntitySchema } from '@mikro-orm/core';
import { idProps, DriverKind } from '@maxal_studio/kratosjs';

export interface ResourcePermission {
	access: boolean;
	create: boolean;
	read: boolean;
	update: boolean;
	delete: boolean;
	fields?: Record<string, 'hidden' | 'readonly' | 'editable'> | boolean | string;
	columns?: Record<string, 'hidden' | 'readonly' | 'editable'> | boolean | string;
	actions?: string[];
	widgets?: string[];
	tabs?: string[];
}

export interface PagePermission {
	access: boolean;
	blocks?: Record<string, 'hidden' | 'visible' | boolean>;
}

export interface IAdminPermissions {
	id: number | string;
	role: string;
	name: string;
	description: string;
	resources?: Record<string, ResourcePermission>;
	pages?: Record<string, PagePermission>;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Build the AdminPermissions entity for the active database driver.
 */
export function createAdminPermissionsEntity(driver: DriverKind): EntitySchema<IAdminPermissions> {
	return new EntitySchema<IAdminPermissions>({
		name: 'AdminPermissions',
		properties: {
			...idProps(driver),
			role: { type: 'string', unique: true },
			name: { type: 'string' },
			description: { type: 'string' },
			resources: { type: 'json', nullable: true },
			pages: { type: 'json', nullable: true },
			createdAt: { type: 'Date', onCreate: () => new Date() },
			updatedAt: {
				type: 'Date',
				onCreate: () => new Date(),
				onUpdate: () => new Date(),
			},
		} as any,
	});
}
