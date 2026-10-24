import { useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { CoverageNode, CoverageEdge, CoverageEdgeData, ActiveImpactItem, ImpactFilterOperator } from '../types';
import {
  computeAffectedScope,
  computeRootCauseScope,
  computeScopedAuditScope,
  computeContentFocusScope,
} from '../utils/graphScopes';

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
  graphVersion,
  isDraggingRef,
}: UseFocusContextProps) {
  // 부모 노드의 접힘(isCollapsed) 상태 키 — 접기/펼치기 시 부모 영향도 하이라이트 및 요약 칩 재계산 트리거
  const collapsedKey = useMemo(
    () => nodes.map(n => `${n.id}:${n.data?.isCollapsed ? 1 : 0}`).join(','),
    [nodes]
  );
  // 엣지 추가/삭제/타입 변경 키 — 엣지 연결 즉시 Focus+Context 하이라이트(active, incoming/outgoing, highlight-edge) 재계산 트리거
  const edgesKey = useMemo(
    () => edges.map(e => `${e.id}:${e.source}->${e.target}:${e.data?.type || e.label || ''}`).join(','),
    [edges]
  );

  const affectedScope = useMemo(() => computeAffectedScope(nodes, edges), [nodes, edges]);
  const rootCauseScope = useMemo(() => computeRootCauseScope(tracedRootNodeId, nodes, edges), [tracedRootNodeId, nodes, edges]);
  const scopedAuditScope = useMemo(() => computeScopedAuditScope(scopedAuditRootId, nodes, edges), [scopedAuditRootId, nodes, edges]);

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

    const searchSeeds = searchQuery
      ? nodes.filter(n => {
          const name = (n.data?.name || '').toLowerCase();
          const label = (n.data?.label || '').toLowerCase();
          const nodeAliases = (n.data?.aliases || []).map((a: string) => a.toLowerCase());
          const q = searchQuery.toLowerCase();
          return name.includes(q) || label.includes(q) || nodeAliases.some((a: string) => a.includes(q));
        })
      : [];
    const searchSeedIds = new Set(searchSeeds.map(s => s.id));
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
    } else if (hasPinnedFocus || searchSeeds.length > 0) {
      const baseSeeds: string[] = [];
      if (hasPinnedFocus && pinnedFocusNodeId) baseSeeds.push(pinnedFocusNodeId);
      for (const s of searchSeeds) if (!baseSeeds.includes(s.id)) baseSeeds.push(s.id);
      const scope = computeContentFocusScope(baseSeeds, nodes, edges, maxDepth);
      scope.activeNodes.forEach(id => activeNodes.add(id));
      scope.incoming.forEach(id => incoming.add(id));
      scope.outgoing.forEach(id => outgoing.add(id));
      scope.edgeHighlights.forEach(eid => edgeHighlights.add(eid));

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
      // Highlight sibling edges that point to the same target node to show the "Test Group"
      edges.filter(e => e.target === selectedEdge.target && e.id !== selectedEdge.id).forEach(e => {
        relatedEdges.add(e.id);
        relatedNodes.add(e.source);
      });
    }

    // Add hovered elements to active set (호버 시 또는 드래그 연결 직후 커서가 타겟 노드에 머물 때 연결 엣지 및 1-홉 이웃 노드가 즉시 활성 표시되도록 포함)
    if (hoveredNode && !selectedNode) {
      if (!selectedEdge && !hasPinnedFocus && searchSeeds.length === 0 && !scopedAuditRootId) {
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
      const edge = edges.find(e => e.id === hoveredEdge);
      if (edge) {
        activeNodes.add(edge.source);
        activeNodes.add(edge.target);
      }
    }

    setNodes(nds => {
      if (nds.some(n => !n.hidden && (!n.measured?.width || !n.measured?.height))) return nds;
      let changed = false;
      const next = nds.map(n => {
        let cls = (n.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|impact-[a-z0-9-]+|status-[a-z-]+)\b/g, '').trim();
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
        } else if (selectedNode || selectedEdge || searchSeeds.length > 0 || hasPinnedFocus || hoveredNode || hoveredEdge || scopedAuditRootId) {
          cls += ' de-emphasized';
        }
        // 결함 원인 역추적(Root Cause Tracing, Spec 3.3) — 선행 결함 경로 맥동 강조
        if (isRootCauseNode) cls += ' highlight-root-cause';
        // D. 변경 영향권(Impact Ripple) — Focus 상태와 독립적으로 유지되는 순수 CSS 클래스
        if (affectedScope.nodeIds.has(n.id)) cls += ' highlight-affected';

        const prevSlots: Record<string, number> = n.data?.activeImpactSlots || {};
        const slotsChanged = Object.keys(prevSlots).length !== Object.keys(nextSlots).length || Object.keys(nextSlots).some(k => prevSlots[k] !== nextSlots[k]);
        const nextCls = cls.trim();
        if (n.className !== nextCls || (n.data?.impactedChildCount || 0) !== impactedChildCount || slotsChanged) {
          changed = true;
          return {
            ...n,
            className: nextCls,
            data: { ...n.data, impactedChildCount, activeImpactSlots: nextSlots },
          };
        }
        return n;
      });
      return changed ? next : nds;
    });

    setEdges(eds => {
      let changed = false;
      const next = eds.map(e => {
        let cls = (e.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|impact-[a-z0-9-]+|status-[a-z-]+|edge-contains)\b/g, '').trim();
        const etLower = String(e.data?.type || e.label || '').toLowerCase();
        if (etLower === 'contains' || etLower === 'has') cls += ' edge-contains';
        cls += ' status-' + (e.data?.test_status || 'untested').toLowerCase();
        const isRootCauseEdge = rootCauseScope.edgeIds.has(e.id);
        const isImpactEdge = hasImpactOverlay && (impactFilterOperator === 'AND' ? activeImpacts.every(item => item.edgeIds.has(e.id)) : activeImpacts.some(item => item.edgeIds.has(e.id)));

        // Impact mode edge classes
        if (isImpactEdge) cls += ' impact-edge';
        else if (!hasImpactOverlay && (edgeHighlights.has(e.id) || hoveredEdge === e.id || isRootCauseEdge)) cls += ' active highlight-edge';
        else if (!hasImpactOverlay && relatedEdges.has(e.id)) cls += ' related';
        else if (!hasImpactOverlay && (selectedNode || selectedEdge || searchSeeds.length > 0 || hasPinnedFocus || hoveredNode || hoveredEdge || scopedAuditRootId)) cls += ' de-emphasized';

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
  };
}
