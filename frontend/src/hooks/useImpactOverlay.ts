import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
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
}

// Impact Overlay Mode (다중 글로벌 노드 동시 비교 및 합집합 OR / 교집합 AND 필터 지원)
export function useImpactOverlay({
  nodesRef,
  setNodes,
  setSelectedNode,
  setSelectedEdge,
  setSearchQuery,
  setPinnedFocusNodeId,
  pushNodeUndoSnapshot,
  setErrorToast,
}: UseImpactOverlayProps) {
  const [activeImpacts, setActiveImpacts] = useState<ActiveImpactItem[]>([]);
  const [impactFilterOperator, setImpactFilterOperator] = useState<ImpactFilterOperator>('OR');
  const [modifiedNoteDraft, setModifiedNoteDraft] = useState('');

  const hasImpactOverlay = activeImpacts.length > 0;

  const toggleImpact = useCallback(async (globalNodeId: string, globalNodeName: string) => {
    // 이미 활성화된 글로벌 노드면 즉시 토글 해제
    if (activeImpacts.some(item => item.globalNodeId === globalNodeId)) {
      setActiveImpacts(prev => prev.filter(item => item.globalNodeId !== globalNodeId));
      return;
    }
    try {
      const data = await api.globals.fetchImpact(globalNodeId);
      const connectedIds = new Set<string>(data.connected_nodes.map(n => n.id));
      const edgeIds = new Set<string>(data.connected_nodes.map(n => n.edge_id).filter((id): id is string => Boolean(id)));
      setActiveImpacts(prev => {
        if (prev.some(item => item.globalNodeId === globalNodeId)) {
          return prev.filter(item => item.globalNodeId !== globalNodeId);
        }
        const base = prev.length >= 5 ? prev.slice(1) : prev;
        const usedSlots = new Set(base.map(item => item.slotIndex));
        let slotIndex = 0;
        while (usedSlots.has(slotIndex) && slotIndex < 4) {
          slotIndex += 1;
        }
        return [
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
      });
      // Deselect everything else
      setSelectedNode(null);
      setSelectedEdge(null);
      setSearchQuery('');
      setPinnedFocusNodeId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to activate impact mode', message);
      setErrorToast(message || 'Failed to activate impact mode');
    }
  }, [activeImpacts, setSelectedNode, setSelectedEdge, setSearchQuery, setPinnedFocusNodeId, setErrorToast]);

  const removeImpact = useCallback((globalNodeId: string) => {
    setActiveImpacts(prev => prev.filter(item => item.globalNodeId !== globalNodeId));
  }, []);

  const deactivateImpact = useCallback(() => {
    setActiveImpacts([]);
  }, []);

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
    setImpactFilterOperator,
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
