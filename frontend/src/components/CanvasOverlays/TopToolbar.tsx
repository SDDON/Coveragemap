import React from 'react';
import { Panel } from '@xyflow/react';
import { t } from '../../locales/koKR';

export interface TopToolbarProps {
  filterText: string;
  showAllDomains: boolean;
  onAddNode: () => void;
  onSwitchWorkspace: () => void;
  onOpenPresets: () => void;
  onOpenHelp: () => void;
  onRelayout: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  filterText,
  showAllDomains,
  onAddNode,
  onSwitchWorkspace,
  onOpenPresets,
  onOpenHelp,
  onRelayout,
}) => {
  return (
    <Panel position="top-left">
      <div style={{ display: 'flex', gap: '8px', marginTop: 10 }}>
        <button
          style={{ padding: 8, cursor: 'pointer' }}
          onClick={onAddNode}
        >
          {t.toolbar.addNode}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.toolbar.currentWorkspace}</span>
          <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>
            {filterText ? filterText : (showAllDomains ? t.workspace.all : t.workspace.none)}
          </span>
        </div>
        <button
          className="primary"
          style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}
          title={t.toolbar.switchWorkspace}
          onClick={onSwitchWorkspace}
        >
          {t.toolbar.switchWorkspaceBtn}
        </button>
        <button
          className="primary"
          style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#0284c7' }}
          title={t.toolbar.presets}
          onClick={onOpenPresets}
        >
          {t.toolbar.presetsBtn}
        </button>
        <button
          style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '50%', fontWeight: 'bold' }}
          title={t.toolbar.help}
          onClick={onOpenHelp}
        >
          ?
        </button>
        <button
          style={{ padding: 8, cursor: 'pointer' }}
          title={t.toolbar.relayout}
          onClick={onRelayout}
        >
          {t.toolbar.relayoutBtn}
        </button>
      </div>
    </Panel>
  );
};
