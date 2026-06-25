import React, { useState } from 'react';
import { Badge, BadgeVariant, Button, Card, cn, Icon, useTranslation } from '@maxal_studio/kratosjs-react';
import type { PermissionsData, ResourcePermission, ResourceStatus, StructureResource } from './types';
import {
	createDefaultResourcePermission,
	ensureResourcePermission,
	getColumnLevel,
	getFieldLevel,
	getResourceStatus,
	grantFullResourceAccess,
	resetResourceAccess,
	setAllColumnLevels,
	setAllFieldLevels,
} from './permissionUtils';
import {
	CheckboxPermissionGroup,
	ExpandChevron,
	PermissionMatrix,
	PermissionToggle,
	SubPanelTabs,
} from './PermissionControls';

const STATUS_BADGE: Record<ResourceStatus, { label: string; variant: BadgeVariant }> = {
	disabled: { label: 'Disabled', variant: 'neutral' },
	partial: { label: 'Partial', variant: 'warning' },
	enabled: { label: 'Enabled', variant: 'success' },
};

type ResourceSubPanel = 'fields' | 'columns' | 'actions' | 'widgets' | 'tabs';

interface ResourceCardProps {
	resourceSlug: string;
	resourceInfo: StructureResource;
	data: PermissionsData;
	onChange: (data: PermissionsData) => void;
	disabled?: boolean;
	defaultExpanded?: boolean;
}

export function ResourceCard({
	resourceSlug,
	resourceInfo,
	data,
	onChange,
	disabled,
	defaultExpanded = false,
}: ResourceCardProps) {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState(defaultExpanded);
	const [subPanel, setSubPanel] = useState<ResourceSubPanel>('fields');

	const perm = data.resources[resourceSlug] ?? createDefaultResourcePermission();
	const status = getResourceStatus(perm, resourceInfo);
	const badge = STATUS_BADGE[status];

	const updatePerm = (updater: (p: ResourcePermission) => void) => {
		const next = structuredClone(data);
		const p = ensureResourcePermission(next, resourceSlug);
		updater(p);
		onChange(next);
	};

	const columnRows = [
		...resourceInfo.columns.map(c => ({
			key: c.name,
			label: c.label || c.name,
		})),
		...resourceInfo.extraFields.map(c => ({
			key: c.name,
			label: c.label || c.name,
		})),
	];

	const subTabs: { id: ResourceSubPanel; label: string; count?: number }[] = [];
	if (resourceInfo.fields.length > 0) {
		subTabs.push({
			id: 'fields',
			label: t('permissions:resource_card.fields'),
			count: resourceInfo.fields.length,
		});
	}
	if (columnRows.length > 0) {
		subTabs.push({ id: 'columns', label: t('permissions:resource_card.columns'), count: columnRows.length });
	}
	if (resourceInfo.actions.length > 0) {
		subTabs.push({
			id: 'actions',
			label: t('permissions:resource_card.actions'),
			count: resourceInfo.actions.length,
		});
	}
	if (resourceInfo.widgets.length > 0) {
		subTabs.push({
			id: 'widgets',
			label: t('permissions:resource_card.widgets'),
			count: resourceInfo.widgets.length,
		});
	}
	if (resourceInfo.tabs.length > 0) {
		subTabs.push({
			id: 'tabs',
			label: t('permissions:resource_card.tabs'),
			count: resourceInfo.tabs.length,
		});
	}

	const activeSubPanel = subTabs.some(t => t.id === subPanel) ? subPanel : subTabs[0]?.id;

	return (
		<Card padding={false} className="overflow-hidden">
			{/* Collapsed header row */}
			<button
				type="button"
				onClick={() => setExpanded(v => !v)}
				className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-hover/50 transition-colors">
				<ExpandChevron expanded={expanded} />
				{resourceInfo.icon && <Icon name={resourceInfo.icon} className="h-5 w-5 shrink-0 text-fg-muted" />}
				<span className="flex-1 min-w-0 font-medium text-fg truncate">
					{resourceInfo.label || resourceSlug}
				</span>
				<Badge variant={badge.variant}>{t(`permissions:${status}`)}</Badge>
				{!expanded && perm.access && (
					<span className="hidden sm:flex items-center gap-2 text-xs text-fg-muted shrink-0">
						{perm.create && <span>C</span>}
						{perm.read && <span>R</span>}
						{perm.update && <span>U</span>}
						{perm.delete && <span>D</span>}
					</span>
				)}
			</button>

			{expanded && (
				<div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
					{/* Quick actions toolbar */}
					<div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 border border-border px-3 py-3">
						<PermissionToggle
							label={t('permissions:resource_card.resource_access')}
							checked={perm.access}
							disabled={disabled}
							onChange={checked =>
								updatePerm(p => {
									p.access = checked;
									if (checked) {
										p.read = true;
									}
								})
							}
						/>
						<div className="flex flex-wrap gap-2 ml-auto">
							<Button
								size="sm"
								variant="secondary"
								disabled={disabled}
								onClick={() => updatePerm(p => grantFullResourceAccess(p, resourceInfo))}>
								{t('permissions:resource_card.grant_full_access')}
							</Button>
							<Button
								size="sm"
								variant="ghost"
								disabled={disabled}
								onClick={() => updatePerm(p => resetResourceAccess(p, resourceInfo))}>
								{t('permissions:resource_card.reset_to_defaults')}
							</Button>
						</div>
					</div>

					{/* CRUD toggles — always visible when expanded */}
					<div
						className={cn(
							'grid grid-cols-2 sm:grid-cols-4 gap-3',
							!perm.access && 'opacity-50 pointer-events-none',
						)}>
						<PermissionToggle
							label={t('permissions:crud.create')}
							inline
							checked={perm.create}
							disabled={disabled || !perm.access}
							onChange={v =>
								updatePerm(p => {
									p.create = v;
								})
							}
						/>
						<PermissionToggle
							label={t('permissions:crud.read')}
							inline
							checked={perm.read}
							disabled={disabled || !perm.access}
							onChange={v =>
								updatePerm(p => {
									p.read = v;
								})
							}
						/>
						<PermissionToggle
							label={t('permissions:crud.update')}
							inline
							checked={perm.update}
							disabled={disabled || !perm.access}
							onChange={v =>
								updatePerm(p => {
									p.update = v;
								})
							}
						/>
						<PermissionToggle
							label={t('permissions:crud.delete')}
							inline
							checked={perm.delete}
							disabled={disabled || !perm.access}
							onChange={v =>
								updatePerm(p => {
									p.delete = v;
								})
							}
						/>
					</div>

					{/* Sub-panels */}
					{subTabs.length > 0 && (
						<div className={cn(!perm.access && 'opacity-50 pointer-events-none')}>
							<SubPanelTabs
								tabs={subTabs}
								active={activeSubPanel || 'fields'}
								onChange={id => setSubPanel(id as ResourceSubPanel)}
							/>

							{activeSubPanel === 'fields' && (
								<PermissionMatrix
									rows={resourceInfo.fields.map(f => ({
										key: f.name,
										label: f.label || f.name,
									}))}
									getValue={key => getFieldLevel(perm, key)}
									onChange={(key, level) =>
										updatePerm(p => {
											if (!p.fields) p.fields = {};
											p.fields[key] = level;
										})
									}
									onBulkApply={level =>
										updatePerm(p =>
											setAllFieldLevels(
												p,
												resourceInfo.fields.map(f => f.name),
												level,
											),
										)
									}
									disabled={disabled || !perm.access}
								/>
							)}

							{activeSubPanel === 'columns' && (
								<PermissionMatrix
									rows={columnRows}
									getValue={key => getColumnLevel(perm, key)}
									onChange={(key, level) =>
										updatePerm(p => {
											if (!p.columns) p.columns = {};
											p.columns[key] = level;
										})
									}
									onBulkApply={level =>
										updatePerm(p =>
											setAllColumnLevels(
												p,
												columnRows.map(r => r.key),
												level,
											),
										)
									}
									disabled={disabled || !perm.access}
								/>
							)}

							{activeSubPanel === 'actions' && (
								<CheckboxPermissionGroup
									items={resourceInfo.actions.map(a => ({
										key: a,
										label: a,
									}))}
									values={perm.actions || {}}
									onChange={(key, checked) =>
										updatePerm(p => {
											if (!p.actions) p.actions = {};
											p.actions[key] = checked;
										})
									}
									onSelectAll={checked =>
										updatePerm(p => {
											if (!p.actions) p.actions = {};
											for (const a of resourceInfo.actions) {
												p.actions[a] = checked;
											}
										})
									}
									disabled={disabled || !perm.access}
									columns={4}
								/>
							)}

							{activeSubPanel === 'widgets' && (
								<CheckboxPermissionGroup
									items={resourceInfo.widgets.map(w => ({
										key: w,
										label: w,
									}))}
									values={perm.widgets || {}}
									onChange={(key, checked) =>
										updatePerm(p => {
											if (!p.widgets) p.widgets = {};
											p.widgets[key] = checked;
										})
									}
									onSelectAll={checked =>
										updatePerm(p => {
											if (!p.widgets) p.widgets = {};
											for (const w of resourceInfo.widgets) {
												p.widgets[w] = checked;
											}
										})
									}
									disabled={disabled || !perm.access}
									columns={4}
								/>
							)}

							{activeSubPanel === 'tabs' && (
								<CheckboxPermissionGroup
									items={resourceInfo.tabs.map(t => ({ key: t, label: t }))}
									values={perm.tabs || {}}
									onChange={(key, checked) =>
										updatePerm(p => {
											if (!p.tabs) p.tabs = {};
											p.tabs[key] = checked;
										})
									}
									onSelectAll={checked =>
										updatePerm(p => {
											if (!p.tabs) p.tabs = {};
											for (const t of resourceInfo.tabs) {
												p.tabs[t] = checked;
											}
										})
									}
									disabled={disabled || !perm.access}
									columns={4}
								/>
							)}
						</div>
					)}
				</div>
			)}
		</Card>
	);
}
