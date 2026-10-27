import { useCallback } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { MarkerType, ReactFlowInstance } from '@xyflow/react';
import {
  CoverageNode,
  CoverageEdge,
  StatusName,
  ChecklistItem,
  EditFormData,
  UndoAction,
  ActiveImpactItem,
} from '../types';
import { calculateEdgeBundling } from '../utils/edgeBundling';
import { getSmartDefaultEdgeType } from '../utils/graphScopes';
import { recalcTargetAndPropagate, propagateToDependents, applyStatusChanges } from '../statusPropagation';
import { api, extractErrorMessage } from '../api/client';

export interface UseGraphOperationsProps {
  nodesRef: MutableRefObject<CoverageNode[]>;
  edgesRef: MutableRefObject<CoverageEdge[]>;
  selectedNodeRef: MutableRefObject<CoverageNode | null>;
  selectedEdgeRef: MutableRefObject<CoverageEdge | null>;
  editFormData: EditFormData;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  setPinnedFocusNodeId: Dispatch<SetStateAction<string | null>>;
  setActiveImpacts: Dispatch<SetStateAction<ActiveImpactItem[]>>;
  pushUndo: (action: UndoAction) => void;
  applyLocalStatusChanges: (changes: Record<string, string | StatusName>) => void;
  syncStatusesFromServer: () => Promise<void>;
  triggerRefresh: () => void;
  unparentNodesOnContainsDelete: (deletedContains: CoverageEdge[], remainingEdges: CoverageEdge[]) => void;
  setErrorToast: (msg: string | null) => void;
  isCreatingNode?: boolean;
  setIsCreatingNode?: Dispatch<SetStateAction<boolean>>;
  rfInstance?: ReactFlowInstance<CoverageNode, CoverageEdge> | null;
  setEditFormData?: Dispatch<SetStateAction<EditFormData>>;
  filterText?: string;
  setFilterText?: Dispatch<SetStateAction<string>>;
  setShowAllDomains?: Dispatch<SetStateAction<boolean>>;
  pendingCreatePosRef?: MutableRefObject<{ x: number; y: number } | null>;
}

export function useGraphOperations({
  nodesRef,
  edgesRef,
  selectedNodeRef,
  selectedEdgeRef,
  editFormData,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  setPinnedFocusNodeId,
  setActiveImpacts,
  pushUndo,
  applyLocalStatusChanges,
  syncStatusesFromServer,
  triggerRefresh,
  unparentNodesOnContainsDelete,
  setErrorToast,
  isCreatingNode,
  setIsCreatingNode,
  rfInstance,
  setEditFormData,
  filterText,
  setFilterText,
  setShowAllDomains,
  pendingCreatePosRef,
}: UseGraphOperationsProps) {
  /**
   * 캔버스 드래그 연결(onConnect), Quick Connect 팝오버(Pattern A), 2-Step 클릭 연결(Pattern B)이
   * 공통으로 사용하는 엣지 생성 핸들러입니다.
   */
  const createEdgeBetweenNodes = useCallback(async (
    sourceId: string,
    targetId: string,
    explicitEdgeType?: string,
    extraProperties?: Record<string, unknown>
  ) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceNode = nodesRef.current.find(n => n.id === sourceId);
    const targetNode = nodesRef.current.find(n => n.id === targetId);
    if (sourceNode?.parentId && sourceNode.parentId === targetId) return;

    const sourceIsGlobal = sourceNode?.data?.properties?.is_global === 'true';
    const targetIsGlobal = targetNode?.data?.properties?.is_global === 'true';
    const defaultType = explicitEdgeType || getSmartDefaultEdgeType(sourceNode, targetNode);

    try {
      const newEdgeId = await api.edges.createEdge({
        source: sourceId,
        target: targetId,
        type: defaultType,
        test_status: 'Untested',
        properties: (extraProperties || {}) as Record<string, string>,
      });
      pushUndo({ type: 'CREATE_EDGE', id: newEdgeId });

      if (sourceIsGlobal || targetIsGlobal) {
        setNodes(nds => nds.map(n => {
          if (sourceIsGlobal && n.id === targetId && sourceNode) {
            const nextBadges = [...(n.data?.badges || []), {
              ...sourceNode.data,
              id: sourceNode.id,
              edgeId: newEdgeId,
              edgeType: defaultType,
              test_status: sourceNode.data.test_status,
              properties: sourceNode.data.properties || {},
            }];
            return { ...n, data: { ...n.data, badges: nextBadges } };
          }
          if (targetIsGlobal && n.id === sourceId && targetNode) {
            const nextBadges = [...(n.data?.badges || []), {
              ...targetNode.data,
              id: targetNode.id,
              edgeId: newEdgeId,
              edgeType: defaultType,
              test_status: targetNode.data.test_status,
              properties: targetNode.data.properties || {},
            }];
            return { ...n, data: { ...n.data, badges: nextBadges } };
          }
          return n;
        }));
        return;
      }

      const isContains = defaultType.toLowerCase() === 'contains' || defaultType.toLowerCase() === 'has';
      // CONTAINS_EDGE_DISAPPEARANCE_SPEC 5.1-2:
      // Contains/Has 연결 시에도 조기 리턴하지 않고 캔버스에 newEdge(.edge-contains)를 즉시 등록합니다.
      const newEdge: CoverageEdge = {
        id: newEdgeId,
        source: sourceId,
        target: targetId,
        label: defaultType,
        type: 'floating',
        className: isContains ? 'edge-contains status-untested' : 'status-untested',
        data: { type: defaultType, test_status: 'Untested', properties: (extraProperties || {}) as Record<string, string> },
        style: { stroke: 'gray', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'gray' },
      };
      // 이전 선택된 엣지나 무관한 노드의 Focus+Context 선택 상태로 인해 방금 연결한 새 엣지가 .de-emphasized(투명도 0.1)로 가려지지 않도록 정리합니다.
      const clearedPrevEdges = edgesRef.current.map(e => (e.selected ? { ...e, selected: false } : e));
      const bundledEds = calculateEdgeBundling([...clearedPrevEdges, newEdge]);
      setEdges(bundledEds);
      setSelectedEdge(null);
      const relatedEndpointIds = new Set<string>([sourceId, targetId, ...(sourceNode?.parentId ? [sourceNode.parentId] : []), ...(targetNode?.parentId ? [targetNode.parentId] : [])]);
      if (selectedNodeRef.current && !relatedEndpointIds.has(selectedNodeRef.current.id)) {
        setSelectedNode(null);
        setNodes(nds => (nds.some(n => n.selected) ? nds.map(n => (n.selected ? { ...n, selected: false } : n)) : nds));
      }
      // 새 입력 엣지가 생긴 타겟을 재계산하고, 바뀌면 하류(Depends_On/Tests)로 연쇄 전파 (낙관적)
      applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, bundledEds, [targetId]));
      syncStatusesFromServer();

      if (isContains) {
        // 부모 컨테이너 크기(style.width/height)와 자식 상대 좌표를 ELK 레이아웃으로 재계산 (Contains 엣지는 fetchGraph에서도 유지됨)
        triggerRefresh();
      }
    } catch (err: unknown) {
      setErrorToast(extractErrorMessage(err));
    }
  }, [nodesRef, edgesRef, selectedNodeRef, pushUndo, setNodes, setEdges, setSelectedEdge, setSelectedNode, applyLocalStatusChanges, syncStatusesFromServer, triggerRefresh, setErrorToast]);

  const onNodesDelete = useCallback(async (deleted: CoverageNode[]) => {
    const deletedIds = new Set<string>();
    for (const n of deleted) {
      try {
        await api.nodes.deleteNode(n.id);
        deletedIds.add(n.id);
        const connectedEdges = edgesRef.current.filter(e => e.source === n.id || e.target === n.id);
        pushUndo({
          type: 'DELETE_NODE',
          id: n.id,
          nodeData: { label: n.data?.label || 'Node', name: n.data?.name || '', aliases: n.data?.aliases || [], test_status: n.data?.test_status || 'Untested', properties: n.data?.properties || {} },
          connectedEdges,
        });
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
        setNodes(nds => (nds.some(existing => existing.id === n.id) ? nds : [...nds, n]));
      }
    }
    // ReactFlow already removes node from local state via onNodesChange
    // Remove connected edges from local state
    const remainingEdges = edgesRef.current.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target));
    setEdges(remainingEdges);
    // 삭제된 노드가 입력이던 타겟들을 재계산 (백엔드 delete_node → _recalc_target_node_status 와 동일)
    const affectedTargets = Array.from(new Set(edgesRef.current.filter(e => deletedIds.has(e.source) && !deletedIds.has(e.target)).map(e => e.target)));
    applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current.filter(n => !deletedIds.has(n.id)), remainingEdges, affectedTargets));
    setPinnedFocusNodeId(prev => (prev && deletedIds.has(prev) ? null : prev));
    if (deletedIds.size > 0) syncStatusesFromServer();
  }, [edgesRef, nodesRef, pushUndo, setErrorToast, setNodes, setEdges, applyLocalStatusChanges, setPinnedFocusNodeId, syncStatusesFromServer]);

  const onEdgesDelete = useCallback(async (deleted: CoverageEdge[]) => {
    for (const e of deleted) {
      try {
        await api.edges.deleteEdge(e.id);
        pushUndo({
          type: 'DELETE_EDGE',
          id: e.id,
          edgeData: { source: e.source, target: e.target, type: e.label || e.data?.type || 'RELATED', test_status: e.data?.test_status || 'Untested', properties: e.data?.properties || {} },
        });
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
        setEdges(eds => (eds.some(existing => existing.id === e.id) ? eds : [...eds, e]));
      }
    }
    // ReactFlow already removes edges from local state via onEdgesChange
    // 삭제된 엣지의 타겟 노드를 재계산하고 하류로 전파 (낙관적) → 서버 결과로 재동기화
    const deletedEdgeIds = new Set(deleted.map(e => e.id));
    const remainingEdges = edgesRef.current.filter(e => !deletedEdgeIds.has(e.id));
    applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, remainingEdges, Array.from(new Set(deleted.map(e => e.target)))));
    if (deleted.length > 0) syncStatusesFromServer();
    const deletedContains = deleted.filter(e => {
      const et = String(e.data?.type || e.label || '').toLowerCase();
      return et === 'contains' || et === 'has';
    });
    if (deletedContains.length > 0) unparentNodesOnContainsDelete(deletedContains, remainingEdges);
  }, [edgesRef, nodesRef, pushUndo, setErrorToast, setEdges, applyLocalStatusChanges, syncStatusesFromServer, unparentNodesOnContainsDelete]);

  /**
   * 자식 노드 Edit 패널의 [⏏ 분리] 버튼 핸들러:
   * 해당 Contains 엣지를 삭제하고 부모 컨테이너에서 자식 노드를 즉시 분리합니다.
   */
  const handleDetachFromParent = useCallback(async (containsEdge: CoverageEdge) => {
    try {
      await api.edges.deleteEdge(containsEdge.id);
      pushUndo({
        type: 'DELETE_EDGE',
        id: containsEdge.id,
        edgeData: { source: containsEdge.source, target: containsEdge.target, type: containsEdge.label || containsEdge.data?.type || 'Contains', test_status: containsEdge.data?.test_status || 'Untested', properties: containsEdge.data?.properties || {} },
      });
      const nextEds = edgesRef.current.filter(e => e.id !== containsEdge.id);
      setEdges(nextEds);
      applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, nextEds, [containsEdge.target]));
      syncStatusesFromServer();
      unparentNodesOnContainsDelete([containsEdge], nextEds);
      setSelectedNode(prev => (prev && prev.id === containsEdge.target ? { ...prev, parentId: undefined, extent: undefined } : prev));
    } catch (err: unknown) {
      setErrorToast(extractErrorMessage(err));
    }
  }, [edgesRef, pushUndo, setEdges, applyLocalStatusChanges, nodesRef, syncStatusesFromServer, unparentNodesOnContainsDelete, setSelectedNode, setErrorToast]);

  const handleDelete = useCallback(async () => {
    if (editFormData.type === 'node') {
      const targetId = editFormData.id;
      const targetNode = nodesRef.current.find(n => n.id === targetId);
      if (!targetId || !targetNode) return;
      try {
        await api.nodes.deleteNode(targetId);
        const connectedEdges = edgesRef.current.filter(e => e.source === targetId || e.target === targetId);
        pushUndo({
          type: 'DELETE_NODE',
          id: targetId,
          nodeData: { label: targetNode.data?.label || 'Node', name: targetNode.data?.name || '', aliases: targetNode.data?.aliases || [], test_status: targetNode.data?.test_status || 'Untested', properties: targetNode.data?.properties || {} },
          connectedEdges,
        });
        // 삭제된 노드가 입력이던 타겟들 (백엔드 delete_node → _recalc_target_node_status 와 동일)
        const remainingEdges = edgesRef.current.filter(e => e.source !== targetId && e.target !== targetId);
        const affectedTargets = Array.from(new Set(edgesRef.current.filter(e => e.source === targetId && e.target !== targetId).map(e => e.target)));
        const remainingNodes = nodesRef.current.filter(n => n.id !== targetId);
        const changes = recalcTargetAndPropagate(remainingNodes, remainingEdges, affectedTargets);
        setNodes(nds => applyStatusChanges(
          nds.filter(n => n.id !== targetId).map(n => {
            const badges = n.data?.badges;
            if (!Array.isArray(badges) || !badges.some(b => b.id === targetId)) return n;
            return { ...n, data: { ...n.data, badges: badges.filter(b => b.id !== targetId) } };
          }),
          changes
        ));
        setEdges(remainingEdges);
        setSelectedNode(null);
        setPinnedFocusNodeId(prev => (prev === targetId ? null : prev));
        setActiveImpacts(prev => prev.filter(item => item.globalNodeId !== targetId));
        syncStatusesFromServer();
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
      }
    } else if (editFormData.type === 'edge') {
      const targetId = editFormData.id;
      const targetEdge = edgesRef.current.find(e => e.id === targetId);
      if (!targetId || !targetEdge) return;
      try {
        await api.edges.deleteEdge(targetId);
        pushUndo({
          type: 'DELETE_EDGE',
          id: targetId,
          edgeData: { source: targetEdge.source, target: targetEdge.target, type: targetEdge.label || targetEdge.data?.type || 'RELATED', test_status: targetEdge.data?.test_status || 'Untested', properties: targetEdge.data?.properties || {} },
        });
        const nextEds = edgesRef.current.filter(e => e.id !== targetId);
        setEdges(nextEds);
        // 입력 엣지가 사라진 타겟을 재계산하고 하류로 연쇄 전파 (낙관적) → 서버 결과로 재동기화
        applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, nextEds, [targetEdge.target]));
        setSelectedEdge(null);
        syncStatusesFromServer();
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
      }
    }
  }, [editFormData, nodesRef, pushUndo, edgesRef, applyLocalStatusChanges, setNodes, setEdges, setSelectedNode, setPinnedFocusNodeId, setActiveImpacts, syncStatusesFromServer, setErrorToast, setSelectedEdge]);

  /**
   * 상태 마킹 저장 (Mark Passed / Failed / Reset / Blocked)
   * - override가 있으면 📌 수동 고정(Manual Override): is_manual_override=true + override_reason 기록 (TESTCASE 스펙 4.3)
   * - Passed/Failed/Reset은 테스터의 직접 판정이므로 기존 📌 고정을 해제합니다.
   * - 낙관적 업데이트를 먼저 적용(로컬 연쇄 전파 포함)한 뒤 저장하고, 저장 후 서버 상태로 재동기화합니다.
   */
  const handleSaveStatus = useCallback(async (status: StatusName, overrideOptions?: { reason?: string }) => {
    if (isCreatingNode) {
      if (setEditFormData) {
        const isOverride = Boolean(overrideOptions?.reason);
        setEditFormData(prev => ({
          ...prev,
          test_status: status,
          properties: {
            ...(prev.properties || {}),
            is_manual_override: isOverride,
            override_reason: overrideOptions?.reason || undefined,
          },
        }));
      }
      return;
    }
    const selectedNode = selectedNodeRef.current;
    if (!selectedNode) {
      const selectedEdge = selectedEdgeRef.current;
      if (selectedEdge) {
        const edgeId = selectedEdge.id;
        try {
          const edgeType = editFormData.edgeType || selectedEdge.data?.type || (typeof selectedEdge.label === 'string' ? selectedEdge.label : 'Transition');
          await api.edges.updateEdge(edgeId, {
            type: edgeType,
            action: editFormData.action,
            test_status: status,
          });
          setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, test_status: status } } : e));
          syncStatusesFromServer();
        } catch (err: unknown) {
          setErrorToast(extractErrorMessage(err));
        }
      }
      return;
    }
    const isOverride = Boolean(overrideOptions?.reason);
    const targetId = selectedNode.id;
    const isGlobal = selectedNode.data?.properties?.is_global === 'true';
    const prevNodes = nodesRef.current;
    const prevEdges = edgesRef.current;
    // 1) 낙관적 업데이트: 대상 노드 상태 + 📌 고정 플래그 + 배지 상태를 즉시 반영
    // Update className: replace old status-xxx with new one
    const newClass = (selectedNode.className || '').replace(/\bstatus-[a-z-]+\b/g, '').trim() + ` status-${status.toLowerCase()}`;

    setNodes(nds => nds.map(n => {
      if (n.id === targetId) {
        return {
          ...n,
          className: newClass,
          data: {
            ...n.data,
            test_status: status,
            is_manual_override: isOverride,
            override_reason: overrideOptions?.reason || (isOverride ? n.data?.override_reason : undefined),
            properties: {
              ...(n.data?.properties || {}),
              is_manual_override: isOverride,
              override_reason: overrideOptions?.reason || (isOverride ? n.data?.override_reason : undefined),
            },
          },
        };
      }
      if (isGlobal && n.data?.badges) {
        return { ...n, data: { ...n.data, badges: n.data.badges.map(b => (b.id === targetId ? { ...b, test_status: status } : b)) } };
      }
      return n;
    }));

    // 2) 하류(Depends_On / Tests) 연쇄 전파 — 방금 마킹한 노드는 exclude 되어 덮어쓰지 않음
    const simulated = nodesRef.current.map(n => (n.id === targetId ? { ...n, data: { ...n.data, test_status: status } } : n));
    applyLocalStatusChanges(propagateToDependents(simulated, edgesRef.current, targetId));

    // 3) 저장 (백엔드 update_node가 동일 규칙으로 연쇄 전파) → 서버 결과로 재동기화
    try {
      await api.nodes.markStatus(targetId, status, isOverride ? overrideOptions?.reason : undefined);
      syncStatusesFromServer();
    } catch (err: unknown) {
      setNodes(prevNodes);
      setEdges(prevEdges);
      setErrorToast(extractErrorMessage(err));
    }
  }, [isCreatingNode, setEditFormData, selectedNodeRef, selectedEdgeRef, editFormData, nodesRef, edgesRef, setNodes, setEdges, applyLocalStatusChanges, syncStatusesFromServer, setErrorToast]);

  /**
   * C. B안 노드 내부 체크리스트 저장 (TESTCASE 스펙 3.3)
   * - 항목 체크/추가/삭제 즉시 낙관적 업데이트: properties.checklist → 노드 자동 판정 → 하류 연쇄 전파
   * - 📌 수동 고정 노드는 체크리스트가 바뀌어도 상태를 덮어쓰지 않습니다. (백엔드 _recalc_single_node_status 와 동일)
   * - 체크리스트를 모두 지우면(0개) 자동 판정을 멈추고 현재 상태를 유지합니다. (백엔드 update_node 와 동일)
   */
  const saveChecklist = useCallback(async (items: ChecklistItem[]) => {
    const selectedNode = selectedNodeRef.current;
    if (!selectedNode) return;
    const targetId = selectedNode.id;
    const prevNodes = nodesRef.current;
    pushUndo({
      type: 'UPDATE_NODE',
      id: targetId,
      oldData: { label: selectedNode.data?.label || 'Node', name: selectedNode.data?.name || '', aliases: selectedNode.data?.aliases || [], test_status: selectedNode.data?.test_status || 'Untested', properties: { ...(selectedNode.data?.properties || {}) } },
    });
    // 1) properties.checklist 반영 (전역 노드인 경우 다른 노드에 부착된 배지 객체의 properties.checklist도 함께 갱신)
    // 2) 체크리스트 기반 자기 자신 상태 재합성
    // 3) 하류(Depends_On / Tests) 연쇄 전파
    // 4) 저장 (상태는 백엔드가 같은 규칙으로 재계산) → 서버 결과로 재동기화
    try {
      await api.nodes.saveChecklist(targetId, items);
      setNodes(nds => nds.map(n => n.id === targetId ? { ...n, data: { ...n.data, properties: { ...(n.data?.properties || {}), checklist: items } } } : n));
      syncStatusesFromServer();
    } catch (err: unknown) {
      setNodes(prevNodes);
      setErrorToast(extractErrorMessage(err));
    }
  }, [selectedNodeRef, nodesRef, pushUndo, setNodes, syncStatusesFromServer, setErrorToast]);

  /**
   * 노드(및 직속 Contains/Has 자식 구조, 체크리스트, 글로벌 배지 연결)를 새 태그로 복제하고
   * 모든 상태를 Untested로 초기화한 뒤 Undo 스택(CLONE_SUBGRAPH)에 등록합니다.
   */
  const handleCloneNode = useCallback(async (nodeId?: string, tag?: string) => {
    const targetId = nodeId || selectedNodeRef.current?.id;
    if (!targetId) return;
    try {
      const res = await api.nodes.cloneSubgraph(targetId, tag);
      pushUndo({ type: 'CLONE_SUBGRAPH', id: targetId, createdNodeIds: res.cloned_node_ids, createdEdgeIds: res.cloned_edge_ids, nodeIds: res.cloned_node_ids });
      if (res.cloned_root_id) {
        const targetNode = nodesRef.current.find(n => n.id === targetId) || (selectedNodeRef.current?.id === targetId ? selectedNodeRef.current : undefined);
        const parentNode = targetNode?.parentId ? nodesRef.current.find(p => p.id === targetNode.parentId) : undefined;
        const baseAbsX = parentNode
          ? (parentNode.position?.x || 0)
          : (targetNode?.position?.x || 0);
        const baseAbsY = parentNode
          ? (parentNode.position?.y || 0) + (targetNode?.position?.y || 0)
          : (targetNode?.position?.y || 0);
        const sourceWidth = parentNode
          ? (parentNode.measured?.width || Number(parentNode.style?.width) || 300)
          : (targetNode?.measured?.width || Number(targetNode?.style?.width) || 260);
        let cloneX = baseAbsX + sourceWidth + 60;
        const cloneY = baseAbsY;
        while (
          nodesRef.current.some(
            n => !n.hidden && !n.parentId && Math.abs((n.position?.x || 0) - cloneX) < 220 && Math.abs((n.position?.y || 0) - cloneY) < 110
          )
        ) {
          cloneX += 300;
        }
        const clonePosition = { x: cloneX, y: cloneY };

        const cleanTag = (tag || '').replace(/^#+/, '').trim();
        const baseAliases = Array.isArray(targetNode?.data?.aliases) ? [...targetNode.data.aliases] : [];
        if (cleanTag && !baseAliases.some(a => String(a).replace(/^#+/, '').trim().toLowerCase() === cleanTag.toLowerCase())) {
          baseAliases.push(cleanTag);
        }

        const clonedNode: CoverageNode = {
          id: res.cloned_root_id,
          type: 'custom',
          position: clonePosition,
          selected: true,
          className: 'status-untested',
          data: {
            id: res.cloned_root_id,
            label: targetNode?.data?.label || 'Node',
            name: res.name || targetNode?.data?.name || '',
            aliases: baseAliases,
            test_status: 'Untested',
            properties: { ...(targetNode?.data?.properties || {}), is_manual_override: false, override_reason: undefined },
            badges: targetNode?.data?.badges ? targetNode.data.badges.map(b => ({ ...b, test_status: 'Untested' })) : [],
          },
        };

        // 1) 낙관적 업데이트: triggerRefresh(ELK 레이아웃) 실행 전에 nodesRef와 setNodes에 복제 노드를 먼저 등록하여
        //    useGraphLayout의 prevNodesMap이 원본 바로 옆(clonePosition) 좌표를 그대로 보존하도록 보장합니다.
        const nextNodesList = [
          ...nodesRef.current.map(n => (n.selected ? { ...n, selected: false } : n)),
          clonedNode,
        ];
        nodesRef.current = nextNodesList;
        setNodes(nextNodesList);

        selectedNodeRef.current = clonedNode;
        setSelectedNode(clonedNode);
        if (setEditFormData) {
          setEditFormData({
            id: res.cloned_root_id,
            label: clonedNode.data.label,
            name: clonedNode.data.name,
            aliases: clonedNode.data.aliases,
            description: '',
            issue_link: '',
            test_status: 'Untested',
            properties: { ...(clonedNode.data.properties || {}) },
            type: 'node',
          });
        }
        setPinnedFocusNodeId(prev => (prev === targetId ? res.cloned_root_id : prev));

        // 2) 현재 워크스페이스 필터(filterText)가 활성화된 상태에서 새 태그(#골드던전 등)로 복제하여
        //    기존 해시태그가 치환되면 /api/graph?filter=... 응답에서 복제된 노드가 제외될 수 있으므로 전체 보기로 전환합니다.
        if (filterText && setFilterText) {
          const fl = filterText.toLowerCase();
          const matchesCurrentFilter =
            clonedNode.data.name.toLowerCase().includes(fl) ||
            clonedNode.data.label.toLowerCase().includes(fl) ||
            (clonedNode.data.aliases || []).some(a => String(a).toLowerCase().includes(fl));
          if (!matchesCurrentFilter) {
            if (setShowAllDomains) setShowAllDomains(true);
            setFilterText('');
          }
        }
      }
      triggerRefresh();
    } catch (err: unknown) {
      setErrorToast(extractErrorMessage(err));
    }
  }, [selectedNodeRef, pushUndo, triggerRefresh, setErrorToast, setPinnedFocusNodeId, nodesRef, setNodes, setSelectedNode, setEditFormData, filterText, setFilterText, setShowAllDomains]);

  /**
   * 항목 C: 빈 공간 드래그 Quick Connect 팝오버에서 새 노드를 즉시 생성하고 소스 노드와 연결합니다.
   */
  const handleQuickCreateAndConnect = useCallback(async (
    sourceId: string,
    newNodeName: string,
    newNodeLabel: string,
    edgeType?: string,
    screenPosition?: { x: number; y: number }
  ) => {
    const trimmedName = newNodeName.trim();
    if (!sourceId || !trimmedName) return;
    try {
      const sourceNode = nodesRef.current.find(n => n.id === sourceId);
      const extractedTags = Array.from(trimmedName.matchAll(/#([^\s#]+)/g)).map(m => m[1]);
      const payloadAliases = [...extractedTags];
      if (filterText && !payloadAliases.some(a => a.toLowerCase() === filterText.toLowerCase())) {
        payloadAliases.push(filterText);
      }
      const inheritedDomain = sourceNode?.data?.properties?.domain;
      const initialProperties: Record<string, unknown> = inheritedDomain ? { domain: inheritedDomain } : {};

      const newId = await api.nodes.createNode({
        label: newNodeLabel || 'Screen',
        name: trimmedName,
        aliases: payloadAliases,
        description: '',
        issue_link: '',
        test_status: 'Untested',
        properties: initialProperties,
      });
      pushUndo({ type: 'CREATE_NODE', id: newId });

      let initialPos = {
        x: (sourceNode?.position?.x || 0) + (sourceNode?.measured?.width || 260) + 80,
        y: sourceNode?.position?.y || 0,
      };
      if (rfInstance && screenPosition) {
        initialPos = rfInstance.screenToFlowPosition(screenPosition);
      }

      const newNode: CoverageNode = {
        id: newId,
        type: 'custom',
        position: initialPos,
        className: 'status-untested',
        data: {
          id: newId,
          label: newNodeLabel || 'Screen',
          name: trimmedName,
          aliases: payloadAliases,
          description: '',
          issue_link: '',
          test_status: 'Untested',
          properties: initialProperties,
          badges: [],
        },
      };
      const updatedNodes = [...nodesRef.current, newNode];
      nodesRef.current = updatedNodes;
      setNodes(updatedNodes);

      await createEdgeBetweenNodes(sourceId, newId, edgeType);
    } catch (err: unknown) {
      setErrorToast(extractErrorMessage(err));
    }
  }, [nodesRef, filterText, pushUndo, rfInstance, setNodes, createEdgeBetweenNodes, setErrorToast]);

  const handleSave = useCallback(async () => {
    if (isCreatingNode) {
      try {
        const payloadAliases = Array.isArray(editFormData.aliases)
          ? editFormData.aliases
          : (typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map(s => s.trim()).filter(Boolean) : []);
        const statusName = (editFormData.test_status as StatusName) || 'Untested';
        const newId = await api.nodes.createNode({
          label: editFormData.label || 'Node',
          name: editFormData.name || '',
          aliases: payloadAliases,
          description: editFormData.description || '',
          issue_link: editFormData.issue_link || '',
          test_status: statusName,
          properties: editFormData.properties || {},
        });
        pushUndo({ type: 'CREATE_NODE', id: newId });

        const targetScreenPos = pendingCreatePosRef?.current || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        let initialPos = { x: targetScreenPos.x - 100, y: targetScreenPos.y - 50 };
        if (rfInstance) {
          initialPos = rfInstance.screenToFlowPosition(targetScreenPos);
        }
        if (pendingCreatePosRef) {
          pendingCreatePosRef.current = null;
        }
        const newNode: CoverageNode = {
          id: newId,
          type: 'custom',
          position: initialPos,
          selected: true,
          className: `status-${statusName.toLowerCase()}`,
          data: {
            id: newId,
            label: editFormData.label || 'Node',
            name: editFormData.name || '',
            aliases: payloadAliases,
            description: editFormData.description || '',
            issue_link: editFormData.issue_link || '',
            test_status: statusName,
            properties: editFormData.properties || {},
            badges: [],
          },
        };
        const nextNodes = [...nodesRef.current.map(n => (n.selected ? { ...n, selected: false } : n)), newNode];
        nodesRef.current = nextNodes;
        setNodes(nextNodes);
        selectedNodeRef.current = newNode;
        if (setIsCreatingNode) setIsCreatingNode(false);
        setSelectedNode(newNode);
        if (setEditFormData) {
          setEditFormData(prev => ({ ...prev, id: newId, type: 'node' }));
        }
        if (filterText && setFilterText) {
          const fl = filterText.toLowerCase();
          const matchesCurrentFilter =
            (newNode.data.name || '').toLowerCase().includes(fl) ||
            (newNode.data.label || '').toLowerCase().includes(fl) ||
            (newNode.data.aliases || []).some(a => String(a).toLowerCase().includes(fl));
          if (!matchesCurrentFilter) {
            if (setShowAllDomains) setShowAllDomains(true);
            setFilterText('');
          }
        } else if (!filterText && setShowAllDomains) {
          setShowAllDomains(true);
        }
        triggerRefresh();
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
      }
      return;
    }

    if (editFormData.type === 'node') {
      const targetId = editFormData.id;
      const targetNode = nodesRef.current.find(n => n.id === targetId) || (selectedNodeRef.current?.id === targetId ? selectedNodeRef.current : undefined);
      if (!targetId || !targetNode) return;
      pushUndo({
        type: 'UPDATE_NODE',
        id: targetId,
        oldData: { label: targetNode.data?.label || 'Node', name: targetNode.data?.name || '', aliases: targetNode.data?.aliases || [], test_status: targetNode.data?.test_status || 'Untested', properties: { ...(targetNode.data?.properties || {}) } },
      });
      // Extract description and issue_link to top-level for the backend, while preserving is_global in properties
      // 전용 폼 컨트롤(#nodeIsGlobal, description, issue_link)이 사용하는 키는 보존하되,
      // Custom Properties 목록에서는 SYSTEM_RESERVED_KEYS 필터로 숨깁니다.
      // 상태는 폼에 열어둔 값이 아니라 "현재 노드의 실제 상태"를 사용합니다.
      // (폼을 연 뒤 연쇄 전파로 Blocked 등이 된 경우, 이름만 고쳐 저장해도 전파 결과를 덮어쓰지 않도록)
      // 기존 시스템 속성(checklist / 📌 고정 / 변경 표시 / is_global 등)은 로컬 state에서도 그대로 보존합니다.
      // (백엔드는 properties를 병합(n += $properties)하므로 서버 쪽 값도 유지됨)
      try {
        const nextLabel = editFormData.label || targetNode.data?.label || 'Node';
        const nextName = editFormData.name !== undefined ? editFormData.name : (targetNode.data?.name || '');
        const nextAliases = Array.isArray(editFormData.aliases)
          ? editFormData.aliases
          : (typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map(s => s.trim()).filter(Boolean) : (targetNode.data?.aliases || []));
        const nextDesc = editFormData.description !== undefined ? String(editFormData.description) : targetNode.data?.description;
        const nextIssue = editFormData.issue_link !== undefined ? String(editFormData.issue_link) : targetNode.data?.issue_link;

        await api.nodes.updateNode(targetId, {
          label: nextLabel,
          name: nextName,
          aliases: nextAliases,
          description: nextDesc,
          issue_link: nextIssue,
          properties: editFormData.properties,
        });
        // Don't triggerRefresh for normal edits — local state is already updated
        // triggerRefresh would re-run dagre layout and reset all dragged positions
        // However, if is_global was changed (un-globalized or globalized), graph structure changes and requires full refresh
        const wasGlobal = String(targetNode.data?.properties?.is_global ?? targetNode.data?.is_global ?? '').toLowerCase() === 'true';
        const isGlobalNow = String(editFormData.properties?.is_global ?? '').toLowerCase() === 'true';
        const globalChanged = wasGlobal !== isGlobalNow;

        setNodes(nds => nds.map(n => (n.id === targetId ? {
          ...n,
          data: {
            ...n.data,
            label: nextLabel,
            name: nextName,
            aliases: nextAliases,
            description: nextDesc,
            issue_link: nextIssue,
            properties: { ...(n.data?.properties || {}), ...(editFormData.properties || {}) },
          },
        } : n)));
        setSelectedNode(prev => (prev && prev.id === targetId ? {
          ...prev,
          data: {
            ...prev.data,
            label: nextLabel,
            name: nextName,
            aliases: nextAliases,
            description: nextDesc,
            issue_link: nextIssue,
            properties: { ...(prev.data?.properties || {}), ...(editFormData.properties || {}) },
          },
        } : prev));

        if (globalChanged) {
          triggerRefresh();
        } else {
          syncStatusesFromServer();
        }
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
      }
    } else if (editFormData.type === 'edge') {
      const targetId = editFormData.id;
      const targetEdge = edgesRef.current.find(e => e.id === targetId) || (selectedEdgeRef.current?.id === targetId ? selectedEdgeRef.current : undefined);
      if (!targetId || !targetEdge) return;
      pushUndo({
        type: 'UPDATE_EDGE',
        id: targetId,
        oldData: { type: targetEdge.data?.type || targetEdge.label || 'Transition', test_status: targetEdge.data?.test_status || 'Untested', action: targetEdge.data?.action },
      });
      // Snapshot for rollback
      // 1) 낙관적 업데이트: 엣지 상태 및 타입 반영 + 타겟 노드 재계산/하류 전파
      // data.type도 함께 갱신해야 전파 엔진(edgeTypeOf)이 바뀐 타입(예: Return 전환)을 인식합니다.
      // 타입/상태가 바뀐 엣지의 타겟을 재계산하고 하류로 전파 (낙관적) → 서버 결과로 재동기화
      try {
        const nextEdgeType: string = editFormData.edgeType || targetEdge.data?.type || (typeof targetEdge.label === 'string' ? targetEdge.label : 'Transition');
        const nextEdgeStatus: StatusName = ((editFormData.status as StatusName) || (editFormData.test_status as StatusName) || targetEdge.data?.test_status || 'Untested');
        await api.edges.updateEdge(targetId, { type: nextEdgeType, action: editFormData.action, test_status: nextEdgeStatus });
        setEdges(eds => eds.map(e => (e.id === targetId ? {
          ...e,
          label: nextEdgeType,
          data: {
            ...e.data,
            type: nextEdgeType,
            action: editFormData.action || e.data?.action,
            test_status: nextEdgeStatus,
          },
        } : e)));
        // 2) 저장 → 서버 결과로 재동기화
        syncStatusesFromServer();
      } catch (err: unknown) {
        setErrorToast(extractErrorMessage(err));
      }
    }
  }, [editFormData, isCreatingNode, setIsCreatingNode, rfInstance, triggerRefresh, nodesRef, selectedNodeRef, pushUndo, edgesRef, selectedEdgeRef, setNodes, setSelectedNode, syncStatusesFromServer, setErrorToast, setEdges, pendingCreatePosRef, setEditFormData, filterText, setFilterText, setShowAllDomains]);

  return {
    createEdgeBetweenNodes,
    handleQuickCreateAndConnect,
    onNodesDelete,
    onEdgesDelete,
    handleDetachFromParent,
    handleDelete,
    handleSaveStatus,
    saveChecklist,
    handleCloneNode,
    handleSave,
  };
}
