import React, { useState } from 'react';
import { t } from '../../locales/koKR';

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'changelog'>('guide');

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
    }}>
      <div className="glass-panel help-modal-panel" style={{
        backgroundColor: 'var(--bg-color)', color: 'var(--text-main)',
        padding: '28px', borderRadius: '12px', width: '560px', maxWidth: '92%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxHeight: '88vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>{t.help.title}</h2>
          <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-main)', padding: '4px 8px' }}>&times;</button>
        </div>

        <div className="help-modal-tabs" style={{
          display: 'flex', gap: '6px', padding: '4px', backgroundColor: '#f1f5f9',
          borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px',
        }}>
          <button
            type="button"
            className={`help-tab-btn${activeTab === 'guide' ? ' active' : ''}`}
            onClick={() => setActiveTab('guide')}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '6px',
              background: activeTab === 'guide' ? '#ffffff' : 'transparent',
              color: activeTab === 'guide' ? '#2563eb' : '#64748b',
              fontWeight: activeTab === 'guide' ? 700 : 500, fontSize: '0.86rem',
            }}
          >
            {t.help.tabGuide}
          </button>
          <button
            type="button"
            className={`help-tab-btn${activeTab === 'changelog' ? ' active' : ''}`}
            onClick={() => setActiveTab('changelog')}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '6px',
              background: activeTab === 'changelog' ? '#ffffff' : 'transparent',
              color: activeTab === 'changelog' ? '#2563eb' : '#64748b',
              fontWeight: activeTab === 'changelog' ? 700 : 500, fontSize: '0.86rem',
            }}
          >
            {t.help.tabChangelog}
          </button>
        </div>

        {activeTab === 'guide' ? (
          <div className="help-guide-content">
            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>{t.help.highlightTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong style={{ color: '#3b82f6' }}>{t.help.incomingTitle}</strong>: {t.help.incomingBody}</li>
              <li><strong style={{ color: '#f59e0b' }}>{t.help.outgoingTitle}</strong>: {t.help.outgoingBody}</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.statusTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>{t.help.untestedTitle}</strong>: {t.help.untestedBody}</li>
              <li><strong style={{ color: '#10b981' }}>{t.help.passedTitle}</strong>: {t.help.passedBody}</li>
              <li><strong style={{ color: '#ef4444' }}>{t.help.failedTitle}</strong>: {t.help.failedBody}</li>
              <li><strong style={{ color: '#d97706' }}>{t.help.blockedTitle}</strong>: {t.help.blockedBody}</li>
              <li style={{ fontSize: '0.9rem', color: 'gray', marginTop: '5px' }}>{t.help.statusNote}</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.tipsTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>{t.help.connectTitle}</strong>: {t.help.connectBody}</li>
              <li><strong>{t.help.highlightTipTitle}</strong>: {t.help.highlightTipBody}</li>
              <li><strong>{t.help.depthTitle}</strong>: {t.help.depthBody}</li>
              <li><strong>{t.help.undoTitle}</strong>: {t.help.undoBody}</li>
              <li><strong>{t.help.copyPasteTitle}</strong>: {t.help.copyPasteBody}</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.globalTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>{t.help.globalTypeTitle}</strong>: {t.help.globalTypeBody}</li>
              <li><strong>{t.help.globalDeleteTitle}</strong>: {t.help.globalDeleteBody}</li>
              <li><strong>{t.help.globalUsageTitle}</strong>: {t.help.globalUsageBody}</li>
            </ul>
          </div>
        ) : (
          <div className="help-changelog-content">
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {t.help.changelogIntro}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {t.help.changelogEntries.map(entry => (
                <div
                  key={entry.version}
                  className="changelog-entry-card"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '999px' }}>
                      {entry.version}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{entry.date}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '6px' }}>
                    {entry.title}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>
                    {entry.items.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '3px' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'right', marginTop: '24px' }}>
          <button onClick={onClose} className="success">{t.common.ok}</button>
        </div>
      </div>
    </div>
  );
};

