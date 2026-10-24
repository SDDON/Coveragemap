import React from 'react';
import { t } from '../../locales/koKR';

export interface LoadingOverlayProps {
  loading: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ loading }) => {
  if (!loading) return null;

  return (
    <div
      data-testid="loading-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(248, 250, 252, 0.85)',
        zIndex: 'var(--z-loading-overlay)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div className="glass-panel" style={{ fontWeight: '600', fontSize: '1.2rem', padding: '16px 32px' }}>
        {t.canvas.loading}
      </div>
    </div>
  );
};
