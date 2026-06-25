import { FieldProps, ViewFieldWrapper, useTranslation } from '@maxal_studio/kratosjs-react';
import { useFormContext } from 'react-hook-form';
import { useEffect, useRef } from 'react';

function getValueByPath(obj: unknown, path: string): unknown {
	return path.split('.').reduce((acc: unknown, key) => (acc as Record<string, unknown>)?.[key], obj);
}

/**
 * Custom field: one checkbox that checks/unchecks all target paths together.
 * Reflects checked when all are true, unchecked when all false, indeterminate when mixed.
 */
export default function ToggleAllField(props: FieldProps) {
	const { t } = useTranslation();
	const targetPaths: string[] = 'targetPaths' in props && Array.isArray(props.targetPaths) ? props.targetPaths : [];
	const inputRef = useRef<HTMLInputElement>(null);

	if (props.mode === 'view') {
		return (
			<ViewFieldWrapper label={props.label}>
				<span className="text-sm k-text-secondary">—</span>
			</ViewFieldWrapper>
		);
	}

	const { setValue, watch } = useFormContext();
	const formValues = watch();

	const values = targetPaths.map(p => getValueByPath(formValues, p) === true);
	const allChecked = targetPaths.length > 0 && values.every(Boolean);
	const someChecked = values.some(Boolean);
	const indeterminate = someChecked && !allChecked;

	useEffect(() => {
		const el = inputRef.current;
		if (el) el.indeterminate = indeterminate;
	}, [indeterminate]);

	const handleChange = () => {
		const next = !allChecked;
		for (const path of targetPaths) {
			setValue(path, next, { shouldDirty: true });
		}
	};

	if (targetPaths.length === 0) {
		return null;
	}

	return (
		<div className="mb-4">
			<label className="inline-flex items-center gap-2 cursor-pointer">
				<input
					ref={inputRef}
					type="checkbox"
					checked={allChecked}
					onChange={handleChange}
					className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-[var(--kratos-accent)] focus:ring-[var(--kratos-ring)]"
				/>
				<span className="text-sm font-medium k-text">{props.label || t('permissions:toggle_all')}</span>
			</label>
			{props.helperText && <p className="mt-1 text-xs k-text-secondary ml-6">{props.helperText}</p>}
		</div>
	);
}
