import { Field } from '@maxal_studio/kratosjs';

/**
 * Custom field: single checkbox that checks/unchecks all target paths (boolean checkboxes).
 * Used at the top of Actions, Widgets, and Table Tabs sections to toggle all at once.
 */
export class ToggleAll extends Field {
	protected componentType: string = 'toggle-all';
	protected _targetPaths: string[] = [];

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

	static make(name: string): ToggleAll {
		const instance = new this(name);
		instance.configure();
		return instance;
	}
}

export interface ToggleAll extends Field {
	targetPaths(paths: string[]): this;
}
