import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { CoverageNode, CoverageEdge, ApiNode, ApiEdge, CoverageNodeData } from '../types/graph';
import type { EditFormData } from '../types/ui';
import { getLayoutedElements } from '../layout';
import { calculateEdgeBundling } from '../utils/edgeBundling';
import { FILTERABLE_NODE_TYPES } from '../utils/constants';
import { api } from '../api/client';

interface GlobalDetectable {
  properties?: { is_global?: string | boolean };
  is_global?: string | boolean;
}

const isNodeGlobal = (nodeOrProps: GlobalDetectable | null | undefined): boolean => {
  if (!nodeOrProps) return false;
  const val = nodeOrProps.properties?.is_global ?? nodeOrProps.is_global;
  return val === true || val === 'true' || String(val).toLowerCase() === 'true';
};

interface UseGraphLayoutProps {
  nodes: CoverageNode[];
  edges: CoverageEdge[];
  nodesRef: MutableRefObject<CoverageNode[]>;
  selectedNodeRef?: MutableRefObject<CoverageNode | null>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode?: Dispatch<SetStateAction<CoverageNode | null>>;
  setHoveredNode?: Dispatch<SetStateAction<string | null>>;
  setHoveredEdge?: Dispatch<SetStateAction<string | null>>;
  setEditFormData?: Dispatch<SetStateAction<EditFormData>>;
  filterText: string;
  maxDepth: number;
  visibleTypes?: Set<string>;
  visibleTypesRef?: MutableRefObject<Set<string>>;
  rfInstance: ReactFlowInstance<CoverageNode, CoverageEdge> | null;
  refreshKey?: number;
  graphVersion?: number;
  triggerRefresh: () => void;
  setGraphVersion?: Dispatch<SetStateAction<number>>;
}

export function useGraphLayout({
  nodes = [],
  edges = [],
  nodesRef,
  selectedNodeRef,
  setNodes,
  setEdges,
  setSelectedNode,
  setHoveredNode,
  setHoveredEdge,
  setEditFormData,
  filterText,
  maxDepth,
  visibleTypes,
  visibleTypesRef,
  rfInstance,
  refreshKey,
  graphVersion,
  triggerRefresh,
  setGraphVersion,
}: UseGraphLayoutProps) {
  const actualRefreshKey = refreshKey ?? graphVersion ?? 0;
  const internalVisibleTypesRef = useRef<Set<string>>(visibleTypes || new Set(FILTERABLE_NODE_TYPES));
  if (visibleTypes) internalVisibleTypesRef.current = visibleTypes;
  const effectiveVisibleTypesRef = visibleTypesRef || internalVisibleTypesRef;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevFilterForFitRef = useRef<string | null>(null);
  const hasInitialFitRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);
  const lastFetchedFilterRef = useRef<string | null>(null);
  const lastFetchedDepthRef = useRef<number | null>(null);
  // rfInstance 초기화(onInit) 시점에 초기 그래프 조회 요청이 abort/재호출되지 않도록 ref로 참조합니다.
  const rfInstanceRef = useRef<ReactFlowInstance<CoverageNode, CoverageEdge> | null>(rfInstance);
  rfInstanceRef.current = rfInstance;

  /**
   * Contains/Has 엣지가 삭제되거나 다른 타입으로 바뀌었을 때 자식 노드의 parentId/extent를 해제하고,
   * 부모 상대 좌표를 절대 캔버스 좌표로 복원하며, 남은 자식이 없는 부모 컨테이너의 스타일/hasChildren을 초기화합니다.
   */
  const unparentNodesOnContainsDelete = useCallback((deletedContains: CoverageEdge[], remainingEdges: CoverageEdge[]) => {
    if (deletedContains.length === 0) return;
    const unparentedTargets = new Set(deletedContains.map(e => e.target));
    const parentsWithRemaining = new Set(
      remainingEdges
        .filter(rem => {
          const rt = String(rem.data?.type || rem.label || '').toLowerCase();
          return rt === 'contains' || rt === 'has';
        })
        .map(rem => rem.source)
    );
    const affectedParents = new Set(deletedContains.map(e => e.source));
    setNodes(nds => {
      const parentPosMap = new Map<string, { x: number; y: number }>();
      nds.forEach(p => {
        if (affectedParents.has(p.id)) {
          parentPosMap.set(p.id, { x: p.position?.x || 0, y: p.position?.y || 0 });
        }
      });
      return nds.map(n => {
        if (unparentedTargets.has(n.id)) {
          const type = n.data?.label || 'Data';
          const isGlobal = isNodeGlobal(n.data);
          const isHiddenByFilter = isGlobal || (FILTERABLE_NODE_TYPES.has(type) && !effectiveVisibleTypesRef.current.has(type));
          const parentPos = n.parentId ? parentPosMap.get(n.parentId) : undefined;
          const absPosition = parentPos
            ? { x: parentPos.x + (n.position?.x || 0), y: parentPos.y + (n.position?.y || 0) }
            : n.position;
          return { ...n, position: absPosition, parentId: undefined, extent: undefined, hidden: isHiddenByFilter };
        }
        if (affectedParents.has(n.id) && !parentsWithRemaining.has(n.id)) {
          const restStyle = { ...(n.style || {}) };
          delete restStyle.width;
          delete restStyle.height;
          delete restStyle.minHeight;
          return { ...n, style: restStyle, data: { ...n.data, hasChildren: false, isCollapsed: false, expandedStyle: undefined, childSummary: undefined, impactedChildCount: 0 } };
        }
        return n;
      });
    });
  }, [setNodes, effectiveVisibleTypesRef]);

  // Main graph fetching effect with debounce and abort controller
  useEffect(() => {
    const controller = new AbortController();

    const fetchGraph = async () => {
      // If only maxDepth changed and there is no filter text, the backend will return the exact same full graph anyway.
      // Skip the fetch to avoid ruining the user's manual graph layout.
      if (!isInitialMountRef.current && 
          filterText === '' && 
          lastFetchedFilterRef.current === '' && 
          lastFetchedDepthRef.current !== maxDepth) {
        lastFetchedDepthRef.current = maxDepth;
        return;
      }

      try {
        setLoading(true);
        lastFetchedFilterRef.current = filterText;
        lastFetchedDepthRef.current = maxDepth;
        isInitialMountRef.current = false;

        const isFilterChange = prevFilterForFitRef.current !== filterText;
        const shouldFitView = !hasInitialFitRef.current || isFilterChange;

        const data = await api.nodes.fetchGraph(filterText, maxDepth, controller.signal);
        if (controller.signal.aborted) return;

        const initialNodes: CoverageNode[] = data.nodes.map((n: ApiNode) => {
          const type = n.label || 'Data';
          const isGlobal = isNodeGlobal(n);
          const isHiddenByFilter = isGlobal || (FILTERABLE_NODE_TYPES.has(type) && !effectiveVisibleTypesRef.current.has(type));
          const statusCls = `status-${(n.test_status || 'untested').toLowerCase()}`;
          return {
            id: n.id,
            data: {
              id: n.id,
              label: n.label,
              name: n.name,
              aliases: n.aliases || [],
              test_status: (n.test_status as CoverageNodeData['test_status']) || 'Untested',
              properties: n.properties || {},
              badges: [],
              hasChildren: false,
              isCollapsed: false,
              impactedChildCount: 0,
            },
            type: 'custom',
            selected: selectedNodeRef?.current?.id === n.id,
            position: { x: 0, y: 0 },
            className: statusCls,
            hidden: isHiddenByFilter,
          };
        });

        const edgeBundles: Record<string, ApiEdge[]> = {};
        const nodeMap = new Map<string, CoverageNode>(initialNodes.map(n => [n.id, n]));

        for (const e of data.edges) {
          const sourceNode = nodeMap.get(e.source);
          const targetNode = nodeMap.get(e.target);
          const isSourceGlobal = isNodeGlobal(sourceNode?.data);
          const isTargetGlobal = isNodeGlobal(targetNode?.data);
          const isBadgeEdge = isSourceGlobal || isTargetGlobal;

          if (isBadgeEdge) {
            const hostNode = isSourceGlobal ? targetNode : sourceNode;
            const globalNode = isSourceGlobal ? sourceNode : targetNode;
            if (hostNode && globalNode) {
              if (!hostNode.data.badges) hostNode.data.badges = [];
              hostNode.data.badges.push({
                ...globalNode.data,
                id: globalNode.id,
                edgeId: e.id,
                edgeType: e.type,
                test_status: (e.test_status as CoverageNodeData['test_status']) || 'Untested',
                properties: { ...(globalNode.data?.properties || {}), ...(e.properties || {}) },
              });
            }
          }

          const eTypeLower = (e.type || '').toLowerCase();
          if (eTypeLower === 'contains' || eTypeLower === 'has') {
            const parentId = nodeMap.get(e.source);
            const childNode = nodeMap.get(e.target);
            if (parentId && childNode) {
              childNode.parentId = e.source;
              childNode.extent = parentId.hidden ? undefined : 'parent';
              parentId.data.hasChildren = true;
            }
          }

          // CONTAINS_EDGE_DISAPPEARANCE_BUG_SPEC 5.1:
          // 배지(Global Node) 엣지만 노드 내부 칩으로 흡수하고, Contains/Has 엣지는 캔버스에 렌더링되도록 번들에 포함합니다.
          if (!isBadgeEdge) {
            const key = e.source < e.target ? `${e.source}→${e.target}` : `${e.target}→${e.source}`;
            if (!edgeBundles[key]) edgeBundles[key] = [];
            edgeBundles[key].push(e);
          }
        }

        // Sort initialNodes so parents come before children for React Flow parent-child rendering
        initialNodes.sort((a, b) => {
          if (a.parentId && !b.parentId) return 1;
          if (!a.parentId && b.parentId) return -1;
          return 0;
        });

        // 부모 노드의 childSummary를 초기 로드 시점에 미리 계산하여 마운트 직후 불필요한 setNodes 재호출(React Flow handleBounds 초기화 경합)을 방지합니다.
        initialNodes.forEach(n => {
          if (n.data?.hasChildren) {
            const children = initialNodes.filter(c => c.parentId === n.id);
            const total = children.length;
            const passed = children.filter(c => c.data?.test_status === 'Passed').length;
            const failed = children.filter(c => c.data?.test_status === 'Failed').length;
            const blocked = children.filter(c => c.data?.test_status === 'Blocked').length;
            n.data.childSummary = { total, passed, failed, blocked };
          }
        });

        const rawEdges: CoverageEdge[] = [];
        Object.values(edgeBundles).forEach((bundle) => {
          bundle.forEach((e) => {
            const eTypeLower = (e.type || '').toLowerCase();
            const isContainsEdge = eTypeLower === 'contains' || eTypeLower === 'has';
            const edgeStatus = (e.test_status || 'untested').toLowerCase();
            rawEdges.push({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.type,
              data: {
                type: e.type,
                test_status: (e.test_status as CoverageNodeData['test_status']) || 'Untested',
                properties: e.properties,
              },
              type: 'floating',
              className: `${isContainsEdge ? 'edge-contains ' : ''}status-${edgeStatus}`,
              style: { strokeWidth: 2 },
            });
          });
        });

        const initialEdges = calculateEdgeBundling(rawEdges);

        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
          initialNodes,
          initialEdges
        );

        if (controller.signal.aborted) return;
        // 백그라운드 triggerRefresh() 시에는 기존 루트 노드들의 위치를 그대로 유지하여 캔버스 점프를 방지합니다.
        const prevNodesMap = new Map(nodesRef.current.map(n => [n.id, n]));
        let finalNodes = layoutedNodes;
        if (!shouldFitView && prevNodesMap.size > 0) {
          const preservedPositions: Array<{ x: number; y: number }> = [];
          finalNodes = layoutedNodes.map(ln => {
            const prevNode = prevNodesMap.get(ln.id);
            const isSelected = selectedNodeRef?.current?.id === ln.id;
            if (prevNode && !prevNode.hidden && !prevNode.parentId && !ln.parentId && prevNode.position) {
              preservedPositions.push(prevNode.position);
              return { ...ln, position: prevNode.position, selected: isSelected };
            }
            return { ...ln, selected: isSelected };
          });
          if (preservedPositions.length > 0) {
            let maxPreservedX = Math.max(...preservedPositions.map(p => p.x));
            finalNodes = finalNodes.map(ln => {
              const prevNode = prevNodesMap.get(ln.id);
              const isNewlyVisibleRoot = !ln.hidden && !ln.parentId && (!prevNode || prevNode.hidden || Boolean(prevNode.parentId));
              if (isNewlyVisibleRoot) {
                const collides = preservedPositions.some(
                  p => Math.abs(p.x - ln.position.x) < 260 && Math.abs(p.y - ln.position.y) < 140
                );
                if (collides) {
                  maxPreservedX += 380;
                  const newPos = { x: maxPreservedX, y: preservedPositions[0].y };
                  preservedPositions.push(newPos);
                  return { ...ln, position: newPos };
                }
              }
              return ln;
            });
          }
        }

        if (setHoveredNode) setHoveredNode(null);
        if (setHoveredEdge) setHoveredEdge(null);
        setNodes(finalNodes);
        setEdges(layoutedEdges);
        if (selectedNodeRef?.current?.id) {
          const matchedNode = finalNodes.find(n => n.id === selectedNodeRef.current?.id);
          if (matchedNode) {
            selectedNodeRef.current = matchedNode;
            if (setSelectedNode) setSelectedNode(matchedNode);
            if (setEditFormData) {
              setEditFormData({
                id: matchedNode.id,
                label: matchedNode.data?.label || 'Node',
                name: matchedNode.data?.name || '',
                aliases: matchedNode.data?.aliases || [],
                description: matchedNode.data?.description || '',
                issue_link: matchedNode.data?.issue_link || '',
                test_status: matchedNode.data?.test_status || 'Untested',
                properties: { ...(matchedNode.data?.properties || {}) },
                type: 'node',
              });
            }
          }
        }
        setError(null);

        // 초기 로드 또는 필터 변경 시에만 fitView를 실행하고, 백그라운드 재조회(triggerRefresh)에서는 현재 뷰포트를 보존합니다.
        hasInitialFitRef.current = true;
        prevFilterForFitRef.current = filterText;
        if (shouldFitView) {
          setTimeout(() => {
            if (rfInstanceRef.current) rfInstanceRef.current.fitView({ padding: 0.2, duration: 600 });
          }, 50);
        }
      } catch (err: unknown) {
        // AbortController에 의한 정상적인 이전 요청 취소는 에러 토스트로 노출하지 않습니다.
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const debounceMs = isInitialMountRef.current ? 0 : 300;
    const timerId = setTimeout(() => {
      fetchGraph();
    }, debounceMs);

    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [
    filterText,
    maxDepth,
    setNodes,
    setEdges,
    actualRefreshKey,
    nodesRef,
    selectedNodeRef,
    setSelectedNode,
    setHoveredNode,
    setHoveredEdge,
    effectiveVisibleTypesRef,
    // rfInstance는 ref(rfInstanceRef)로 참조하므로 의존성에서 제외하여 마운트 직후 불필요한 abort를 방지합니다.
    setGraphVersion,
    setEditFormData,
  ]);

  // Performance Optimization: Decouple child summary calculation from drag positions
  const nodesStructuralKey = useMemo(
    () => nodes.map(n => `${n.id}:${n.parentId || ''}:${n.data?.isCollapsed ? 1 : 0}`).join('|'),
    [nodes]
  );
  const nodesStatusKey = useMemo(
    () => nodes.map(n => `${n.id}:${n.data?.test_status || ''}:${n.data?.is_manual_override ? 1 : 0}`).join('|'),
    [nodes]
  );

  // 부모 노드의 하위 자식 상태 요약(childSummary)을 자식 상태 변경 시 자동 동기화 (Spec 4.1)
  // Single-pass O(N) child summary sync keyed on structural & status keys
  useEffect(() => {
    setNodes(nds => {
      if (nds.some(n => !n.hidden && (!n.measured?.width || !n.measured?.height))) {
        return nds;
      }

      // Compute child counts in a single O(N) pass
      const summaryMap = new Map<string, { total: number; passed: number; failed: number; blocked: number }>();
      for (const n of nds) {
        if (n.parentId) {
          let entry = summaryMap.get(n.parentId);
          if (!entry) {
            entry = { total: 0, passed: 0, failed: 0, blocked: 0 };
            summaryMap.set(n.parentId, entry);
          }
          entry.total += 1;
          const st = n.data?.test_status;
          if (st === 'Passed') entry.passed += 1;
          else if (st === 'Failed') entry.failed += 1;
          else if (st === 'Blocked') entry.blocked += 1;
        }
      }

      let changed = false;
      const next = nds.map(n => {
        if (!n.data?.hasChildren) return n;
        const entry = summaryMap.get(n.id) || { total: 0, passed: 0, failed: 0, blocked: 0 };
        const prev = n.data?.childSummary;
        if (!prev || prev.total !== entry.total || prev.passed !== entry.passed || prev.failed !== entry.failed || prev.blocked !== entry.blocked) {
          changed = true;
          return { ...n, data: { ...n.data, childSummary: entry } };
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [nodesStructuralKey, nodesStatusKey, setNodes]);

  /**
   * Selection subset or full layout execution
   */
  const relayoutFocused = useCallback(async () => {
    // 1. Check if there is any active focus (selected or highlighted)
    const focusedNodes = nodes.filter(n =>
      !n.hidden && (n.selected || (n.className && (n.className.includes('active') || n.className.includes('related'))))
    );

    // 2. Determine which nodes to layout
    const nodesToLayout = focusedNodes.length >= 2 ? [...focusedNodes] : nodes.filter(n => !n.hidden);

    if (focusedNodes.length >= 2) {
      // Ensure we include all children of any focused parent, and the parent of any focused child
      const targetIds = new Set(nodesToLayout.map(n => n.id));
      let added = true;
      while (added) {
        added = false;
        nodes.forEach(n => {
          if (!n.hidden && !targetIds.has(n.id)) {
            if ((n.parentId && targetIds.has(n.parentId)) || nodesToLayout.some(tn => tn.parentId === n.id)) {
              targetIds.add(n.id);
              nodesToLayout.push(n);
              added = true;
            }
          }
        });
      }
    }

    if (nodesToLayout.length >= 2) {
      const targetIds = new Set(nodesToLayout.map(n => n.id));
      const targetEdges = edges.filter(e => targetIds.has(e.source) && targetIds.has(e.target));

      // Run ELK on the subset
      const { nodes: layouted } = await getLayoutedElements(nodesToLayout, targetEdges);

      // Keep the group at its original top-left to avoid jumping
      const minX = Math.min(...nodesToLayout.map(n => n.position.x));
      const minY = Math.min(...nodesToLayout.map(n => n.position.y));
      const newMinX = Math.min(...layouted.map(n => n.position.x));
      const newMinY = Math.min(...layouted.map(n => n.position.y));
      const offsetX = minX - newMinX;
      const offsetY = minY - newMinY;

      // Build position map
      const posMap = new Map(layouted.map(n => [n.id, { x: n.position.x + offsetX, y: n.position.y + offsetY }]));

      // Update positions
      setNodes(nds => nds.map(n => {
        if (posMap.has(n.id)) {
          return { ...n, position: posMap.get(n.id)! };
        }
        return n;
      }));
    } else {
      // Full layout if less than 2 focused
      if (triggerRefresh) triggerRefresh();
    }
  }, [nodes, edges, setNodes, triggerRefresh]);

  return {
    loading,
    error,
    setError,
    unparentNodesOnContainsDelete,
    relayoutFocused,
    nodesStructuralKey,
    nodesStatusKey,
  };
}
