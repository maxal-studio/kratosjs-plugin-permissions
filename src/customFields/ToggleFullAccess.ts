import { Field } from '@maxal_studio/kratosjs';

/**
 * Payload for "Full access" button: paths to set and the value to apply.
 * The React component will set togglePaths, widgetPaths, tabPaths to true,
 * and fieldPaths, columnPaths to 'editable'.
 */
export interface ToggleFullAccessTargets {
	togglePaths: string[];
	fieldPaths: string[];
	columnPaths: string[];
	actionPaths: string[];
	widgetPaths: string[];
	tabPaths: string[];
}

/**
 * Custom field: button "Full access" that sets all permissions for this resource to enabled/editable.
 * - Access, Create, Read, Update, Delete → true
 * - All field and column permissions → editable
 * - All widgets and table tabs → true
 */
export class ToggleFullAccess extends Field {
	protected componentType: string = 'toggle-full-access';
	protected _targets: ToggleFullAccessTargets = {
		togglePaths: [],
		fieldPaths: [],
		columnPaths: [],
		actionPaths: [],
		widgetPaths: [],
		tabPaths: [],
	};

	targets(t: Partial<ToggleFullAccessTargets>): this {
		this._targets = { ...this._targets, ...t };
		return this;
	}

	toJSON() {
		const json = super.toJSON();
		json.targets = this._targets;
		return json;
	}

	static make(name: string): ToggleFullAccess {
		const instance = new this(name);
		instance.configure();
		return instance;
	}
}

export interface ToggleFullAccess extends Field {
	targets(t: Partial<ToggleFullAccessTargets>): this;
}
