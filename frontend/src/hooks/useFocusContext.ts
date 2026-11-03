import { useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { CoverageNode, CoverageEdge, CoverageEdgeData, ActiveImpactItem, ImpactFilterOperator } from '../types';
import {
  computeAffectedScope,
  computeRootCauseScope,
  computeScopedAuditScope,
  computeContentFocusScope,
  computeDomainScope,
  matchesNodeSearchQuery,
  getEdgesKey,
} from '../utils/graphScopes';
import { t } from '../locales/koKR';

export interface UseFocusContextProps {
  nodes: CoverageNode[];
  edges: CoverageEdge[];
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  selectedNode: CoverageNode | null;
  selectedEdge: CoverageEdge | null;
  hoveredNode: string | null;
  hoveredEdge: string | null;
  maxDepth: number;
  searchQuery: string;
  pinnedFocusNodeId: string | null;
  tracedRootNodeId: string | null;
  scopedAuditRootId: string | null;
  activeImpacts: ActiveImpactItem[];
  impactFilterOperator: ImpactFilterOperator;
  hasImpactOverlay: boolean;
  selectedDomain?: string | null;
  graphVersion: number;
  isDraggingRef: MutableRefObject<boolean>;
}

export function useFocusContext({
  nodes,
  edges,
  setNodes,
  setEdges,
  selectedNode,
  selectedEdge,
  hoveredNode,
  hoveredEdge,
  maxDepth,
  searchQuery,
  pinnedFocusNodeId,
  tracedRootNodeId,
  scopedAuditRootId,
  activeImpacts,
  impactFilterOperator,
  hasImpactOverlay,
  selectedDomain = null,
  graphVersion,
  isDraggingRef,
}: UseFocusContextProps) {
  // 부모 노드의 접힘(isCollapsed) 상태 키 — 접기/펼치기 시 부모 영향도 하이라이트 및 요약 칩 재계산 트리거
  const collapsedKey = useMemo(
    () => nodes.map(n => `${n.id}:${n.data?.isCollapsed ? 1 : 0}`).join(','),
    [nodes]
  );
  // 엣지 추가/삭제/타입/액션/속성 변경 키 — 엣지 연결 및 편집 즉시 Focus+Context 하이라이트 재계산 트리거
  const edgesKey = useMemo(() => getEdgesKey(edges), [edges]);

  const affectedScope = useMemo(
    () => computeAffectedScope(nodes, edges, selectedNode?.id),
    [nodes, edges, selectedNode?.id]
  );
  const rootCauseScope = useMemo(() => computeRootCauseScope(tracedRootNodeId, nodes, edges), [tracedRootNodeId, nodes, edges]);
  const scopedAuditScope = useMemo(() => computeScopedAuditScope(scopedAuditRootId, nodes, edges), [scopedAuditRootId, nodes, edges]);
  const domainScope = useMemo(() => computeDomainScope(selectedDomain, nodes, edges), [selectedDomain, nodes, edges]);

  // React Flow ResizeObserver가 가시 노드의 초기 측정(measured)을 완료했는지 확인 (미측정 상태에서 setNodes로 노드 참조 교체 시 handleBounds가 초기화되는 경합 방지)
  const allNodesMeasured = useMemo(
    () => nodes.length > 0 && nodes.every(n => n.hidden || Boolean(n.measured?.width && n.measured?.height)),
    [nodes]
  );

  useEffect(() => {
    if (isDraggingRef.current) return;
    const activeNodes = new Set<string>();
    const relatedNodes = new Set<string>();
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    const edgeHighlights = new Set<string>();
    const relatedEdges = new Set<string>();

    const nodeCollapseMap = new Map<string, { parentId?: string; isCollapsed?: boolean }>();
    nodes.forEach(n => {
      nodeCollapseMap.set(n.id, { parentId: n.parentId, isCollapsed: Boolean(n.data?.isCollapsed) });
    });
    const getProxyEdgeInfo = (e: CoverageEdge) => {
      const sInfo = nodeCollapseMap.get(e.source);
      const tInfo = nodeCollapseMap.get(e.target);
      const sParent = sInfo?.parentId ? nodeCollapseMap.get(sInfo.parentId) : undefined;
      const tParent = tInfo?.parentId ? nodeCollapseMap.get(tInfo.parentId) : undefined;
      const newSource = sParent?.isCollapsed ? (sInfo?.parentId as string) : e.source;
      const newTarget = tParent?.isCollapsed ? (tInfo?.parentId as string) : e.target;
      const domainType = String(e.data?.type || e.label || 'Transition');
      const isRerouted = newSource !== e.source || newTarget !== e.target;
      const proxyId = isRerouted ? `${newSource}-${newTarget}-${domainType}` : e.id;
      return { newSource, newTarget, proxyId };
    };

    const trimmedQuery = searchQuery.trim();
    const searchSeeds = trimmedQuery
      ? nodes.filter(n => matchesNodeSearchQuery(n, trimmedQuery, nodes))
      : [];
    const searchSeedIds = new Set(searchSeeds.map(s => s.id));

    const searchMatchedEdges = trimmedQuery
      ? edges.filter(e => {
          const q = trimmedQuery.toLowerCase();
          const qClean = q.replace(/^#+/, '').trim();
          const rawType = String(e.data?.type || '');
          const rawLabel = String(e.label || '');
          const typeLower = rawType.toLowerCase();
          const labelLower = rawLabel.toLowerCase();
          const localizedType = (t.edgeType[(rawType || rawLabel) as keyof typeof t.edgeType] || '').toLowerCase();
          const actionStr = String(e.data?.action || (typeof e.data?.properties?.action === 'string' ? e.data.properties.action : '') || '').toLowerCase();
          const statusStr = String(e.data?.test_status || '').toLowerCase();
          const propsObj = e.data?.properties || {};
          const propsMatched = Object.entries(propsObj).some(([k, v]) => {
            if (v === null || v === undefined) return false;
            const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return (
              k.toLowerCase().includes(q) ||
              valStr.toLowerCase().includes(q) ||
              (qClean.length > 0 && (k.toLowerCase().includes(qClean) || valStr.toLowerCase().includes(qClean)))
            );
          });
          return (
            typeLower.includes(q) ||
            labelLower.includes(q) ||
            localizedType.includes(q) ||
            actionStr.includes(q) ||
            statusStr.includes(q) ||
            (qClean.length > 0 &&
              (typeLower.includes(qClean) || labelLower.includes(qClean) || localizedType.includes(qClean) || actionStr.includes(qClean) || statusStr.includes(qClean))) ||
            propsMatched
          );
        })
      : [];
    const searchMatchedEdgeIds = new Set(searchMatchedEdges.map(e => e.id));
    const hasSearchMatch = searchSeeds.length > 0 || searchMatchedEdges.length > 0;
    const hasPinnedFocus = Boolean(pinnedFocusNodeId && nodes.some(n => n.id === pinnedFocusNodeId));
    const isSelectedGlobal = selectedNode?.data?.properties?.is_global === 'true';

    const addGlobalHolders = (globalId: string) => {
      nodes.forEach(n => {
        const badges = n.data?.badges || [];
        if (badges.some(b => b.id === globalId)) {
          activeNodes.add(n.id);
          if (n.parentId) {
            activeNodes.add(n.parentId);
            edges.forEach(ce => {
              const et = String(ce.data?.type || ce.label || '').toLowerCase();
              if ((et === 'contains' || et === 'has') && ce.source === n.parentId && ce.target === n.id) {
                edgeHighlights.add(ce.id);
              }
            });
          }
        }
      });
    };

    if (scopedAuditScope.nodeIds.size > 0) {
      scopedAuditScope.nodeIds.forEach(id => {
        activeNodes.add(id);
        if (id !== scopedAuditRootId) outgoing.add(id);
      });
      scopedAuditScope.edgeIds.forEach(eid => edgeHighlights.add(eid));
    } else if (hasPinnedFocus || hasSearchMatch) {
      const baseSeeds: string[] = [];
      if (hasPinnedFocus && pinnedFocusNodeId) baseSeeds.push(pinnedFocusNodeId);
      for (const s of searchSeeds) {
        if (!baseSeeds.includes(s.id)) baseSeeds.push(s.id);
        if (String(s.data?.properties?.is_global ?? s.data?.is_global ?? '').toLowerCase() === 'true') {
          addGlobalHolders(s.id);
        }
      }
      if (baseSeeds.length > 0) {
        const scope = computeContentFocusScope(baseSeeds, nodes, edges, maxDepth);
        scope.activeNodes.forEach(id => activeNodes.add(id));
        scope.incoming.forEach(id => incoming.add(id));
        scope.outgoing.forEach(id => outgoing.add(id));
        scope.edgeHighlights.forEach(eid => edgeHighlights.add(eid));
      }

      if (searchMatchedEdges.length > 0) {
        searchMatchedEdges.forEach(me => {
          edgeHighlights.add(me.id);
          activeNodes.add(me.source);
          activeNodes.add(me.target);
          const pInfo = getProxyEdgeInfo(me);
          activeNodes.add(pInfo.newSource);
          activeNodes.add(pInfo.newTarget);
          const sParentId = nodeCollapseMap.get(me.source)?.parentId;
          const tParentId = nodeCollapseMap.get(me.target)?.parentId;
          if (sParentId) {
            activeNodes.add(sParentId);
            edges.forEach(ce => {
              const et = String(ce.data?.type || ce.label || '').toLowerCase();
              if ((et === 'contains' || et === 'has') && ce.source === sParentId && ce.target === me.source) {
                edgeHighlights.add(ce.id);
              }
            });
          }
          if (tParentId) {
            activeNodes.add(tParentId);
            edges.forEach(ce => {
              const et = String(ce.data?.type || ce.label || '').toLowerCase();
              if ((et === 'contains' || et === 'has') && ce.source === tParentId && ce.target === me.target) {
                edgeHighlights.add(ce.id);
              }
            });
          }
        });
      }

      // 상태 마킹 시 포커스 유지 규칙:
      // pinnedFocusNodeId 또는 searchQuery 활성 상태에서는 주변 노드/엣지를 클릭해 selectedNode/selectedEdge가 바뀌어도
      // BFS 시드를 덮어쓰지 않고 유지하며, 현재 클릭해 편집 중인 대상도 선명하게 표시합니다.
      if (selectedNode) {
        if (isSelectedGlobal) addGlobalHolders(selectedNode.id);
        else {
          activeNodes.add(selectedNode.id);
          if (selectedNode.parentId) activeNodes.add(selectedNode.parentId);
          edges.forEach(e => {
            if ((e.source === selectedNode.id && activeNodes.has(e.target)) || (e.target === selectedNode.id && activeNodes.has(e.source))) {
              edgeHighlights.add(e.id);
            }
          });
        }
      }
      if (selectedEdge) {
        edgeHighlights.add(selectedEdge.id);
        activeNodes.add(selectedEdge.source);
        activeNodes.add(selectedEdge.target);
        edges.forEach(e => {
          const pInfo = getProxyEdgeInfo(e);
          if (pInfo.proxyId === selectedEdge.id) {
            edgeHighlights.add(e.id);
            activeNodes.add(pInfo.newSource);
            activeNodes.add(pInfo.newTarget);
          }
        });
      }
    } else if (selectedNode) {
      if (isSelectedGlobal) addGlobalHolders(selectedNode.id);
      else {
        const scope = computeContentFocusScope([selectedNode.id], nodes, edges, maxDepth);
        scope.activeNodes.forEach(id => activeNodes.add(id));
        scope.incoming.forEach(id => incoming.add(id));
        scope.outgoing.forEach(id => outgoing.add(id));
        scope.edgeHighlights.forEach(eid => edgeHighlights.add(eid));
      }
    } else if (selectedEdge) {
      edgeHighlights.add(selectedEdge.id);
      activeNodes.add(selectedEdge.source);
      activeNodes.add(selectedEdge.target);
      edges.forEach(e => {
        const pInfo = getProxyEdgeInfo(e);
        if (pInfo.proxyId === selectedEdge.id) {
          edgeHighlights.add(e.id);
          activeNodes.add(pInfo.newSource);
          activeNodes.add(pInfo.newTarget);
        }
      });
      // Highlight sibling edges that point to the same target node to show the "Test Group"
      edges.filter(e => e.target === selectedEdge.target && e.id !== selectedEdge.id).forEach(e => {
        relatedEdges.add(e.id);
        relatedNodes.add(e.source);
      });
    }

    // Add hovered elements to active set (호버 시 또는 드래그 연결 직후 커서가 타겟 노드에 머물 때 연결 엣지 및 1-홉 이웃 노드가 즉시 활성 표시되도록 포함)
    if (hoveredNode && !selectedNode) {
      if (!selectedEdge && !hasPinnedFocus && !hasSearchMatch && !scopedAuditRootId) {
        const hScope = computeContentFocusScope([hoveredNode], nodes, edges, 1);
        hScope.activeNodes.forEach(id => activeNodes.add(id));
        hScope.incoming.forEach(id => incoming.add(id));
        hScope.outgoing.forEach(id => outgoing.add(id));
        hScope.edgeHighlights.forEach(eid => edgeHighlights.add(eid));
      } else {
        activeNodes.add(hoveredNode);
      }
    }
    if (hoveredEdge) {
      edges.forEach(e => {
        const pInfo = getProxyEdgeInfo(e);
        if (e.id === hoveredEdge || pInfo.proxyId === hoveredEdge) {
          edgeHighlights.add(e.id);
          activeNodes.add(pInfo.newSource);
          activeNodes.add(pInfo.newTarget);
        }
      });
    }

    const impactMatchedNodeSet = new Set<string>();
    if (hasImpactOverlay) {
      nodes.forEach(n => {
        const childNodes = n.data?.hasChildren ? nodes.filter(c => c.parentId === n.id) : [];
        const matching = activeImpacts.filter(item =>
          item.globalNodeId === n.id ||
          item.connectedIds.has(n.id) ||
          Boolean(n.data?.isCollapsed && childNodes.some(c => item.connectedIds.has(c.id)))
        );
        const isMatched = impactFilterOperator === 'AND' ? matching.length === activeImpacts.length : matching.length >= 1;
        if (isMatched) impactMatchedNodeSet.add(n.id);
      });
    }

    setNodes(nds => {
      if (nds.some(n => !n.hidden && (!n.measured?.width || !n.measured?.height))) return nds;
      let changed = false;
      const next = nds.map(n => {
        let cls = (n.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|impact-[a-z0-9-]+|domain-[a-z0-9-]+|status-[a-z-]+)\b/g, '').trim();
        const st = (n.data?.test_status || 'untested').toLowerCase();
        cls += ' status-' + st;
        const isRootCauseNode = rootCauseScope.nodeIds.has(n.id);

        // COLLAPSED_SCREEN_IMPACT_HIGHLIGHT_SPEC 4.1:
        // 접힌 부모 Screen(isCollapsed)의 하위 자식 컴포넌트가 글로벌 영향도(activeImpacts) 또는 스펙 변경 영향권(affectedScope)에 포함된 경우 상향 롤업
        const childNodes = n.data?.hasChildren ? nds.filter(c => c.parentId === n.id) : [];
        const matchingImpacts = hasImpactOverlay
          ? activeImpacts.filter(item =>
              item.globalNodeId === n.id ||
              item.connectedIds.has(n.id) ||
              Boolean(n.data?.isCollapsed && childNodes.some(c => item.connectedIds.has(c.id)))
            )
          : [];
        const isNodeMatched = hasImpactOverlay && (impactFilterOperator === 'AND' ? matchingImpacts.length === activeImpacts.length : matchingImpacts.length >= 1);

        const nextSlots: Record<string, number> = {};
        if (hasImpactOverlay) {
          activeImpacts.forEach(item => {
            if (item.connectedIds.has(n.id)) nextSlots[item.globalNodeId] = item.slotIndex;
          });
        }
        const impactedChildrenInOverlay = hasImpactOverlay
          ? childNodes.filter(c => impactFilterOperator === 'AND' ? activeImpacts.every(item => item.connectedIds.has(c.id)) : activeImpacts.some(item => item.connectedIds.has(c.id)))
          : [];
        const impactedChildrenInRipple = childNodes.filter(c => c.data?.properties?.is_modified === true || c.data?.properties?.is_modified === 'true' || affectedScope.nodeIds.has(c.id));
        const impactedChildCount = n.data?.isCollapsed ? (hasImpactOverlay ? impactedChildrenInOverlay.length : impactedChildrenInRipple.length) : 0;

        // Impact mode classes
        if (hasImpactOverlay) {
          if (isNodeMatched) {
            cls += ` impact-highlighted impact-slot-${matchingImpacts[0].slotIndex}`;
            if (matchingImpacts.length >= 2) cls += ' impact-multi-overlap';
            if (activeImpacts.some(item => item.globalNodeId === n.id)) cls += ' impact-source';
          } else if (!n.data?.isCollapsed && impactedChildrenInOverlay.length > 0) {
            // GLOBAL_IMPACT_ISOLATION_AND_NAVIGATION_SPEC 4.1:
            // 펼쳐진 부모 컨테이너 내부에 영향받는 자식이 있는 경우 격리 모드에서도 컨테이너 외곽선을 은은하게 유지
            cls += ' impact-parent-container';
          }
          if (selectedNode?.id === n.id || hoveredNode === n.id) cls += ' active';
          if (selectedNode?.id === n.id) cls += ' highlight-selected';
        } else if (activeNodes.has(n.id) || hoveredNode === n.id || isRootCauseNode) {
          cls += ' active';
          if (selectedNode?.id === n.id) cls += ' highlight-selected';
          if (searchSeedIds.has(n.id)) cls += ' highlight-search-match';
          if (outgoing.has(n.id)) cls += ' highlight-outgoing';
          if (incoming.has(n.id)) cls += ' highlight-incoming';
        } else if (relatedNodes.has(n.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || hasSearchMatch || hasPinnedFocus || hoveredNode || hoveredEdge || scopedAuditRootId) {
          cls += ' de-emphasized';
        }

        // 논리 도메인 필터링 클래스 (PROPOSAL_TAG_BASED_DOMAIN_GROUPING 4.1)
        if (selectedDomain) {
          if (domainScope.matchedNodeIds.has(n.id)) cls += ' domain-matched';
          else if (domainScope.hubNodeIds.has(n.id)) cls += ' domain-hub';
        }

        // 결함 원인 역추적(Root Cause Tracing, Spec 3.3) — 선행 결함 경로 맥동 강조
        if (isRootCauseNode) cls += ' highlight-root-cause';
        // D. 변경 영향권(Impact Ripple) — Focus 상태와 독립적으로 유지되는 순수 CSS 클래스
        const isNodeAffected = affectedScope.nodeIds.has(n.id);
        if (isNodeAffected) cls += ' highlight-affected';

        const prevSlots: Record<string, number> = n.data?.activeImpactSlots || {};
        const slotsChanged = Object.keys(prevSlots).length !== Object.keys(nextSlots).length || Object.keys(nextSlots).some(k => prevSlots[k] !== nextSlots[k]);
        const nextCls = cls.trim();
        if (
          n.className !== nextCls ||
          (n.data?.impactedChildCount || 0) !== impactedChildCount ||
          Boolean(n.data?.isAffected) !== isNodeAffected ||
          slotsChanged
        ) {
          changed = true;
          return {
            ...n,
            className: nextCls,
            data: { ...n.data, impactedChildCount, isAffected: isNodeAffected, activeImpactSlots: nextSlots },
          };
        }
        return n;
      });
      return changed ? next : nds;
    });

    setEdges(eds => {
      let changed = false;
      const next = eds.map(e => {
        let cls = (e.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|impact-[a-z0-9-]+|domain-[a-z0-9-]+|status-[a-z-]+|edge-contains)\b/g, '').trim();
        const etLower = String(e.data?.type || e.label || '').toLowerCase();
        const isContains = etLower === 'contains' || etLower === 'has';
        if (isContains) cls += ' edge-contains';
        cls += ' status-' + (e.data?.test_status || 'untested').toLowerCase();
        const isRootCauseEdge = rootCauseScope.edgeIds.has(e.id);
        const isDirectImpactEdge = hasImpactOverlay && (impactFilterOperator === 'AND' ? activeImpacts.every(item => item.edgeIds.has(e.id)) : activeImpacts.some(item => item.edgeIds.has(e.id)));
        const isInterMatchedEdge = hasImpactOverlay && !isContains && impactMatchedNodeSet.has(e.source) && impactMatchedNodeSet.has(e.target);
        const isImpactEdge = isDirectImpactEdge || isInterMatchedEdge;

        // Impact mode edge classes
        if (isImpactEdge) cls += ' impact-edge';
        else if (!hasImpactOverlay && (edgeHighlights.has(e.id) || hoveredEdge === e.id || isRootCauseEdge)) {
          cls += ' active highlight-edge';
          if (searchMatchedEdgeIds.has(e.id)) cls += ' highlight-search-match';
        }
        else if (!hasImpactOverlay && relatedEdges.has(e.id)) cls += ' related';
        else if (!hasImpactOverlay && (selectedNode || selectedEdge || hasSearchMatch || hasPinnedFocus || hoveredNode || hoveredEdge || scopedAuditRootId)) cls += ' de-emphasized';

        // 논리 도메인 필터링 간선 클래스 (PROPOSAL_TAG_BASED_DOMAIN_GROUPING 4.1)
        if (selectedDomain && domainScope.domainEdgeIds.has(e.id)) {
          cls += ' domain-edge';
        }
        if (selectedDomain && domainScope.domainInternalEdgeIds.has(e.id)) {
          cls += ' domain-internal-edge';
        }

        // 결함 원인 역추적 엣지 강조
        if (isRootCauseEdge) cls += ' highlight-root-cause';
        // D. 수정 노드에서 뻗어나가는 영향권 엣지
        if (affectedScope.edgeIds.has(e.id)) cls += ' highlight-affected';

        const nextCls = cls.trim();
        if (e.className !== nextCls) {
          changed = true;
          // Clean up old markerColor prop if present
          const nextData: CoverageEdgeData = e.data ? { ...e.data } : { test_status: 'Untested' };
          return { ...e, className: nextCls, data: nextData };
        }
        return e;
      });
      return changed ? next : eds;
    });
  }, [
    selectedNode,
    selectedEdge,
    hoveredNode,
    hoveredEdge,
    maxDepth,
    searchQuery,
    pinnedFocusNodeId,
    activeImpacts,
    impactFilterOperator,
    hasImpactOverlay,
    selectedDomain,
    domainScope,
    affectedScope,
    rootCauseScope,
    scopedAuditScope,
    scopedAuditRootId,
    collapsedKey,
    edgesKey,
    allNodesMeasured,
    graphVersion,
    setNodes,
    setEdges,
    nodes,
    edges,
    isDraggingRef,
  ]);

  return {
    affectedScope,
    rootCauseScope,
    scopedAuditScope,
    domainScope,
  };
}
