import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';

/**
 * 양방향 엣지를 위한 커스텀 엣지 컴포넌트.
 * data.pathOffset 값에 따라 곡선이 좌/우로 휘어집니다.
 *   - offset = 0: 직선 (단방향 엣지)
 *   - offset > 0: 오른쪽으로 호
 *   - offset < 0: 왼쪽으로 호
 */
export default function OffsetEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const offset = (data as any)?.pathOffset || 0;

  // 소스→타겟 방향 벡터
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // 법선 벡터 (엣지 방향에 수직)
  const nx = -dy / len;
  const ny = dx / len;

  // 곡선의 중간 제어점을 법선 방향으로 offset만큼 이동
  const midX = (sourceX + targetX) / 2 + nx * offset;
  const midY = (sourceY + targetY) / 2 + ny * offset;

  // Quadratic Bezier: 하나의 제어점으로 부드러운 호 생성
  const path = `M${sourceX},${sourceY} Q${midX},${midY} ${targetX},${targetY}`;

  // 라벨 위치 (호의 중간)
  const labelX = (sourceX + 2 * midX + targetX) / 4;
  const labelY = (sourceY + 2 * midY + targetY) / 4;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: '0.7rem',
              color: '#e57373',
              fontWeight: 500,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
