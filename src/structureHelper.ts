import { Panel, traverseComponent } from '@maxal_studio/kratosjs';

/** Serialized form component (from FormBuilder.toJSON()) */
type SerializedComponent = Record<string, any>;

// Re-export the shared traversal so existing importers of this module keep working.
export { traverseComponent };

/**
 * Get panel structure (resources, pages, fields, columns, actions, widgets)
 * This is a helper function that can be used both in controllers and pages
 */
export async function getPanelStructureData(panel: Panel): Promise<{
	resources: Record<string, any>;
	pages: Record<string, any>;
}> {
	const resources = panel.getResources();
	const structure: any = {
		resources: {},
		pages: {},
	};

	// Collect all resources with their fields, columns, actions, and widgets
	for (const [slug, registered] of resources) {
		const ResourceClass = registered.resourceClass;
		const actions = ResourceClass.actions();

		// Build through the panel so plugin-registered global configuration (configureUsing)
		// is applied — otherwise actions injected by plugins (e.g. CSV export) are missing here.
		const resourceInstance = panel.createResourceInstance(registered);
		const formSchema = resourceInstance.getFormSchema();
		const tableSchema = resourceInstance.getTableSchema();

		// Extract field names and labels from form schema using full component traversal
		const fields: Array<{ name: string; label?: string }> = [];
		const formComponents = formSchema.components as SerializedComponent[] | undefined;
		if (formComponents && Array.isArray(formComponents)) {
			for (const component of formComponents) {
				traverseComponent(component as any, (comp: SerializedComponent) => {
					if (comp.name) {
						fields.push({
							name: comp.name as string,
							label: comp.label as string | undefined,
						});
					}
				});
			}
		}

		// Extract column names and labels from table schema
		const columns: Array<{ name: string; label?: string }> = [];
		if (tableSchema.columns) {
			tableSchema.columns.forEach((col: any) => {
				if (col.name) {
					columns.push({
						name: col.name,
						label: col.label,
					});
				}
			});
		}

		// Extract action names from the handler map plus row, header, and bulk actions in the
		// table schema (built-in view/edit/delete are governed by the read/create/update/delete toggles).
		const actionNamesFromHandlers = Object.keys(actions);
		const actionNamesFromTable: string[] = [];
		for (const list of [tableSchema.actions, tableSchema.headerActions, tableSchema.bulkActions]) {
			if (Array.isArray(list)) {
				actionNamesFromTable.push(...list.map((action: any) => action.name).filter(Boolean));
			}
		}
		// Combine and remove duplicates
		const actionNames = [...new Set([...actionNamesFromHandlers, ...actionNamesFromTable])];

		// Extract widget names
		const widgetNames: string[] = [];
		if (registered.widgets) {
			widgetNames.push(...Array.from(registered.widgets.keys()));
		}

		// Extract tab keys from table schema
		const tabKeys: string[] = [];
		if (tableSchema.tabs && Array.isArray(tableSchema.tabs)) {
			tabKeys.push(...tableSchema.tabs.map((tab: any) => tab.key).filter(Boolean));
		}

		// Extract extra fields from table schema (TableBuilder.extraFields())
		const extraFields: Array<{ name: string }> = [];
		if (tableSchema.extraFields && Array.isArray(tableSchema.extraFields)) {
			for (const name of tableSchema.extraFields) {
				if (typeof name === 'string' && name) {
					extraFields.push({ name });
				}
			}
		}

		// Extract populate paths from table schema (TableBuilder.populate())
		const populatePaths: Array<{ name: string }> = [];
		if (tableSchema.populate && Array.isArray(tableSchema.populate)) {
			for (const item of tableSchema.populate) {
				const path = item?.path ?? item;
				if (typeof path === 'string' && path) {
					populatePaths.push({ name: path });
				}
			}
		}

		// Remove duplicate fields by name, keeping the first occurrence
		const uniqueFields = Array.from(new Map(fields.map(field => [field.name, field])).values());

		// Remove duplicate columns by name, keeping the first occurrence
		const uniqueColumns = Array.from(new Map(columns.map(column => [column.name, column])).values());

		structure.resources[slug] = {
			label: ResourceClass.getLabel(),
			pluralLabel: ResourceClass.getPluralLabel(),
			icon: ResourceClass.getIcon(),
			navigationGroup: ResourceClass.navigationGroup ?? 'Other',
			fields: uniqueFields,
			extraFields,
			populatePaths,
			columns: uniqueColumns,
			actions: actionNames,
			widgets: widgetNames,
			tabs: tabKeys,
		};
	}

	// Collect all pages with their blocks
	const pages = (panel as any)._pages;
	for (const [slug, PageClass] of pages) {
		const blockIdentifiers: string[] = [];

		// Skip PermissionsPage to avoid circular dependency
		// (PermissionsPage.blocks() calls getPanelStructureData which would call PermissionsPage.blocks() again)
		if (slug === 'permissions') {
			structure.pages[slug] = {
				label: PageClass.label,
				icon: PageClass.icon,
				blocks: [], // No blocks for permissions page
			};
			continue;
		}

		try {
			// Get page blocks to extract block identifiers
			// Call blocks() without context for structure extraction
			// Use a timeout to prevent hanging
			const blocksPromise = PageClass.blocks();
			const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));

			const blocks = (await Promise.race([blocksPromise, timeoutPromise])) as any[];

			const extractBlockIdentifiers = (blocks: any[]): void => {
				for (const block of blocks) {
					// Use title as the primary identifier
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
								`block-${block.type}`; // Fallback: block-type
						}
					}

					if (identifier) {
						blockIdentifiers.push(identifier);
					}

					// Handle nested blocks in tabs
					if (block.type === 'tabs' && block.tabs && Array.isArray(block.tabs)) {
						for (const tab of block.tabs) {
							if (tab.blocks && Array.isArray(tab.blocks)) {
								extractBlockIdentifiers(tab.blocks);
							}
						}
					}
				}
			};

			extractBlockIdentifiers(blocks.map((b: any) => b.toJSON()));
		} catch (error) {
			// If blocks() fails or times out, just continue without block identifiers
			console.warn(`Failed to extract blocks for page ${slug}:`, error);
		}

		structure.pages[slug] = {
			label: PageClass.label,
			icon: PageClass.icon,
			blocks: [...new Set(blockIdentifiers)], // Remove duplicates
		};
	}

	return structure;
}
