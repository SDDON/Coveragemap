import React from 'react';
import { CoverageNode, PendingConnectSource } from '../../types';
import { t } from '../../locales/koKR';

export interface PendingConnectBannerProps {
  source: PendingConnectSource | null;
  nodes: CoverageNode[];
  hasImpactOverlay: boolean;
  onCancel: () => void;
}

/* Pattern B: 2-Step 출발 노드 고정 후 타겟 노드 클릭 대기 배너 */
export const PendingConnectBanner: React.FC<PendingConnectBannerProps> = ({
  source,
  nodes,
  hasImpactOverlay,
  onCancel,
}) => {
  if (!source) return null;

  const srcNode = nodes.find(n => n.id === source.nodeId);
  const srcName = srcNode?.data?.name || source.nodeId;

  return (
    <div
      className="pending-connect-banner"
      style={hasImpactOverlay ? { bottom: 88 } : undefined}
    >
      <span>{t.quickConnect.pendingBanner(srcName, source.edgeType)}</span>
      <button
        type="button"
        className="pending-connect-cancel-btn"
        onClick={onCancel}
      >
        {t.quickConnect.cancelPending}
      </button>
    </div>
  );
};
