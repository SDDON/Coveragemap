import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

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

  useEffect(() => {
    const handleSelection = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSelectedBadgeId(customEvent.detail); // detail is the badge id
    };
    window.addEventListener('selectBadgeNode', handleSelection);
    return () => window.removeEventListener('selectBadgeNode', handleSelection);
  }, []);

  const isParent = data.hasChildren;
  const wrapperStyle = isParent 
    ? { position: 'relative' as const, pointerEvents: 'auto' as const, width: '100%', height: '100%' }
    : { position: 'relative' as const, pointerEvents: 'auto' as const, width: '240px' };

  const customNodeStyle = isParent 
    ? { position: 'relative' as const, zIndex: 1, width: '100%', height: '100%', padding: '16px', boxSizing: 'border-box' as const }
    : { position: 'relative' as const, zIndex: 1 };

  return (
    <div className="custom-node-wrapper" style={wrapperStyle}>
      <Handle type="target" position={Position.Top} id="target" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, width: '1px', height: '1px', zIndex: -2 }} />
      <Handle type="source" position={Position.Bottom} id="source" className="halo-handle" />
      <div className="custom-node" style={customNodeStyle}>
        {/* Collapse/Expand button for parent nodes */}
        {data.hasChildren && (
          <button className="collapse-btn" 
               onClick={(e) => {
                 e.stopPropagation();
                 window.dispatchEvent(new CustomEvent('toggleCollapseNode', { detail: id }));
               }}
               style={{
                 position: 'absolute', top: '12px', right: '12px', width: '28px', height: '28px',
                 backgroundColor: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.3)', 
                 borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                 cursor: 'pointer', zIndex: 1000, fontSize: '16px', fontWeight: 'bold', 
                 color: 'rgba(255,255,255,0.9)', padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
               }}>
            {data.isCollapsed ? '+' : '−'}
          </button>
        )}

        {/* Category label (e.g., Screen, Component) */}
        <div className="node-type">{data.label || 'Node'}</div>
        
        {/* Node name (e.g., ARENA, ARENA_SHOP) */}
        <div className="node-label">{data.name}</div>
        
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
          <div className="node-badges-section" style={{ position: 'relative', zIndex: 1000 }}>
            <div className="node-badges-title">Dependencies</div>
            <div className="node-badges">
              {data.badges.map((badge: any, i: number) => {
                // Badge border/background color based on test status
                const isPassed = badge.test_status === 'Passed';
                const isFailed = badge.test_status === 'Failed';
                const borderColor = isPassed ? 'rgba(34, 197, 94, 0.5)' 
                                  : isFailed ? 'rgba(239, 68, 68, 0.5)' 
                                  : 'rgba(255,255,255,0.15)';
                const bgColor = isPassed ? 'rgba(22, 101, 52, 0.4)' 
                              : isFailed ? 'rgba(153, 27, 27, 0.4)' 
                              : 'rgba(255,255,255,0.05)';
                const isSelected = selectedBadgeId === badge.id;
                const highlightStyle = isSelected 
                  ? { boxShadow: '0 0 0 2px #60a5fa, 0 0 12px rgba(96, 165, 250, 0.6)', borderColor: '#60a5fa' } 
                  : {};

                return (
                  <div key={i} className="badge-pill" 
                       onClick={(e) => {
                         e.stopPropagation();
                         window.dispatchEvent(new CustomEvent('selectBadgeNode', { detail: badge.id }));
                       }}
                       onMouseEnter={() => {
                         window.dispatchEvent(new CustomEvent('hoverGlobalBadge', { detail: badge.id }));
                       }}
                       onMouseLeave={() => {
                         window.dispatchEvent(new CustomEvent('unhoverGlobalBadge'));
                       }}
                       style={{ border: `1px solid ${borderColor}`, backgroundColor: bgColor, ...highlightStyle }}>
                    {isPassed && <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>✔</span>}
                    {isFailed && <span style={{ color: '#f87171', fontSize: '0.7rem' }}>✖</span>}
                    <span style={{flex: 1}}>{badge.name}</span>
                    <div className="badge-actions" style={{ display: 'flex', gap: '2px', marginLeft: '4px', alignItems: 'center' }}>
                      <button 
                        title="Mark Passed"
                        onClick={(e) => {
                           e.stopPropagation();
                           window.dispatchEvent(new CustomEvent('markBadgeStatus', { detail: { edgeId: badge.edgeId, status: 'Passed' } }));
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#4ade80', cursor: 'pointer', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>✓</button>
                      <button 
                        title="Mark Failed"
                        onClick={(e) => {
                           e.stopPropagation();
                           window.dispatchEvent(new CustomEvent('markBadgeStatus', { detail: { edgeId: badge.edgeId, status: 'Failed' } }));
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>✕</button>
                      <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }}></div>
                      <button 
                        title="Disconnect Dependency (Edge only)"
                        onClick={(e) => {
                           e.stopPropagation();
                           if (window.confirm("정말 이 뱃지와의 연결(Edge)을 해제하시겠습니까?\n(글로벌 뱃지 원본 데이터는 삭제되지 않습니다.)")) {
                             window.dispatchEvent(new CustomEvent('deleteBadge', { detail: { nodeId: id, edgeId: badge.edgeId } }));
                           }
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>⊘</button>
                    </div>
                    {(badge.properties?.description || badge.properties?.issue_link) && (
                      <div className="badge-tooltip" onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>{badge.name} Verification Guide</div>
                        {badge.properties?.description && (
                          <div style={{ marginBottom: badge.properties?.issue_link ? '8px' : '0', color: 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>
                            {badge.properties.description}
                          </div>
                        )}
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
                    )}
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
