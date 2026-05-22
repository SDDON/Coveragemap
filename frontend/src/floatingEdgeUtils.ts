import { Position, type XYPosition, type InternalNode } from '@xyflow/react';

/**
 * 플로팅 엣지 유틸리티 함수들.
 * 노드 테두리의 가장 가까운 지점에서 엣지가 시작/끝나도록 교차점을 계산한다.
 * React Flow 공식 Floating Edge 예제 패턴을 기반으로 작성.
 */

// 두 노드 중심을 잇는 직선이 intersectionNode의 테두리와 만나는 교차점 계산
function getNodeIntersection(intersectionNode: InternalNode, targetNode: InternalNode): XYPosition {
  const { width: iw, height: ih } = intersectionNode.measured ?? { width: 0, height: 0 };
  const { width: tw, height: th } = targetNode.measured ?? { width: 0, height: 0 };

  const w = (iw ?? 0) / 2;
  const h = (ih ?? 0) / 2;

  // 각 노드의 중심 좌표
  const x2 = intersectionNode.internals.positionAbsolute.x + w;
  const y2 = intersectionNode.internals.positionAbsolute.y + h;
  const x1 = targetNode.internals.positionAbsolute.x + (tw ?? 0) / 2;
  const y1 = targetNode.internals.positionAbsolute.y + (th ?? 0) / 2;

  // 사각형 테두리와의 교차점 계산 (정규화된 좌표계 사용)
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

// 교차점이 노드의 어느 면에 가장 가까운지 판별하여 Position 반환
function getEdgePosition(node: InternalNode, intersectionPoint: XYPosition): Position {
  const { width: nw, height: nh } = node.measured ?? { width: 0, height: 0 };
  const nx = Math.round(intersectionPoint.x - node.internals.positionAbsolute.x);
  const ny = Math.round(intersectionPoint.y - node.internals.positionAbsolute.y);
  const w = nw ?? 0;
  const h = nh ?? 0;

  if (nx <= 0) return Position.Left;
  if (nx >= w) return Position.Right;
  if (ny <= 0) return Position.Top;
  if (ny >= h) return Position.Bottom;

  return Position.Top;
}

// source, target 노드에 대한 엣지 시작/끝점 좌표와 Position을 한번에 계산
export function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}
