import React from 'react';
import { ActiveImpactItem, CoverageNode, ImpactFilterOperator } from '../../types';
import { t } from '../../locales/koKR';

export interface ImpactStatsBarProps {
  activeImpacts: ActiveImpactItem[];
  nodes: CoverageNode[];
  operator: ImpactFilterOperator;
  onChangeOperator: (operator: ImpactFilterOperator) => void;
  onRemoveImpact: (globalNodeId: string) => void;
  onDeactivate: () => void;
}

/* Impact Overlay Stats Bar (Multi-Global 5-Slot & OR/AND Filter) */
export const ImpactStatsBar: React.FC<ImpactStatsBarProps> = ({
  activeImpacts,
  nodes,
  operator,
  onChangeOperator,
  onRemoveImpact,
  onDeactivate,
}) => {
  if (activeImpacts.length === 0) return null;

  let matchedIds: Set<string>;
  if (activeImpacts.length === 1) {
    matchedIds = activeImpacts[0].connectedIds;
  } else if (operator === 'AND') {
    const [first, ...rest] = activeImpacts;
    matchedIds = new Set(
      Array.from(first.connectedIds).filter(id => rest.every(item => item.connectedIds.has(id)))
    );
  } else {
    matchedIds = new Set<string>();
    activeImpacts.forEach(item => item.connectedIds.forEach(id => matchedIds.add(id)));
  }

  const stats = activeImpacts.length === 1
    ? activeImpacts[0].stats
    : (() => {
        let Passed = 0;
        let Failed = 0;
        let Untested = 0;
        matchedIds.forEach(id => {
          const nd = nodes.find(n => n.id === id);
          const st = nd?.data?.test_status || 'Untested';
          if (st === 'Passed') Passed += 1;
          else if (st === 'Failed') Failed += 1;
          else Untested += 1;
        });
        return { Passed, Failed, Untested };
      })();
  const total = activeImpacts.length === 1 ? activeImpacts[0].total : matchedIds.size;

  return (
    <div
      className="impact-stats-bar"
      style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-floating-panel)' }}
    >
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
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
      <div className="impact-stat-item">
        <div className="impact-stat-dot" style={{ background: '#22c55e' }} />
        <span style={{ color: '#4ade80' }}>{stats.Passed}</span>
      </div>
      <div className="impact-stat-item">
        <div className="impact-stat-dot" style={{ background: '#ef4444' }} />
        <span style={{ color: '#f87171' }}>{stats.Failed}</span>
      </div>
      <div className="impact-stat-item">
        <div className="impact-stat-dot" style={{ background: '#64748b' }} />
        <span style={{ color: '#94a3b8' }}>{stats.Untested}</span>
      </div>
      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
      <button className="impact-close-btn" onClick={onDeactivate}>{t.common.closeWithIcon}</button>
    </div>
  );
};
