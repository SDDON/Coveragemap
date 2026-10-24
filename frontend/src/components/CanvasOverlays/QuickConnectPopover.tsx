import React from 'react';
import { CoverageNode, QuickConnectPopoverState } from '../../types';
import { t } from '../../locales/koKR';

export interface QuickConnectPopoverProps {
  popover: QuickConnectPopoverState | null;
  nodes: CoverageNode[];
  onClose: () => void;
  onSelectEdgeType: (edgeType: string) => void;
  onSearchChange: (search: string) => void;
  onConnect: (targetId: string) => void;
  onPickOnCanvas: () => void;
}

/* Pattern A: 빈 캔버스에 연결선 드롭 시 열리는 Quick Connect 검색 팝오버 */
export const QuickConnectPopover: React.FC<QuickConnectPopoverProps> = ({
  popover,
  nodes,
  onClose,
  onSelectEdgeType,
  onSearchChange,
  onConnect,
  onPickOnCanvas,
}) => {
  if (!popover) return null;

  const srcNode = nodes.find(n => n.id === popover.sourceNodeId);
  const srcName = srcNode?.data?.name || popover.sourceNodeId;
  const q = popover.search.trim().toLowerCase();
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

  const edgeTypes = ['Transition', 'Contains', 'Depends_On', 'Tests', 'Return'];

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
      <div className="quick-connect-type-pills" aria-label={t.quickConnect.edgeTypeLabel}>
        {edgeTypes.map(et => (
          <button
            key={et}
            type="button"
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
          } else if (e.key === 'Enter' && candidates.length > 0 && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onConnect(candidates[0].id);
          }
        }}
      />
      <div className="quick-connect-list">
        {candidates.length === 0 ? (
          <div className="quick-connect-empty">{t.quickConnect.emptyResult}</div>
        ) : (
          candidates.slice(0, 10).map(cand => {
            const candName = cand.data?.name || cand.id;
            const candLabel = cand.data?.label || 'Node';
            return (
              <button
                key={cand.id}
                type="button"
                className="quick-connect-item"
                onClick={() => onConnect(cand.id)}
              >
                <span className="quick-connect-item-name" title={candName}>{candName}</span>
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
