import { FieldProps, ViewFieldWrapper, Icon, useTranslation } from '@maxal_studio/kratosjs-react';
import { useFormContext } from 'react-hook-form';

interface ToggleFullAccessTargets {
	togglePaths: string[];
	fieldPaths: string[];
	columnPaths: string[];
	actionPaths: string[];
	widgetPaths: string[];
	tabPaths: string[];
}

/**
 * Custom field: "Full access" / "Remove full access" buttons for resource permissions.
 */
export default function ToggleFullAccessField(props: FieldProps) {
	const { t } = useTranslation();
	const targets: ToggleFullAccessTargets =
		'targets' in props && props.targets && typeof props.targets === 'object'
			? (props.targets as ToggleFullAccessTargets)
			: {
					togglePaths: [],
					fieldPaths: [],
					columnPaths: [],
					widgetPaths: [],
					actionPaths: [],
					tabPaths: [],
				};

	if (props.mode === 'view') {
		return (
			<ViewFieldWrapper label={props.label}>
				<span className="text-sm k-text-secondary">—</span>
			</ViewFieldWrapper>
		);
	}

	const { setValue } = useFormContext();

	const grantFullAccess = () => {
		for (const path of targets.togglePaths) setValue(path, true, { shouldDirty: true });
		for (const path of targets.widgetPaths) setValue(path, true, { shouldDirty: true });
		for (const path of targets.tabPaths) setValue(path, true, { shouldDirty: true });
		for (const path of targets.actionPaths) setValue(path, true, { shouldDirty: true });
		for (const path of targets.fieldPaths) setValue(path, 'editable', { shouldDirty: true });
		for (const path of targets.columnPaths) setValue(path, 'editable', { shouldDirty: true });
	};

	const removeFullAccess = () => {
		for (const path of targets.togglePaths) setValue(path, false, { shouldDirty: true });
		for (const path of targets.widgetPaths) setValue(path, false, { shouldDirty: true });
		for (const path of targets.tabPaths) setValue(path, false, { shouldDirty: true });
		for (const path of targets.actionPaths) setValue(path, false, { shouldDirty: true });
		for (const path of targets.fieldPaths) setValue(path, 'hidden', { shouldDirty: true });
		for (const path of targets.columnPaths) setValue(path, 'hidden', { shouldDirty: true });
	};

	const hasAny =
		targets.togglePaths.length > 0 ||
		targets.fieldPaths.length > 0 ||
		targets.columnPaths.length > 0 ||
		targets.actionPaths.length > 0 ||
		targets.widgetPaths.length > 0 ||
		targets.tabPaths.length > 0;

	return (
		<div className="mb-4">
			<div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-4 shadow-sm">
				{props.label && (
					<p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">{props.label}</p>
				)}
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="button"
						onClick={grantFullAccess}
						disabled={!hasAny}
						className="inline-flex items-center gap-2 rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[rgb(4,120,87)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
						style={{ backgroundColor: 'rgb(5 150 105)' }}
						aria-label={t('permissions:toggle_full_access.grant')}>
						<Icon name="CheckCircle" className="h-4 w-4 shrink-0" />
						{t('permissions:toggle_full_access.grant')}
					</button>
					<button
						type="button"
						onClick={removeFullAccess}
						disabled={!hasAny}
						className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 shadow-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
						aria-label={t('permissions:toggle_full_access.remove')}>
						<Icon name="XCircle" className="h-4 w-4 shrink-0" />
						{t('permissions:toggle_full_access.remove')}
					</button>
				</div>
				{props.helperText && (
					<p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{props.helperText}</p>
				)}
			</div>
		</div>
	);
}
