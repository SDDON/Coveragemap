import React from 'react';
import { t } from '../../locales/koKR';

export interface CanvasContextMenuProps {
  contextMenu: { x: number; y: number; show: boolean } | null;
  onClose: () => void;
  onAddNode: () => void;
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

  return (
    <div
      className="context-menu"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onMouseLeave={onClose}
    >
      <div
        className="context-menu-item"
        onClick={() => {
          onAddNode();
          // contextMenu.show is still true to let initialPos capture its position
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
