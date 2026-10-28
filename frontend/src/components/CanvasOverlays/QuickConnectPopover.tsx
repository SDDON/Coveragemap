import React, { useState, useEffect } from 'react';
import { CoverageNode, CoverageEdge, QuickConnectPopoverState } from '../../types';
import { NODE_LABEL_OPTIONS, EDGE_TYPE_OPTIONS } from '../../utils/constants';
import { t } from '../../locales/koKR';

export interface QuickConnectPopoverProps {
  popover: QuickConnectPopoverState | null;
  nodes: CoverageNode[];
  edges?: CoverageEdge[];
  onClose: () => void;
  onSelectEdgeType: (edgeType: string) => void;
  onSearchChange: (search: string) => void;
  onConnect: (targetId: string) => void;
  onCreateAndConnect?: (newNodeName: string, newNodeLabel: string) => void;
  onPickOnCanvas: () => void;
}

/* Pattern A: 빈 캔버스에 연결선 드롭 시 열리는 Quick Connect 검색 팝오버 (기연결 배지 표시 + 인라인 새 노드 생성 및 즉시 연결 지원) */
export const QuickConnectPopover: React.FC<QuickConnectPopoverProps> = ({
  popover,
  nodes,
  edges = [],
  onClose,
  onSelectEdgeType,
  onSearchChange,
  onConnect,
  onCreateAndConnect,
  onPickOnCanvas,
}) => {
  const [newNodeLabel, setNewNodeLabel] = useState<string>('Screen');
  const popoverEdgeType = popover?.edgeType;
  const popoverSourceNodeId = popover?.sourceNodeId;

  useEffect(() => {
    if (!popoverEdgeType && !popoverSourceNodeId) return;
    if (popoverEdgeType === 'Contains') setNewNodeLabel('Component');
    else if (popoverEdgeType === 'Tests') setNewNodeLabel('Feature');
    else setNewNodeLabel('Screen');
  }, [popoverEdgeType, popoverSourceNodeId]);

  if (!popover) return null;

  const srcNode = nodes.find(n => n.id === popover.sourceNodeId);
  const srcName = srcNode?.data?.name || popover.sourceNodeId;
  const trimmedSearch = popover.search.trim();
  const q = trimmedSearch.toLowerCase();
  const qClean = q.replace(/^#+/, '');

  const candidates = nodes.filter(n => {
    if (n.hidden || n.id === popover.sourceNodeId) return false;
    if (srcNode?.parentId && srcNode.parentId === n.id) return false;
    if (!qClean) return true;
    const name = String(n.data?.name || '').toLowerCase();
    const label = String(n.data?.label || '').toLowerCase();
    const nodeAliases: string[] = Array.isArray(n.data?.aliases) ? n.data.aliases : [];
    return (
      name.includes(qClean) ||
      label.includes(qClean) ||
      nodeAliases.some(a => String(a).replace(/^#+/, '').toLowerCase().includes(qClean))
    );
  });

  // 소스 노드와 후보 노드 간의 기존 연결 상태 판별 (항목 D)
  const getConnectionBadge = (cand: CoverageNode): { text: string; tone: 'same' | 'out' | 'in' | 'badge' } | null => {
    const outEdges = edges.filter(e => e.source === popover.sourceNodeId && e.target === cand.id);
    const inEdges = edges.filter(e => e.source === cand.id && e.target === popover.sourceNodeId);
    const outTypes = Array.from(new Set(outEdges.map(e => String(e.data?.type || e.label || 'Transition'))));
    if (cand.parentId === popover.sourceNodeId && !outTypes.includes('Contains')) {
      outTypes.push('Contains');
    }
    if (outTypes.includes(popover.edgeType)) {
      return { text: t.quickConnect.alreadyConnectedSame(popover.edgeType), tone: 'same' };
    }
    if (outTypes.length > 0) {
      return { text: t.quickConnect.alreadyConnectedOut(outTypes.join(', ')), tone: 'out' };
    }
    const inTypes = Array.from(new Set(inEdges.map(e => String(e.data?.type || e.label || 'Transition'))));
    if (inTypes.length > 0) {
      return { text: t.quickConnect.alreadyConnectedIn(inTypes.join(', ')), tone: 'in' };
    }
    const hasBadgeLink =
      Boolean(srcNode?.data?.badges?.some(b => b.id === cand.id)) ||
      Boolean(cand.data?.badges?.some(b => b.id === popover.sourceNodeId));
    if (hasBadgeLink) {
      return { text: t.quickConnect.alreadyAttachedBadge, tone: 'badge' };
    }
    return null;
  };

  return (
    <div
      className="quick-connect-popover"
      style={{ top: popover.y, left: popover.x }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="quick-connect-header">
        <span className="quick-connect-title" title={srcName}>{t.quickConnect.title(srcName)}</span>
        <button
          type="button"
          className="quick-connect-close-btn"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="quick-connect-type-pills" data-testid="quick-connect-edge-type" aria-label={t.quickConnect.edgeTypeLabel}>
        {EDGE_TYPE_OPTIONS.map(et => (
          <button
            key={et}
            type="button"
            title={t.edgeType[et]}
            className={`quick-connect-type-pill${popover.edgeType === et ? ' active' : ''}`}
            onClick={() => onSelectEdgeType(et)}
          >
            {et}
          </button>
        ))}
      </div>
      <input
        type="text"
        autoFocus
        className="quick-connect-search-input"
        placeholder={t.quickConnect.searchPlaceholder}
        value={popover.search}
        onChange={e => onSearchChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (candidates.length > 0) {
              onConnect(candidates[0].id);
            } else if (trimmedSearch.length > 0 && onCreateAndConnect) {
              onCreateAndConnect(trimmedSearch, newNodeLabel);
            }
          }
        }}
      />
      {trimmedSearch.length > 0 && onCreateAndConnect && (
        <div className="quick-connect-create-row">
          <select
            data-testid="quick-connect-label"
            className="quick-connect-label-select"
            title={t.quickConnect.newNodeLabelSelectTitle}
            value={newNodeLabel}
            onChange={e => setNewNodeLabel(e.target.value)}
          >
            {NODE_LABEL_OPTIONS.map(lbl => (
              <option key={lbl} value={lbl}>{t.nodeLabel[lbl] || lbl}</option>
            ))}
          </select>
          <button
            type="button"
            className="quick-connect-create-btn"
            onClick={() => onCreateAndConnect(trimmedSearch, newNodeLabel)}
          >
            {t.quickConnect.createAndConnectBtn(trimmedSearch, popover.edgeType)}
          </button>
        </div>
      )}
      <div className="quick-connect-list">
        {candidates.length === 0 ? (
          <div className="quick-connect-empty">{t.quickConnect.emptyResult}</div>
        ) : (
          candidates.slice(0, 10).map(cand => {
            const candName = cand.data?.name || cand.id;
            const candLabel = cand.data?.label || 'Node';
            const connBadge = getConnectionBadge(cand);
            return (
              <button
                key={cand.id}
                type="button"
                className={`quick-connect-item${connBadge ? ` is-connected is-connected-${connBadge.tone}` : ''}`}
                onClick={() => onConnect(cand.id)}
              >
                <div className="quick-connect-item-main">
                  <span className="quick-connect-item-name" title={candName}>{candName}</span>
                  {connBadge && (
                    <span className={`quick-connect-connected-badge tone-${connBadge.tone}`}>
                      {connBadge.text}
                    </span>
                  )}
                </div>
                <span className="quick-connect-item-label">{candLabel}</span>
              </button>
            );
          })
        )}
      </div>
      <button
        type="button"
        className="quick-connect-pick-canvas-btn"
        onClick={onPickOnCanvas}
      >
        {t.quickConnect.pickOnCanvasButton}
      </button>
    </div>
  );
};
