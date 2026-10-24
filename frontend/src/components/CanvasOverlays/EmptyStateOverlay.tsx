import React from 'react';
import { t } from '../../locales/koKR';

export interface EmptyStateOverlayProps {
  show: boolean;
}

export const EmptyStateOverlay: React.FC<EmptyStateOverlayProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div
      className="empty-state-message glass-panel"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 'var(--z-canvas-controls)',
      }}
    >
      {t.canvas.noNodes}
    </div>
  );
};
