import { useState, useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { CoverageNode, CoverageEdge } from '../types/graph';
import type { ActiveImpactItem, ImpactFilterOperator } from '../types/ui';
import { api } from '../api/client';
import { t } from '../locales/koKR';

interface UseImpactOverlayProps {
  nodesRef: MutableRefObject<CoverageNode[]>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setPinnedFocusNodeId: Dispatch<SetStateAction<string | null>>;
  pushNodeUndoSnapshot: (node: CoverageNode) => void;
  setErrorToast: (msg: string | null) => void;
  rfInstance?: ReactFlowInstance<CoverageNode, CoverageEdge> | null;
}

// Impact Overlay Mode (다중 글로벌 노드 동시 비교, 합집합 OR / 교집합 AND 필터, 격리 뷰 및 목록 네비게이터 지원)
export function useImpactOverlay({
  nodesRef,
  setNodes,
  setSelectedNode,
  setSelectedEdge,
  setSearchQuery,
  setPinnedFocusNodeId,
  pushNodeUndoSnapshot,
  setErrorToast,
  rfInstance,
}: UseImpactOverlayProps) {
  const [activeImpacts, setActiveImpacts] = useState<ActiveImpactItem[]>([]);
  const [impactFilterOperator, setImpactFilterOperator] = useState<ImpactFilterOperator>('OR');
  const [isImpactIsolated, setIsImpactIsolated] = useState<boolean>(false);
  const [modifiedNoteDraft, setModifiedNoteDraft] = useState('');

  const hasImpactOverlay = activeImpacts.length > 0;

  // 글로벌 영향도가 모두 해제되면 격리 모드도 초기화
  useEffect(() => {
    if (activeImpacts.length === 0 && isImpactIsolated) {
      setIsImpactIsolated(false);
    }
  }, [activeImpacts.length, isImpactIsolated]);

  // 활성 글로벌 영향도 대상 노드들의 Bounding Box로 자동 fitView (GLOBAL_IMPACT_ISOLATION_AND_NAVIGATION_SPEC 3.3)
  const fitToActiveImpacts = useCallback((impacts: ActiveImpactItem[], operator: ImpactFilterOperator) => {
    if (!rfInstance || impacts.length === 0) return;
    let matchedIds: Set<string>;
    if (impacts.length === 1) {
      matchedIds = impacts[0].connectedIds;
    } else if (operator === 'AND') {
      const [first, ...rest] = impacts;
      matchedIds = new Set(
        Array.from(first.connectedIds).filter(id => rest.every(item => item.connectedIds.has(id)))
      );
    } else {
      matchedIds = new Set<string>();
      impacts.forEach(item => item.connectedIds.forEach(id => matchedIds.add(id)));
    }
    if (matchedIds.size === 0) return;

    const currentNodes = nodesRef.current;
    const visibleTargetIds = new Set<string>();
    matchedIds.forEach(id => {
      const nd = currentNodes.find(n => n.id === id);
      if (!nd) return;
      if (nd.hidden && nd.parentId) {
        visibleTargetIds.add(nd.parentId);
      } else {
        visibleTargetIds.add(id);
      }
    });
    if (visibleTargetIds.size === 0) return;

    setTimeout(() => {
      try {
        rfInstance.fitView({
          nodes: Array.from(visibleTargetIds).map(id => ({ id })),
          padding: 0.25,
          maxZoom: 1.25,
          duration: 400,
        });
      } catch {
        // Ignore fitView errors during rapid unmount/layout transitions
      }
    }, 60);
  }, [rfInstance, nodesRef]);

  const toggleImpact = useCallback(async (globalNodeId: string, globalNodeName: string) => {
    // 이미 활성화된 글로벌 노드면 즉시 토글 해제
    if (activeImpacts.some(item => item.globalNodeId === globalNodeId)) {
      const nextImpacts = activeImpacts.filter(item => item.globalNodeId !== globalNodeId);
      setActiveImpacts(nextImpacts);
      if (nextImpacts.length > 0) {
        fitToActiveImpacts(nextImpacts, impactFilterOperator);
      }
      return;
    }
    try {
      const data = await api.globals.fetchImpact(globalNodeId);
      const connectedIds = new Set<string>(data.connected_nodes.map(n => n.id));
      const edgeIds = new Set<string>(data.connected_nodes.map(n => n.edge_id).filter((id): id is string => Boolean(id)));
      let nextImpactsSnapshot: ActiveImpactItem[] = [];
      setActiveImpacts(prev => {
        if (prev.some(item => item.globalNodeId === globalNodeId)) {
          nextImpactsSnapshot = prev.filter(item => item.globalNodeId !== globalNodeId);
          return nextImpactsSnapshot;
        }
        const base = prev.length >= 5 ? prev.slice(1) : prev;
        const usedSlots = new Set(base.map(item => item.slotIndex));
        let slotIndex = 0;
        while (usedSlots.has(slotIndex) && slotIndex < 4) {
          slotIndex += 1;
        }
        nextImpactsSnapshot = [
          ...base,
          {
            globalNodeId,
            globalNodeName,
            slotIndex,
            connectedIds,
            edgeIds,
            stats: data.stats,
            total: data.total,
          },
        ];
        return nextImpactsSnapshot;
      });
      // Deselect everything else
      setSelectedNode(null);
      setSelectedEdge(null);
      setSearchQuery('');
      setPinnedFocusNodeId(null);
      if (nextImpactsSnapshot.length > 0) {
        fitToActiveImpacts(nextImpactsSnapshot, impactFilterOperator);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to activate impact mode', message);
      setErrorToast(message || 'Failed to activate impact mode');
    }
  }, [activeImpacts, impactFilterOperator, fitToActiveImpacts, setSelectedNode, setSelectedEdge, setSearchQuery, setPinnedFocusNodeId, setErrorToast]);

  const removeImpact = useCallback((globalNodeId: string) => {
    setActiveImpacts(prev => {
      const next = prev.filter(item => item.globalNodeId !== globalNodeId);
      if (next.length > 0) {
        fitToActiveImpacts(next, impactFilterOperator);
      }
      return next;
    });
  }, [impactFilterOperator, fitToActiveImpacts]);

  const deactivateImpact = useCallback(() => {
    setActiveImpacts([]);
    setIsImpactIsolated(false);
  }, []);

  const changeImpactOperator = useCallback((nextOperator: ImpactFilterOperator) => {
    setImpactFilterOperator(nextOperator);
    if (activeImpacts.length > 0) {
      fitToActiveImpacts(activeImpacts, nextOperator);
    }
  }, [activeImpacts, fitToActiveImpacts]);

  const toggleImpactIsolation = useCallback(() => {
    setIsImpactIsolated(prev => {
      const next = !prev;
      if (next && activeImpacts.length > 0) {
        fitToActiveImpacts(activeImpacts, impactFilterOperator);
      } else if (!next && rfInstance) {
        setTimeout(() => {
          try {
            rfInstance.fitView({ padding: 0.2, duration: 400 });
          } catch {
            // Ignore fitView errors
          }
        }, 60);
      }
      return next;
    });
  }, [activeImpacts, impactFilterOperator, fitToActiveImpacts, rfInstance]);

  // 목록 드로어에서 특정 노드를 클릭했을 때 해당 노드로 카메라를 부드럽게 이동(Fly-to)하고 Inspector에 표시
  const focusNodeFromImpactList = useCallback((nodeId: string) => {
    const target = nodesRef.current.find(n => n.id === nodeId);
    if (!target) return;
    if (target.parentId) {
      const parent = nodesRef.current.find(p => p.id === target.parentId);
      if (parent?.data?.isCollapsed) {
        window.dispatchEvent(new CustomEvent('toggleCollapseNode', { detail: parent.id }));
      }
    }
    setSelectedNode(target);
    setSelectedEdge(null);
    setTimeout(() => {
      try {
        rfInstance?.fitView({
          nodes: [{ id: nodeId }],
          padding: 0.5,
          maxZoom: 1.3,
          duration: 450,
        });
      } catch {
        // Ignore fitView errors
      }
    }, 80);
  }, [nodesRef, setSelectedNode, setSelectedEdge, rfInstance]);

  /** D. 변경 표시 (Mark Modified): 기획/UI 변경이 발생한 노드에 보라색 펄스 + 하류 영향권 표시 */
  const handleMarkModified = useCallback(async (nodeId: string | undefined) => {
    if (!nodeId) return;
    const note = modifiedNoteDraft.trim();
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const prevNodes = nodesRef.current;
    const patch = { is_modified: true, modified_note: note, modified_at: new Date().toISOString() };
    setNodes(nds => nds.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, properties: { ...(n.data?.properties || {}), ...patch } } }
      : n));
    setModifiedNoteDraft('');
    try {
      await api.nodes.markModified(nodeId, note);
      pushNodeUndoSnapshot(node);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setNodes(prevNodes);
      setErrorToast(message || t.modified.saveFailed);
    }
  }, [modifiedNoteDraft, nodesRef, setNodes, pushNodeUndoSnapshot, setErrorToast]);

  /**
   * D. 변경사항 확인 완료 (Acknowledge): 펄스/영향권 표시 해제.
   * 테스트 상태(test_status)는 바꾸지 않습니다 — 재검증 결과는 테스터가 Mark Passed/체크리스트로 직접 기록합니다.
   */
  const handleAcknowledge = useCallback(async (nodeId: string | undefined) => {
    if (!nodeId) return;
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const prevNodes = nodesRef.current;
    const patch = { is_modified: false, acknowledged_at: new Date().toISOString() };
    setNodes(nds => nds.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, properties: { ...(n.data?.properties || {}), ...patch } } }
      : n));
    try {
      await api.nodes.acknowledgeNode(nodeId);
      pushNodeUndoSnapshot(node);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setNodes(prevNodes);
      setErrorToast(message || t.modified.saveFailed);
    }
  }, [nodesRef, setNodes, pushNodeUndoSnapshot, setErrorToast]);

  return {
    activeImpacts,
    setActiveImpacts,
    impactFilterOperator,
    setImpactFilterOperator: changeImpactOperator,
    isImpactIsolated,
    setIsImpactIsolated,
    toggleImpactIsolation,
    focusNodeFromImpactList,
    hasImpactOverlay,
    toggleImpact,
    removeImpact,
    deactivateImpact,
    modifiedNoteDraft,
    setModifiedNoteDraft,
    handleMarkModified,
    handleAcknowledge,
  };
}
