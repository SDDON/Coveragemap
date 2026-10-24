import React from 'react';
import { CoverageNode } from '../../types';
import { t } from '../../locales/koKR';

export interface PinnedFocusBannerProps {
  pinnedFocusNodeId: string | null;
  nodes: CoverageNode[];
  hasImpactOverlay: boolean;
  onUnpin: () => void;
}

/* 특정 콘텐츠 포커스 고정 플로팅 배너 (Content Focus Pinning — 기존 Workspace 관리자 모달은 제거됨) */
export const PinnedFocusBanner: React.FC<PinnedFocusBannerProps> = ({
  pinnedFocusNodeId,
  nodes,
  hasImpactOverlay,
  onUnpin,
}) => {
  if (!pinnedFocusNodeId) return null;

  const pinnedNode = nodes.find(n => n.id === pinnedFocusNodeId);
  if (!pinnedNode) return null;
  const pinnedName = pinnedNode.data?.name || pinnedNode.id;

  return (
    <div
      className="pinned-focus-banner"
      style={hasImpactOverlay ? { bottom: 88 } : undefined}
    >
      <span>{t.contentFocus.banner(pinnedName)}</span>
      <button
        type="button"
        className="pinned-focus-unpin-btn"
        onClick={onUnpin}
      >
        {t.contentFocus.unpinBannerButton}
      </button>
    </div>
  );
};
