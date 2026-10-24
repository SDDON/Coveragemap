// Living TC 4-Stage 연쇄 전파 엔진 (백엔드 compute_synthesized_status 와 동일 규칙)
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  ConnectionMode,
  Connection,
  ReactFlowInstance,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Tooltip } from 'react-tooltip';
import {
  CoverageNode,
  CoverageEdge,
  ApiNode,
  EditFormData,
  RightPanelTab,
  HealthStatus,
} from './types';
import CustomCoverageNode from './CoverageNode';
import FloatingEdge from './FloatingEdge';
import { PresetManagerModal } from './components/PresetManagerModal';
import { InspectorPanel } from './components/Inspector';
import {
  TopToolbar,
  WorkspaceSelectorOverlay,
  CanvasContextMenu,
  QuickConnectPopover,
  PendingConnectBanner,
  PinnedFocusBanner,
  ImpactStatsBar,
  SystemStatusPill,
  HelpModal,
  ErrorToast,
  EmptyStateOverlay,
  LoadingOverlay,
} from './components/CanvasOverlays';
import { calculateEdgeBundling } from './utils/edgeBundling';
import { FILTERABLE_NODE_TYPES } from './utils/constants';
import { api } from './api/client';
import { useUndoStack } from './hooks/useUndoStack';
import { useImpactOverlay } from './hooks/useImpactOverlay';
import { useGraphSync } from './hooks/useGraphSync';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useFocusContext } from './hooks/useFocusContext';
import { useGraphOperations } from './hooks/useGraphOperations';
import { useCanvasBadgeEvents } from './hooks/useCanvasBadgeEvents';
import { useQuickConnect } from './hooks/useQuickConnect';

const nodeTypes = { custom: CustomCoverageNode };
const edgeTypes = { floating: FloatingEdge };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CoverageNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CoverageEdge>([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<CoverageNode, CoverageEdge> | null>(null);

  const [selectedNode, setSelectedNode] = useState<CoverageNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<CoverageEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('view');
  const [filterText, setFilterText] = useState<string>(() => localStorage.getItem('savedWorkspace') || '');
  const [showAllDomains, setShowAllDomains] = useState<boolean>(() => localStorage.getItem('savedShowAll') === 'true');
  const [maxDepth, setMaxDepth] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(() => new Set(FILTERABLE_NODE_TYPES));
  const [aliases, setAliases] = useState<string[]>([]);
  const [globalNodesList, setGlobalNodesList] = useState<ApiNode[]>([]);

  const [isCreatingNode, setIsCreatingNode] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    id: '',
    label: 'Node',
    name: '',
    aliases: [],
    description: '',
    issue_link: '',
    test_status: 'Untested',
    type: 'node',
  });
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showPresetManager, setShowPresetManager] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean } | null>(null);
  // B. Mark Blocked(📌 수동 차단) 사유 입력 UI 상태 — null이면 입력창 닫힘
  const [blockReasonDraft, setBlockReasonDraft] = useState<string | null>(null);
  // 결함 원인 역추적(Trace Root Cause) 활성 대상 노드 ID (AI_IMPLEMENTATION_SPEC 3.3)
  const [tracedRootNodeId, setTracedRootNodeId] = useState<string | null>(null);
  // 화면(Screen/Container) 단위 다국어 스코프 감사 활성 루트 노드 ID (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 4.1)
  const [scopedAuditRootId, setScopedAuditRootId] = useState<string | null>(null);
  // 특정 콘텐츠 중심 확인을 위한 포커스 고정 노드 ID (Content Focus Pinning)
  const [pinnedFocusNodeId, setPinnedFocusNodeId] = useState<string | null>(null);
  // 그래프 전체 재조회(/api/graph) 완료 횟수 — 재조회로 className이 초기화되면 하이라이트 effect를 다시 적용하기 위함
  const [graphVersion, setGraphVersion] = useState<number>(0);

  const nodesRef = useRef<CoverageNode[]>(nodes);
  const edgesRef = useRef<CoverageEdge[]>(edges);
  const selectedNodeRef = useRef<CoverageNode | null>(selectedNode);
  const selectedEdgeRef = useRef<CoverageEdge | null>(selectedEdge);
  const editFormDataRef = useRef<EditFormData>(editFormData);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  selectedNodeRef.current = selectedNode;
  selectedEdgeRef.current = selectedEdge;
  editFormDataRef.current = editFormData;

  const triggerRefresh = useCallback(() => setGraphVersion(v => v + 1), []);

  const { loading, error: layoutError, setError: setLayoutError, unparentNodesOnContainsDelete, relayoutFocused, nodesStructuralKey, nodesStatusKey } = useGraphLayout({
    nodes, edges, triggerRefresh, filterText, maxDepth, visibleTypes, graphVersion, rfInstance, setNodes, setEdges, nodesRef,
    selectedNodeRef, setSelectedNode, setEditFormData,
  });

  const { persist, syncStatusesFromServer, applyLocalStatusChanges, executeMutation } = useGraphSync({
    setNodes, setEdges, setSelectedNode, setSelectedEdge, setEditFormData, setErrorToast,
    nodesRef, edgesRef, selectedNodeRef, selectedEdgeRef, editFormDataRef,
  });

  const { pushUndo } = useUndoStack({
    setNodes, setEdges, setSelectedNode, setSelectedEdge, setEditFormData, setErrorToast,
    syncStatusesFromServer, unparentNodesOnContainsDelete, selectedEdge, edgesRef, selectedNodeRef,
    setPinnedFocusNodeId, triggerRefresh,
  });

  const {
    activeImpacts, setActiveImpacts, impactFilterOperator, setImpactFilterOperator, hasImpactOverlay,
    toggleImpact, removeImpact, deactivateImpact, modifiedNoteDraft, setModifiedNoteDraft, handleMarkModified, handleAcknowledge,
  } = useImpactOverlay({
    nodesRef, setNodes, setSelectedNode, setSelectedEdge, setSearchQuery, setPinnedFocusNodeId, setErrorToast,
    pushNodeUndoSnapshot: node => pushUndo({
      type: 'UPDATE_NODE', id: node.id,
      previousData: { label: node.data?.label || 'Node', name: node.data?.name || '', aliases: node.data?.aliases || [], test_status: node.data?.test_status || 'Untested', properties: { ...(node.data?.properties || {}) } },
    }),
  });

  const { hoveredGlobalBadgeId } = useCanvasBadgeEvents({
    nodesRef, setNodes, setEdges, selectedNode, setSelectedNode, setSelectedEdge, persist, executeMutation,
    setEditFormData, setRightPanelTab, setIsCreatingNode,
  });

  const { rootCauseScope, scopedAuditScope } = useFocusContext({
    nodes, edges, setNodes, setEdges, selectedNode, selectedEdge, hoveredNode, hoveredEdge, maxDepth, searchQuery,
    pinnedFocusNodeId, tracedRootNodeId, scopedAuditRootId, activeImpacts, impactFilterOperator, hasImpactOverlay, graphVersion, isDraggingRef,
  });

  const {
    createEdgeBetweenNodes, onNodesDelete, onEdgesDelete, handleDetachFromParent,
    handleDelete, handleSaveStatus, saveChecklist, handleCloneNode, handleSave,
  } = useGraphOperations({
    nodesRef, edgesRef, selectedNodeRef, selectedEdgeRef, editFormData, setNodes, setEdges, setSelectedNode, setSelectedEdge,
    setPinnedFocusNodeId, setActiveImpacts, pushUndo, applyLocalStatusChanges, syncStatusesFromServer, triggerRefresh, unparentNodesOnContainsDelete, setErrorToast,
    isCreatingNode, setIsCreatingNode, rfInstance, setEditFormData,
  });

  const {
    isConnecting, connectDragRef, quickConnectOpenedAtRef, quickConnectPopover, setQuickConnectPopover, pendingConnectSource, setPendingConnectSource,
    onConnectStart, onConnectEnd, onNodeClick,
  } = useQuickConnect({ nodesRef, createEdgeBetweenNodes });

  // 고정된 포커스 노드가 그래프 재로드/필터 변경으로 사라지면 고정 해제
  useEffect(() => {
    if (pinnedFocusNodeId && !nodes.some(n => n.id === pinnedFocusNodeId)) {
      setPinnedFocusNodeId(null);
    }
  }, [pinnedFocusNodeId, nodes]);

  const prevSelectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = selectedNode?.id || selectedEdge?.id || (isCreatingNode ? '__new__' : null);
    if (currentId !== prevSelectionIdRef.current) {
      if (currentId) {
        setRightPanelTab('edit');
      } else {
        setRightPanelTab(prev => (prev === 'edit' ? 'view' : prev));
      }
      prevSelectionIdRef.current = currentId;
    }
  }, [selectedNode?.id, selectedEdge?.id, isCreatingNode]);

  // Ensure it stays floating
  // (Cypher Export 기능은 FEATURE_PRUNING_GUIDE 1순위 정리 대상으로 제거됨 — 데이터 백업/공유는 프리셋 JSON 저장 사용)
  const visibleEdges = useMemo(() => {
    const edgeMap = new Map<string, CoverageEdge>();
    const edgePriority = (edge: CoverageEdge): number => {
      const cls = edge.className || '';
      let score = 0;
      if (cls.includes('active')) score += 100;
      if (cls.includes('highlight-root-cause')) score += 50;
      if (cls.includes('highlight-affected')) score += 25;
      if (cls.includes('impact-edge')) score += 25;
      if (cls.includes('status-failed')) score += 4;
      else if (cls.includes('status-blocked')) score += 3;
      else if (cls.includes('status-passed')) score += 2;
      else if (cls.includes('status-untested')) score += 1;
      return score;
    };

    // Ensure memoization invalidates on structural or status updates
    if (!nodesStructuralKey && !nodesStatusKey && !edges) return [];

    const nodeInfoMap = new Map<string, { parentId?: string; isCollapsed?: boolean }>();
    for (const n of nodesRef.current) {
      nodeInfoMap.set(n.id, { parentId: n.parentId, isCollapsed: Boolean(n.data?.isCollapsed) });
    }

    edges.forEach(e => {
      const sInfo = nodeInfoMap.get(e.source);
      const tInfo = nodeInfoMap.get(e.target);
      const sParentInfo = sInfo?.parentId ? nodeInfoMap.get(sInfo.parentId) : undefined;
      const tParentInfo = tInfo?.parentId ? nodeInfoMap.get(tInfo.parentId) : undefined;
      const sCollapsed = sParentInfo?.isCollapsed;
      const tCollapsed = tParentInfo?.isCollapsed;
      const newSource = sCollapsed ? (sInfo?.parentId as string) : e.source;
      const newTarget = tCollapsed ? (tInfo?.parentId as string) : e.target;
      if (newSource === newTarget) return;

      const isRerouted = newSource !== e.source || newTarget !== e.target;
      const domainType = String(e.data?.type || e.label || e.type || 'floating');
      const key = `${newSource}-${newTarget}-${domainType}`;
      const finalEdge: CoverageEdge = { ...e, source: newSource, target: newTarget };
      if (isRerouted) {
        finalEdge.id = key;
        finalEdge.label = '...';
        finalEdge.type = 'floating';
        const existing = edgeMap.get(key);
        if (!existing || edgePriority(finalEdge) > edgePriority(existing)) edgeMap.set(key, finalEdge);
      } else {
        edgeMap.set(e.id, finalEdge);
      }
    });
    return calculateEdgeBundling(Array.from(edgeMap.values()));
  }, [edges, nodesStructuralKey, nodesStatusKey]);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    connectDragRef.current.didConnect = true;
    await createEdgeBetweenNodes(conn.source, conn.target);
  }, [connectDragRef, createEdgeBetweenNodes]);

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: CoverageNode[]; edges: CoverageEdge[] }) => {
    const nextNode = selNodes.length > 0 ? selNodes[0] : null;
    const nextEdge = selEdges.length > 0 ? selEdges[0] : null;

    setSelectedNode(prev => {
      if (prev?.id !== nextNode?.id) {
        // 선택 대상(id)이 바뀌면 이전 노드용 입력(차단 사유/변경 메모/원인 역추적/화면 다국어 감사/노드 복제 박스)은 닫고 비웁니다.
        // (React Flow는 노드 data가 바뀌어도 selection을 새 객체로 다시 알려주므로 id 기준으로만 초기화)
        setBlockReasonDraft(null);
        setModifiedNoteDraft('');
        setTracedRootNodeId(null);
        setScopedAuditRootId(null);
      }
      return nextNode;
    });
    setSelectedEdge(nextEdge);

    if (nextNode) {
      setEditFormData({
        id: nextNode.id, label: nextNode.data?.label || 'Node', name: nextNode.data?.name || '', aliases: nextNode.data?.aliases || [],
        description: nextNode.data?.description || '', issue_link: nextNode.data?.issue_link || '', test_status: nextNode.data?.test_status || 'Untested',
        properties: { ...(nextNode.data?.properties || {}) }, type: 'node',
      });
      setIsCreatingNode(false);
    } else if (nextEdge) {
      setEditFormData({
        id: nextEdge.id, label: (nextEdge.label as string) || nextEdge.data?.type || 'Transition', name: '', aliases: [], description: '', issue_link: '',
        test_status: nextEdge.data?.test_status || 'Untested', edgeType: nextEdge.data?.type || (nextEdge.label as string) || 'Transition',
        action: nextEdge.data?.action || '', properties: { ...(nextEdge.data?.properties || {}) }, type: 'edge',
      });
      setIsCreatingNode(false);
    }
  }, [setEditFormData, setModifiedNoteDraft]);

  const fetchGlobals = useCallback(async () => {
    try {
      const data = await api.globals.fetchGlobals();
      setGlobalNodesList(data);
    } catch {
      setGlobalNodesList([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchAliases = async () => {
      try {
        const res = await fetch('/api/aliases');
        if (res.ok && mounted) {
          const data = (await res.json()) as string[];
          setAliases(data);
        }
      } catch {
        if (mounted) setAliases([]);
      }
    };
    fetchAliases();
    fetchGlobals();
    return () => { mounted = false; };
  }, [graphVersion, fetchGlobals]);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const ok = await api.system.checkHealth();
        if (mounted) setHealthStatus(ok ? 'ok' : 'error');
      } catch {
        if (mounted) setHealthStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 3.1 & 4.1:
  // 배지 Hover 시 글로벌 노드를 화면 중앙에 강제 소환(hidden: false, position: center)하지 않고,
  // 현재 캔버스에 이미 표시 중인 연결 노드들에만 경량 외곽선 하이라이트(.hovered-global-neighbor)를 부여합니다.
  const renderedNodes = useMemo(() => {
    if (!hoveredGlobalBadgeId) return nodes;
    return nodes.map(n => {
      if (n.hidden) return n;
      const badges = n.data?.badges || [];
      if (badges.some(b => b.id === hoveredGlobalBadgeId)) {
        return { ...n, className: `${n.className || ''} hovered-global-neighbor` };
      }
      return n;
    });
  }, [nodes, hoveredGlobalBadgeId]);

  const renderedEdges = useMemo(() => {
    if (!hoveredGlobalBadgeId || !rfInstance) return visibleEdges;
    const globalOnCanvas = nodes.find(gn => gn.id === hoveredGlobalBadgeId && !gn.hidden);
    if (!globalOnCanvas) return visibleEdges;
    const tempEdges: CoverageEdge[] = [];
    nodes.forEach(n => {
      if (n.hidden) return;
      const badges = n.data?.badges || [];
      const badge = badges.find(b => b.id === hoveredGlobalBadgeId);
      if (badge) {
        tempEdges.push({
          id: `hover-edge-${n.id}-${badge.id}`,
          source: hoveredGlobalBadgeId,
          target: n.id,
          type: 'floating',
          animated: true,
          style: { stroke: '#00e5ff', strokeWidth: 2, strokeDasharray: '5,5' },
        });
      }
    });
    return [...visibleEdges, ...tempEdges];
  }, [nodes, visibleEdges, hoveredGlobalBadgeId, rfInstance]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <WorkspaceSelectorOverlay
        show={filterText === '' && !showAllDomains && aliases.length > 0}
        aliases={aliases}
        onSelectAlias={a => { setFilterText(a); setShowAllDomains(true); }}
        onLoadAll={() => setShowAllDomains(true)}
        onOpenPresets={() => setShowPresetManager(true)}
      />

      <ReactFlow<CoverageNode, CoverageEdge>
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.05}
        onInit={setRfInstance}
        isValidConnection={conn => {
          if (!conn.source || !conn.target || conn.source === conn.target) return false;
          const srcNode = nodesRef.current.find(n => n.id === conn.source);
          return !(srcNode?.parentId && srcNode.parentId === conn.target);
        }}
        nodes={renderedNodes}
        edges={renderedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStart={() => { isDraggingRef.current = true; }}
        onNodeDragStop={() => { isDraggingRef.current = false; }}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={() => {
          if (Date.now() - quickConnectOpenedAtRef.current > 300) {
            setQuickConnectPopover(null);
          }
          setSelectedNode(null);
          setSelectedEdge(null);
          setIsCreatingNode(false);
          setScopedAuditRootId(null);
          if (hasImpactOverlay) deactivateImpact();
          setContextMenu(null);
          window.dispatchEvent(new CustomEvent('selectBadgeNode', { detail: null }));
        }}
        onPaneContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, show: true }); }}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        connectionMode={ConnectionMode.Loose}
        className={`${(selectedNode || selectedEdge || searchQuery.length > 0 || pinnedFocusNodeId || hoveredNode || hoveredEdge || hoveredGlobalBadgeId || scopedAuditRootId) ? 'has-selection' : ''} ${hasImpactOverlay ? 'has-impact' : ''} ${isConnecting ? 'react-flow--connecting' : ''}`}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
      >
        <Controls />
        <Background />

        <TopToolbar
          filterText={filterText}
          showAllDomains={showAllDomains}
          onAddNode={() => { setSelectedNode(null); setSelectedEdge(null); setErrorToast(null); setIsCreatingNode(true); }}
          onSwitchWorkspace={() => { setFilterText(''); setShowAllDomains(false); localStorage.removeItem('savedWorkspace'); localStorage.removeItem('savedShowAll'); }}
          onOpenPresets={() => setShowPresetManager(true)}
          onOpenHelp={() => setShowHelp(true)}
          onRelayout={relayoutFocused}
        />

        <InspectorPanel
          rightPanelTab={rightPanelTab} setRightPanelTab={setRightPanelTab}
          nodes={nodes} edges={edges} nodesRef={nodesRef} edgesRef={edgesRef}
          setNodes={setNodes} setEdges={setEdges}
          selectedNode={selectedNode} selectedEdge={selectedEdge}
          setSelectedNode={setSelectedNode} setSelectedEdge={setSelectedEdge}
          liveEditNode={nodes.find(n => n.id === selectedNode?.id) || selectedNode}
          isCreatingNode={isCreatingNode} editFormData={editFormData} setEditFormData={setEditFormData}
          filterText={filterText} setFilterText={setFilterText} aliases={aliases}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          visibleTypes={visibleTypes} setVisibleTypes={setVisibleTypes}
          maxDepth={maxDepth} setMaxDepth={setMaxDepth} rfInstance={rfInstance}
          globalNodesList={globalNodesList} activeImpacts={activeImpacts}
          toggleImpact={toggleImpact} fetchGlobals={fetchGlobals} triggerRefresh={triggerRefresh}
          tracedRootNodeId={tracedRootNodeId} setTracedRootNodeId={setTracedRootNodeId} rootCauseScope={rootCauseScope}
          scopedAuditRootId={scopedAuditRootId} setScopedAuditRootId={setScopedAuditRootId} scopedAuditScope={scopedAuditScope}
          pinnedFocusNodeId={pinnedFocusNodeId} setPinnedFocusNodeId={setPinnedFocusNodeId}
          pendingConnectSource={pendingConnectSource} setPendingConnectSource={setPendingConnectSource}
          blockReasonDraft={blockReasonDraft} setBlockReasonDraft={setBlockReasonDraft}
          modifiedNoteDraft={modifiedNoteDraft} setModifiedNoteDraft={setModifiedNoteDraft}
          handleSaveStatus={handleSaveStatus} handleMarkModified={handleMarkModified}
          handleAcknowledge={handleAcknowledge} handleCloneNode={handleCloneNode}
          handleDetachFromParent={handleDetachFromParent} saveChecklist={saveChecklist}
          handleDelete={handleDelete} handleSave={handleSave} setErrorToast={setErrorToast}
        />

        <SystemStatusPill healthStatus={healthStatus} />
      </ReactFlow>

      <CanvasContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onAddNode={() => { setSelectedNode(null); setSelectedEdge(null); setIsCreatingNode(true); }}
        onFitView={() => { if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 800 }); }}
        onRefresh={triggerRefresh}
      />
      <QuickConnectPopover
        popover={quickConnectPopover}
        nodes={nodes}
        onClose={() => setQuickConnectPopover(null)}
        onSelectEdgeType={et => setQuickConnectPopover(prev => (prev ? { ...prev, edgeType: et, edgeTypeManuallySet: true } : null))}
        onSearchChange={search => setQuickConnectPopover(prev => (prev ? { ...prev, search } : null))}
        onConnect={targetId => {
          if (!quickConnectPopover) return;
          const popoverSnap = quickConnectPopover;
          setQuickConnectPopover(null);
          createEdgeBetweenNodes(popoverSnap.sourceNodeId, targetId, popoverSnap.edgeTypeManuallySet ? popoverSnap.edgeType : undefined);
        }}
        onPickOnCanvas={() => {
          if (!quickConnectPopover) return;
          setPendingConnectSource({ nodeId: quickConnectPopover.sourceNodeId, edgeType: quickConnectPopover.edgeType, edgeTypeManuallySet: quickConnectPopover.edgeTypeManuallySet });
          setQuickConnectPopover(null);
        }}
      />
      <PendingConnectBanner
        source={pendingConnectSource}
        nodes={nodes}
        hasImpactOverlay={hasImpactOverlay}
        onCancel={() => setPendingConnectSource(null)}
      />
      <PinnedFocusBanner
        pinnedFocusNodeId={pinnedFocusNodeId}
        nodes={nodes}
        hasImpactOverlay={hasImpactOverlay}
        onUnpin={() => setPinnedFocusNodeId(null)}
      />
      {/* Preset Manager Modal */}
      <PresetManagerModal
        isOpen={showPresetManager}
        onClose={() => setShowPresetManager(false)}
        onPresetLoaded={() => {
          setFilterText('');
          setShowAllDomains(true);
          triggerRefresh();
          setTimeout(() => { if (rfInstance) rfInstance.fitView({ padding: 0.15, duration: 600 }); }, 300);
        }}
      />
      <ImpactStatsBar
        activeImpacts={activeImpacts}
        nodes={nodes}
        operator={impactFilterOperator}
        onChangeOperator={setImpactFilterOperator}
        onRemoveImpact={removeImpact}
        onDeactivate={deactivateImpact}
      />
      <ErrorToast error={errorToast || layoutError} onClose={() => { setErrorToast(null); setLayoutError(null); }} />
      <EmptyStateOverlay show={nodes.length === 0 && !loading} />
      <LoadingOverlay loading={loading} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <Tooltip id="app-tooltip" className="custom-tooltip" place="left" />
    </div>
  );
}
