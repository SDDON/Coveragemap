import { useCallback } from 'react';
import {
  useStore,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
  type ReactFlowState,
} from '@xyflow/react';

import { getEdgeParams } from './floatingEdgeUtils';
import type { CoverageEdge, CoverageEdgeData } from './types/graph';

/**
 * 플로팅 엣지 컴포넌트.
 * 고정된 핸들 위치 대신 노드 테두리의 최적 지점에서 엣지가 시작/끝난다.
 * 양방향 엣지도 자연스럽게 분리되어 표시된다.
 */
export default function FloatingEdge({
  id,
  source,
  target,
  style,
  label,
  data,
}: EdgeProps<CoverageEdge>) {
  // React Flow 내부 스토어에서 소스/타겟 노드의 InternalNode 정보를 구독
  const sourceNode = useStore(
    useCallback((s: ReactFlowState) => s.nodeLookup.get(source), [source])
  );
  const targetNode = useStore(
    useCallback((s: ReactFlowState) => s.nodeLookup.get(target), [target])
  );

  if (!sourceNode || !targetNode) {
    return null;
  }

  // 노드 테두리 교차점 계산
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  const edgeData = data as CoverageEdgeData | undefined;
  const pathOffset = edgeData?.pathOffset || 0;
  
  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (pathOffset === 0) {
    // 단방향 엣지: 기본 베지어 곡선 (테두리간 최단경로 느낌)
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: sourcePos,
      targetX: tx,
      targetY: ty,
      targetPosition: targetPos,
    });
  } else {
    // 양방향 엣지: 두 선이 겹치지 않도록 활 모양(Quadratic Bezier)으로 그림
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    
    // 엣지 방향에 수직인 법선 벡터 계산
    const nx = -dy / len;
    const ny = dx / len;

    // 중앙 제어점을 법선 방향으로 pathOffset 만큼 이동시켜 호(arc)를 만듦
    const midX = (sx + tx) / 2 + nx * pathOffset;
    const midY = (sy + ty) / 2 + ny * pathOffset;

    edgePath = `M${sx},${sy} Q${midX},${midY} ${tx},${ty}`;
    
    // 라벨 위치 계산을 위한 t 값. 여러 선이 겹치는 경우 곡선을 따라 위치를 엇갈리게(Stagger) 배치
    const edgeIndex = edgeData?.edgeIndex || 0;
    const totalEdges = edgeData?.totalEdges || 1;
    const isReverse = edgeData?.isReverse || false;
    
    // 기본적으로 호의 중간(t=0.5)에 위치하지만, 갯수에 따라 t값을 0.3 ~ 0.7 사이로 분산
    let staggerOffset = (edgeIndex - (totalEdges - 1) / 2) * 0.15;
    // 역방향 엣지의 경우 방향이 반대이므로, 오프셋의 부호를 뒤집어야 절대적인 Y 높이가 엇갈리게 됩니다.
    if (isReverse) staggerOffset = -staggerOffset;
    
    const t = 0.5 + staggerOffset;
    const u = 1 - t;

    // 베지어 곡선의 t 위치값 공식: B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
    labelX = u * u * sx + 2 * u * t * midX + t * t * tx;
    labelY = u * u * sy + 2 * u * t * midY + t * t * ty;
  }

  const markerId = `marker-${id}`;
  const markerColor = edgeData?.markerColor || '#64748b';
  const edgeTypeLower = String(edgeData?.type || label || '').toLowerCase();
  const isContainsEdge = edgeTypeLower === 'contains' || edgeTypeLower === 'has';

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path className="custom-marker-path" d="M 0 0 L 10 5 L 0 10 z" fill={markerColor} />
        </marker>
      </defs>
      <BaseEdge id={id} path={edgePath} markerEnd={`url(#${markerId})`} style={style} />
      {label && !isContainsEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: '0.7rem',
              color: '#e57373',
              fontWeight: 500,
              pointerEvents: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            className="nodrag nopan"
          >
            <div style={{ textAlign: 'center' }}>
              <div>{label}</div>
              {edgeData?.action && (
                <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
                  ({edgeData.action})
                </div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
