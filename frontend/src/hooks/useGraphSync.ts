import { useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { CoverageNode, CoverageEdge } from '../types/graph';
import type { EditFormData, GraphSnapshot } from '../types/ui';
import { applyStatusChanges } from '../statusPropagation';
import { api } from '../api/client';

interface UseGraphSyncProps {
  nodesRef: MutableRefObject<CoverageNode[]>;
  edgesRef: MutableRefObject<CoverageEdge[]>;
  selectedNodeRef: MutableRefObject<CoverageNode | null>;
  selectedEdgeRef: MutableRefObject<CoverageEdge | null>;
  editFormDataRef: MutableRefObject<EditFormData>;
  setNodes: Dispatch<SetStateAction<CoverageNode[]>>;
  setEdges: Dispatch<SetStateAction<CoverageEdge[]>>;
  setSelectedNode: Dispatch<SetStateAction<CoverageNode | null>>;
  setSelectedEdge: Dispatch<SetStateAction<CoverageEdge | null>>;
  setEditFormData: Dispatch<SetStateAction<EditFormData>>;
  setErrorToast: (msg: string | null) => void;
}

export interface MutationOptions<T> {
  actionName: string;
  optimisticUpdate?: () => void;
  apiCall: () => Promise<Response>;
  onSuccess?: (resData: T) => Promise<void> | void;
  skipStatusSync?: boolean;
}

export interface MutationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function useGraphSync({
  nodesRef,
  edgesRef,
  selectedNodeRef,
  selectedEdgeRef,
  editFormDataRef,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  setEditFormData,
  setErrorToast,
}: UseGraphSyncProps) {
  // 최신 nodes/edges 참조 (useCallback 핸들러의 stale closure 방지 — 전파 계산은 항상 최신 그래프 기준)

  // 서버 재동기화 순번: 늦게 도착한 이전 응답이 최신 낙관적 상태를 덮어쓰지 않도록 마지막 요청만 반영
  const statusSyncSeq = useRef(0);
  // 저장 중인 변경 요청 수: 다른 변경이 아직 저장 중이면 그 사이의 서버 스냅샷은 낡았으므로 반영하지 않음
  const pendingMutations = useRef(0);

  /**
   * 상태 전파를 일으키는 저장 요청 래퍼.
   * 요청 시작 시 진행 중인 재동기화를 무효화하고, 끝날 때까지 pending으로 표시합니다.
   */
  const persist = useCallback(async (url: string, init: RequestInit) => {
    pendingMutations.current += 1;
    statusSyncSeq.current += 1;
    try {
      return await fetch(url, init);
    } finally {
      pendingMutations.current -= 1;
    }
  }, []);

  /**
   * 낙관적 전파 이후 서버(SSOT)의 실제 연쇄 전파 결과로 노드 상태를 재동기화합니다.
   * - 프론트 state에는 Contains/배지 엣지가 없어 일부 노드는 로컬 계산과 서버 계산이 다를 수 있습니다.
   * - 레이아웃/줌을 건드리지 않고 test_status(+status-xxx 클래스)만 맞춥니다. (Anti-Jumping)
   */
  const syncStatusesFromServer = useCallback(async () => {
    const seq = ++statusSyncSeq.current;
    try {
      const serverStatuses = await api.nodes.fetchStatuses();
      if (seq !== statusSyncSeq.current || pendingMutations.current > 0) return;
      setNodes(nds => applyStatusChanges(nds, serverStatuses));
    } catch (err: unknown) {
      console.error('Failed to sync statuses', err);
    }
  }, [setNodes]);

  /** 로컬 전파 결과를 노드 state에 반영 (상태 변경 맵이 비어 있으면 아무것도 하지 않음) */
  const applyLocalStatusChanges = useCallback((changes: Record<string, string>) => {
    if (Object.keys(changes).length === 0) return;
    setNodes(nds => applyStatusChanges(nds, changes));
  }, [setNodes]);

  /**
   * 사전 뮤테이션 스냅샷 캡처 및 제로-점프(Zero-Jump) 롤백 실행기.
   * 모든 CUD 요청에 대해 낙관적 업데이트를 적용하고, 서버 오류 시 이전 상태로 복구하며 에러 토스트를 표시합니다.
   */
  const executeMutation = useCallback(async <T,>({
    actionName,
    optimisticUpdate,
    apiCall,
    onSuccess,
    skipStatusSync = false,
  }: MutationOptions<T>): Promise<MutationResult<T>> => {
    // Snapshot for rollback in case persist fails
    const snapshot: GraphSnapshot = {
      nodes: nodesRef.current,
      edges: edgesRef.current,
      selectedNode: selectedNodeRef.current,
      selectedEdge: selectedEdgeRef.current,
      editFormData: { ...editFormDataRef.current },
      sequenceToken: statusSyncSeq.current,
    };

    pendingMutations.current += 1;
    statusSyncSeq.current += 1;

    if (optimisticUpdate) {
      try {
        optimisticUpdate();
      } catch (err: unknown) {
        console.error(`Optimistic update failed for ${actionName}`, err);
      }
    }

    try {
      const res = await apiCall();
      if (!res.ok) {
        let errorMessage = `Failed to ${actionName}`;
        try {
          const errJson = await res.json();
          errorMessage = errJson.detail || errJson.message || errorMessage;
        } catch {
          const text = await res.text().catch(() => '');
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      let resData: T | undefined = undefined;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          resData = (await res.json()) as T;
        } catch {
          // Gracefully ignore body parsing if response body is empty
        }
      }

      if (onSuccess && resData !== undefined) {
        await onSuccess(resData);
      }

      if (!skipStatusSync) {
        // 3) 저장 (백엔드 update_node가 동일 규칙으로 연쇄 전파) → 서버 결과로 재동기화
        await syncStatusesFromServer();
      }

      return { ok: true, data: resData };
    } catch (err: unknown) {
      statusSyncSeq.current += 1;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setSelectedNode(snapshot.selectedNode);
      setSelectedEdge(snapshot.selectedEdge);
      setEditFormData(snapshot.editFormData);
      const errorText = err instanceof Error ? err.message : `Failed to ${actionName}`;
      setErrorToast(errorText);
      return { ok: false, error: errorText };
    } finally {
      pendingMutations.current -= 1;
    }
  }, [
    syncStatusesFromServer,
    setNodes,
    setEdges,
    setSelectedNode,
    setSelectedEdge,
    setEditFormData,
    setErrorToast,
    nodesRef,
    edgesRef,
    selectedNodeRef,
    selectedEdgeRef,
    editFormDataRef,
  ]);

  return {
    statusSyncSeq,
    pendingMutations,
    persist,
    syncStatusesFromServer,
    applyLocalStatusChanges,
    executeMutation,
  };
}
