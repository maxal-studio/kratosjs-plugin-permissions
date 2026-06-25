import { Field } from '@maxal_studio/kratosjs';

/**
 * Custom field: select with Hidden / Read Only / Editable.
 * When changed, sets all targetPaths (form field names) to the selected value.
 * Used as a helper in Field Permissions and Column Permissions sections.
 */
export class SetAll extends Field {
	protected componentType: string = 'set-all';
	protected _targetPaths: string[] = [];

	/**
	 * Set the form paths to update when the select value changes (e.g. ['resources.users.fields.name', ...])
	 */
	targetPaths(paths: string[]): this {
		this._targetPaths = paths;
		return this;
	}

	toJSON() {
		const json = super.toJSON();
		if (this._targetPaths.length > 0) {
			json.targetPaths = this._targetPaths;
		}
		return json;
	}

	static make(name: string): SetAll {
		const instance = new this(name);
		instance.configure();
		return instance;
	}
}

export interface SetAll extends Field {
	targetPaths(paths: string[]): this;
}
