import React, { useState } from 'react';
import { Badge, Button, Card, cn, Icon, useTranslation } from '@maxal_studio/kratosjs-react';
import type { PagePermission, PermissionsData, StructurePage } from './types';
import { CheckboxPermissionGroup, ExpandChevron, PermissionToggle } from './PermissionControls';

interface PageCardProps {
	pageSlug: string;
	pageInfo: StructurePage;
	data: PermissionsData;
	onChange: (data: PermissionsData) => void;
	disabled?: boolean;
}

export function PageCard({ pageSlug, pageInfo, data, onChange, disabled }: PageCardProps) {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState(false);

	const perm = data.pages[pageSlug] ?? { access: false, blocks: {} };

	const updatePerm = (updater: (p: PagePermission) => void) => {
		const next = structuredClone(data);
		if (!next.pages[pageSlug]) {
			next.pages[pageSlug] = { access: false, blocks: {} };
		}
		updater(next.pages[pageSlug]);
		onChange(next);
	};

	const grantFullAccess = () => {
		updatePerm(p => {
			p.access = true;
			if (!p.blocks) p.blocks = {};
			for (const block of pageInfo.blocks) {
				p.blocks[block] = true;
			}
		});
	};

	const resetAccess = () => {
		updatePerm(p => {
			p.access = false;
			if (!p.blocks) p.blocks = {};
			for (const block of pageInfo.blocks) {
				p.blocks[block] = false;
			}
		});
	};

	return (
		<Card padding={false} className="overflow-hidden">
			<button
				type="button"
				onClick={() => setExpanded(v => !v)}
				className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-hover/50 transition-colors">
				<ExpandChevron expanded={expanded} />
				{pageInfo.icon && <Icon name={pageInfo.icon} className="h-5 w-5 shrink-0 text-fg-muted" />}
				<span className="flex-1 min-w-0 font-medium text-fg truncate">{pageInfo.label || pageSlug}</span>
				<Badge variant={perm.access ? 'success' : 'neutral'}>
					{perm.access ? t('permissions:enabled') : t('permissions:disabled')}
				</Badge>
			</button>

			{expanded && (
				<div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
					<div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 border border-border px-3 py-3">
						<PermissionToggle
							label={t('permissions:page_card.page_access')}
							checked={perm.access}
							disabled={disabled}
							onChange={checked =>
								updatePerm(p => {
									p.access = checked;
								})
							}
						/>
						<div className="flex flex-wrap gap-2 ml-auto">
							<Button size="sm" variant="secondary" disabled={disabled} onClick={grantFullAccess}>
								{t('permissions:page_card.grant_full_access')}
							</Button>
							<Button size="sm" variant="ghost" disabled={disabled} onClick={resetAccess}>
								{t('permissions:page_card.reset_to_defaults')}
							</Button>
						</div>
					</div>

					{pageInfo.blocks.length > 0 && (
						<div className={cn(!perm.access && 'opacity-50 pointer-events-none')}>
							<p className="text-sm font-medium text-fg mb-2">{t('permissions:page_card.blocks')}</p>
							<CheckboxPermissionGroup
								items={pageInfo.blocks.map(b => ({ key: b, label: b }))}
								values={perm.blocks || {}}
								onChange={(key, checked) =>
									updatePerm(p => {
										if (!p.blocks) p.blocks = {};
										p.blocks[key] = checked;
									})
								}
								onSelectAll={checked =>
									updatePerm(p => {
										if (!p.blocks) p.blocks = {};
										for (const b of pageInfo.blocks) {
											p.blocks[b] = checked;
										}
									})
								}
								disabled={disabled || !perm.access}
								columns={3}
							/>
						</div>
					)}
				</div>
			)}
		</Card>
	);
}
