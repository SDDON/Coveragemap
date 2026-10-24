import React from 'react';
import { t } from '../../locales/koKR';

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
    }}>
      <div className="glass-panel" style={{
        backgroundColor: 'var(--bg-color)', color: 'var(--text-main)',
        padding: '30px', borderRadius: '12px', width: '500px', maxWidth: '90%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>{t.help.title}</h2>
          <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-main)' }}>&times;</button>
        </div>

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
        </ul>

        <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.globalTitle}</h3>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
          <li><strong>{t.help.globalTypeTitle}</strong>: {t.help.globalTypeBody}</li>
          <li><strong>{t.help.globalDeleteTitle}</strong>: {t.help.globalDeleteBody}</li>
          <li><strong>{t.help.globalUsageTitle}</strong>: {t.help.globalUsageBody}</li>
        </ul>

        <div style={{ textAlign: 'right', marginTop: '30px' }}>
          <button onClick={onClose} className="success">{t.common.ok}</button>
        </div>
      </div>
    </div>
  );
};
