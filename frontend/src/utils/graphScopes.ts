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
 * 엣지 추가/삭제/타입/액션/속성 변경 키 — 엣지 연결 및 편집 즉시 Focus+Context 하이라이트(active, incoming/outgoing, highlight-edge) 재계산 트리거
 */
export function getEdgesKey(edges: CoverageEdge[]): string {
  return edges
    .map(
      e =>
        `${e.id}:${e.source}:${e.target}:${e.data?.type || ''}:${e.label || ''}:${e.data?.action || ''}:${e.data?.test_status || ''}:${JSON.stringify(e.data?.properties || {})}`
    )
    .sort()
    .join('|');
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

/**
 * 도메인 문자열을 표준 키(Battle, Growth, Economy, Social, System 또는 사용자 지정 문자열)로 정규화합니다.
 */
export function canonicalizeDomain(raw?: string | null): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  const lower = val.toLowerCase();
  if ((t.domain.keywords.battle as readonly string[]).some(k => lower === k || lower.includes(k))) return 'Battle';
  if ((t.domain.keywords.growth as readonly string[]).some(k => lower === k || lower.includes(k))) return 'Growth';
  if ((t.domain.keywords.economy as readonly string[]).some(k => lower === k || lower.includes(k))) return 'Economy';
  if ((t.domain.keywords.social as readonly string[]).some(k => lower === k || lower.includes(k))) return 'Social';
  if ((t.domain.keywords.system as readonly string[]).some(k => lower === k || lower.includes(k))) return 'System';
  return val;
}

export function getRawNodeDomain(node?: CoverageNode | null): string {
  if (!node) return '';
  const raw = node.data?.properties?.domain ?? node.data?.domain ?? '';
  const explicit = canonicalizeDomain(String(raw));
  if (explicit) return explicit;

  // Fallback: aliases 또는 노드 이름의 해시태그(#도메인:전투, #domain:Battle, #Growth 등)에서 도메인 추출
  const aliases: string[] = Array.isArray(node.data?.aliases) ? node.data.aliases.map(a => String(a)) : [];
  const nameTags = Array.from(String(node.data?.name || '').matchAll(/#([^\s#]+)/g)).map(m => m[1]);
  const tokens = [...aliases, ...nameTags];

  for (const tk of tokens) {
    const clean = tk.replace(/^#+/, '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    for (const prefix of t.domain.tagPrefixes) {
      if (lower.startsWith(prefix)) {
        const extracted = clean.slice(prefix.length).trim();
        if (extracted) return canonicalizeDomain(extracted);
      }
    }
  }

  for (const tk of tokens) {
    const clean = tk.replace(/^#+/, '').trim().toLowerCase();
    if (!clean) continue;
    if ((t.domain.keywords.battle as readonly string[]).includes(clean)) return 'Battle';
    if ((t.domain.keywords.growth as readonly string[]).includes(clean)) return 'Growth';
    if ((t.domain.keywords.economy as readonly string[]).includes(clean)) return 'Economy';
    if ((t.domain.keywords.social as readonly string[]).includes(clean)) return 'Social';
    if ((t.domain.keywords.system as readonly string[]).includes(clean)) return 'System';
  }

  return '';
}

export function getEffectiveNodeDomain(node: CoverageNode, allNodes?: CoverageNode[]): string {
  const own = getRawNodeDomain(node);
  if (own) return own;
  if (node.parentId && allNodes) {
    const parent = allNodes.find(p => p.id === node.parentId);
    if (parent) return getRawNodeDomain(parent);
  }
  return '';
}

export function getDomainMeta(domainKey: string): { key: string; tone: string; displayLabel: string } {
  const canon = domainKey === '__unassigned__' ? '__unassigned__' : canonicalizeDomain(domainKey);
  if (canon === 'Battle') return { key: 'Battle', tone: 'battle', displayLabel: t.domain.presets.Battle };
  if (canon === 'Growth') return { key: 'Growth', tone: 'growth', displayLabel: t.domain.presets.Growth };
  if (canon === 'Economy') return { key: 'Economy', tone: 'economy', displayLabel: t.domain.presets.Economy };
  if (canon === 'Social') return { key: 'Social', tone: 'social', displayLabel: t.domain.presets.Social };
  if (canon === 'System') return { key: 'System', tone: 'system', displayLabel: t.domain.presets.System };
  if (canon === '__unassigned__') return { key: '__unassigned__', tone: 'system', displayLabel: t.domain.unassigned };
  return { key: canon, tone: 'custom', displayLabel: `🏷️ ${canon}` };
}

/**
 * PROPOSAL_TAG_BASED_DOMAIN_GROUPING.md 3.1 & 4.1:
 * 선택된 도메인에 속한 노드(.domain-matched), 이들과 직접 연결된 허브 노드(.domain-hub),
 * 그리고 연결 간선(.domain-edge)을 계산합니다.
 */
export function computeDomainScope(
  selectedDomain: string | null,
  nodes: CoverageNode[],
  edges: CoverageEdge[]
) {
  const matchedNodeIds = new Set<string>();
  const cameraNodeIds = new Set<string>();
  const hubNodeIds = new Set<string>();
  const domainEdgeIds = new Set<string>();
  const domainInternalEdgeIds = new Set<string>();
  if (!selectedDomain) {
    return { matchedNodeIds, cameraNodeIds, hubNodeIds, domainEdgeIds, domainInternalEdgeIds, key: '' };
  }

  const coreMatchedIds = new Set<string>();
  for (const n of nodes) {
    if (String(n.data?.properties?.is_global ?? n.data?.is_global ?? '').toLowerCase() === 'true') continue;
    const eff = getEffectiveNodeDomain(n, nodes);
    if (selectedDomain === '__unassigned__') {
      if (!eff) coreMatchedIds.add(n.id);
    } else if (eff === selectedDomain) {
      coreMatchedIds.add(n.id);
    }
  }

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  coreMatchedIds.forEach(id => matchedNodeIds.add(id));

  // 자식 노드가 매칭된 경우 소속 부모 컨테이너도 가시성 유지(matchedNodeIds)에 포함하되,
  // 다른 도메인의 형제 자식으로 오염 전파하지 않으며, 카메라 타겟(cameraNodeIds)에는
  // 실제 도메인 매칭 노드(또는 접힌 부모 대리 노드)만 포함합니다.
  for (const id of coreMatchedIds) {
    const n = nodeById.get(id);
    if (!n) continue;
    if (n.parentId) {
      matchedNodeIds.add(n.parentId);
      const parentNode = nodeById.get(n.parentId);
      if (n.hidden || parentNode?.data?.isCollapsed) {
        if (parentNode && !parentNode.hidden) {
          cameraNodeIds.add(parentNode.id);
          coreMatchedIds.add(parentNode.id);
        }
      } else {
        cameraNodeIds.add(n.id);
      }
    } else if (!n.hidden) {
      cameraNodeIds.add(n.id);
    }
  }

  // 매칭된 도메인 노드들과 직접 연결된 1-hop 외부 허브 노드(예: 메인 로비) 및 간선 산출
  for (const e of edges) {
    const sCore = coreMatchedIds.has(e.source);
    const tCore = coreMatchedIds.has(e.target);
    const sMatched = matchedNodeIds.has(e.source);
    if (sCore && tCore) {
      domainEdgeIds.add(e.id);
      domainInternalEdgeIds.add(e.id);
    } else if (isContainsEdge(e) && sMatched && tCore) {
      domainEdgeIds.add(e.id);
      domainInternalEdgeIds.add(e.id);
    } else if (!isContainsEdge(e) && (sCore || tCore)) {
      domainEdgeIds.add(e.id);
      const hubId = sCore ? e.target : e.source;
      if (!matchedNodeIds.has(hubId)) {
        hubNodeIds.add(hubId);
      }
      const hubNode = nodeById.get(hubId);
      if (hubNode?.parentId && !matchedNodeIds.has(hubNode.parentId)) {
        hubNodeIds.add(hubNode.parentId);
      }
    }
  }

  const key = `${selectedDomain}|${Array.from(matchedNodeIds).sort().join(',')}|${Array.from(hubNodeIds).sort().join(',')}|${Array.from(domainEdgeIds).sort().join(',')}|${Array.from(domainInternalEdgeIds).sort().join(',')}`;
  return { matchedNodeIds, cameraNodeIds, hubNodeIds, domainEdgeIds, domainInternalEdgeIds, key };
}


