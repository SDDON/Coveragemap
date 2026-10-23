import { memo, useState, useEffect } from 'react';
import { Handle, Position, useInternalNode, useUpdateNodeInternals } from '@xyflow/react';
import { t } from './locales/koKR';

/**
 * CoverageNode: Custom React Flow node for the CoverageMap graph.
 * 
 * Renders:
 * - Node label (category like Screen, Component, Data, TestCase)
 * - Node name (e.g. ARENA, ARENA_SHOP)
 * - Aliases as small tags
 * - Dependencies section with pill badges (for global/common nodes)
 * - Collapse/expand button for parent nodes with children
 */
function CoverageNode({ id, data }: { id: string, data: any; selected?: boolean; [key: string]: any }) {
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const internalNode = useInternalNode(id);
  const updateNodeInternals = useUpdateNodeInternals();
  const hasMeasured = Boolean(internalNode?.measured?.width && internalNode?.measured?.height);
  const hasHandleBounds = Boolean(internalNode?.internals?.handleBounds);

  // React Flow 내부에서 userNode.measured 커밋 전후로 setNodes가 겹치면 handleBounds만 undefined로 유실되는 경합을 자가 복구합니다.
  useEffect(() => {
    if (hasMeasured && !hasHandleBounds) {
      updateNodeInternals(id);
    }
  }, [id, hasMeasured, hasHandleBounds, updateNodeInternals]);

  useEffect(() => {
    const handleSelection = (e: Event) => {
      const customEvent = e as CustomEvent;
      const nextId = typeof customEvent.detail === 'string' && customEvent.detail ? customEvent.detail : null;
      setSelectedBadgeId(nextId);
    };
    window.addEventListener('selectBadgeNode', handleSelection);
    return () => window.removeEventListener('selectBadgeNode', handleSelection);
  }, []);

  const isParent = data.hasChildren;
  const wrapperStyle = {
    position: 'relative' as const,
    pointerEvents: 'auto' as const,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box' as const,
  };

  const customNodeStyle = isParent 
    ? { position: 'relative' as const, zIndex: 1, width: '100%', height: '100%', padding: '16px', boxSizing: 'border-box' as const }
    : { position: 'relative' as const, zIndex: 1, width: '100%', boxSizing: 'border-box' as const };

  // ── 노드 내부 시스템 속성 (Spec 3.5 / 4.4 / Rule 5-3) ──
  const props = data.properties || {};
  // 📌 Manual Override: 합성 엔진이 덮어쓰지 않는 고정 상태 (Mark Blocked 사유 포함)
  const isPinned = props.is_manual_override === true || props.is_manual_override === 'true';
  // 🟣 Change Impact Ripple: 기능 변경 표시 (테스터가 Acknowledge 할 때까지 유지)
  const isModified = props.is_modified === true || props.is_modified === 'true';
  // ☑ 노드 내부 체크리스트 (B안: properties.checklist 배열) 진행률 배지 계산
  const checklist: Array<{ status?: string }> = Array.isArray(props.checklist) ? props.checklist : [];
  const clTotal = checklist.length;
  const clPassed = checklist.filter(i => i.status === 'Passed').length;
  const clFailed = checklist.filter(i => i.status === 'Failed').length;
  const clBlocked = checklist.filter(i => i.status === 'Blocked').length;
  // 우선순위: Failed > Blocked > 전부 Passed > 진행 중
  let checklistBadge: { text: string; tone: string } | null = null;
  if (clTotal > 0) {
    if (clFailed > 0) checklistBadge = { text: t.checklist.badgeFailed(clFailed, clTotal), tone: 'failed' };
    else if (clBlocked > 0) checklistBadge = { text: t.checklist.badgeBlocked(clBlocked, clTotal), tone: 'blocked' };
    else if (clPassed === clTotal) checklistBadge = { text: t.checklist.badgeAllPassed(clPassed, clTotal), tone: 'passed' };
    else checklistBadge = { text: t.checklist.badgeProgress(clPassed, clTotal), tone: 'progress' };
  }
  // 부모 노드를 접었을 때(isCollapsed) 하위 자식 노드들의 통과/결함 요약 배지 (AI_IMPLEMENTATION_SPEC 4.1)
  const childSummary: { total: number; passed: number; failed: number; blocked: number } | null =
    isParent && data.isCollapsed && data.childSummary ? data.childSummary : null;
  // 부모 노드를 접었을 때(isCollapsed) 영향받는 하위 자식 컴포넌트 개수 배지 (COLLAPSED_SCREEN_IMPACT_HIGHLIGHT_SPEC 3.2 & 4.2)
  const impactedChildCount: number =
    isParent && data.isCollapsed && typeof data.impactedChildCount === 'number' ? data.impactedChildCount : 0;
  // Detail-on-Demand 동적 결함 칩 (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 3.2): 실패한 전역 배지만 상단 붉은 결함 칩으로 노출
  const failedBadges = Array.isArray(data.badges)
    ? data.badges.filter((b: any) => b?.test_status === 'Failed')
    : [];

  return (
    <div className="custom-node-wrapper" style={wrapperStyle}>
      {/* Target Handle: 평소에는 노드 중앙의 1px 점(클릭 가로채기 없음).
          연결 드래그 중(.react-flow--connecting)에만 CSS로 노드 전체 크기의 드롭 히트박스로 확장됩니다. (AGENTS.md #9) */}
      <Handle type="target" position={Position.Top} id="target" className="target-drop-handle" />
      <Handle type="source" position={Position.Bottom} id="source" className="halo-handle" />
      <div className={`custom-node${isModified ? ' node-modified-pulse' : ''}`} style={customNodeStyle}>
        {/* Collapse/Expand button for parent nodes */}
        {data.hasChildren && (
          <button className="collapse-btn nodrag nopan" 
               onPointerDown={(e) => e.stopPropagation()}
               onClick={(e) => {
                 e.stopPropagation();
                 window.dispatchEvent(new CustomEvent('toggleCollapseNode', { detail: id }));
               }}>
            {data.isCollapsed ? '+' : '−'}
          </button>
        )}

        {/* Category label (e.g., Screen, Component) */}
        <div className="node-type">
          {data.label || 'Node'}
          {/* 📌 수동 고정 표시: 사유는 툴팁으로 노출 */}
          {isPinned && (
            <span className="override-pin" title={t.override.pinTitle(props.override_reason || '')}>📌</span>
          )}
        </div>
        
        {/* Node name (e.g., ARENA, ARENA_SHOP) */}
        <div className="node-label">{data.name}</div>

        {/* 부모 노드 접기 시 하위 자식 진행률 요약 배지 (Spec 4.1) */}
        {childSummary && childSummary.total > 0 && (
          <div className="parent-collapse-summary">
            {t.parentCollapse.summary(childSummary.passed, childSummary.failed, childSummary.blocked, childSummary.total)}
          </div>
        )}

        {/* 부모 노드 접기 시 하위 자식 영향도 요약 배지 (COLLAPSED_SCREEN_IMPACT_HIGHLIGHT_SPEC 3.2 & 4.2) */}
        {impactedChildCount > 0 && (
          <div className="parent-collapse-impact-summary">
            {t.parentCollapse.affectedChildCount(impactedChildCount)}
          </div>
        )}

        {/* 변경 표시 칩 + 체크리스트 진행률 배지 + 동적 결함 칩 (값이 있을 때만 렌더링하여 노드를 컴팩트하게 유지) */}
        {(isModified || checklistBadge || failedBadges.length > 0) && (
          <div className="node-status-chips">
            {isModified && (
              <span className="modified-chip" title={props.modified_note || ''}>{t.modified.chip}</span>
            )}
            {checklistBadge && (
              <span className={`checklist-badge checklist-badge-${checklistBadge.tone}`}>{checklistBadge.text}</span>
            )}
            {failedBadges.map((fb: any, idx: number) => {
              const fbChecklist: Array<{ text?: string }> = Array.isArray(fb.properties?.checklist) ? fb.properties.checklist : [];
              const fbTitle = fbChecklist.length > 0
                ? fbChecklist.map(c => c.text).filter(Boolean).join(' / ') || fb.name
                : (fb.properties?.description || fb.name);
              return (
                <span key={fb.edgeId || fb.id || idx} className="fault-chip" title={fbTitle}>
                  {t.scopedAudit.faultChip(fb.name)}
                </span>
              );
            })}
          </div>
        )}
        
        {/* Alias tags */}
        {data.aliases && data.aliases.length > 0 && (
          <div className="node-aliases">
            {data.aliases.map((alias: string, i: number) => (
              <span key={i} className="alias-tag">{alias}</span>
            ))}
          </div>
        )}

        {/* Dependencies section (Badge pills for global common nodes) */}
        {data.badges && data.badges.length > 0 && (
          <div className="node-badges-section" style={{ position: 'relative', zIndex: 'var(--z-node-badge)' }}>
            <div className="node-badges-title">Dependencies</div>
            <div className="node-badges">
              {data.badges.map((badge: any, i: number) => {
                // Badge border/background color based on test status
                const isPassed = badge.test_status === 'Passed';
                const isFailed = badge.test_status === 'Failed';
                const isBlocked = badge.test_status === 'Blocked';
                const borderColor = isPassed ? '#86efac' 
                                  : isFailed ? '#fca5a5' 
                                  : isBlocked ? '#fcd34d'
                                  : '#cbd5e1';
                const bgColor = isPassed ? '#dcfce7' 
                              : isFailed ? '#fee2e2' 
                              : isBlocked ? '#fef3c7'
                              : '#f1f5f9';
                const textColor = isPassed ? 'var(--status-passed-text)' 
                                : isFailed ? 'var(--status-failed-text)' 
                                : isBlocked ? 'var(--status-blocked-text)'
                                : '#334155';
                const isSelected = selectedBadgeId === badge.id;
                const highlightStyle = isSelected 
                  ? { boxShadow: '0 0 0 2px #2563eb, 0 0 10px rgba(96, 165, 250, 0.5)', borderColor: '#2563eb' } 
                  : {};
                const impactSlot = data.activeImpactSlots && typeof data.activeImpactSlots[badge.id] === 'number'
                  ? data.activeImpactSlots[badge.id]
                  : undefined;
                const badgeSlotClass = impactSlot !== undefined
                  ? ` badge-impact-active badge-impact-slot-${impactSlot}`
                  : '';

                return (
                  <div key={i} className={`badge-pill${badgeSlotClass}`}
                       data-badge-id={badge.id}
                       onClick={(e) => {
                         e.stopPropagation();
                         if (!badge.id) return;
                         window.dispatchEvent(new CustomEvent('selectBadgeNode', { detail: badge.id }));
                       }}
                       onMouseEnter={() => {
                         window.dispatchEvent(new CustomEvent('hoverGlobalBadge', { detail: badge.id }));
                       }}
                       onMouseLeave={() => {
                         window.dispatchEvent(new CustomEvent('unhoverGlobalBadge'));
                       }}
                       style={{ border: `1px solid ${borderColor}`, backgroundColor: bgColor, color: textColor, ...highlightStyle }}>
                    {isPassed && <span style={{ color: 'var(--status-passed-text)', fontSize: '0.7rem' }}>✔</span>}
                    {isFailed && <span style={{ color: 'var(--status-failed-text)', fontSize: '0.7rem' }}>✖</span>}
                    <span style={{flex: 1}}>{badge.name}</span>
                    <div className="badge-actions" style={{ display: 'flex', gap: '2px', marginLeft: '4px', alignItems: 'center' }}>
                      <button 
                        title="Mark Passed"
                        onClick={(e) => {
                           e.stopPropagation();
                           window.dispatchEvent(new CustomEvent('markBadgeStatus', { detail: { edgeId: badge.edgeId, status: 'Passed' } }));
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--status-passed-text)', cursor: 'pointer', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>✓</button>
                      <button 
                        title="Mark Failed"
                        onClick={(e) => {
                           e.stopPropagation();
                           window.dispatchEvent(new CustomEvent('markBadgeStatus', { detail: { edgeId: badge.edgeId, status: 'Failed' } }));
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--status-failed-text)', cursor: 'pointer', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>✕</button>
                      <div style={{ width: '1px', height: '10px', background: 'rgba(0,0,0,0.15)', margin: '0 2px' }}></div>
                      <button 
                        title="Disconnect Dependency (Edge only)"
                        onClick={(e) => {
                           e.stopPropagation();
                           if (window.confirm(t.globalNode.unlinkConfirm)) {
                             window.dispatchEvent(new CustomEvent('deleteBadge', { detail: { nodeId: id, edgeId: badge.edgeId } }));
                           }
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>⊘</button>
                    </div>
                    {(() => {
                      const badgeChecklist: Array<{ id?: string; text?: string; status?: string }> = Array.isArray(badge.properties?.checklist)
                        ? badge.properties.checklist.filter((item: any) => item && String(item.text || '').trim().length > 0)
                        : [];
                      const hasBadgeTooltip = badgeChecklist.length > 0 || Boolean(badge.properties?.description) || Boolean(badge.properties?.issue_link);
                      if (!hasBadgeTooltip) return null;
                      const badgeStatusIcon = (st?: string) =>
                        st === 'Passed' ? '🟢' : st === 'Failed' ? '🔴' : st === 'Blocked' ? '🟡' : '⚪';
                      return (
                        <div className="badge-tooltip" onClick={e => e.stopPropagation()}>
                          <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>{badge.name} Verification Guide</div>
                          {badgeChecklist.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: badge.properties?.issue_link ? '8px' : '0', color: 'rgba(255,255,255,0.9)', lineHeight: '1.4' }}>
                              {badgeChecklist.map((item: any, cIdx: number) => (
                                <div key={item.id || cIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                  <span style={{ flexShrink: 0 }}>{badgeStatusIcon(item.status)}</span>
                                  <span>{item.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : badge.properties?.description ? (
                            <div style={{ marginBottom: badge.properties?.issue_link ? '8px' : '0', color: 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>
                              {badge.properties.description}
                            </div>
                          ) : null}
                          {badge.properties?.issue_link && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {badge.properties.issue_link.split(/[,\n]+/).map((l: string) => l.trim()).filter((link: string) => link.length > 0).map((link: string, idx: number) => {
                                let url = link;
                                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                  url = 'https://' + url;
                                }
                                let hostname = link;
                                try {
                                  hostname = new URL(url).hostname;
                                } catch(e) {}
                                return (
                                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    {hostname}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom comparator: only re-render when actual visible data changes.
// Ignore xPos, yPos, dragging, zIndex etc. which change every drag frame.
export default memo(CoverageNode, (prev, next) => {
  return prev.data === next.data && prev.selected === next.selected;
});
