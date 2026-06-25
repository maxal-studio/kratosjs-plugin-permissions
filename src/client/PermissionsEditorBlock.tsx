import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
	authenticatedFetch,
	Badge,
	Button,
	Card,
	cn,
	CustomBlockComponentProps,
	EmptyState,
	ErrorAlert,
	Icon,
	Input,
	Label,
	Select,
	Spinner,
	useConfirm,
	useToast,
	useTranslation,
} from '@maxal_studio/kratosjs-react';
import type { EditorTab, PanelStructure, PermissionsData, RoleInfo } from './types';
import { countEnabledPages, countEnabledResources, groupResourcesByNav, GROUP_ICONS } from './permissionUtils';
import { PageCard } from './PageCard';
import { ResourceCard } from './ResourceCard';
import { ExpandChevron } from './PermissionControls';

async function fetchJson<T>(url: string, apiBaseUrl: string, init?: RequestInit): Promise<T> {
	const response = await authenticatedFetch(url, init ?? {}, apiBaseUrl);
	if (!response.ok) {
		const err = await response.json().catch(() => ({}));
		throw new Error(err.message || err.error || response.statusText);
	}
	return response.json();
}

export default function PermissionsEditorBlock({ block, apiBaseUrl }: CustomBlockComponentProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const confirm = useConfirm();
	const toast = useToast();
	const { t } = useTranslation();

	const roleFromUrl = searchParams.get('role') || block.initialRole || '';
	const [selectedRole, setSelectedRole] = useState(roleFromUrl);
	const [pickerRole, setPickerRole] = useState('');

	const [roles, setRoles] = useState<RoleInfo[]>([]);
	const [structure, setStructure] = useState<PanelStructure | null>(null);
	const [data, setData] = useState<PermissionsData | null>(null);
	const [savedSnapshot, setSavedSnapshot] = useState<string>('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [activeTab, setActiveTab] = useState<EditorTab>('resources');
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

	const activeRoleInfo = roles.find(r => r.role === selectedRole);
	const isDirty = data ? JSON.stringify(data) !== savedSnapshot : false;

	// Load roles + structure once
	useEffect(() => {
		if (!apiBaseUrl) return;
		let cancelled = false;

		(async () => {
			try {
				const [rolesData, structureData] = await Promise.all([
					fetchJson<RoleInfo[]>(`${apiBaseUrl}/permissions/roles`, apiBaseUrl),
					fetchJson<PanelStructure>(`${apiBaseUrl}/permissions/structure`, apiBaseUrl),
				]);
				if (cancelled) return;
				setRoles(rolesData);
				setStructure(structureData);
			} catch (err: any) {
				if (!cancelled) setError(err.message || 'Failed to load permissions editor');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [apiBaseUrl]);

	// Load permissions when role changes
	useEffect(() => {
		if (!apiBaseUrl || !selectedRole) {
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		(async () => {
			try {
				const permData = await fetchJson<PermissionsData>(
					`${apiBaseUrl}/permissions/data?role=${encodeURIComponent(selectedRole)}`,
					apiBaseUrl,
				);
				if (cancelled) return;
				setData(permData);
				setSavedSnapshot(JSON.stringify(permData));
			} catch (err: any) {
				if (!cancelled) setError(err.message || 'Failed to load permissions');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [apiBaseUrl, selectedRole]);

	// Sync URL when role is set
	useEffect(() => {
		if (selectedRole && searchParams.get('role') !== selectedRole) {
			navigate(`/page/permissions?role=${encodeURIComponent(selectedRole)}`, {
				replace: true,
			});
		}
	}, [selectedRole, navigate, searchParams]);

	const resourceSlugs = useMemo(() => (structure ? Object.keys(structure.resources) : []), [structure]);
	const pageSlugs = useMemo(() => (structure ? Object.keys(structure.pages) : []), [structure]);

	const filteredResourceGroups = useMemo(() => {
		if (!structure) return new Map<string, [string, (typeof structure.resources)[string]][]>();
		const groups = groupResourcesByNav(structure.resources);
		if (!search.trim()) return groups;

		const q = search.toLowerCase();
		const filtered = new Map<string, [string, (typeof structure.resources)[string]][]>();
		for (const [group, entries] of groups) {
			const matches = entries.filter(
				([slug, info]) =>
					info.label.toLowerCase().includes(q) ||
					slug.toLowerCase().includes(q) ||
					group.toLowerCase().includes(q),
			);
			if (matches.length > 0) filtered.set(group, matches);
		}
		return filtered;
	}, [structure, search]);

	const filteredPages = useMemo(() => {
		if (!structure) return [];
		const q = search.toLowerCase().trim();
		return Object.entries(structure.pages).filter(([slug, info]) => {
			if (!q) return true;
			return info.label.toLowerCase().includes(q) || slug.toLowerCase().includes(q);
		});
	}, [structure, search]);

	const handleRoleChange = useCallback(
		async (newRole: string) => {
			if (newRole === selectedRole) return;
			if (isDirty) {
				const ok = await confirm({
					title: t('permissions:editor.unsaved_changes.title'),
					message: t('permissions:editor.unsaved_changes.message'),
					confirmLabel: t('permissions:editor.unsaved_changes.confirm'),
					danger: true,
				});
				if (!ok) return;
			}
			setSelectedRole(newRole);
		},
		[selectedRole, isDirty, confirm, t],
	);

	const handleSave = async () => {
		if (!apiBaseUrl || !data || !selectedRole) return;
		setSaving(true);
		setError(null);
		try {
			const response = await authenticatedFetch(
				`${apiBaseUrl}/permissions/save?role=${encodeURIComponent(selectedRole)}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						role: selectedRole,
						resources: data.resources,
						pages: data.pages,
					}),
				},
				apiBaseUrl,
			);
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.message || 'Failed to save permissions');
			}
			const saved: PermissionsData = {
				role: selectedRole,
				resources: result.resources ?? data.resources,
				pages: result.pages ?? data.pages,
			};
			setData(saved);
			setSavedSnapshot(JSON.stringify(saved));
			toast.success(t('permissions:editor.saved'));
		} catch (err: any) {
			setError(err.message || 'Failed to save permissions');
		} finally {
			setSaving(false);
		}
	};

	const startEditing = () => {
		if (!pickerRole) return;
		setSelectedRole(pickerRole);
	};

	// ── Role picker (no role selected) ──────────────────────────────────────
	if (!selectedRole) {
		return (
			<div className="max-w-lg mx-auto py-8">
				<Card>
					<div className="flex items-center gap-3 mb-6">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft">
							<Icon name="Shield" className="h-5 w-5 text-accent" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-fg">{t('permissions:editor.picker.title')}</h2>
							<p className="text-sm text-fg-secondary">{t('permissions:editor.picker.description')}</p>
						</div>
					</div>

					{error && <ErrorAlert message={error} className="mb-4" />}

					<div className="space-y-4">
						<div>
							<Label htmlFor="role-picker">{t('permissions:editor.picker.role')}</Label>
							<Select
								id="role-picker"
								value={pickerRole}
								onChange={e => setPickerRole(e.target.value)}
								className="mt-1.5">
								<option value="">{t('permissions:editor.picker.select_role')}</option>
								{roles.map(r => (
									<option key={r.role} value={r.role}>
										{r.name}
									</option>
								))}
							</Select>
						</div>
						<Button
							variant="primary"
							disabled={!pickerRole || loading}
							onClick={startEditing}
							className="w-full sm:w-auto">
							{t('permissions:editor.picker.continue')}
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	if (loading || !structure || !data) {
		return (
			<div className="flex items-center justify-center min-h-[320px]">
				<Spinner size="lg" />
			</div>
		);
	}

	const enabledResources = countEnabledResources(data, resourceSlugs);
	const enabledPages = countEnabledPages(data, pageSlugs);

	const saveButton = (
		<Button variant="primary" loading={saving} disabled={!isDirty || saving} onClick={handleSave}>
			{t('permissions:editor.save')}
		</Button>
	);

	return (
		<div className="space-y-4">
			{/* Sticky header */}
			<div className="sticky top-0 z-20 -mx-1 px-1 pb-4 mb-2 bg-bg/95 backdrop-blur-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between pt-1">
					<div className="min-w-0 flex-1">
						<h1 className="text-xl font-semibold text-fg">{t('permissions:editor.title')}</h1>
						{activeRoleInfo && (
							<p className="text-sm text-fg-secondary mt-0.5 truncate">
								{activeRoleInfo.name}
								{activeRoleInfo.description ? ` — ${activeRoleInfo.description}` : ''}
							</p>
						)}
						<div className="flex flex-wrap items-center gap-2 mt-2">
							<Badge variant="neutral">
								{t('permissions:editor.resources_count', { count: enabledResources, total: resourceSlugs.length })}
							</Badge>
							<Badge variant="neutral">
								{t('permissions:editor.pages_count', { count: enabledPages, total: pageSlugs.length })}
							</Badge>
							{isDirty && <Badge variant="warning">{t('permissions:editor.unsaved_changes_badge')}</Badge>}
						</div>
					</div>
					<div className="flex items-center justify-end gap-2 w-full lg:w-auto lg:ml-auto shrink-0">
						<Select
							value={selectedRole}
							onChange={e => handleRoleChange(e.target.value)}
							aria-label="Select role"
							className="w-full max-w-48 sm:max-w-none sm:w-44">
							{roles.map(r => (
								<option key={r.role} value={r.role}>
									{r.name}
								</option>
							))}
						</Select>
						{saveButton}
					</div>
				</div>

				<div className="mt-4 flex flex-col sm:flex-row gap-3">
					<div className="relative flex-1 min-w-0">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted pointer-events-none"
							aria-hidden
						/>
						<Input
							type="search"
							placeholder={t('permissions:editor.search_placeholder', { tab: activeTab === 'resources' ? t('permissions:editor.resources') : t('permissions:editor.pages') })}
							value={search}
							onChange={e => setSearch(e.target.value)}
							className="pl-10"
							aria-label={t('permissions:editor.search_placeholder', { tab: activeTab === 'resources' ? t('permissions:editor.resources') : t('permissions:editor.pages') })}
						/>
					</div>
					<div className="inline-flex rounded-lg border border-border bg-input p-0.5 shrink-0">
						{(['resources', 'pages'] as EditorTab[]).map(tab => (
							<button
								key={tab}
								type="button"
								onClick={() => setActiveTab(tab)}
								className={cn(
									'px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize',
									activeTab === tab
										? 'bg-accent text-accent-fg shadow-soft-sm'
										: 'text-fg-secondary hover:text-fg hover:bg-hover',
								)}>
								{t(`permissions:editor.${tab}`)}
							</button>
						))}
					</div>
				</div>
			</div>

			{error && <ErrorAlert message={error} />}

			{/* Resources tab */}
			{activeTab === 'resources' && (
				<div className="space-y-6">
					{filteredResourceGroups.size === 0 ? (
						<EmptyState
							title={t('permissions:editor.empty.resources.title')}
							description={
								search ? t('permissions:editor.empty.search_desc') : t('permissions:editor.empty.resources.desc')
							}
						/>
					) : (
						Array.from(filteredResourceGroups.entries()).map(([groupName, entries]) => {
							const groupKey = groupName.replace(/\s+/g, '_').toLowerCase();
							const isCollapsed = collapsedGroups[groupKey] ?? false;
							const groupIcon = GROUP_ICONS[groupName] ?? 'Database';

							return (
								<div key={groupKey}>
									<button
										type="button"
										onClick={() =>
											setCollapsedGroups(prev => ({
												...prev,
												[groupKey]: !isCollapsed,
											}))
										}
										className="flex items-center gap-2 mb-3 text-left w-full group">
										<ExpandChevron expanded={!isCollapsed} />
										<Icon name={groupIcon} className="h-4 w-4 text-fg-muted" />
										<span className="text-sm font-semibold text-fg uppercase tracking-wide">
											{groupName}
										</span>
										<span className="text-xs text-fg-muted">({entries.length})</span>
									</button>

									{!isCollapsed && (
										<div className="space-y-2 pl-2">
											{entries.map(([slug, info]) => (
												<ResourceCard
													key={slug}
													resourceSlug={slug}
													resourceInfo={info}
													data={data}
													onChange={setData}
												/>
											))}
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			)}

			{/* Pages tab */}
			{activeTab === 'pages' && (
				<div className="space-y-2">
					{filteredPages.length === 0 ? (
						<EmptyState
							title={t('permissions:editor.empty.pages.title')}
							description={
								search
									? t('permissions:editor.empty.search_desc')
									: t('permissions:editor.empty.pages.desc')
							}
						/>
					) : (
						filteredPages.map(([slug, info]) => (
							<PageCard key={slug} pageSlug={slug} pageInfo={info} data={data} onChange={setData} />
						))
					)}
				</div>
			)}

			<div className="flex justify-end pt-6 mt-2 border-t border-border">{saveButton}</div>
		</div>
	);
}
