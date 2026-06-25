import type { PermissionLevel, PermissionsData, ResourcePermission, ResourceStatus, StructureResource } from './types';

export function createDefaultResourcePermission(): ResourcePermission {
	return {
		access: false,
		create: false,
		read: false,
		update: false,
		delete: false,
		fields: {},
		columns: {},
		actions: {},
		widgets: {},
		tabs: {},
	};
}

export function ensureResourcePermission(data: PermissionsData, resourceSlug: string): ResourcePermission {
	if (!data.resources[resourceSlug]) {
		data.resources[resourceSlug] = createDefaultResourcePermission();
	}
	const perm = data.resources[resourceSlug];
	if (!perm.fields) perm.fields = {};
	if (!perm.columns) perm.columns = {};
	if (!perm.actions) perm.actions = {};
	if (!perm.widgets) perm.widgets = {};
	if (!perm.tabs) perm.tabs = {};
	return perm;
}

export function getFieldLevel(perm: ResourcePermission, fieldName: string): PermissionLevel {
	return perm.fields?.[fieldName] ?? 'hidden';
}

export function getColumnLevel(perm: ResourcePermission, columnName: string): PermissionLevel {
	return perm.columns?.[columnName] ?? 'hidden';
}

export function setAllFieldLevels(perm: ResourcePermission, fieldNames: string[], level: PermissionLevel): void {
	if (!perm.fields) perm.fields = {};
	for (const name of fieldNames) {
		perm.fields[name] = level;
	}
}

export function setAllColumnLevels(perm: ResourcePermission, columnNames: string[], level: PermissionLevel): void {
	if (!perm.columns) perm.columns = {};
	for (const name of columnNames) {
		perm.columns[name] = level;
	}
}

export function grantFullResourceAccess(perm: ResourcePermission, resourceInfo: StructureResource): void {
	perm.access = true;
	perm.create = true;
	perm.read = true;
	perm.update = true;
	perm.delete = true;

	const fieldNames = resourceInfo.fields.map(f => f.name);
	const columnNames = [...resourceInfo.columns.map(c => c.name), ...resourceInfo.extraFields.map(c => c.name)];
	setAllFieldLevels(perm, fieldNames, 'editable');
	setAllColumnLevels(perm, columnNames, 'editable');

	if (!perm.actions) perm.actions = {};
	for (const action of resourceInfo.actions) {
		perm.actions[action] = true;
	}
	if (!perm.widgets) perm.widgets = {};
	for (const widget of resourceInfo.widgets) {
		perm.widgets[widget] = true;
	}
	if (!perm.tabs) perm.tabs = {};
	for (const tab of resourceInfo.tabs) {
		perm.tabs[tab] = true;
	}
}

export function resetResourceAccess(perm: ResourcePermission, resourceInfo: StructureResource): void {
	perm.access = false;
	perm.create = false;
	perm.read = false;
	perm.update = false;
	perm.delete = false;

	const fieldNames = resourceInfo.fields.map(f => f.name);
	const columnNames = [...resourceInfo.columns.map(c => c.name), ...resourceInfo.extraFields.map(c => c.name)];
	setAllFieldLevels(perm, fieldNames, 'hidden');
	setAllColumnLevels(perm, columnNames, 'hidden');

	if (!perm.actions) perm.actions = {};
	for (const action of resourceInfo.actions) {
		perm.actions[action] = false;
	}
	if (!perm.widgets) perm.widgets = {};
	for (const widget of resourceInfo.widgets) {
		perm.widgets[widget] = false;
	}
	if (!perm.tabs) perm.tabs = {};
	for (const tab of resourceInfo.tabs) {
		perm.tabs[tab] = false;
	}
}

export function getResourceStatus(
	perm: ResourcePermission | undefined,
	resourceInfo: StructureResource,
): ResourceStatus {
	if (!perm?.access) return 'disabled';

	const crudComplete = perm.create && perm.read && perm.update && perm.delete;
	if (!crudComplete) return 'partial';

	const allFieldsEditable = resourceInfo.fields.every(f => getFieldLevel(perm, f.name) === 'editable');
	const allColumnsEditable = [...resourceInfo.columns, ...resourceInfo.extraFields].every(
		c => getColumnLevel(perm, c.name) === 'editable',
	);

	if (!allFieldsEditable || !allColumnsEditable) return 'partial';

	return 'enabled';
}

export function countEnabledResources(data: PermissionsData, resourceSlugs: string[]): number {
	return resourceSlugs.filter(slug => data.resources[slug]?.access).length;
}

export function countEnabledPages(data: PermissionsData, pageSlugs: string[]): number {
	return pageSlugs.filter(slug => data.pages[slug]?.access).length;
}

export function groupResourcesByNav(
	resources: Record<string, StructureResource>,
): Map<string, [string, StructureResource][]> {
	const groupMap = new Map<string, [string, StructureResource][]>();
	for (const [slug, info] of Object.entries(resources)) {
		const group = info.navigationGroup ?? 'Other';
		if (!groupMap.has(group)) groupMap.set(group, []);
		groupMap.get(group)!.push([slug, info]);
	}
	for (const entries of groupMap.values()) {
		entries.sort((a, b) => a[1].label.localeCompare(b[1].label));
	}
	return groupMap;
}

export const GROUP_ICONS: Record<string, string> = {
	'User Management': 'Users',
	Content: 'FileText',
	Finance: 'Landmark',
	'Live Sessions': 'Radio',
	Live: 'Zap',
	Commerce: 'ShoppingBag',
	System: 'Settings',
	Other: 'Database',
};
