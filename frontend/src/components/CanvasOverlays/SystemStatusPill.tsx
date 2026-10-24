import React from 'react';
import { Panel } from '@xyflow/react';
import { HealthStatus } from '../../types';
import { t } from '../../locales/koKR';

export interface SystemStatusPillProps {
  healthStatus: HealthStatus;
}

export const SystemStatusPill: React.FC<SystemStatusPillProps> = ({ healthStatus }) => {
  return (
    <Panel position="bottom-right" style={{ margin: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--panel-bg)', padding: '6px 12px', borderRadius: '16px', border: '1px solid var(--panel-border)', backdropFilter: 'blur(12px)', boxShadow: 'var(--panel-shadow)' }}>
        <div className={`health-dot ${healthStatus}`} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {healthStatus === 'ok' ? t.systemStatus.online : (healthStatus === 'error' ? t.systemStatus.offline : t.systemStatus.checking)}
        </span>
      </div>
    </Panel>
  );
};
