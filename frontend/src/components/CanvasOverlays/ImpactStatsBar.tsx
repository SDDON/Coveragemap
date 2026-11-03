import React, { useState, useMemo } from 'react';
import { ActiveImpactItem, CoverageNode, ImpactFilterOperator } from '../../types';
import { t } from '../../locales/koKR';

export interface ImpactStatsBarProps {
  activeImpacts: ActiveImpactItem[];
  nodes: CoverageNode[];
  operator: ImpactFilterOperator;
  onChangeOperator: (operator: ImpactFilterOperator) => void;
  onRemoveImpact: (globalNodeId: string) => void;
  onDeactivate: () => void;
  isIsolated?: boolean;
  onToggleIsolation?: () => void;
  onSelectNodeFromList?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

const STATUS_PRIORITY: Record<string, number> = {
  Failed: 0,
  Blocked: 1,
  Untested: 2,
  Passed: 3,
};

type ImpactStatusFilter = 'all' | 'Passed' | 'Failed' | 'Untested';

/* Impact Overlay Stats Bar (Multi-Global 5-Slot, OR/AND Filter, Isolation Toggle & Node Navigator Drawer) */
export const ImpactStatsBar: React.FC<ImpactStatsBarProps> = ({
  activeImpacts,
  nodes,
  operator,
  onChangeOperator,
  onRemoveImpact,
  onDeactivate,
  isIsolated = false,
  onToggleIsolation,
  onSelectNodeFromList,
  selectedNodeId,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ImpactStatusFilter>('all');

  const matchedIds = useMemo(() => {
    if (activeImpacts.length === 0) return new Set<string>();
    if (activeImpacts.length === 1) {
      return activeImpacts[0].connectedIds;
    }
    if (operator === 'AND') {
      const [first, ...rest] = activeImpacts;
      return new Set(
        Array.from(first.connectedIds).filter(id => rest.every(item => item.connectedIds.has(id)))
      );
    }
    const union = new Set<string>();
    activeImpacts.forEach(item => item.connectedIds.forEach(id => union.add(id)));
    return union;
  }, [activeImpacts, operator]);

  const matchedNodes = useMemo(() => {
    const list: CoverageNode[] = [];
    matchedIds.forEach(id => {
      const nd = nodes.find(n => n.id === id);
      if (nd) list.push(nd);
    });
    list.sort((a, b) => {
      const stA = STATUS_PRIORITY[String(a.data?.test_status || 'Untested')] ?? 2;
      const stB = STATUS_PRIORITY[String(b.data?.test_status || 'Untested')] ?? 2;
      if (stA !== stB) return stA - stB;
      return String(a.data?.name || '').localeCompare(String(b.data?.name || ''));
    });
    return list;
  }, [matchedIds, nodes]);

  const filteredDrawerNodes = useMemo(() => {
    if (statusFilter === 'all') return matchedNodes;
    return matchedNodes.filter(nd => {
      const st = String(nd.data?.test_status || 'Untested');
      if (statusFilter === 'Untested') {
        return st !== 'Passed' && st !== 'Failed';
      }
      return st === statusFilter;
    });
  }, [matchedNodes, statusFilter]);

  if (activeImpacts.length === 0) return null;

  const stats = matchedNodes.length > 0
    ? (() => {
        let Passed = 0;
        let Failed = 0;
        let Untested = 0;
        matchedNodes.forEach(nd => {
          const st = nd.data?.test_status || 'Untested';
          if (st === 'Passed') Passed += 1;
          else if (st === 'Failed') Failed += 1;
          else Untested += 1;
        });
        return { Passed, Failed, Untested };
      })()
    : activeImpacts[0].stats;
  const total = activeImpacts.length === 1 ? activeImpacts[0].total : matchedIds.size;

  const handleToggleStatusFilter = (target: 'Passed' | 'Failed' | 'Untested') => {
    setStatusFilter(prev => {
      const next = prev === target ? 'all' : target;
      if (next !== 'all') {
        setIsDrawerOpen(true);
      }
      return next;
    });
  };

  return (
    <div
      className="impact-stats-bar"
      style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-floating-panel)' }}
    >
      {isDrawerOpen && (
        <div
          className="impact-navigator-drawer"
          style={{ zIndex: 'var(--z-floating-panel)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="impact-navigator-header">
            <span>
              {t.impact.listTitle} ({filteredDrawerNodes.length}
              {statusFilter !== 'all' ? ` / ${matchedNodes.length}` : ''})
            </span>
            <button
              type="button"
              className="impact-navigator-close"
              onClick={() => setIsDrawerOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="impact-navigator-list">
            {filteredDrawerNodes.length === 0 ? (
              <div className="impact-navigator-empty">{t.impact.listEmpty}</div>
            ) : (
              filteredDrawerNodes.map(nd => {
                const st = String(nd.data?.test_status || 'Untested');
                const stColor =
                  st === 'Passed' ? '#22c55e' :
                  st === 'Failed' ? '#ef4444' :
                  st === 'Blocked' ? '#eab308' : '#64748b';
                const parentNode = nd.parentId ? nodes.find(p => p.id === nd.parentId) : null;
                const matchingSlots = activeImpacts
                  .filter(item => item.connectedIds.has(nd.id))
                  .map(item => item.slotIndex);
                const isSelected = selectedNodeId === nd.id;

                return (
                  <button
                    key={nd.id}
                    type="button"
                    className={`impact-navigator-item${isSelected ? ' active' : ''}`}
                    title={t.impact.flyToHint}
                    onClick={() => onSelectNodeFromList?.(nd.id)}
                  >
                    <span className="impact-stat-dot" style={{ background: stColor, flexShrink: 0 }} />
                    <span className="impact-navigator-label">[{nd.data?.label || 'Node'}]</span>
                    <span className="impact-navigator-name">
                      {parentNode ? `${parentNode.data?.name || parentNode.id} › ${nd.data?.name || nd.id}` : (nd.data?.name || nd.id)}
                    </span>
                    <span className="impact-navigator-slots">
                      {matchingSlots.map(slotIdx => (
                        <span key={slotIdx} className={`impact-slot-dot slot-${slotIdx}`} />
                      ))}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.1rem' }}>🔍</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {activeImpacts.map(item => (
            <span key={item.globalNodeId} className={`impact-chip impact-slot-${item.slotIndex}`}>
              <span className={`impact-slot-dot slot-${item.slotIndex}`} />
              <span>{item.globalNodeName}</span>
              <button
                type="button"
                className="impact-chip-remove"
                title={t.impact.removeChipTitle(item.globalNodeName)}
                onClick={() => onRemoveImpact(item.globalNodeId)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.impact.affected(total)}</div>
      </div>
      <div className="impact-operator-toggle" role="group">
        <button
          type="button"
          className={`impact-operator-btn${operator === 'OR' ? ' active' : ''}`}
          title={t.impact.modeOrTitle}
          onClick={() => onChangeOperator('OR')}
        >
          {t.impact.modeOr}
        </button>
        <button
          type="button"
          className={`impact-operator-btn${operator === 'AND' ? ' active' : ''}`}
          title={t.impact.modeAndTitle}
          onClick={() => onChangeOperator('AND')}
        >
          {t.impact.modeAnd}
        </button>
      </div>
      {onToggleIsolation && (
        <button
          type="button"
          className={`impact-isolate-btn${isIsolated ? ' active' : ''}`}
          title={t.impact.isolateTitle}
          onClick={onToggleIsolation}
        >
          {isIsolated ? t.impact.isolateOn : t.impact.isolateOff}
        </button>
      )}
      <button
        type="button"
        className={`impact-list-toggle-btn${isDrawerOpen ? ' active' : ''}`}
        title={t.impact.listTitle}
        onClick={() => setIsDrawerOpen(prev => !prev)}
      >
        {isDrawerOpen ? t.impact.listToggleClose(matchedNodes.length) : t.impact.listToggleOpen(matchedNodes.length)}
      </button>
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
      <div
        className={`impact-stat-item${statusFilter === 'Passed' ? ' active' : ''}`}
        role="button"
        tabIndex={0}
        title={t.impact.filterByStatusTitle('Passed')}
        onClick={() => handleToggleStatusFilter('Passed')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleStatusFilter('Passed'); } }}
      >
        <div className="impact-stat-dot" style={{ background: '#22c55e' }} />
        <span style={{ color: '#4ade80' }}>{stats.Passed}</span>
      </div>
      <div
        className={`impact-stat-item${statusFilter === 'Failed' ? ' active' : ''}`}
        role="button"
        tabIndex={0}
        title={t.impact.filterByStatusTitle('Failed')}
        onClick={() => handleToggleStatusFilter('Failed')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleStatusFilter('Failed'); } }}
      >
        <div className="impact-stat-dot" style={{ background: '#ef4444' }} />
        <span style={{ color: '#f87171' }}>{stats.Failed}</span>
      </div>
      <div
        className={`impact-stat-item${statusFilter === 'Untested' ? ' active' : ''}`}
        role="button"
        tabIndex={0}
        title={t.impact.filterByStatusTitle('Untested')}
        onClick={() => handleToggleStatusFilter('Untested')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleStatusFilter('Untested'); } }}
      >
        <div className="impact-stat-dot" style={{ background: '#64748b' }} />
        <span style={{ color: '#94a3b8' }}>{stats.Untested}</span>
      </div>
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
      <button className="impact-close-btn" onClick={onDeactivate}>{t.common.closeWithIcon}</button>
    </div>
  );
};
