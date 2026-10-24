import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CoverageNode } from '../../types/graph';
import { t } from '../../locales/koKR';

interface ViewTabProps {
  nodes: CoverageNode[];
  filterText: string;
  setFilterText: (text: string) => void;
  aliases: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  visibleTypes: Set<string>;
  setVisibleTypes: Dispatch<SetStateAction<Set<string>>>;
  maxDepth: number;
  setMaxDepth: (depth: number) => void;
}

export const ViewTab: React.FC<ViewTabProps> = ({
  nodes,
  filterText,
  setFilterText,
  aliases,
  searchQuery,
  setSearchQuery,
  visibleTypes,
  setVisibleTypes,
  maxDepth,
  setMaxDepth,
}) => {
  const passedCount = nodes.filter(n => n.data?.test_status === 'Passed').length;

  return (
    <div>
      <div className="form-group">
        <label htmlFor="filterGraph" className="form-label">
          {t.inspector.filterGraph}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.filterGraph}>?</span>
        </label>
        <div className="metrics" style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t.inspector.passedNodes}{' '}
          <span className="metrics-passed-count" style={{ fontWeight: 'bold', color: 'var(--status-passed-text)' }}>
            {passedCount}
          </span>
        </div>
        <select
          id="filterGraph"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        >
          <option value="">{t.inspector.allAliases}</option>
          {aliases.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginTop: '12px', marginBottom: '16px' }}>
        <label className="form-label" style={{ marginBottom: '6px' }}>
          {t.inspector.searchHighlight}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.searchHighlight}>?</span>
        </label>
        <input 
          type="text" 
          placeholder={t.inspector.searchPlaceholder} 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a' }} 
        />
      </div>

      <div className="form-group">
        <label className="form-label" style={{ marginBottom: '6px' }}>
          {t.inspector.visibilityFilter}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.visibilityFilter}>?</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          {['Screen', 'Component', 'TestCase', 'Data'].map(type => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: '#1e293b', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={visibleTypes.has(type)}
                onChange={e => {
                  const next = new Set(visibleTypes);
                  if (e.target.checked) next.add(type);
                  else next.delete(type);
                  setVisibleTypes(next);
                }}
                style={{ cursor: 'pointer' }}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="maxDepth" className="form-label">
          {t.inspector.maxDepth}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.maxDepth}>?</span>
        </label>
        <input
          id="maxDepth"
          type="number"
          min={1}
          max={10}
          value={maxDepth}
          onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
        />
      </div>
    </div>
  );
};
