import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CoverageNode, StatusName, BadgeData } from '../../types/graph';
import { NODE_LABEL_OPTIONS, STATUS_ICON } from '../../utils/constants';
import { matchesNodeSearchQuery } from '../../utils/graphScopes';
import { t } from '../../locales/koKR';

type TriageFilter = 'all' | 'modified' | StatusName;

const STATUS_SORT_ORDER: Record<string, number> = {
  Failed: 0,
  Blocked: 1,
  Untested: 2,
  Passed: 3,
};

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
  hideUnconnectedEdges?: boolean;
  setHideUnconnectedEdges?: (hide: boolean) => void;
  selectedNodeId?: string | null;
  onFocusNode?: (nodeId: string, openEditTab?: boolean) => void;
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
  hideUnconnectedEdges = false,
  setHideUnconnectedEdges,
  selectedNodeId,
  onFocusNode,
}) => {
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('all');
  const [activeMatchIdx, setActiveMatchIdx] = useState<number>(0);

  const passedCount = nodes.filter(n => n.data?.test_status === 'Passed').length;
  const parentNodes = nodes.filter(n => n.data?.hasChildren);
  const allParentsCollapsed = parentNodes.length > 0 && parentNodes.every(n => n.data?.isCollapsed);

  const trimmedQuery = searchQuery.trim();
  const qClean = trimmedQuery.toLowerCase().replace(/^#+/, '').trim();

  const isNodeModified = (n: CoverageNode): boolean => {
    const v = n.data?.properties?.is_modified ?? n.data?.is_modified;
    return v === true || v === 'true';
  };

  const getMatchedBadge = useCallback((n: CoverageNode): BadgeData | undefined => {
    if (!qClean) return undefined;
    const badges = Array.isArray(n.data?.badges) ? n.data.badges : [];
    return badges.find(b => {
      const bName = String(b?.name || '').toLowerCase();
      return bName.includes(qClean);
    });
  }, [qClean]);

  // 검색어가 특정 글로벌 배지(예: '스크롤')와 일치하면 해당 노드에 부착된 배지의 Pass/Fail 상태를 우선 반영합니다.
  const getEffectiveStatus = useCallback((n: CoverageNode): StatusName => {
    const mb = getMatchedBadge(n);
    if (mb?.test_status) return mb.test_status;
    return (n.data?.test_status as StatusName) || 'Untested';
  }, [getMatchedBadge]);

  const queryMatchedNodes = useMemo(() => {
    const canvasNodes = nodes.filter(
      n => !n.data?.is_global && String(n.data?.properties?.is_global) !== 'true'
    );
    if (!trimmedQuery) return canvasNodes;
    return canvasNodes.filter(n => matchesNodeSearchQuery(n, trimmedQuery, nodes));
  }, [nodes, trimmedQuery]);

  const triageCounts = useMemo(() => {
    let Passed = 0;
    let Failed = 0;
    let Blocked = 0;
    let Untested = 0;
    let Modified = 0;
    for (const n of queryMatchedNodes) {
      const st = getEffectiveStatus(n);
      if (st === 'Passed') Passed += 1;
      else if (st === 'Failed') Failed += 1;
      else if (st === 'Blocked') Blocked += 1;
      else Untested += 1;
      if (isNodeModified(n)) Modified += 1;
    }
    return {
      total: queryMatchedNodes.length,
      Passed,
      Failed,
      Blocked,
      Untested,
      Modified,
    };
  }, [queryMatchedNodes, getEffectiveStatus]);

  const filteredResultNodes = useMemo(() => {
    const list = queryMatchedNodes.filter(n => {
      if (triageFilter === 'all') return true;
      if (triageFilter === 'modified') return isNodeModified(n);
      return getEffectiveStatus(n) === triageFilter;
    });
    return [...list].sort((a, b) => {
      const stA = STATUS_SORT_ORDER[getEffectiveStatus(a)] ?? 2;
      const stB = STATUS_SORT_ORDER[getEffectiveStatus(b)] ?? 2;
      if (stA !== stB) return stA - stB;
      const modA = isNodeModified(a) ? 0 : 1;
      const modB = isNodeModified(b) ? 0 : 1;
      if (modA !== modB) return modA - modB;
      return String(a.data?.name || '').localeCompare(String(b.data?.name || ''));
    });
  }, [queryMatchedNodes, triageFilter, getEffectiveStatus]);

  useEffect(() => {
    setActiveMatchIdx(0);
  }, [trimmedQuery, triageFilter]);

  const showResultDrawer = trimmedQuery.length > 0 || triageFilter !== 'all';

  const jumpToMatchAt = (index: number, openEdit = false) => {
    if (filteredResultNodes.length === 0) return;
    const safeIdx = ((index % filteredResultNodes.length) + filteredResultNodes.length) % filteredResultNodes.length;
    setActiveMatchIdx(safeIdx);
    const target = filteredResultNodes[safeIdx];
    if (target && onFocusNode) {
      onFocusNode(target.id, openEdit);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResultNodes.length === 0) return;
      if (e.shiftKey) {
        jumpToMatchAt(activeMatchIdx - 1, false);
      } else {
        const currentTarget = filteredResultNodes[activeMatchIdx];
        const nextIdx = selectedNodeId === currentTarget?.id ? activeMatchIdx + 1 : activeMatchIdx;
        jumpToMatchAt(nextIdx, false);
      }
    } else if (e.key === 'ArrowDown') {
      if (filteredResultNodes.length > 0) {
        e.preventDefault();
        jumpToMatchAt(activeMatchIdx + 1, false);
      }
    } else if (e.key === 'ArrowUp') {
      if (filteredResultNodes.length > 0) {
        e.preventDefault();
        jumpToMatchAt(activeMatchIdx - 1, false);
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setTriageFilter('all');
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label htmlFor="searchHighlight" className="form-label" style={{ marginBottom: 0 }}>
            {t.inspector.searchHighlight}
            <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.searchHighlight}>?</span>
          </label>
          {(trimmedQuery.length > 0 || triageFilter !== 'all') && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setTriageFilter('all');
              }}
            >
              {t.quickFind.clearBtn} ✕
            </button>
          )}
        </div>
        <div className="search-input-row">
          <input
            id="searchHighlight"
            type="text"
            placeholder={t.inspector.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a' }}
          />
          {showResultDrawer && filteredResultNodes.length > 0 && (
            <div className="search-nav-controls">
              <span className="search-nav-counter">
                {Math.min(activeMatchIdx + 1, filteredResultNodes.length)}/{filteredResultNodes.length}
              </span>
              <button
                type="button"
                className="search-nav-btn"
                title={t.quickFind.prevMatchTitle}
                onClick={() => jumpToMatchAt(activeMatchIdx - 1, false)}
              >
                ▲
              </button>
              <button
                type="button"
                className="search-nav-btn"
                title={t.quickFind.nextMatchTitle}
                onClick={() => jumpToMatchAt(activeMatchIdx + 1, false)}
              >
                ▼
              </button>
            </div>
          )}
        </div>

        {/* 상태 및 변경점(is_modified) 원클릭 모아보기 필터 칩 */}
        <div className="search-triage-chips" role="group">
          <button
            type="button"
            className={`triage-chip${triageFilter === 'all' ? ' active' : ''}`}
            onClick={() => setTriageFilter('all')}
          >
            {t.quickFind.filterAll} ({triageCounts.total})
          </button>
          <button
            type="button"
            className={`triage-chip triage-chip-modified${triageFilter === 'modified' ? ' active' : ''}`}
            onClick={() => setTriageFilter(prev => (prev === 'modified' ? 'all' : 'modified'))}
          >
            {t.quickFind.filterModified} ({triageCounts.Modified})
          </button>
          <button
            type="button"
            className={`triage-chip triage-chip-failed${triageFilter === 'Failed' ? ' active' : ''}`}
            onClick={() => setTriageFilter(prev => (prev === 'Failed' ? 'all' : 'Failed'))}
          >
            {t.quickFind.filterFailed} ({triageCounts.Failed})
          </button>
          <button
            type="button"
            className={`triage-chip triage-chip-blocked${triageFilter === 'Blocked' ? ' active' : ''}`}
            onClick={() => setTriageFilter(prev => (prev === 'Blocked' ? 'all' : 'Blocked'))}
          >
            {t.quickFind.filterBlocked} ({triageCounts.Blocked})
          </button>
          <button
            type="button"
            className={`triage-chip triage-chip-passed${triageFilter === 'Passed' ? ' active' : ''}`}
            onClick={() => setTriageFilter(prev => (prev === 'Passed' ? 'all' : 'Passed'))}
          >
            {t.quickFind.filterPassed} ({triageCounts.Passed})
          </button>
          <button
            type="button"
            className={`triage-chip triage-chip-untested${triageFilter === 'Untested' ? ' active' : ''}`}
            onClick={() => setTriageFilter(prev => (prev === 'Untested' ? 'all' : 'Untested'))}
          >
            {t.quickFind.filterUntested} ({triageCounts.Untested})
          </button>
        </div>

        {/* 검색어 입력 또는 상태/변경점 필터 활성 시 매칭 노드 요약 및 빠른 점프 리스트 */}
        {showResultDrawer && (
          <div className="search-result-drawer">
            <div className="search-triage-summary">
              {t.quickFind.summaryText(
                triageCounts.total,
                triageCounts.Passed,
                triageCounts.Failed,
                triageCounts.Blocked,
                triageCounts.Untested,
                triageCounts.Modified
              )}
            </div>
            <div className="search-result-list">
              {filteredResultNodes.length === 0 ? (
                <div className="search-result-empty">{t.quickFind.emptyResult}</div>
              ) : (
                filteredResultNodes.map((nd, idx) => {
                  const effSt = getEffectiveStatus(nd);
                  const stIcon = STATUS_ICON[effSt] || '⚪';
                  const parentNode = nd.parentId ? nodes.find(p => p.id === nd.parentId) : null;
                  const modified = isNodeModified(nd);
                  const modNote = String(nd.data?.properties?.modified_note || nd.data?.modified_note || '').trim();
                  const matchedBadge = getMatchedBadge(nd);
                  const isActiveRow = selectedNodeId === nd.id || idx === activeMatchIdx;

                  return (
                    <div
                      key={nd.id}
                      className={`search-result-item${isActiveRow ? ' active' : ''}`}
                    >
                      <button
                        type="button"
                        className="search-result-main-btn"
                        title={t.quickFind.flyToTitle}
                        onClick={() => {
                          setActiveMatchIdx(idx);
                          onFocusNode?.(nd.id, false);
                        }}
                      >
                        <span className="search-result-status-icon">{stIcon}</span>
                        <div className="search-result-text-col">
                          <div className="search-result-title-line">
                            <span className="search-result-label">[{nd.data?.label || 'Node'}]</span>
                            <span className="search-result-name">
                              {parentNode
                                ? `${parentNode.data?.name || parentNode.id} › ${nd.data?.name || nd.id}`
                                : (nd.data?.name || nd.id)}
                            </span>
                          </div>
                          {(modified || matchedBadge) && (
                            <div className="search-result-meta-line">
                              {modified && (
                                <span className="search-result-mod-pill">
                                  {t.quickFind.modifiedBadge(modNote)}
                                </span>
                              )}
                              {matchedBadge && (
                                <span className={`search-result-badge-pill status-${String(matchedBadge.test_status || 'Untested').toLowerCase()}`}>
                                  {t.quickFind.globalBadgeStatus(
                                    matchedBadge.name,
                                    t.status[(matchedBadge.test_status as StatusName) || 'Untested']
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="search-result-edit-btn"
                        title={t.quickFind.editNodeTitle}
                        onClick={() => {
                          setActiveMatchIdx(idx);
                          onFocusNode?.(nd.id, true);
                        }}
                      >
                        ✎
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" style={{ marginBottom: '6px' }}>
          {t.inspector.visibilityFilter}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.visibilityFilter}>?</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          {NODE_LABEL_OPTIONS.map(type => (
            <label key={type} title={t.nodeLabel[type]} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: '#1e293b', fontWeight: 500 }}>
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

      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
          <input
            id="hideUnconnectedEdges"
            type="checkbox"
            checked={hideUnconnectedEdges}
            onChange={(e) => setHideUnconnectedEdges?.(e.target.checked)}
            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
          />
          <span>{t.inspector.hideUnconnectedEdges}</span>
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.hideUnconnectedEdges}>?</span>
        </label>
      </div>

      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label" style={{ marginBottom: '6px' }}>
          {t.inspector.overviewModeLabel}
          <span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.overviewMode}>?</span>
        </label>
        <button
          type="button"
          className={`overview-collapse-all-btn${allParentsCollapsed ? ' active' : ''}`}
          disabled={parentNodes.length === 0}
          title={t.parentCollapse.collapseAllTitle}
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('toggleCollapseAllNodes', { detail: { collapsed: !allParentsCollapsed } })
            );
          }}
        >
          {allParentsCollapsed ? t.parentCollapse.expandAllBtn : t.parentCollapse.collapseAllBtn}
        </button>
      </div>
    </div>
  );
};
