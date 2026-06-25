import { Page, getRequestContext, t } from '@maxal_studio/kratosjs';
import { PermissionsEditorBlock } from './PermissionsEditorBlock';

/**
 * Permissions page — renders a single custom block with the full permissions editor.
 */
export class PermissionsPage extends Page {
	static slug = 'permissions';

	static get label() {
		return t('permissions:page.label');
	}

	static icon = 'Shield';

	static get navigationGroup() {
		return t('permissions:navGroup');
	}

	static navigationSort = 100;
	static hidden = true;

	static async blocks() {
		const context = getRequestContext();
		const roleFromQuery = context?.query?.role as string | undefined;

		const block = PermissionsEditorBlock.make().columns(12);
		if (roleFromQuery) {
			block.initialRole(roleFromQuery);
		}

		return [block];
	}
}
