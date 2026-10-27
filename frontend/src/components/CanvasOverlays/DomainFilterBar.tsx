import React, { useMemo } from 'react';
import type { CoverageNode } from '../../types/graph';
import { getEffectiveNodeDomain, getDomainMeta } from '../../utils/graphScopes';
import { t } from '../../locales/koKR';

export interface DomainFilterBarProps {
  nodes: CoverageNode[];
  selectedDomain: string | null;
  isDomainIsolated: boolean;
  onSelectDomain: (domain: string | null) => void;
  onToggleDomainIsolate: () => void;
}

export const DomainFilterBar: React.FC<DomainFilterBarProps> = ({
  nodes,
  selectedDomain,
  isDomainIsolated,
  onSelectDomain,
  onToggleDomainIsolate,
}) => {
  const { domainGroups, unassignedCount, unassignedFailed } = useMemo(() => {
    const map = new Map<string, { count: number; hasFailed: boolean }>();
    let uCount = 0;
    let uFailed = false;

    for (const n of nodes) {
      const isGlobal = String(n.data?.properties?.is_global ?? n.data?.is_global ?? '').toLowerCase() === 'true';
      if (isGlobal) continue;
      // 상위(루트) 노드 단위로 카운트하되, 자식만 도메인이 있는 경우도 집계에 반영
      const dom = getEffectiveNodeDomain(n, nodes);
      const isFailed = n.data?.test_status === 'Failed';
      if (dom) {
        const entry = map.get(dom) || { count: 0, hasFailed: false };
        if (!n.parentId) entry.count += 1;
        else if (entry.count === 0) entry.count = 1;
        if (isFailed) entry.hasFailed = true;
        map.set(dom, entry);
      } else if (!n.parentId) {
        uCount += 1;
        if (isFailed) uFailed = true;
      }
    }

    const order = ['Battle', 'Growth', 'Economy', 'Social', 'System'];
    const entries = Array.from(map.entries()).sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });

    return {
      domainGroups: entries.map(([key, val]) => ({
        ...getDomainMeta(key),
        count: val.count,
        hasFailed: val.hasFailed,
      })),
      unassignedCount: uCount,
      unassignedFailed: uFailed,
    };
  }, [nodes]);

  if (domainGroups.length === 0 && !selectedDomain) {
    return null;
  }

  return (
    <div className="domain-filter-bar-panel">
      <div className="domain-filter-bar">
        <span className="domain-bar-label">
          {t.domain.barLabel}
          <span
            className="info-icon-wrapper"
            data-tooltip-id="app-tooltip"
            data-tooltip-place="bottom"
            data-tooltip-content={t.tooltip.domainBar}
          >
            ?
          </span>
        </span>
        <div className="domain-filter-chips">
          <button
            type="button"
            className={`domain-chip domain-chip-btn domain-chip-all${selectedDomain === null ? ' active' : ''}`}
            onClick={() => onSelectDomain(null)}
          >
            {t.domain.all}
          </button>
          {domainGroups.map(item => (
            <button
              key={item.key}
              type="button"
              className={`domain-chip domain-chip-btn domain-tone-${item.tone}${selectedDomain === item.key ? ' active' : ''}`}
              onClick={() => onSelectDomain(selectedDomain === item.key ? null : item.key)}
            >
              <span>{t.domain.chipCount(item.displayLabel, item.count)}</span>
              {item.hasFailed && <span className="domain-fault-dot domain-chip-fault-dot" />}
            </button>
          ))}
          {unassignedCount > 0 && (
            <button
              type="button"
              className={`domain-chip domain-chip-btn domain-tone-system${selectedDomain === '__unassigned__' ? ' active' : ''}`}
              onClick={() => onSelectDomain(selectedDomain === '__unassigned__' ? null : '__unassigned__')}
            >
              <span>{t.domain.chipCount(t.domain.unassigned, unassignedCount)}</span>
              {unassignedFailed && <span className="domain-fault-dot domain-chip-fault-dot" />}
            </button>
          )}
        </div>
        {selectedDomain !== null && (
          <button
            type="button"
            className={`domain-isolate-btn domain-isolate-toggle-btn${isDomainIsolated ? ' active' : ''}`}
            title={t.domain.isolateTitle}
            onClick={onToggleDomainIsolate}
          >
            {isDomainIsolated ? t.domain.isolateOn : t.domain.isolateOff}
          </button>
        )}
      </div>
    </div>
  );
};

