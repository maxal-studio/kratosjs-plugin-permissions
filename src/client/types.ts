export type PermissionLevel = 'hidden' | 'readonly' | 'editable';

export interface ResourcePermission {
	access: boolean;
	create: boolean;
	read: boolean;
	update: boolean;
	delete: boolean;
	fields?: Record<string, PermissionLevel>;
	columns?: Record<string, PermissionLevel>;
	actions?: Record<string, boolean>;
	widgets?: Record<string, boolean>;
	tabs?: Record<string, boolean>;
}

export interface PagePermission {
	access: boolean;
	blocks?: Record<string, boolean>;
}

export interface PermissionsData {
	role: string;
	resources: Record<string, ResourcePermission>;
	pages: Record<string, PagePermission>;
}

export interface RoleInfo {
	role: string;
	name: string;
	description: string;
}

export interface StructureField {
	name: string;
	label?: string;
}

export interface StructureResource {
	label: string;
	icon?: string;
	navigationGroup: string;
	fields: StructureField[];
	columns: StructureField[];
	extraFields: StructureField[];
	actions: string[];
	widgets: string[];
	tabs: string[];
}

export interface StructurePage {
	label: string;
	icon?: string;
	blocks: string[];
}

export interface PanelStructure {
	resources: Record<string, StructureResource>;
	pages: Record<string, StructurePage>;
}

export type ResourceStatus = 'disabled' | 'partial' | 'enabled';

export type EditorTab = 'resources' | 'pages';
