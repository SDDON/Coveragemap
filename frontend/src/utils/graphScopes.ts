import type { CoverageNode, CoverageEdge } from '../types/graph';
import { edgeTypeOf } from '../statusPropagation';
import { AFFECTED_MAX_HOPS } from './constants';
import { t } from '../locales/koKR';

// Living TC 4-Stage 연쇄 전파 엔진 (백엔드 compute_synthesized_status 와 동일 규칙)

/**
 * Helper to check if an edge represents parent-child containment.
 */
export function isContainsEdge(e: CoverageEdge): boolean {
  const et = String(e.data?.type || e.label || '').toLowerCase();
  return et === 'contains' || et === 'has';
}

/**
 * Infers default edge type based on source/target node labels.
 */
export function getSmartDefaultEdgeType(sourceNode?: CoverageNode, targetNode?: CoverageNode): string {
  const sourceLabel = sourceNode?.data?.label;
  const targetLabel = targetNode?.data?.label;
  if (sourceLabel === 'System' || sourceLabel === 'Category') return 'Contains';
  if (sourceLabel === 'TestCase') return targetLabel === 'TestCase' ? 'Depends_On' : 'Tests';
  return 'Transition';
}

/**
 * D. 변경 영향권(Impact Ripple): is_modified 노드에서 나가는 엣지(Return 제외)를 따라 1~2홉 하류 노드/엣지.
 * 집합 객체 대신 정렬된 키 문자열을 함께 만들어, 내용이 같으면 하이라이트 effect가 다시 돌지 않게 합니다.
 */
export function computeAffectedScope(nodes: CoverageNode[], edges: CoverageEdge[]) {
  const modifiedIds = nodes
    .filter(n => {
      const v = n.data?.properties?.is_modified ?? n.data?.is_modified;
      return v === true || v === 'true';
    })
    .map(n => n.id);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  let frontier = modifiedIds;
  const visited = new Set(modifiedIds);
  for (let hop = 0; hop < AFFECTED_MAX_HOPS && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of edges) {
        if (e.source !== id || edgeTypeOf(e) === 'RETURN') continue;
        edgeIds.add(e.id);
        if (!visited.has(e.target)) {
          visited.add(e.target);
          nodeIds.add(e.target);
          next.push(e.target);
        }
      }
    }
    frontier = next;
  }

  // D. 변경 영향권(Impact Ripple) 또는 변경 표시(is_modified)에 포함된 자식 노드의 부모 Screen 상향 롤업 (COLLAPSED_SCREEN_IMPACT_HIGHLIGHT_SPEC 4.1)
  const parentNodeIds = new Set<string>();
  for (const nid of [...modifiedIds, ...nodeIds]) {
    const childNode = nodes.find(n => n.id === nid);
    if (childNode?.parentId) {
      const parentNode = nodes.find(n => n.id === childNode.parentId);
      if (parentNode) {
        parentNodeIds.add(parentNode.id);
      }
    }
  }
  for (const pid of parentNodeIds) {
    nodeIds.add(pid);
  }

  const key = `${Array.from(nodeIds).sort().join(',')}|${Array.from(edgeIds).sort().join(',')}|${[...modifiedIds].sort().join(',')}`;
  return { nodeIds, edgeIds, key };
}

/**
 * 부모 노드의 접힘(isCollapsed) 상태 키 — 접기/펼치기 시 부모 영향도 하이라이트 및 요약 칩 재계산 트리거
 */
export function getCollapsedKey(nodes: CoverageNode[]): string {
  return nodes.filter(n => n.data?.isCollapsed).map(n => n.id).sort().join(',');
}

/**
 * 엣지 추가/삭제/타입 변경 키 — 엣지 연결 즉시 Focus+Context 하이라이트(active, incoming/outgoing, highlight-edge) 재계산 트리거
 */
export function getEdgesKey(edges: CoverageEdge[]): string {
  return edges.map(e => `${e.id}:${e.source}:${e.target}:${e.data?.type || e.label || ''}`).sort().join('|');
}

/**
 * 결함 원인 역추적(Root Cause Tracing, AI_IMPLEMENTATION_SPEC 3.3):
 * tracedRootNodeId로부터 역방향(Incoming, Return 제외) BFS로 최대 10홉까지
 * Failed/Blocked 상태인 선행 노드 및 엣지 경로를 찾아 .highlight-root-cause 클래스를 부여합니다.
 */
export function computeRootCauseScope(
  tracedRootNodeId: string | null,
  nodes: CoverageNode[],
  edges: CoverageEdge[]
) {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  if (!tracedRootNodeId) return { nodeIds, edgeIds, key: '' };
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  nodeIds.add(tracedRootNodeId);
  const visited = new Set<string>([tracedRootNodeId]);
  let frontier = [tracedRootNodeId];
  for (let hop = 0; hop < 10 && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const currId of frontier) {
      for (const e of edges) {
        if (e.target !== currId || edgeTypeOf(e) === 'RETURN') continue;
        const srcNode = nodeById.get(e.source);
        const edgeSt = e.data?.test_status || 'Untested';
        const srcSt = srcNode?.data?.test_status || 'Untested';
        if (edgeSt === 'Failed' || edgeSt === 'Blocked' || srcSt === 'Failed' || srcSt === 'Blocked') {
          edgeIds.add(e.id);
          nodeIds.add(e.source);
          if (!visited.has(e.source)) {
            visited.add(e.source);
            next.push(e.source);
          }
        }
      }
    }
    frontier = next;
  }
  const key = `${Array.from(nodeIds).sort().join(',')}|${Array.from(edgeIds).sort().join(',')}`;
  return { nodeIds, edgeIds, key };
}

/**
 * 화면(Screen/Container) 단위 다국어 스코프 감사 (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 3.2 & 4.1):
 * scopedAuditRootId가 활성화되면 선택된 화면 및 직속 자식(Contains/Has 또는 1-hop) 노드 중
 * Localization/다국어 배지(또는 태그/체크리스트)를 가진 노드들만 Focus+Context로 강조하고 나머지는 dim 처리합니다.
 */
export function computeScopedAuditScope(
  scopedAuditRootId: string | null,
  nodes: CoverageNode[],
  edges: CoverageEdge[]
) {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  if (!scopedAuditRootId) return { nodeIds, edgeIds, totalInScope: 0, matchedCount: 0, key: '' };
  nodeIds.add(scopedAuditRootId);
  const directChildren = nodes.filter(n => n.parentId === scopedAuditRootId && !n.hidden);
  const candidateChildren = directChildren.length > 0
    ? directChildren
    : nodes.filter(n => !n.hidden && edges.some(e => e.source === scopedAuditRootId && e.target === n.id && edgeTypeOf(e) !== 'RETURN'));

  const kwList = t.scopedAudit.keywords;
  const hasI18nTarget = (n: CoverageNode) => {
    const badges = n.data?.badges || [];
    if (badges.some(b => {
      const bName = String(b?.name || '').toLowerCase();
      const bLabel = String(b?.label || '').toLowerCase();
      return kwList.some(kw => bName.includes(kw) || bLabel.includes(kw));
    })) return true;
    const nName = String(n.data?.name || '').toLowerCase();
    const nAliases = Array.isArray(n.data?.aliases) ? n.data.aliases.map(a => String(a).toLowerCase()) : [];
    const checklist = Array.isArray(n.data?.properties?.checklist) ? n.data.properties.checklist : [];
    return kwList.some(kw =>
      nName.includes(kw) ||
      nAliases.some(a => a.includes(kw)) ||
      checklist.some(c => String(c?.text || '').toLowerCase().includes(kw))
    );
  };

  const matchedChildren = candidateChildren.filter(hasI18nTarget);
  const highlightedChildren = matchedChildren.length > 0 ? matchedChildren : candidateChildren;
  highlightedChildren.forEach(c => nodeIds.add(c.id));

  edges.forEach(e => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target) && edgeTypeOf(e) !== 'RETURN') {
      edgeIds.add(e.id);
    }
  });

  const key = `${Array.from(nodeIds).sort().join(',')}|${Array.from(edgeIds).sort().join(',')}`;
  return {
    nodeIds,
    edgeIds,
    totalInScope: 1 + candidateChildren.length,
    matchedCount: matchedChildren.length > 0 ? matchedChildren.length : candidateChildren.length,
    key,
  };
}

/**
 * 특정 콘텐츠 중심 확인을 위한 N-Depth BFS 하이라이트 범위 산출:
 * - (1) 기준 노드가 자식 노드를 가진 부모 컨테이너(hasChildren 또는 c.parentId === seedId)인 경우,
 *   부모 노드와 직속 자식 컴포넌트 전부를 시작 시드(depth = 0, Content Unit)로 함께 등록하고
 *   부모-자식 간 Contains/Has 엣지를 edgeHighlights에 포함합니다.
 * - (2) BFS 탐색으로 도달한 이웃 노드(nextNode)가 어떤 부모 컨테이너의 자식(parentId)인 경우,
 *   해당 부모 컨테이너(parentId)도 activeNodes 및 incoming/outgoing에 함께 롤업하여 접힌 화면이 딤 처리되지 않도록 합니다.
 */
export function computeContentFocusScope(
  baseSeedIds: string[],
  currentNodes: CoverageNode[],
  currentEdges: CoverageEdge[],
  depthLimit: number
) {
  const activeNodes = new Set<string>();
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  const edgeHighlights = new Set<string>();
  const seedUnitIds = new Set<string>();
  const seedParentIds = new Set<string>();

  const getParentId = (nodeId: string): string | undefined => {
    const nodeObj = currentNodes.find(n => n.id === nodeId);
    if (nodeObj?.parentId) return nodeObj.parentId;
    return currentEdges.find(e => e.target === nodeId && isContainsEdge(e))?.source;
  };

  const getDirectChildIds = (parentId: string): string[] => {
    return currentNodes
      .filter(c =>
        c.parentId === parentId ||
        currentEdges.some(e => e.source === parentId && e.target === c.id && isContainsEdge(e))
      )
      .map(c => c.id);
  };

  for (const seedId of baseSeedIds) {
    const seedNode = currentNodes.find(n => n.id === seedId);
    if (!seedNode) continue;
    seedUnitIds.add(seedId);
    const directChildIds = getDirectChildIds(seedId);
    if (seedNode.data?.hasChildren || directChildIds.length > 0) {
      for (const childId of directChildIds) {
        seedUnitIds.add(childId);
      }
    }
    // 자식 컴포넌트 단독 선택 시 해당 부모 컨테이너도 activeNodes에 포함 (방향성 테두리 오염 없이 컨테이너 가시성 유지)
    const seedParentId = getParentId(seedId);
    if (seedParentId) {
      seedParentIds.add(seedParentId);
      activeNodes.add(seedParentId);
      currentEdges.forEach(ce => {
        if (isContainsEdge(ce) && ce.source === seedParentId && ce.target === seedId) {
          edgeHighlights.add(ce.id);
        }
      });
    }
  }

  seedUnitIds.forEach(id => activeNodes.add(id));

  for (const e of currentEdges) {
    if (seedUnitIds.has(e.source) && seedUnitIds.has(e.target)) {
      edgeHighlights.add(e.id);
    }
  }

  const queue: Array<{ id: string; depth: number }> = Array.from(seedUnitIds).map(id => ({ id, depth: 0 }));
  const visited = new Set<string>(seedUnitIds);
  const traversedEdges = new Set<string>(edgeHighlights);

  const enqueueAtDepth = (nodeId: string, nextDepth: number) => {
    activeNodes.add(nodeId);
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      queue.push({ id: nodeId, depth: nextDepth });
    }
  };

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { id, depth } = item;
    if (depth >= depthLimit) continue;

    // Contains/Has는 부모-자식 구조 엣지이므로 BFS 흐름 탐색에서는 제외하여 역방향 incoming/outgoing 오염을 방지합니다.
    const adjacentEdges = currentEdges.filter(
      e => (e.source === id || e.target === id) && !isContainsEdge(e)
    );
    for (const edge of adjacentEdges) {
      if (traversedEdges.has(edge.id)) continue;
      traversedEdges.add(edge.id);
      edgeHighlights.add(edge.id);

      const nextNode = edge.source === id ? edge.target : edge.source;
      const isOutgoing = edge.source === id;
      const nextDepth = depth + 1;

      if (!seedUnitIds.has(nextNode) && (depth === 0 || !visited.has(nextNode))) {
        if (isOutgoing) {
          outgoing.add(nextNode);
        } else {
          incoming.add(nextNode);
        }
      }

      const parentId = getParentId(nextNode);
      if (parentId) {
        activeNodes.add(parentId);
        currentEdges.forEach(ce => {
          if (isContainsEdge(ce) && ce.source === parentId && ce.target === nextNode) {
            edgeHighlights.add(ce.id);
          }
        });
        if (!seedUnitIds.has(parentId) && !seedParentIds.has(parentId) && (depth === 0 || !visited.has(parentId))) {
          if (isOutgoing) {
            outgoing.add(parentId);
          } else {
            incoming.add(parentId);
          }
        }
        // 다중 홉(nextDepth < depthLimit)에서 부모 컨테이너(특히 접힌 부모)를 경유하는 연쇄 탐색 지원 (단, 시드의 부모 컨테이너는 형제 오염 방지를 위해 제외)
        if (nextDepth < depthLimit && !seedParentIds.has(parentId)) {
          enqueueAtDepth(parentId, nextDepth);
          const parentObj = currentNodes.find(n => n.id === parentId);
          if (parentObj?.data?.isCollapsed) {
            for (const siblingId of getDirectChildIds(parentId)) {
              enqueueAtDepth(siblingId, nextDepth);
            }
          }
        }
      }

      // 도달한 노드가 부모 컨테이너이고 추가 홉 여유(nextDepth < depthLimit)가 있으면 직속 자식도 동일 홉으로 확장
      if (nextDepth < depthLimit) {
        const nextNodeObj = currentNodes.find(n => n.id === nextNode);
        const childIds = getDirectChildIds(nextNode);
        if (nextNodeObj?.data?.hasChildren || childIds.length > 0) {
          for (const childId of childIds) {
            enqueueAtDepth(childId, nextDepth);
            currentEdges.forEach(ce => {
              if (isContainsEdge(ce) && ce.source === nextNode && ce.target === childId) {
                edgeHighlights.add(ce.id);
              }
            });
          }
        }
      }

      enqueueAtDepth(nextNode, nextDepth);
    }
  }

  return { activeNodes, incoming, outgoing, edgeHighlights, seedUnitIds };
}
