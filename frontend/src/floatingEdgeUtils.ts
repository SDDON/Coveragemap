import { Position, type XYPosition, type InternalNode } from '@xyflow/react';

/**
 * 플로팅 엣지 유틸리티 함수들.
 * 노드 테두리의 가장 가까운 지점에서 엣지가 시작/끝나도록 교차점을 계산한다.
 * React Flow 공식 Floating Edge 예제 패턴을 기반으로 작성.
 */

// 두 노드 중심을 잇는 직선이 intersectionNode의 테두리와 만나는 교차점 계산
function getNodeIntersection(intersectionNode: InternalNode, targetNode: InternalNode): XYPosition {
  const iw = intersectionNode.measured?.width || Number(intersectionNode.style?.width) || intersectionNode.width || 280;
  const ih = intersectionNode.measured?.height || Number(intersectionNode.style?.height) || intersectionNode.height || 120;
  const tw = targetNode.measured?.width || Number(targetNode.style?.width) || targetNode.width || 280;
  const th = targetNode.measured?.height || Number(targetNode.style?.height) || targetNode.height || 120;

  // 부모 서브플로우 컨테이너와 내부 자식 노드 간 Contains 엣지인 경우,
  // 부모 박스 전체 외곽 하단이 아닌 상단 헤더 영역(최대 120px 높이)을 기준으로 교차점을 계산합니다.
  const isParentIntersection = targetNode.parentId === intersectionNode.id;
  const isParentTarget = intersectionNode.parentId === targetNode.id;
  const effectiveIh = Math.max(1, isParentIntersection ? Math.min(ih, 120) : ih);
  const effectiveTh = Math.max(1, isParentTarget ? Math.min(th, 120) : th);

  const w = Math.max(1, iw) / 2;
  const h = effectiveIh / 2;

  // 각 노드의 중심 좌표
  const x2 = intersectionNode.internals.positionAbsolute.x + w;
  const y2 = intersectionNode.internals.positionAbsolute.y + h;
  const x1 = targetNode.internals.positionAbsolute.x + Math.max(1, tw) / 2;
  const y1 = targetNode.internals.positionAbsolute.y + effectiveTh / 2;

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
function getEdgePosition(node: InternalNode, intersectionPoint: XYPosition, otherNode?: InternalNode): Position {
  const nw = node.measured?.width || Number(node.style?.width) || node.width || 280;
  const nh = node.measured?.height || Number(node.style?.height) || node.height || 120;
  const nx = Math.round(intersectionPoint.x - node.internals.positionAbsolute.x);
  const ny = Math.round(intersectionPoint.y - node.internals.positionAbsolute.y);
  const w = nw;
  const isParentNode = otherNode?.parentId === node.id;
  const h = isParentNode ? Math.min(nh, 120) : nh;

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

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint, target);
  const targetPos = getEdgePosition(target, targetIntersectionPoint, source);

  const sx = sourceIntersectionPoint.x;
  const sy = sourceIntersectionPoint.y;
  // 수직/수평 직선 경로의 SVG getBoundingClientRect() 폭/높이가 0이 되지 않도록 최소 1px 편차를 보장합니다.
  const tx = Math.abs(targetIntersectionPoint.x - sx) < 1 ? sx + 1 : targetIntersectionPoint.x;
  const ty = Math.abs(targetIntersectionPoint.y - sy) < 1 ? sy + 1 : targetIntersectionPoint.y;

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
}
