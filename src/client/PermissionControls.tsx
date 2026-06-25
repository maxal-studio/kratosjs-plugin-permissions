import React from 'react';
import { cn, Icon, useTranslation } from '@maxal_studio/kratosjs-react';
import type { PermissionLevel } from './types';

const LEVELS: { value: PermissionLevel; label: string }[] = [
	{ value: 'hidden', label: 'Hidden' },
	{ value: 'readonly', label: 'View only' },
	{ value: 'editable', label: 'Edit' },
];

interface SegmentedPermissionControlProps {
	value: PermissionLevel;
	onChange: (value: PermissionLevel) => void;
	disabled?: boolean;
	compact?: boolean;
}

export function SegmentedPermissionControl({ value, onChange, disabled, compact }: SegmentedPermissionControlProps) {
	const { t } = useTranslation();
	return (
		<div
			className={cn(
				'inline-flex rounded-lg border border-border bg-input p-0.5',
				disabled && 'opacity-60 pointer-events-none',
			)}
			role="radiogroup">
			{LEVELS.map(level => (
				<button
					key={level.value}
					type="button"
					role="radio"
					aria-checked={value === level.value}
					disabled={disabled}
					onClick={() => onChange(level.value)}
					className={cn(
						'rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs',
						value === level.value
							? 'bg-accent text-accent-fg shadow-soft-sm'
							: 'text-fg-secondary hover:text-fg hover:bg-hover',
					)}>
					{t(`permissions:levels.${level.value}`)}
				</button>
			))}
		</div>
	);
}

interface BulkPermissionButtonsProps {
	onApply: (level: PermissionLevel) => void;
	disabled?: boolean;
	label?: string;
}

export function BulkPermissionButtons({ onApply, disabled, label }: BulkPermissionButtonsProps) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-wrap items-center gap-2">
			{label && <span className="text-xs font-medium text-fg-secondary">{label}</span>}
			{LEVELS.map(level => (
				<button
					key={level.value}
					type="button"
					disabled={disabled}
					onClick={() => onApply(level.value)}
					className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-fg-secondary transition-colors hover:bg-hover hover:text-fg disabled:opacity-60 disabled:cursor-not-allowed">
					{t(`permissions:bulk.${level.value}`)}
				</button>
			))}
		</div>
	);
}

interface PermissionToggleProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	hint?: string;
	inline?: boolean;
}

export function PermissionToggle({ label, checked, onChange, disabled, hint, inline }: PermissionToggleProps) {
	return (
		<div className={cn('flex items-center gap-3', inline ? '' : 'justify-between py-1')}>
			<div className="min-w-0">
				<span className="text-sm font-medium text-fg">{label}</span>
				{hint && <p className="text-xs text-fg-muted mt-0.5">{hint}</p>}
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				disabled={disabled}
				onClick={() => onChange(!checked)}
				className={cn(
					'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					checked ? 'bg-accent' : 'bg-gray-200 dark:bg-gray-700',
					disabled && 'opacity-60 cursor-not-allowed',
				)}>
				<span
					className={cn(
						'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
						checked ? 'translate-x-5' : 'translate-x-0',
					)}
				/>
			</button>
		</div>
	);
}

interface CheckboxPermissionGroupProps {
	items: { key: string; label: string }[];
	values: Record<string, boolean>;
	onChange: (key: string, checked: boolean) => void;
	onSelectAll: (checked: boolean) => void;
	disabled?: boolean;
	columns?: number;
}

export function CheckboxPermissionGroup({
	items,
	values,
	onChange,
	onSelectAll,
	disabled,
	columns = 3,
}: CheckboxPermissionGroupProps) {
	const { t } = useTranslation();
	const checkedCount = items.filter(item => values[item.key]).length;
	const allChecked = items.length > 0 && checkedCount === items.length;
	const someChecked = checkedCount > 0 && !allChecked;

	const colClass =
		columns === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

	return (
		<div className="space-y-3">
			<label className="inline-flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					checked={allChecked}
					ref={el => {
						if (el) el.indeterminate = someChecked;
					}}
					disabled={disabled || items.length === 0}
					onChange={() => onSelectAll(!allChecked)}
					className="h-4 w-4 rounded border-input-border text-accent focus:ring-ring"
				/>
				<span className="text-sm font-medium text-fg">{t('permissions:select_all')}</span>
			</label>
			<div className={cn('grid gap-2', colClass)}>
				{items.map(item => (
					<label key={item.key} className="inline-flex items-center gap-2 cursor-pointer min-w-0">
						<input
							type="checkbox"
							checked={Boolean(values[item.key])}
							disabled={disabled}
							onChange={e => onChange(item.key, e.target.checked)}
							className="h-4 w-4 shrink-0 rounded border-input-border text-accent focus:ring-ring"
						/>
						<span className="text-sm text-fg truncate" title={item.label}>
							{item.label}
						</span>
					</label>
				))}
			</div>
		</div>
	);
}

interface PermissionMatrixProps {
	rows: { key: string; label: string }[];
	getValue: (key: string) => PermissionLevel;
	onChange: (key: string, level: PermissionLevel) => void;
	onBulkApply: (level: PermissionLevel) => void;
	disabled?: boolean;
}

export function PermissionMatrix({ rows, getValue, onChange, onBulkApply, disabled }: PermissionMatrixProps) {
	const { t } = useTranslation();
	if (rows.length === 0) {
		return <p className="text-sm text-fg-muted">{t('permissions:matrix.no_items')}</p>;
	}

	return (
		<div className="space-y-3">
			<BulkPermissionButtons label={t('permissions:matrix.apply_to_all')} onApply={onBulkApply} disabled={disabled} />
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="min-w-full divide-y divide-border text-sm">
					<thead className="bg-muted/50">
						<tr>
							<th className="px-4 py-2.5 text-left font-medium text-fg-secondary">{t('permissions:matrix.name')}</th>
							<th className="px-4 py-2.5 text-left font-medium text-fg-secondary">{t('permissions:matrix.permission')}</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border bg-surface">
						{rows.map(row => (
							<tr key={row.key} className="hover:bg-hover/50">
								<td className="px-4 py-3 font-medium text-fg whitespace-nowrap">{row.label}</td>
								<td className="px-4 py-3">
									<SegmentedPermissionControl
										value={getValue(row.key)}
										onChange={level => onChange(row.key, level)}
										disabled={disabled}
										compact
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

interface SubPanelTabsProps {
	tabs: { id: string; label: string; count?: number }[];
	active: string;
	onChange: (id: string) => void;
}

export function SubPanelTabs({ tabs, active, onChange }: SubPanelTabsProps) {
	return (
		<div className="flex flex-wrap gap-1 border-b border-border mb-4">
			{tabs.map(tab => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onChange(tab.id)}
					className={cn(
						'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
						active === tab.id
							? 'border-accent text-accent'
							: 'border-transparent text-fg-secondary hover:text-fg hover:border-border',
					)}>
					{tab.label}
					{tab.count !== undefined && tab.count > 0 && (
						<span className="ml-1.5 text-xs text-fg-muted">({tab.count})</span>
					)}
				</button>
			))}
		</div>
	);
}

interface ExpandChevronProps {
	expanded: boolean;
}

export function ExpandChevron({ expanded }: ExpandChevronProps) {
	return <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} className="h-4 w-4 shrink-0 text-fg-muted" />;
}
