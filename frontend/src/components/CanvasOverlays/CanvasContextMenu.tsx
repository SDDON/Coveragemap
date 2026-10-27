import React from 'react';
import { t } from '../../locales/koKR';

export interface CanvasContextMenuProps {
  contextMenu: { x: number; y: number; show: boolean } | null;
  onClose: () => void;
  onAddNode: (pos?: { x: number; y: number }) => void;
  onFitView: () => void;
  onRefresh: () => void;
}

/* Context Menu */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  contextMenu,
  onClose,
  onAddNode,
  onFitView,
  onRefresh,
}) => {
  if (!contextMenu?.show) return null;

  const clampedLeft = typeof window !== 'undefined' ? Math.max(8, Math.min(contextMenu.x, window.innerWidth - 180)) : contextMenu.x;
  const clampedTop = typeof window !== 'undefined' ? Math.max(8, Math.min(contextMenu.y, window.innerHeight - 150)) : contextMenu.y;

  return (
    <div
      className="context-menu"
      style={{ top: clampedTop, left: clampedLeft }}
      onMouseLeave={onClose}
    >
      <div
        className="context-menu-item"
        onClick={() => {
          onAddNode({ x: contextMenu.x, y: contextMenu.y });
          onClose();
        }}
      >
        {t.contextMenu.addNode}
      </div>
      <div className="context-menu-divider" />
      <div
        className="context-menu-item"
        onClick={() => {
          onFitView();
          onClose();
        }}
      >
        {t.contextMenu.fitView}
      </div>
      <div
        className="context-menu-item"
        onClick={() => {
          onRefresh();
          onClose();
        }}
      >
        {t.contextMenu.refresh}
      </div>
    </div>
  );
};

