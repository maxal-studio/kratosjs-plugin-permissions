import { Block, SerializedBlock } from '@maxal_studio/kratosjs';

export interface SerializedPermissionsEditorBlock extends SerializedBlock {
	type: 'permissions-editor';
	initialRole?: string;
}

/**
 * Custom page block that renders the dedicated permissions editor UI.
 */
export class PermissionsEditorBlock extends Block {
	protected blockType = 'permissions-editor' as const;
	private _initialRole?: string;

	initialRole(role: string): this {
		this._initialRole = role;
		return this;
	}

	static make(): PermissionsEditorBlock {
		return new PermissionsEditorBlock();
	}

	toJSON(): SerializedPermissionsEditorBlock {
		return {
			type: 'permissions-editor',
			...(this._initialRole !== undefined && {
				initialRole: this._initialRole,
			}),
			...(this._title !== undefined && { title: this._title }),
			...(this._subtitle !== undefined && { subtitle: this._subtitle }),
			...(this._columns !== undefined && { columns: this._columns }),
		};
	}
}
