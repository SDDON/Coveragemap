import React from 'react';
import { t } from '../../locales/koKR';

export interface ErrorToastProps {
  error: string | null;
  onClose: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div
      className="error-toast glass-panel"
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'var(--status-failed-text)',
        background: 'var(--status-failed-bg)',
        border: '1px solid var(--status-failed-border)',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span>{t.error.prefix}{error}</span>
      <button
        type="button"
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
      >
        ×
      </button>
    </div>
  );
};
