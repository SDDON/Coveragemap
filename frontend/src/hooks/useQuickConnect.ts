import { useState, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { CoverageNode, QuickConnectPopoverState, PendingConnectSourceState } from '../types';
import { getSmartDefaultEdgeType } from '../utils/graphScopes';

export interface UseQuickConnectProps {
  nodesRef: MutableRefObject<CoverageNode[]>;
  createEdgeBetweenNodes: (
    sourceId: string,
    targetId: string,
    explicitEdgeType?: string,
    extraProperties?: Record<string, unknown>
  ) => Promise<void>;
}

export function useQuickConnect({ nodesRef, createEdgeBetweenNodes }: UseQuickConnectProps) {
  // E. 연결 드래그 중일 때만 타겟 드롭 히트박스를 노드 전체로 확장하기 위한 플래그 (.react-flow--connecting)
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const connectDragRef = useRef<{ sourceNodeId: string | null; startX: number; startY: number; didConnect: boolean }>({
    sourceNodeId: null,
    startX: 0,
    startY: 0,
    didConnect: false,
  });
  const quickConnectOpenedAtRef = useRef<number>(0);

  // 장거리 노드 연결 UI/UX (Pattern A: 빈 캔버스 드롭 팝오버 / Pattern B: 2-Step 소스 고정 후 타겟 클릭)
  const [quickConnectPopover, setQuickConnectPopover] = useState<QuickConnectPopoverState | null>(null);
  const [pendingConnectSource, setPendingConnectSource] = useState<PendingConnectSourceState | null>(null);

  // E. 연결 드래그 중에만 컨테이너에 .react-flow--connecting을 붙여 타겟 드롭 히트박스를 노드 전체로 확장
  const onConnectStart = useCallback((event: MouseEvent | TouchEvent, params: { nodeId: string | null }) => {
    setIsConnecting(true);
    const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX ?? 0;
    const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY ?? 0;
    connectDragRef.current = { sourceNodeId: params.nodeId || null, startX: clientX, startY: clientY, didConnect: false };
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    setIsConnecting(false);
    const drag = connectDragRef.current;
    if (!drag.sourceNodeId || drag.didConnect) {
      connectDragRef.current = { sourceNodeId: null, startX: 0, startY: 0, didConnect: false };
      return;
    }
    const clientX = 'clientX' in event ? event.clientX : event.changedTouches?.[0]?.clientX ?? 0;
    const clientY = 'clientY' in event ? event.clientY : event.changedTouches?.[0]?.clientY ?? 0;
    const dist = Math.hypot(clientX - drag.startX, clientY - drag.startY);
    if (dist >= 50) {
      const srcNode = nodesRef.current.find(n => n.id === drag.sourceNodeId);
      const defaultEdgeType = getSmartDefaultEdgeType(srcNode, undefined);
      const clampedX = Math.min(Math.max(clientX, 20), window.innerWidth - 340);
      const clampedY = Math.min(Math.max(clientY, 20), window.innerHeight - 380);
      quickConnectOpenedAtRef.current = Date.now();
      setQuickConnectPopover({ sourceNodeId: drag.sourceNodeId, x: clampedX, y: clampedY, edgeType: defaultEdgeType, search: '' });
    }
  }, [nodesRef]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: CoverageNode) => {
    setQuickConnectPopover(null);
    if (pendingConnectSource && node.id !== pendingConnectSource.nodeId) {
      createEdgeBetweenNodes(
        pendingConnectSource.nodeId,
        node.id,
        pendingConnectSource.edgeTypeManuallySet ? pendingConnectSource.edgeType : undefined
      );
      setPendingConnectSource(null);
    }
  }, [pendingConnectSource, createEdgeBetweenNodes]);

  return {
    isConnecting,
    connectDragRef,
    quickConnectOpenedAtRef,
    quickConnectPopover,
    setQuickConnectPopover,
    pendingConnectSource,
    setPendingConnectSource,
    onConnectStart,
    onConnectEnd,
    onNodeClick,
  };
}
