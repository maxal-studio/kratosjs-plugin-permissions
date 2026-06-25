import { FieldProps, ViewFieldWrapper, useTranslation } from '@maxal_studio/kratosjs-react';
import { useFormContext } from 'react-hook-form';

/**
 * Custom field: select that sets all target paths to the chosen value.
 * Used in Field Permissions and Column Permissions as a bulk helper.
 */
export default function SetAllField(props: FieldProps) {
	const { t } = useTranslation();
	const targetPaths: string[] = 'targetPaths' in props && Array.isArray(props.targetPaths) ? props.targetPaths : [];

	if (props.mode === 'view') {
		return (
			<ViewFieldWrapper label={props.label}>
				<span className="text-sm k-text-secondary">—</span>
			</ViewFieldWrapper>
		);
	}

	const { setValue } = useFormContext();

	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value as 'hidden' | 'readonly' | 'editable' | '';
		if (!value || targetPaths.length === 0) return;
		for (const path of targetPaths) {
			setValue(path, value, { shouldDirty: true });
		}
		// Reset this helper select so it can be used again
		setValue(props.name, '', { shouldDirty: false });
		e.target.value = '';
	};

	const options = [
		{ value: '', label: t('permissions:set_all_field.choose') },
		{ value: 'hidden', label: t('permissions:set_all_field.hidden') },
		{ value: 'readonly', label: t('permissions:set_all_field.readonly') },
		{ value: 'editable', label: t('permissions:set_all_field.editable') },
	] as const;

	return (
		<div className="mb-4">
			{props.label && <label className="block text-sm font-medium k-text mb-2">{props.label}</label>}
			<select
				className="w-full max-w-xs rounded-md border k-border k-input k-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kratos-ring)]"
				onChange={handleChange}
				defaultValue="">
				{options.map(opt => (
					<option key={opt.value || '_placeholder'} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
			{props.helperText && <p className="mt-1 text-sm k-text-secondary">{props.helperText}</p>}
		</div>
	);
}
