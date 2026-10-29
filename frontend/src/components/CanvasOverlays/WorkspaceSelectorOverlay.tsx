import React from 'react';
import { t } from '../../locales/koKR';

export interface WorkspaceSelectorOverlayProps {
  show: boolean;
  aliases: string[];
  onSelectAlias: (alias: string) => void;
  onLoadAll: () => void;
  onOpenPresets: () => void;
}

/* Workspace Selector Overlay */
export const WorkspaceSelectorOverlay: React.FC<WorkspaceSelectorOverlayProps> = ({
  show,
  aliases,
  onSelectAlias,
  onLoadAll,
  onOpenPresets,
}) => {
  if (!show) return null;

  return (
    <div className="workspace-selector-overlay" style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 'var(--z-modal)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="glass-panel" style={{ padding: '40px', width: '600px', textAlign: 'center', backgroundColor: 'var(--panel-bg)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--text-main)', fontWeight: 600 }}>{t.workspace.selectTitle}</h2>
        <p style={{ color: 'var(--text-main)', opacity: 0.8, marginBottom: '32px', lineHeight: '1.5' }}>
          {t.workspace.selectGuide}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', maxHeight: '400px', overflowY: 'auto', padding: '10px' }}>
          {aliases.map(a => (
            <button
              key={a}
              style={{ padding: '16px 12px', fontSize: '1rem', cursor: 'pointer', borderRadius: '12px', border: '1px solid var(--panel-border)', backgroundColor: 'var(--node-bg)', color: 'var(--text-main)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--status-passed-border)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--panel-border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              onClick={() => {
                onSelectAlias(a);
                if ((document.getElementById('rememberWorkspace') as HTMLInputElement)?.checked) {
                  localStorage.setItem('savedWorkspace', a);
                  localStorage.setItem('savedShowAll', 'true');
                }
              }}
            >
              {a}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="rememberWorkspace"
            defaultChecked={localStorage.getItem('savedShowAll') !== null || localStorage.getItem('savedWorkspace') !== null}
            onChange={(e) => {
              if (e.target.checked) {
                // It will be saved when a button is clicked
              } else {
                localStorage.removeItem('savedWorkspace');
                localStorage.removeItem('savedShowAll');
              }
            }}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <label htmlFor="rememberWorkspace" style={{ cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem' }}>
            {t.workspace.dontShowAgain}
          </label>
        </div>
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            onClick={onOpenPresets}
            style={{ padding: '12px 24px', background: '#eff6ff', color: '#2563eb', border: '1.5px solid #93c5fd', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
          >
            {t.workspace.loadPreset}
          </button>
          <button
            onClick={() => {
              onLoadAll();
              if ((document.getElementById('rememberWorkspace') as HTMLInputElement)?.checked) {
                localStorage.setItem('savedShowAll', 'true');
              }
            }}
            style={{ padding: '12px 24px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-main)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
          >
            {t.workspace.loadAll}
          </button>
        </div>
      </div>
    </div>
  );
};
