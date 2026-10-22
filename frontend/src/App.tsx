import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  OnSelectionChangeParams,
  Panel,
  MarkerType,
  Connection,
  ConnectionMode,
} from '@xyflow/react';
import { getLayoutedElements } from './layout';
import { PresetManagerModal } from './components/PresetManagerModal';
import { t } from './locales/koKR';
// Living TC 4-Stage 연쇄 전파 엔진 (백엔드 compute_synthesized_status 와 동일 규칙)
import {
  applyStatusChanges,
  checklistStatus,
  computeSynthesizedStatus,
  edgeTypeOf,
  isOverridden,
  propagateToDependents,
  recalcTargetAndPropagate,
  type ChecklistItem,
  type StatusInput,
  type StatusName,
} from './statusPropagation';

const calculateEdgeBundling = (edgesList: Edge[]): Edge[] => {
  const edgeBundles: Record<string, Edge[]> = {};
  edgesList.forEach(e => {
    const key = e.source < e.target ? `${e.source}→${e.target}` : `${e.target}→${e.source}`;
    if (!edgeBundles[key]) edgeBundles[key] = [];
    edgeBundles[key].push(e);
  });

  const bundledEdges: Edge[] = [];
  Object.values(edgeBundles).forEach(bundle => {
    const N = bundle.length;
    bundle.forEach((e, i) => {
      const isReverse = e.source > e.target;
      const absoluteShift = (i - (N - 1) / 2) * 80;
      const pathOffset = isReverse ? -absoluteShift : absoluteShift;
      bundledEdges.push({
        ...e,
        data: { ...(e.data as any), pathOffset, edgeIndex: i, totalEdges: N, isReverse }
      });
    });
  });
  return bundledEdges;
};

// System reserved keys that have dedicated UI form controls and must be excluded from Custom Properties
const SYSTEM_RESERVED_KEYS = new Set([
  'name', 'label', 'aliases', 'test_status', 'id',
  'is_global', 'description', 'issue_link', 'x', 'y',
  // B안 체크리스트 / 📌 수동 고정 / Change Impact Ripple 필드는 전용 UI(Inspector 섹션)에서만 편집합니다.
  'checklist', 'is_manual_override', 'override_reason',
  'is_modified', 'modified_note', 'modified_at', 'acknowledged_at'
]);

// 체크리스트 항목 원클릭 상태 버튼 순서 (⚪ / 🟢 / 🔴 / 🟡) — TESTCASE 스펙 3.3-3
const CHECKLIST_STATUS_CYCLE: StatusName[] = ['Untested', 'Passed', 'Failed', 'Blocked'];
const STATUS_ICON: Record<string, string> = { Untested: '⚪', Passed: '🟢', Failed: '🔴', Blocked: '🟡' };

// 변경 영향권(.highlight-affected)으로 표시할 다운스트림 홉 수 (TESTCASE 스펙 7.2: 1~2차 후속 노드)
const AFFECTED_MAX_HOPS = 2;


type ApiNode = {
  id: string;
  label: string;
  name: string;
  aliases: string[];
  properties: Record<string, any>;
  test_status: string;
};

type ApiEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  action?: string;
  properties: Record<string, any>;
  test_status: string;
};

import CoverageNode from './CoverageNode';
import FloatingEdge from './FloatingEdge';
const nodeTypes = { custom: CoverageNode };
const edgeTypes = { floating: FloatingEdge };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredGlobalBadgeId, setHoveredGlobalBadgeId] = useState<string | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [refreshKey, setRefreshKey] = useState(0);
  // 그래프 전체 재조회(/api/graph) 완료 횟수 — 재조회로 className이 초기화되면 하이라이트 effect를 다시 적용하기 위함
  const [graphVersion, setGraphVersion] = useState(0);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, show: boolean } | null>(null);
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);

  // E. 연결 드래그 중일 때만 타겟 드롭 히트박스를 노드 전체로 확장하기 위한 플래그 (.react-flow--connecting)
  const [isConnecting, setIsConnecting] = useState(false);
  // B. Mark Blocked(📌 수동 차단) 사유 입력 UI 상태 — null이면 입력창 닫힘
  const [blockReasonDraft, setBlockReasonDraft] = useState<string | null>(null);
  // D. 변경 표시(Mark Modified) 메모 입력값
  const [modifiedNoteDraft, setModifiedNoteDraft] = useState('');
  // C. 체크리스트 항목의 상태 선택 팝오버가 열린 항목 id (한 번에 하나만 열림, null이면 닫힘)
  const [openChecklistStatusId, setOpenChecklistStatusId] = useState<string | null>(null);
  // 결함 원인 역추적(Trace Root Cause) 활성 대상 노드 ID (AI_IMPLEMENTATION_SPEC 3.3)
  const [tracedRootNodeId, setTracedRootNodeId] = useState<string | null>(null);
  // 화면(Screen/Container) 단위 다국어 스코프 감사 활성 루트 노드 ID (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 4.1)
  const [scopedAuditRootId, setScopedAuditRootId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  const [maxDepth, setMaxDepth] = useState<number>(1);
  const [filterText, setFilterText] = useState<string>(() => localStorage.getItem('savedWorkspace') || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showAllDomains, setShowAllDomains] = useState<boolean>(() => localStorage.getItem('savedShowAll') === 'true');
  const [rightPanelTab, setRightPanelTab] = useState<'view' | 'edit' | 'globals'>('view');
  const [globalNodesList, setGlobalNodesList] = useState<any[]>([]);
  const [rfInstance, setRfInstance] = useState<any>(null);

  // Impact Overlay Mode
  const [impactMode, setImpactMode] = useState<{
    globalNodeId: string;
    globalNodeName: string;
    connectedIds: Set<string>;
    edgeIds: Set<string>;
    stats: { Passed: number; Failed: number; Untested: number };
    total: number;
  } | null>(null);

  const activateImpact = useCallback(async (globalNodeId: string, globalNodeName: string) => {
    try {
      const res = await fetch(`/api/impact/${globalNodeId}`);
      if (!res.ok) throw new Error('Failed to fetch impact data');
      const data = await res.json();
      const connectedIds = new Set<string>(data.connected_nodes.map((n: any) => n.id));
      const edgeIds = new Set<string>(data.connected_nodes.map((n: any) => n.edge_id).filter(Boolean));
      setImpactMode({
        globalNodeId,
        globalNodeName,
        connectedIds,
        edgeIds,
        stats: data.stats,
        total: data.total,
      });
      // Deselect everything else
      setSelectedNode(null);
      setSelectedEdge(null);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to activate impact mode', err);
    }
  }, []);

  const deactivateImpact = useCallback(() => {
    setImpactMode(null);
  }, []);

  const FILTERABLE_NODE_TYPES = useMemo(() => new Set(['Screen', 'Component', 'TestCase', 'Data']), []);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['Screen', 'Popup', 'Component', 'TestCase', 'Data', 'API', 'Feature', 'System', 'Content', 'Node', 'Logic', 'Category'])
  );
  const visibleTypesRef = useRef(visibleTypes);
  useEffect(() => { visibleTypesRef.current = visibleTypes; }, [visibleTypes]);

  useEffect(() => {
    if (selectedNode || selectedEdge || isCreatingNode) {
      setRightPanelTab('edit');
    } else if (rightPanelTab === 'edit') {
      setRightPanelTab('view');
    }
  }, [selectedNode, selectedEdge, isCreatingNode]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setHealthStatus('ok');
        else setHealthStatus('error');
      } catch {
        setHealthStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchGlobals = useCallback(async () => {
    try {
      const res = await fetch('/api/globals');
      if (res.ok) {
        const data = await res.json();
        setGlobalNodesList(data);
      }
    } catch (e) {
      console.error('Failed to fetch globals', e);
    }
  }, []);

  useEffect(() => {
    if (rightPanelTab === 'globals') {
      fetchGlobals();
    }
  }, [rightPanelTab, fetchGlobals]);

  useEffect(() => {
    setNodes(nds => {
      let changed = false;
      const hiddenNodes = new Set<string>();
      const collapsedParentIds = new Set<string>();
      nds.forEach(n => {
        const type = (n.data as any)?.label || 'Data';
        const isGlobal = (n.data as any)?.properties?.is_global === 'true';
        if (isGlobal || (FILTERABLE_NODE_TYPES.has(type) && !visibleTypes.has(type))) hiddenNodes.add(n.id);
        if ((n.data as any)?.isCollapsed) collapsedParentIds.add(n.id);
      });

      const next = nds.map(n => {
        const type = (n.data as any)?.label || 'Data';
        const isGlobal = (n.data as any)?.properties?.is_global === 'true';
        const isCollapsedChild = Boolean(n.parentId && collapsedParentIds.has(n.parentId));
        const isHidden = isGlobal || isCollapsedChild || (FILTERABLE_NODE_TYPES.has(type) && !visibleTypes.has(type));
        
        let newExtent = n.extent;
        if (n.parentId) {
           newExtent = hiddenNodes.has(n.parentId) ? undefined : 'parent';
        }

        if (n.hidden !== isHidden || n.extent !== newExtent) {
          changed = true;
          return { ...n, hidden: isHidden, extent: newExtent };
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [visibleTypes, setNodes]);

  const triggerRefresh = () => setRefreshKey(k => k + 1);

  // 최신 nodes/edges 참조 (useCallback 핸들러의 stale closure 방지 — 전파 계산은 항상 최신 그래프 기준)
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

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
      const res = await fetch('/api/node-statuses');
      if (!res.ok || seq !== statusSyncSeq.current || pendingMutations.current > 0) return;
      const serverStatuses: Record<string, string> = await res.json();
      if (seq !== statusSyncSeq.current || pendingMutations.current > 0) return;
      setNodes(nds => applyStatusChanges(nds, serverStatuses));
    } catch (err) {
      console.error('Failed to sync statuses', err);
    }
  }, [setNodes]);

  /** 로컬 전파 결과를 노드 state에 반영 (상태 변경 맵이 비어 있으면 아무것도 하지 않음) */
  const applyLocalStatusChanges = useCallback((changes: Record<string, string>) => {
    if (Object.keys(changes).length === 0) return;
    setNodes(nds => applyStatusChanges(nds, changes));
  }, [setNodes]);



  // Undo Stack
  const actionHistory = useRef<any[]>([]);

  const pushUndo = useCallback((action: any) => {
    actionHistory.current.push(action);
    if (actionHistory.current.length > 50) actionHistory.current.shift();
  }, []);

  const handleUndo = useCallback(async () => {
    const action = actionHistory.current.pop();
    if (!action) return;
    
    try {
      if (action.type === 'CREATE_NODE') {
        // Undo node creation: delete from backend + remove from local state
        await fetch(`/api/nodes/${action.id}`, { method: 'DELETE' });
        setNodes(nds => nds.filter(n => n.id !== action.id));
        setEdges(eds => eds.filter(e => e.source !== action.id && e.target !== action.id));
      } else if (action.type === 'UPDATE_NODE') {
        await fetch(`/api/nodes/${action.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.previousData)
        });
        // Update local state with previous data
        setNodes(nds => nds.map(n => n.id === action.id ? { ...n, data: { ...n.data, ...action.previousData } } : n));
      } else if (action.type === 'DELETE_NODE') {
        // Recreate node — needs triggerRefresh because new IDs are assigned
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.nodeData)
        });
        const newId = await res.json();
        for (const edge of action.connectedEdges) {
          const edgePayload = {
            source: edge.source === action.id ? newId : edge.source,
            target: edge.target === action.id ? newId : edge.target,
            type: edge.label || edge.type || 'RELATED',
            test_status: edge.data?.test_status || 'Untested',
            properties: edge.data?.properties || {}
          };
          await fetch('/api/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edgePayload)
          });
        }
        triggerRefresh(); // New IDs require full re-fetch
      } else if (action.type === 'CREATE_EDGE') {
        const targetEdge = edgesRef.current.find(e => e.id === action.id);
        const eType = String((targetEdge?.data as any)?.type || targetEdge?.label || '').toLowerCase();
        await fetch(`/api/edges/${action.id}`, { method: 'DELETE' });
        setEdges(eds => eds.filter(e => e.id !== action.id));
        if (eType === 'contains' || eType === 'has') {
          triggerRefresh();
        }
      } else if (action.type === 'UPDATE_EDGE') {
        await fetch(`/api/edges/${action.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.previousData)
        });
        setEdges(eds => eds.map(e => e.id === action.id ? { ...e, data: { ...e.data, ...action.previousData } } : e));
      } else if (action.type === 'DELETE_EDGE') {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.edgeData)
        });
        const newEdgeId = await res.json();
        const eType = String(action.edgeData.type || '').toLowerCase();
        const isContains = eType === 'contains' || eType === 'has';
        // Add edge back to local state with floating type
        setEdges(eds => calculateEdgeBundling([...eds, {
          id: newEdgeId,
          source: action.edgeData.source,
          target: action.edgeData.target,
          label: action.edgeData.type,
          type: 'floating',
          className: isContains ? 'edge-contains' : undefined,
          data: action.edgeData,
          style: { strokeWidth: 2 },
        }]));
        if (isContains) {
          triggerRefresh();
        }
      }
      // 되돌린 변경이 연쇄 전파를 일으켰을 수 있으므로 서버 상태로 재동기화
      syncStatusesFromServer();
    } catch (err) {
      console.error("Undo failed", err);
    }
  }, [triggerRefresh, setNodes, setEdges, syncStatusesFromServer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Only undo if not typing in an input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  

  useEffect(() => {
    const fetchAliases = async () => {
      try {
        const res = await fetch('/api/aliases');
        if (res.ok) {
          const data = await res.json();
          setAliases(data);
        } else {
          setAliases([]);
        }
      } catch (err) {
        console.error('Failed to fetch aliases', err);
        setAliases([]);
      }
    };
    fetchAliases();
  }, [refreshKey]);

  useEffect(() => {
    const handleBadgeSelect = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const nodeId = customEvent.detail;
      try {
        const res = await fetch(`/api/nodes/${nodeId}`);
        const data = await res.json();
        const globalNode = {
          id: data.id,
          type: 'custom',
          position: { x: 0, y: 0 }, // Position doesn't matter for edit panel
          data: data
        };
        setSelectedNode(globalNode as Node);
      } catch (err) {
        console.error("Failed to fetch badge node", err);
      }
    };

    const handleMarkBadgeStatus = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { edgeId, status } = customEvent.detail;
      if (!edgeId) return;
      try {
        await fetch(`/api/edges/${edgeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test_status: status })
        });
        
        // Optimistically update the local edges state
        setEdges(eds => eds.map(edge => {
          if (edge.id === edgeId) {
            return { ...edge, data: { ...edge.data as any, test_status: status } };
          }
          return edge;
        }));

        // Optimistically update the badge in all nodes
        setNodes(nds => nds.map(n => {
          if (!n.data?.badges) return n;
          let changed = false;
          const newBadges = (n.data as any).badges.map((b: any) => {
            if (b.edgeId === edgeId && b.test_status !== status) {
              changed = true;
              return { ...b, test_status: status };
            }
            return b;
          });
          return changed ? { ...n, data: { ...n.data, badges: newBadges } } : n;
        }));
      } catch (err) {
        console.error("Failed to mark badge status", err);
      }
    };

    const handleToggleCollapse = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetId = customEvent.detail;
      setNodes((nds) => {
        const parentNode = nds.find(n => n.id === targetId);
        const isCollapsed = !parentNode?.data?.isCollapsed;
        const children = nds.filter(n => n.parentId === targetId);
        const childSummary = {
          total: children.length,
          passed: children.filter(c => (c.data as any)?.test_status === 'Passed').length,
          failed: children.filter(c => (c.data as any)?.test_status === 'Failed').length,
          blocked: children.filter(c => (c.data as any)?.test_status === 'Blocked').length,
        };
        return nds.map(n => {
          if (n.id === targetId) {
            const expandedStyle = (n.data as any)?.expandedStyle || n.style;
            const nextStyle = isCollapsed
              ? { ...n.style, width: 280, height: 'auto', minHeight: 110 }
              : expandedStyle;
            return {
              ...n,
              style: nextStyle,
              data: { ...n.data, isCollapsed, childSummary, expandedStyle }
            };
          }
          if (n.parentId === targetId) return { ...n, hidden: isCollapsed };
          return n;
        });
      });
    };

    const handleDeleteBadge = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { nodeId, edgeId } = customEvent.detail;
      if (!edgeId) return;
      await fetch(`/api/edges/${edgeId}`, { method: 'DELETE' });
      
      // Optimistically remove the edge from local state
      setEdges(eds => eds.filter(e => e.id !== edgeId));

      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        const newBadges = ((n.data as any).badges || []).filter((b: any) => b.edgeId !== edgeId);
        return { ...n, data: { ...n.data, badges: newBadges } };
      }));
    };

    const handleHoverGlobalBadge = (e: Event) => {
      const customEvent = e as CustomEvent;
      setHoveredGlobalBadgeId(customEvent.detail);
    };

    const handleUnhoverGlobalBadge = () => {
      setHoveredGlobalBadgeId(null);
    };

    window.addEventListener('selectBadgeNode', handleBadgeSelect);
    window.addEventListener('markBadgeStatus', handleMarkBadgeStatus);
    window.addEventListener('toggleCollapseNode', handleToggleCollapse);
    window.addEventListener('deleteBadge', handleDeleteBadge);
    window.addEventListener('hoverGlobalBadge', handleHoverGlobalBadge);
    window.addEventListener('unhoverGlobalBadge', handleUnhoverGlobalBadge);
    
    return () => {
      window.removeEventListener('selectBadgeNode', handleBadgeSelect);
      window.removeEventListener('markBadgeStatus', handleMarkBadgeStatus);
      window.removeEventListener('toggleCollapseNode', handleToggleCollapse);
      window.removeEventListener('deleteBadge', handleDeleteBadge);
      window.removeEventListener('hoverGlobalBadge', handleHoverGlobalBadge);
      window.removeEventListener('unhoverGlobalBadge', handleUnhoverGlobalBadge);
    };
  }, [setNodes, setSelectedNode]);

  const prevFilterRef = useRef(filterText);
  const prevRefreshRef = useRef(refreshKey);

  useEffect(() => {
    // If only maxDepth changed and there is no filter text, the backend will return the exact same full graph anyway.
    // Skip the fetch to avoid ruining the user's manual graph layout.
    if (filterText === '' && prevFilterRef.current === '' && refreshKey === prevRefreshRef.current && nodes.length > 0) {
      return;
    }
    prevFilterRef.current = filterText;
    prevRefreshRef.current = refreshKey;

    const controller = new AbortController();
    const currentDebounceId = Date.now().toString();

    const fetchGraph = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterText) params.append('filter', filterText);
        params.append('depth', maxDepth.toString());
        params.append('debounce_id', currentDebounceId);

        const res = await fetch(`/api/graph?${params.toString()}`, {
          signal: controller.signal
        });
        if (!res.ok) {
          throw new Error('Failed to fetch graph');
        }
        const data = await res.json();
        
        if (data.debounce_id && data.debounce_id !== currentDebounceId) {
          return;
        }
        const globalNodes = new Map<string, ApiNode>();
        const initialNodes: Node[] = data.nodes.map((n: ApiNode) => {
          const isGlobal = n.properties?.is_global === 'true';
          if (isGlobal) {
            globalNodes.set(n.id, n);
          }
          return {
            id: n.id,
            type: 'custom',
            data: { ...n, badges: [], isCollapsed: false },
            hidden: (FILTERABLE_NODE_TYPES.has(n.label) && !visibleTypesRef.current.has(n.label)) || isGlobal,
            position: { x: 0, y: 0 },
            className: `status-${(n.test_status || 'untested').toLowerCase()}`,
          };
        });

        const edgeBundles: Record<string, ApiEdge[]> = {};
        for (const e of data.edges) {
          let isBadgeEdge = false;
          if (globalNodes.has(e.target)) {
            const sourceNode = initialNodes.find(n => n.id === e.source);
            const gNode = globalNodes.get(e.target);
            const badgeStatus = (e.test_status && e.test_status !== 'Untested') ? e.test_status : (gNode?.test_status || 'Untested');
            if (sourceNode) ((sourceNode.data as any).badges as any[]).push({ ...gNode, edgeId: e.id, edgeType: e.type, test_status: badgeStatus });
            isBadgeEdge = true;
          } else if (globalNodes.has(e.source)) {
            const targetNode = initialNodes.find(n => n.id === e.target);
            const gNode = globalNodes.get(e.source);
            const badgeStatus = (e.test_status && e.test_status !== 'Untested') ? e.test_status : (gNode?.test_status || 'Untested');
            if (targetNode) ((targetNode.data as any).badges as any[]).push({ ...gNode, edgeId: e.id, edgeType: e.type, test_status: badgeStatus });
            isBadgeEdge = true;
          }

          const eType = (e.type || '').toLowerCase();
          if (eType === 'contains' || eType === 'has') {
            const childNode = initialNodes.find(n => n.id === e.target);
            const parentId = initialNodes.find(n => n.id === e.source);
            if (childNode && parentId && !globalNodes.has(e.target)) {
              childNode.parentId = e.source;
              childNode.extent = parentId.hidden ? undefined : 'parent';
              (parentId.data as any).hasChildren = true;
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
          if ((n.data as any)?.hasChildren) {
            const children = initialNodes.filter(c => c.parentId === n.id);
            const total = children.length;
            const passed = children.filter(c => (c.data as any)?.test_status === 'Passed').length;
            const failed = children.filter(c => (c.data as any)?.test_status === 'Failed').length;
            const blocked = children.filter(c => (c.data as any)?.test_status === 'Blocked').length;
            (n.data as any).childSummary = { total, passed, failed, blocked };
          }
        });

        let rawEdges: Edge[] = [];
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
              data: { ...e },
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

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setGraphVersion(v => v + 1);
        setError(null);
        
        // Auto-fit view when the graph is loaded to center all elements nicely
        setTimeout(() => {
          if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 600 });
        }, 150);
      } catch (err: any) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        setLoading(false);
      }
    };

    const timerId = setTimeout(() => {
      fetchGraph();
    }, 300);

    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [filterText, maxDepth, setNodes, setEdges, refreshKey]);

  // 부모 노드의 하위 자식 상태 요약(childSummary)을 자식 상태 변경 시 자동 동기화 (Spec 4.1)
  useEffect(() => {
    setNodes(nds => {
      let changed = false;
      const next = nds.map(n => {
        if (!(n.data as any)?.hasChildren) return n;
        const children = nds.filter(c => c.parentId === n.id);
        const total = children.length;
        const passed = children.filter(c => (c.data as any)?.test_status === 'Passed').length;
        const failed = children.filter(c => (c.data as any)?.test_status === 'Failed').length;
        const blocked = children.filter(c => (c.data as any)?.test_status === 'Blocked').length;
        const prev = (n.data as any)?.childSummary;
        if (!prev || prev.total !== total || prev.passed !== passed || prev.failed !== failed || prev.blocked !== blocked) {
          changed = true;
          return { ...n, data: { ...n.data, childSummary: { total, passed, failed, blocked } } };
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [nodes, setNodes]);

  // 선택 대상(id)이 바뀌면 이전 노드용 입력(차단 사유/변경 메모/원인 역추적/화면 다국어 감사)은 닫고 비웁니다.
  // (React Flow는 노드 data가 바뀌어도 selection을 새 객체로 다시 알려주므로 id 기준으로만 초기화)
  useEffect(() => {
    setBlockReasonDraft(null);
    setModifiedNoteDraft('');
    setTracedRootNodeId(null);
    setScopedAuditRootId(null);
  }, [selectedNode?.id, selectedEdge?.id, isCreatingNode]);

  useEffect(() => {
    if (selectedNode) {
      const n = selectedNode.data as ApiNode;
      const rawProps = n.properties || {};
      const cleanProps: Record<string, any> = { ...rawProps };
      SYSTEM_RESERVED_KEYS.forEach(k => delete cleanProps[k]);
      // 전용 폼 컨트롤(#nodeIsGlobal, description, issue_link)이 사용하는 키는 보존하되,
      // Custom Properties 목록에서는 SYSTEM_RESERVED_KEYS 필터로 숨깁니다.
      if (rawProps.is_global !== undefined) cleanProps.is_global = String(rawProps.is_global);
      if (rawProps.description !== undefined || (n as any).description !== undefined) {
        cleanProps.description = rawProps.description ?? (n as any).description;
      }
      if (rawProps.issue_link !== undefined || (n as any).issue_link !== undefined) {
        cleanProps.issue_link = rawProps.issue_link ?? (n as any).issue_link;
      }
      setEditFormData({ 
        type: 'node', 
        id: selectedNode.id, 
        label: n.label || 'Node', 
        name: n.name, 
        aliases: (n.aliases || []).join(', '), 
        status: n.test_status || 'Untested', 
        properties: cleanProps 
      });
    } else if (selectedEdge) {
      const e = selectedEdge.data as ApiEdge;
      setEditFormData({ type: 'edge', id: selectedEdge.id, edgeType: e.type, action: e.action || '', status: e.test_status || 'Untested', properties: e.properties || {} });
    } else if (isCreatingNode) {
      setEditFormData({ type: 'node', id: '', label: 'Screen', name: '', aliases: filterText || '', status: 'Untested', properties: {} });
    } else {
      setEditFormData({});
    }
  }, [selectedNode, selectedEdge, isCreatingNode, filterText]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const isSelected = params.nodes.length > 0 || params.edges.length > 0;

    setSelectedNode(params.nodes.length === 1 ? params.nodes[0] : null);
    setSelectedEdge(params.edges.length === 1 ? params.edges[0] : null);
    if (isSelected) setIsCreatingNode(false);
  }, []);

  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    const deletedIds = new Set<string>();
    for (const n of deleted) {
      const res = await fetch(`/api/nodes/${n.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || 'Failed to delete node');
        triggerRefresh(); // Restore node to canvas since React Flow eagerly removed it
        continue;
      }
      deletedIds.add(n.id);
      // Find connected edges for undo
      const connectedEdges = edges.filter(e => e.source === n.id || e.target === n.id);
      pushUndo({
        type: 'DELETE_NODE',
        id: n.id,
        nodeData: {
          label: (n.data as any).label || 'Node',
          name: (n.data as any).name,
          aliases: (n.data as any).aliases || [],
          test_status: (n.data as any).test_status || 'Untested',
          properties: (n.data as any).properties || {}
        },
        connectedEdges
      });
    }
    // ReactFlow already removes node from local state via onNodesChange
    // Remove connected edges from local state
    const remainingEdges = edgesRef.current.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target));
    setEdges(remainingEdges);
    // 삭제된 노드가 입력이던 타겟들을 재계산 (백엔드 delete_node → _recalc_target_node_status 와 동일)
    const affectedTargets = Array.from(new Set(
      edgesRef.current.filter(e => deletedIds.has(e.source) && !deletedIds.has(e.target)).map(e => e.target)
    ));
    applyLocalStatusChanges(recalcTargetAndPropagate(
      nodesRef.current.filter(n => !deletedIds.has(n.id)), remainingEdges, affectedTargets
    ));
    if (deletedIds.size > 0) syncStatusesFromServer();
  }, [pushUndo, edges, setEdges, applyLocalStatusChanges, syncStatusesFromServer]);

  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const e of deleted) {
      pushUndo({
        type: 'DELETE_EDGE',
        id: e.id,
        edgeData: {
          source: e.source,
          target: e.target,
          type: e.label || (e.data as any)?.type || 'RELATED',
          test_status: (e.data as any)?.test_status || 'Untested',
          properties: (e.data as any)?.properties || {}
        }
      });
      await fetch(`/api/edges/${e.id}`, { method: 'DELETE' });
    }
    // ReactFlow already removes edges from local state via onEdgesChange
    // 삭제된 엣지의 타겟 노드를 재계산하고 하류로 전파 (낙관적) → 서버 결과로 재동기화
    const deletedEdgeIds = new Set(deleted.map(e => e.id));
    const remainingEdges = edgesRef.current.filter(e => !deletedEdgeIds.has(e.id));
    applyLocalStatusChanges(recalcTargetAndPropagate(
      nodesRef.current, remainingEdges, Array.from(new Set(deleted.map(e => e.target)))
    ));
    if (deleted.length > 0) syncStatusesFromServer();

    const deletedContains = deleted.filter(e => {
      const eType = String((e.data as any)?.type || e.label || '').toLowerCase();
      return eType === 'contains' || eType === 'has';
    });
    if (deletedContains.length > 0) {
      const unparentedTargets = new Set(deletedContains.map(e => e.target));
      const parentsWithRemaining = new Set(
        remainingEdges
          .filter(rem => {
            const rt = String((rem.data as any)?.type || rem.label || '').toLowerCase();
            return rt === 'contains' || rt === 'has';
          })
          .map(rem => rem.source)
      );
      const affectedParents = new Set(deletedContains.map(e => e.source));
      setNodes(nds => nds.map(n => {
        if (unparentedTargets.has(n.id)) {
          const type = (n.data as any)?.label || 'Data';
          const isGlobal = (n.data as any)?.properties?.is_global === 'true';
          const isHiddenByFilter = isGlobal || (FILTERABLE_NODE_TYPES.has(type) && !visibleTypesRef.current.has(type));
          return { ...n, parentId: undefined, extent: undefined, hidden: isHiddenByFilter };
        }
        if (affectedParents.has(n.id) && !parentsWithRemaining.has(n.id)) {
          const { width, height, minHeight, ...restStyle } = (n.style || {}) as any;
          return { ...n, style: restStyle, data: { ...n.data, hasChildren: false, isCollapsed: false, expandedStyle: undefined, childSummary: undefined, impactedChildCount: 0 } };
        }
        return n;
      }));
      triggerRefresh();
    }
  }, [pushUndo, applyLocalStatusChanges, syncStatusesFromServer, setNodes, FILTERABLE_NODE_TYPES]);

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    
    const sourceNode = nodesRef.current.find(n => n.id === connection.source);
    const targetNode = nodesRef.current.find(n => n.id === connection.target);
    const sourceIsGlobal = (sourceNode?.data as any)?.properties?.is_global === 'true';
    const targetIsGlobal = (targetNode?.data as any)?.properties?.is_global === 'true';

    let defaultType = "Transition";
    const sourceLabel = (sourceNode?.data as any)?.label;
    const targetLabel = (targetNode?.data as any)?.label;
    if (sourceLabel === 'System' || sourceLabel === 'Category') {
      defaultType = "Contains";
    } else if (sourceLabel === 'TestCase') {
      defaultType = targetLabel === 'TestCase' ? "Depends_On" : "Tests";
    }

    const payload = {
      source: connection.source,
      target: connection.target,
      type: defaultType,
      test_status: "Untested",
      properties: (connection as any).properties || {}
    };
    
    try {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newEdgeId = await res.json();
      pushUndo({ type: 'CREATE_EDGE', id: newEdgeId });

      if (sourceIsGlobal || targetIsGlobal) {
        setNodes(nds => nds.map(n => {
          if (sourceIsGlobal && n.id === connection.target) {
            return { ...n, data: { ...n.data, badges: [...((n.data as any).badges || []), { ...sourceNode?.data, edgeId: newEdgeId, edgeType: 'Transition' }] } };
          }
          if (targetIsGlobal && n.id === connection.source) {
            return { ...n, data: { ...n.data, badges: [...((n.data as any).badges || []), { ...targetNode?.data, edgeId: newEdgeId, edgeType: 'Transition' }] } };
          }
          return n;
        }));
        return;
      }

      const isContainsEdge = defaultType.toLowerCase() === 'contains' || defaultType.toLowerCase() === 'has';

      // CONTAINS_EDGE_DISAPPEARANCE_BUG_SPEC 5.1-2:
      // Contains/Has 연결 시에도 조기 리턴하지 않고 캔버스에 newEdge(.edge-contains)를 즉시 등록합니다.
      const newEdge: Edge = {
        id: newEdgeId,
        source: connection.source!,
        target: connection.target!,
        label: defaultType,
        type: 'floating',
        className: isContainsEdge ? 'edge-contains' : undefined,
        data: { type: defaultType, test_status: 'Untested', properties: (connection as any).properties || {}, markerColor: '#64748b' },
        style: { stroke: 'gray', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'gray' },
      };
      const bundledEds = calculateEdgeBundling([...edgesRef.current, newEdge]);
      setEdges(bundledEds);
      // 새 입력 엣지가 생긴 타겟을 재계산하고, 바뀌면 하류(Depends_On/Tests)로 연쇄 전파 (낙관적)
      applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, bundledEds, [connection.target!]));
      syncStatusesFromServer();

      if (isContainsEdge) {
        // 부모 컨테이너 크기(style.width/height)와 자식 상대 좌표를 ELK 레이아웃으로 재계산 (Contains 엣지는 fetchGraph에서도 유지됨)
        setSelectedEdge(null);
        triggerRefresh();
      }
    } catch (err) {
      console.error("Failed to create edge:", err);
    }
  }, [pushUndo, setEdges, setNodes, applyLocalStatusChanges, syncStatusesFromServer]);

  
  const handleDelete = async () => {
    if (editFormData.type === "node") {
      const res = await fetch(`/api/nodes/${editFormData.id}`, { method: "DELETE" }); 
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || 'Failed to delete node');
        return;
      }
      const node = nodes.find(n => n.id === editFormData.id);
      if (node) {
        const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
        pushUndo({
          type: 'DELETE_NODE',
          id: node.id,
          nodeData: {
            label: (node.data as any).label || 'Node',
            name: (node.data as any).name,
            aliases: (node.data as any).aliases || [],
            test_status: (node.data as any).test_status || 'Untested',
            properties: (node.data as any).properties || {}
          },
          connectedEdges
        });
      }
      const deletedNodeId = editFormData.id;
      const remainingEdges = edgesRef.current.filter(e => e.source !== deletedNodeId && e.target !== deletedNodeId);
      // 삭제된 노드가 입력이던 타겟들 (백엔드 delete_node → _recalc_target_node_status 와 동일)
      const affectedTargets = Array.from(new Set(
        edgesRef.current.filter(e => e.source === deletedNodeId && e.target !== deletedNodeId).map(e => e.target)
      ));
      const remainingNodes = nodesRef.current.filter(n => n.id !== deletedNodeId);
      const changes = recalcTargetAndPropagate(remainingNodes, remainingEdges, affectedTargets);
      setNodes(applyStatusChanges(remainingNodes, changes));
      setEdges(remainingEdges);
      syncStatusesFromServer();
    } else if (editFormData.type === "edge") { 
      const edge = edges.find(e => e.id === editFormData.id);
      if (edge) {
        pushUndo({
          type: 'DELETE_EDGE',
          id: edge.id,
          edgeData: {
            source: edge.source,
            target: edge.target,
            type: edge.label || (edge.data as any)?.type || 'RELATED',
            test_status: (edge.data as any)?.test_status || 'Untested',
            properties: (edge.data as any)?.properties || {}
          }
        });
      }
      await fetch(`/api/edges/${editFormData.id}`, { method: "DELETE" }); 
      const nextEds = edgesRef.current.filter(e => e.id !== editFormData.id);
      setEdges(nextEds);
      if (edge) {
        // 입력 엣지가 사라진 타겟을 재계산하고 하류로 연쇄 전파 (낙관적) → 서버 결과로 재동기화
        applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, nextEds, [edge.target]));
        syncStatusesFromServer();

        const edgeTypeLower = String((edge.data as any)?.type || edge.label || '').toLowerCase();
        if (edgeTypeLower === 'contains' || edgeTypeLower === 'has') {
          const stillHasChildren = nextEds.some(rem => {
            const rt = String((rem.data as any)?.type || rem.label || '').toLowerCase();
            return rem.source === edge.source && (rt === 'contains' || rt === 'has');
          });
          setNodes(nds => nds.map(n => {
            if (n.id === edge.target && n.parentId === edge.source) {
              const type = (n.data as any)?.label || 'Data';
              const isGlobal = (n.data as any)?.properties?.is_global === 'true';
              const isHiddenByFilter = isGlobal || (FILTERABLE_NODE_TYPES.has(type) && !visibleTypesRef.current.has(type));
              return { ...n, parentId: undefined, extent: undefined, hidden: isHiddenByFilter };
            }
            if (n.id === edge.source && !stillHasChildren) {
              const { width, height, minHeight, ...restStyle } = (n.style || {}) as any;
              return { ...n, style: restStyle, data: { ...n.data, hasChildren: false, isCollapsed: false, expandedStyle: undefined, childSummary: undefined, impactedChildCount: 0 } };
            }
            return n;
          }));
          triggerRefresh();
        }
      }
    } 
    setEditFormData({}); 
    setSelectedNode(null); 
    setSelectedEdge(null);
  }; 
  
  /**
   * 노드 1개의 상태를 "현재 입력(들어오는 엣지/출발 노드/체크리스트)" 기준으로 합성합니다.
   * (기존 recalculateTargetStatus 대체: Failed 대신 Blocked 전파, Return 제외, 📌 고정 존중 — statusPropagation.ts 참고)
   */
  const synthesizeNodeStatus = (nodeId: string, checklist: unknown, currentStatus: string): StatusName => {
    const statusOf = new Map(nodesRef.current.map(n => [n.id, ((n.data as any)?.test_status || 'Untested') as string]));
    const inputs: StatusInput[] = edgesRef.current
      .filter(e => e.target === nodeId && edgeTypeOf(e) !== 'RETURN')
      .map(e => ({
        edgeType: edgeTypeOf(e),
        edgeStatus: ((e.data as any)?.test_status || 'Untested'),
        srcStatus: statusOf.get(e.source) || 'Untested',
      }));
    return computeSynthesizedStatus(currentStatus, inputs, checklist, false);
  };

  /**
   * 상태 마킹 저장 (Mark Passed / Failed / Reset / Blocked)
   * - override가 있으면 📌 수동 고정(Manual Override): is_manual_override=true + override_reason 기록 (TESTCASE 스펙 4.3)
   * - Passed/Failed/Reset은 테스터의 직접 판정이므로 기존 📌 고정을 해제합니다.
   * - 낙관적 업데이트를 먼저 적용(로컬 연쇄 전파 포함)한 뒤 저장하고, 저장 후 서버 상태로 재동기화합니다.
   */
  const handleSaveStatus = async (newStatus: string, override?: { reason: string }) => {
    if (editFormData.type === 'node') {
      const node = nodes.find(n => n.id === editFormData.id);
      const cleanProps = { ...(editFormData.properties || {}) };
      SYSTEM_RESERVED_KEYS.forEach(k => delete cleanProps[k]);
      const isManual = !!override;
      const overrideReason = override?.reason ?? '';
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        test_status: newStatus,
        properties: cleanProps
      };
      if (isCreatingNode) {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          setError(errData.detail || 'Failed to create node');
          return;
        }
        setError(null);
        const newId = await res.json();
        pushUndo({ type: 'CREATE_NODE', id: newId });
        setIsCreatingNode(false);
        triggerRefresh(); // New node needs layout
        return;
      }

      if (node) {
        pushUndo({
          type: 'UPDATE_NODE',
          id: node.id,
          previousData: {
            name: (node.data as any).name,
            aliases: (node.data as any).aliases || [],
            test_status: (node.data as any).test_status || 'Untested',
            properties: (node.data as any).properties || {}
          }
        });
      }

      // 1) 낙관적 업데이트: 대상 노드 상태 + 📌 고정 플래그 + 배지 상태를 즉시 반영
      const updatedNodes = nodesRef.current.map(n => {
        let newBadges = [...((n.data as any).badges || [])];
        let badgesChanged = false;
        newBadges = newBadges.map((b: any) => {
          if (b.id === editFormData.id) {
            badgesChanged = true;
            return { ...b, test_status: newStatus };
          }
          return b;
        });

        if (n.id !== editFormData.id) {
          return badgesChanged ? { ...n, data: { ...n.data, badges: newBadges } } : n;
        }
        
        // Update className: replace old status-xxx with new one
        const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newStatus.toLowerCase();
        return { 
          ...n, 
          className: cls.trim(), 
          data: { 
            ...(n.data || {}), 
            test_status: newStatus, 
            badges: newBadges,
            properties: {
              ...((n.data as any)?.properties || {}),
              is_manual_override: isManual,
              override_reason: overrideReason
            }
          } 
        };
      });
      // 2) 하류(Depends_On / Tests) 연쇄 전파 — 방금 마킹한 노드는 exclude 되어 덮어쓰지 않음
      const changes = propagateToDependents(updatedNodes, edgesRef.current, editFormData.id);
      setNodes(applyStatusChanges(updatedNodes, changes));
      setEditFormData({ ...editFormData, status: newStatus, properties: cleanProps });

      // 3) 저장 (백엔드 update_node가 동일 규칙으로 연쇄 전파) → 서버 결과로 재동기화
      await persist(`/api/nodes/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, is_manual_override: isManual, override_reason: overrideReason })
      });
      syncStatusesFromServer();
    } else if (editFormData.type === 'edge') {
      const edge = edges.find(e => e.id === editFormData.id);
      if (!edge) return;
      
      pushUndo({
        type: 'UPDATE_EDGE',
        id: edge.id,
        previousData: {
          test_status: (edge.data as any)?.test_status || 'Untested',
          properties: (edge.data as any)?.properties || {}
        }
      });
      const payload = {
        type: editFormData.edgeType,
        test_status: newStatus,
        properties: editFormData.properties || {}
      };
      // 1) 낙관적 업데이트: 엣지 상태 반영 + 타겟 노드 재계산/하류 전파
      const nextEds = edgesRef.current.map(e => {
        if (e.id !== editFormData.id) return e;
        const cls = (e.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newStatus.toLowerCase();
        return { ...e, data: { ...(e.data || {}), test_status: newStatus, markerColor: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, className: cls.trim(), style: { ...(e.style || {}), stroke: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, markerEnd: { type: MarkerType.ArrowClosed, color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') } };
      });
      setEdges(nextEds);
      applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, nextEds, [edge.target]));
      setEditFormData({ ...editFormData, status: newStatus });

      // 2) 저장 → 서버 결과로 재동기화
      await persist(`/api/edges/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      syncStatusesFromServer();
    }
  };

  const handleSave = async () => {
    if (editFormData.type === 'node') {
      const node = nodes.find(n => n.id === editFormData.id);
      
      // Extract description and issue_link to top-level for the backend, while preserving is_global in properties
      const props = { ...(editFormData.properties || {}) };
      const description = props.description;
      const issue_link = props.issue_link;
      const isGlobalVal = props.is_global;
      SYSTEM_RESERVED_KEYS.forEach(k => delete props[k]);
      if (isGlobalVal !== undefined) {
        props.is_global = String(isGlobalVal);
      }
      // 상태는 폼에 열어둔 값이 아니라 "현재 노드의 실제 상태"를 사용합니다.
      // (폼을 연 뒤 연쇄 전파로 Blocked 등이 된 경우, 이름만 고쳐 저장해도 전파 결과를 덮어쓰지 않도록)
      const liveStatus = isCreatingNode ? editFormData.status : ((node?.data as any)?.test_status || editFormData.status);
      
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        test_status: liveStatus,
        description: description,
        issue_link: issue_link,
        properties: props
      };
      if (isCreatingNode) {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          setError(errData.detail || 'Failed to create node');
          return;
        }
        setError(null);
        const newId = await res.json();
        pushUndo({ type: 'CREATE_NODE', id: newId });
        
        let initialPos = { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 50 };
        if (contextMenu?.show && rfInstance) {
          initialPos = rfInstance.screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
        } else if (rfInstance) {
          initialPos = rfInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        const newNode = {
          id: newId,
          type: 'custom',
          position: initialPos,
          className: `status-${(payload.test_status || 'untested').toLowerCase()}`,
          data: {
            id: newId,
            label: payload.label,
            name: payload.name,
            aliases: payload.aliases,
            test_status: payload.test_status,
            properties: payload.properties,
            badges: []
          }
        };
        setNodes(nds => [...nds, newNode as Node]);
        setIsCreatingNode(false);
        if (payload.properties?.is_global === 'true') {
          fetchGlobals();
          triggerRefresh();
        } else {
          setTimeout(() => setSelectedNode(newNode as Node), 0);
        }
      } else {
        const prevIsGlobal = String((node?.data as any)?.properties?.is_global || 'false');
        const nextIsGlobal = String(props.is_global ?? prevIsGlobal);
        if (node) {
          pushUndo({
            type: 'UPDATE_NODE',
            id: node.id,
            previousData: {
              name: (node.data as any).name,
              aliases: (node.data as any).aliases || [],
              test_status: (node.data as any).test_status || 'Untested',
              properties: (node.data as any).properties || {}
            }
          });
        }
        await fetch(`/api/nodes/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        // 기존 시스템 속성(checklist / 📌 고정 / 변경 표시 / is_global 등)은 로컬 state에서도 그대로 보존합니다.
        // (백엔드는 properties를 병합(n += $properties)하므로 서버 쪽 값도 유지됨)
        const mergedProps = (prevData: any) => ({
          ...((prevData as any)?.properties || {}),
          ...payload.properties,
          description: payload.description,
          issue_link: payload.issue_link
        });
        setNodes(nds => nds.map(n => n.id === editFormData.id ? { 
          ...n, 
          className: (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + (liveStatus || 'untested').toLowerCase(),
          data: { 
            ...n.data, 
            label: editFormData.label, 
            name: editFormData.name, 
            test_status: liveStatus, 
            aliases: payload.aliases, 
            properties: mergedProps(n.data)
          } 
        } : n));
        setSelectedNode(prev => prev && prev.id === editFormData.id ? {
          ...prev,
          className: (prev.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + (liveStatus || 'untested').toLowerCase(),
          data: {
            ...prev.data,
            label: editFormData.label,
            name: editFormData.name,
            test_status: liveStatus,
            aliases: payload.aliases,
            properties: mergedProps(prev.data)
          }
        } : prev);
        if (prevIsGlobal !== nextIsGlobal) {
          fetchGlobals();
          triggerRefresh();
        }
      }
    } else if (editFormData.type === 'edge') {
      const edge = edges.find(e => e.id === editFormData.id);
      if (!edge) return;
      
      pushUndo({
        type: 'UPDATE_EDGE',
        id: edge.id,
        previousData: {
          test_status: (edge.data as any)?.test_status || 'Untested',
          properties: (edge.data as any)?.properties || {}
        }
      });
      const payload = {
        type: editFormData.edgeType,
        action: editFormData.action,
        test_status: editFormData.status,
        properties: editFormData.properties || {}
      };
      const response = await fetch(`/api/edges/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const newId = data.new_id || editFormData.id;
      const prevEdgeType = String((edge.data as any)?.type || edge.label || '').toLowerCase();
      const nextEdgeType = String(payload.type || prevEdgeType).toLowerCase();
      const wasContains = prevEdgeType === 'contains' || prevEdgeType === 'has';
      const isNowContains = nextEdgeType === 'contains' || nextEdgeType === 'has';
      // data.type도 함께 갱신해야 전파 엔진(edgeTypeOf)이 바뀐 타입(예: Return 전환)을 인식합니다.
      const nextEds = edgesRef.current.map(e => {
        if (e.id !== editFormData.id) return e;
        const baseCls = (e.className || '').replace(/\bedge-contains\b/g, '').trim();
        const nextCls = isNowContains ? `${baseCls} edge-contains`.trim() : baseCls;
        return {
          ...e,
          id: newId,
          type: e.type,
          label: payload.type || e.label,
          className: nextCls || undefined,
          data: { ...e.data as any, type: payload.type || (e.data as any)?.type, action: payload.action, test_status: payload.test_status }
        };
      });
      setEdges(nextEds);
      // 타입/상태가 바뀐 엣지의 타겟을 재계산하고 하류로 전파 (낙관적) → 서버 결과로 재동기화
      applyLocalStatusChanges(recalcTargetAndPropagate(nodesRef.current, nextEds, [edge.target]));
      syncStatusesFromServer();
      if (newId !== editFormData.id) {
        setEditFormData({...editFormData, id: newId});
        setSelectedEdge(prev => prev ? {...prev, id: newId} : null);
      }
      if (wasContains && !isNowContains) {
        const stillHasChildren = nextEds.some(rem => {
          const rt = String((rem.data as any)?.type || rem.label || '').toLowerCase();
          return rem.source === edge.source && (rt === 'contains' || rt === 'has');
        });
        setNodes(nds => nds.map(n => {
          if (n.id === edge.target && n.parentId === edge.source) {
            const type = (n.data as any)?.label || 'Data';
            const isGlobal = (n.data as any)?.properties?.is_global === 'true';
            const isHiddenByFilter = isGlobal || (FILTERABLE_NODE_TYPES.has(type) && !visibleTypesRef.current.has(type));
            return { ...n, parentId: undefined, extent: undefined, hidden: isHiddenByFilter };
          }
          if (n.id === edge.source && !stillHasChildren) {
            const { width, height, minHeight, ...restStyle } = (n.style || {}) as any;
            return { ...n, style: restStyle, data: { ...n.data, hasChildren: false, isCollapsed: false, expandedStyle: undefined, childSummary: undefined, impactedChildCount: 0 } };
          }
          return n;
        }));
      }
      if (wasContains || isNowContains) {
        setSelectedEdge(null);
        triggerRefresh();
      }
    }
    // Don't triggerRefresh for normal edits — local state is already updated
    // triggerRefresh would re-run dagre layout and reset all dragged positions
  };

  // Inspector에서 편집 중인 노드의 "최신" 객체 (selectedNode는 선택 시점 스냅샷이라 전파/체크리스트 반영이 늦을 수 있음)
  const liveEditNode = useMemo(
    () => (editFormData.type === 'node' && editFormData.id) ? (nodes.find(n => n.id === editFormData.id) || null) : null,
    [nodes, editFormData.type, editFormData.id]
  );

  /** UPDATE_NODE Undo 스냅샷 (체크리스트/변경 표시 등 properties 변경 전 상태 보관) */
  const pushNodeUndoSnapshot = (node: Node) => {
    pushUndo({
      type: 'UPDATE_NODE',
      id: node.id,
      previousData: {
        name: (node.data as any).name,
        aliases: (node.data as any).aliases || [],
        test_status: (node.data as any).test_status || 'Untested',
        properties: (node.data as any).properties || {}
      }
    });
  };

  /**
   * C. B안 노드 내부 체크리스트 저장 (TESTCASE 스펙 3.3)
   * - 항목 체크/추가/삭제 즉시 낙관적 업데이트: properties.checklist → 노드 자동 판정 → 하류 연쇄 전파
   * - 📌 수동 고정 노드는 체크리스트가 바뀌어도 상태를 덮어쓰지 않습니다. (백엔드 _recalc_single_node_status 와 동일)
   * - 체크리스트를 모두 지우면(0개) 자동 판정을 멈추고 현재 상태를 유지합니다. (백엔드 update_node 와 동일)
   */
  const saveChecklist = async (nextChecklist: ChecklistItem[]) => {
    const node = nodesRef.current.find(n => n.id === editFormData.id);
    if (!node) return;
    pushNodeUndoSnapshot(node);

    // 1) properties.checklist 반영
    let updatedNodes = nodesRef.current.map(n => n.id === node.id
      ? { ...n, data: { ...n.data, properties: { ...((n.data as any)?.properties || {}), checklist: nextChecklist } } }
      : n);
    // 2) 체크리스트 기반 자기 자신 상태 재합성
    if (nextChecklist.length > 0 && !isOverridden(node)) {
      const current = (node.data as any)?.test_status || 'Untested';
      const selfStatus = synthesizeNodeStatus(node.id, nextChecklist, current);
      if (selfStatus !== current) updatedNodes = applyStatusChanges(updatedNodes, { [node.id]: selfStatus });
    }
    // 3) 하류(Depends_On / Tests) 연쇄 전파
    const changes = propagateToDependents(updatedNodes, edgesRef.current, node.id);
    setNodes(applyStatusChanges(updatedNodes, changes));

    // 4) 저장 (상태는 백엔드가 같은 규칙으로 재계산) → 서버 결과로 재동기화
    await persist(`/api/nodes/${node.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { checklist: nextChecklist } })
    });
    syncStatusesFromServer();
  };

  /** D. 변경 표시 (Mark Modified): 기획/UI 변경이 발생한 노드에 보라색 펄스 + 하류 영향권 표시 */
  const handleMarkModified = async () => {
    const nodeId = editFormData.id;
    const note = modifiedNoteDraft.trim();
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    pushNodeUndoSnapshot(node);
    const patch = { is_modified: true, modified_note: note, modified_at: new Date().toISOString() };
    setNodes(nds => nds.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, properties: { ...((n.data as any)?.properties || {}), ...patch } } }
      : n));
    setModifiedNoteDraft('');
    const res = await fetch(`/api/nodes/${nodeId}/mark-modified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if (!res.ok) {
      setError(t.modified.saveFailed);
      triggerRefresh();
    }
  };

  /**
   * D. 변경사항 확인 완료 (Acknowledge): 펄스/영향권 표시 해제.
   * 테스트 상태(test_status)는 바꾸지 않습니다 — 재검증 결과는 테스터가 Mark Passed/체크리스트로 직접 기록합니다.
   */
  const handleAcknowledge = async () => {
    const nodeId = editFormData.id;
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    pushNodeUndoSnapshot(node);
    const patch = { is_modified: false, acknowledged_at: new Date().toISOString() };
    setNodes(nds => nds.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, properties: { ...((n.data as any)?.properties || {}), ...patch } } }
      : n));
    const res = await fetch(`/api/nodes/${nodeId}/acknowledge`, { method: 'POST' });
    if (!res.ok) {
      setError(t.modified.saveFailed);
      triggerRefresh();
    }
  };

  /**
   * D. 변경 영향권(Impact Ripple): is_modified 노드에서 나가는 엣지(Return 제외)를 따라 1~2홉 하류 노드/엣지.
   * 집합 객체 대신 정렬된 키 문자열을 함께 만들어, 내용이 같으면 하이라이트 effect가 다시 돌지 않게 합니다.
   */
  const affectedScope = useMemo(() => {
    const modifiedIds = nodes
      .filter(n => { const v = (n.data as any)?.properties?.is_modified; return v === true || v === 'true'; })
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

    const key = `${Array.from(nodeIds).sort().join(',')}|${Array.from(edgeIds).sort().join(',')}|${ [...modifiedIds].sort().join(',') }`;
    return { nodeIds, edgeIds, key };
  }, [nodes, edges]);
  const affectedScopeRef = useRef(affectedScope);
  affectedScopeRef.current = affectedScope;

  // 부모 노드의 접힘(isCollapsed) 상태 키 — 접기/펼치기 시 부모 영향도 하이라이트 및 요약 칩 재계산 트리거
  const collapsedKey = useMemo(
    () => nodes.filter(n => (n.data as any)?.isCollapsed).map(n => n.id).sort().join(','),
    [nodes]
  );

  /**
   * 결함 원인 역추적(Root Cause Tracing, AI_IMPLEMENTATION_SPEC 3.3):
   * tracedRootNodeId로부터 역방향(Incoming, Return 제외) BFS로 최대 10홉까지
   * Failed/Blocked 상태인 선행 노드 및 엣지 경로를 찾아 .highlight-root-cause 클래스를 부여합니다.
   */
  const rootCauseScope = useMemo(() => {
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
          const edgeSt = (e.data as any)?.test_status || 'Untested';
          const srcSt = (srcNode?.data as any)?.test_status || 'Untested';
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
  }, [tracedRootNodeId, nodes, edges]);
  const rootCauseScopeRef = useRef(rootCauseScope);
  rootCauseScopeRef.current = rootCauseScope;

  /**
   * 화면(Screen/Container) 단위 다국어 스코프 감사 (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 3.2 & 4.1):
   * scopedAuditRootId가 활성화되면 선택된 화면 및 직속 자식(Contains/Has 또는 1-hop) 노드 중
   * Localization/다국어 배지(또는 태그/체크리스트)를 가진 노드들만 Focus+Context로 강조하고 나머지는 dim 처리합니다.
   */
  const scopedAuditScope = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    if (!scopedAuditRootId) return { nodeIds, edgeIds, totalInScope: 0, matchedCount: 0, key: '' };
    nodeIds.add(scopedAuditRootId);
    const directChildren = nodes.filter(n => n.parentId === scopedAuditRootId && !n.hidden);
    const candidateChildren = directChildren.length > 0
      ? directChildren
      : nodes.filter(n => !n.hidden && edges.some(e => e.source === scopedAuditRootId && e.target === n.id && edgeTypeOf(e) !== 'RETURN'));

    const kwList = t.scopedAudit.keywords;
    const hasI18nTarget = (n: Node) => {
      const badges: any[] = (n.data as any)?.badges || [];
      if (badges.some(b => {
        const bName = String(b?.name || '').toLowerCase();
        const bAliases: string[] = Array.isArray(b?.aliases) ? b.aliases.map((a: any) => String(a).toLowerCase()) : [];
        return kwList.some(kw => bName.includes(kw) || bAliases.some(a => a.includes(kw)));
      })) return true;
      const nName = String((n.data as any)?.name || '').toLowerCase();
      const nAliases: string[] = Array.isArray((n.data as any)?.aliases) ? (n.data as any).aliases.map((a: any) => String(a).toLowerCase()) : [];
      const checklist: any[] = Array.isArray((n.data as any)?.properties?.checklist) ? (n.data as any).properties.checklist : [];
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
  }, [scopedAuditRootId, nodes, edges]);
  const scopedAuditScopeRef = useRef(scopedAuditScope);
  scopedAuditScopeRef.current = scopedAuditScope;


  useEffect(() => {
    const activeNodes = new Set();
    const relatedNodes = new Set();
    const incoming = new Set();
    const outgoing = new Set();
    const edgeHighlights = new Set();
    const relatedEdges = new Set();

    const searchSeeds = searchQuery 
      ? nodes.filter(n => {
          const name = ((n.data as any)?.name || '').toLowerCase();
          const label = ((n.data as any)?.label || '').toLowerCase();
          const aliases = ((n.data as any)?.aliases || []).map((a: string) => a.toLowerCase());
          const q = searchQuery.toLowerCase();
          return name.includes(q) || label.includes(q) || aliases.some((a: string) => a.includes(q));
        })
      : [];

    if (scopedAuditScopeRef.current.nodeIds.size > 0) {
      scopedAuditScopeRef.current.nodeIds.forEach(id => {
        activeNodes.add(id);
        if (id !== scopedAuditRootId) outgoing.add(id);
      });
      scopedAuditScopeRef.current.edgeIds.forEach(eid => edgeHighlights.add(eid));
    } else if (selectedNode) {
      activeNodes.add(selectedNode.id);

      let queue = [{ id: selectedNode.id, depth: 0 }];
      const visited = new Set([selectedNode.id]);
      
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        const id = item.id;
        const depth = item.depth;
        if (depth >= maxDepth) continue;

        const adjacentEdges = edges.filter(e => e.source === id || e.target === id);
        for (const edge of adjacentEdges) {
          edgeHighlights.add(edge.id);
          const nextNode = edge.source === id ? edge.target : edge.source;
          
          if (edge.source === id) {
            if (!outgoing.has(nextNode)) outgoing.add(nextNode);
          } else {
            if (!incoming.has(nextNode)) incoming.add(nextNode);
          }
          
          if (!visited.has(nextNode)) {
            visited.add(nextNode);
            activeNodes.add(nextNode);
            queue.push({ id: nextNode, depth: depth + 1 });
          }
        }
      }
    } else if (searchSeeds.length > 0) {
      let queue = searchSeeds.map(n => ({ id: n.id, depth: 0 }));
      const visited = new Set(searchSeeds.map(n => n.id));
      
      searchSeeds.forEach(n => activeNodes.add(n.id));
      
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        const id = item.id;
        const depth = item.depth;
        if (depth >= maxDepth) continue;

        const adjacentEdges = edges.filter(e => e.source === id || e.target === id);
        for (const edge of adjacentEdges) {
          edgeHighlights.add(edge.id);
          const nextNode = edge.source === id ? edge.target : edge.source;
          
          if (edge.source === id) {
            if (!outgoing.has(nextNode)) outgoing.add(nextNode);
          } else {
            if (!incoming.has(nextNode)) incoming.add(nextNode);
          }
          
          if (!visited.has(nextNode)) {
            visited.add(nextNode);
            activeNodes.add(nextNode);
            queue.push({ id: nextNode, depth: depth + 1 });
          }
        }
      }
    } else if (selectedEdge) {
      edgeHighlights.add(selectedEdge.id);
      activeNodes.add(selectedEdge.source);
      activeNodes.add(selectedEdge.target);
      
      // Highlight sibling edges that point to the same target node to show the "Test Group"
      const siblingEdges = edges.filter(e => e.target === selectedEdge.target && e.id !== selectedEdge.id);
      for (const e of siblingEdges) {
        relatedEdges.add(e.id);
        relatedNodes.add(e.source);
      }
    }
    
    // Add hovered elements to active set
    if (hoveredNode && !selectedNode) {
      // Just highlight the node itself, or we could add its immediate edges
      // but keeping it simple: just the node is active.
    }
    if (hoveredEdge) {
      const edge = edges.find(e => e.id === hoveredEdge);
      if (edge) {
        activeNodes.add(edge.source);
        activeNodes.add(edge.target);
      }
    }

    setNodes(nds => {
      let changed = false;
      const next = nds.map(n => {
        let cls = (n.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|impact-[a-z-]+|status-[a-z-]+)\b/g, '').trim();
        const status = ((n.data as any)?.test_status || 'untested').toLowerCase();
        cls += ' status-' + status;
        const isRootCauseNode = rootCauseScopeRef.current.nodeIds.has(n.id);

        // COLLAPSED_SCREEN_IMPACT_HIGHLIGHT_SPEC 4.1:
        // 접힌 부모 Screen(isCollapsed)의 하위 자식 컴포넌트가 글로벌 영향도(impactMode) 또는 스펙 변경 영향권(affectedScope)에 포함된 경우 상향 롤업
        const childNodes = (n.data as any)?.hasChildren ? nds.filter(child => child.parentId === n.id) : [];
        const impactedChildrenInOverlay = impactMode
          ? childNodes.filter(child => impactMode.connectedIds.has(child.id))
          : [];
        const impactedChildrenInRipple = childNodes.filter(child => {
          const isChildMod = (child.data as any)?.properties?.is_modified === true || (child.data as any)?.properties?.is_modified === 'true';
          return isChildMod || affectedScopeRef.current.nodeIds.has(child.id);
        });
        const isParentOfImpactedChild = Boolean((n.data as any)?.isCollapsed && impactedChildrenInOverlay.length > 0);
        const impactedChildCount = (n.data as any)?.isCollapsed
          ? (impactMode ? impactedChildrenInOverlay.length : impactedChildrenInRipple.length)
          : 0;

        // Impact mode classes
        if (impactMode) {
          if (n.id === impactMode.globalNodeId) {
            cls += ' impact-highlighted impact-source';
          } else if (impactMode.connectedIds.has(n.id) || isParentOfImpactedChild) {
            cls += ' impact-highlighted';
          }
        } else if (activeNodes.has(n.id) || hoveredNode === n.id || isRootCauseNode) {
          cls += ' active';
          if (outgoing.has(n.id)) cls += ' highlight-outgoing';
          if (incoming.has(n.id)) cls += ' highlight-incoming';
        } else if (relatedNodes.has(n.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || searchSeeds.length > 0 || hoveredNode || hoveredEdge || scopedAuditRootId) {
          cls += ' de-emphasized';
        }
        // 결함 원인 역추적(Root Cause Tracing, Spec 3.3) — 선행 결함 경로 맥동 강조
        if (isRootCauseNode) cls += ' highlight-root-cause';
        // D. 변경 영향권(Impact Ripple) — Focus 상태와 독립적으로 유지되는 순수 CSS 클래스
        if (affectedScopeRef.current.nodeIds.has(n.id)) cls += ' highlight-affected';
        
        const prevImpactedCount = (n.data as any)?.impactedChildCount || 0;
        const nextCls = cls.trim();
        if (n.className !== nextCls || prevImpactedCount !== impactedChildCount) {
          changed = true;
          return {
            ...n,
            className: nextCls,
            data: prevImpactedCount !== impactedChildCount
              ? { ...n.data, impactedChildCount }
              : n.data,
          };
        }
        return n;
      });
      return changed ? next : nds;
    });

    setEdges(eds => {
      let changed = false;
      const next = eds.map(e => {
        let cls = (e.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|impact-[a-z-]+|status-[a-z-]+|edge-contains)\b/g, '').trim();
        const eTypeLower = String((e.data as any)?.type || e.label || '').toLowerCase();
        if (eTypeLower === 'contains' || eTypeLower === 'has') {
          cls += ' edge-contains';
        }
        const status = ((e.data as any)?.test_status || 'untested').toLowerCase();
        cls += ' status-' + status;
        const isRootCauseEdge = rootCauseScopeRef.current.edgeIds.has(e.id);

        // Impact mode edge classes
        if (impactMode && impactMode.edgeIds.has(e.id)) {
          cls += ' impact-edge';
        } else if (edgeHighlights.has(e.id) || hoveredEdge === e.id || isRootCauseEdge) {
          cls += ' active highlight-edge';
        } else if (relatedEdges.has(e.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || searchSeeds.length > 0 || hoveredNode || hoveredEdge || scopedAuditRootId) {
          cls += ' de-emphasized';
        }
        // 결함 원인 역추적 엣지 강조
        if (isRootCauseEdge) cls += ' highlight-root-cause';
        // D. 수정 노드에서 뻗어나가는 영향권 엣지
        if (affectedScopeRef.current.edgeIds.has(e.id)) cls += ' highlight-affected';
        
        const currentMarkerColor = (e.data as any)?.markerColor;
        const nextCls = cls.trim();
        
        if (e.className !== nextCls || currentMarkerColor !== undefined) {
          changed = true;
          // Clean up old markerColor prop if present
          const newData = { ...e.data as any };
          delete newData.markerColor;
          return { ...e, className: nextCls, data: newData };
        }
        return e;
      });
      return changed ? next : eds;
    });
  }, [selectedNode, selectedEdge, hoveredNode, hoveredEdge, maxDepth, searchQuery, impactMode, affectedScope.key, rootCauseScope.key, scopedAuditScope.key, scopedAuditRootId, collapsedKey, graphVersion]);

  const visibleEdges = useMemo(() => {
    const edgeMap = new Map<string, Edge>();
    
    edges.forEach(e => {
      const sNode = nodes.find(n => n.id === e.source);
      const tNode = nodes.find(n => n.id === e.target);
      const sCollapsed = sNode?.parentId && nodes.find(n => n.id === sNode.parentId)?.data?.isCollapsed;
      const tCollapsed = tNode?.parentId && nodes.find(n => n.id === tNode.parentId)?.data?.isCollapsed;
      
      const newSource = sCollapsed ? sNode.parentId : e.source;
      const newTarget = tCollapsed ? tNode.parentId : e.target;
      
      if (newSource === newTarget) return;
      
      const isRerouted = newSource !== e.source || newTarget !== e.target;
      const key = `${newSource}-${newTarget}-${e.type}`;
      
      let finalEdge = { ...e, source: newSource as string, target: newTarget as string };
      if (isRerouted) {
        finalEdge.id = key;
        finalEdge.label = '...';
        finalEdge.type = 'floating'; // Ensure it stays floating
        
        if (!edgeMap.has(key)) {
          edgeMap.set(key, finalEdge);
        }
      } else {
        edgeMap.set(e.id, finalEdge);
      }
    });
    return calculateEdgeBundling(Array.from(edgeMap.values()));
  }, [edges, nodes]);

  // (Cypher Export 기능은 FEATURE_PRUNING_GUIDE 1순위 정리 대상으로 제거됨 — 데이터 백업/공유는 프리셋 JSON 저장 사용)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Workspace Selector Overlay */}
      {filterText === '' && !showAllDomains && aliases.length > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 'var(--z-modal)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ padding: '40px', width: '600px', textAlign: 'center', backgroundColor: 'var(--panel-bg)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--text-main)', fontWeight: 600 }}>Select Workspace</h2>
            <p style={{ color: 'var(--text-main)', opacity: 0.8, marginBottom: '32px', lineHeight: '1.5' }}>
              {t.workspace.selectGuide}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', maxHeight: '400px', overflowY: 'auto', padding: '10px' }}>
              {aliases.map(a => (
                <button key={a} 
                        style={{ padding: '16px 12px', fontSize: '1rem', cursor: 'pointer', borderRadius: '12px', border: '1px solid var(--panel-border)', backgroundColor: 'var(--node-bg)', color: 'var(--text-main)', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--status-passed-border)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--panel-border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                        onClick={() => { 
                          setFilterText(a); 
                          setShowAllDomains(true); 
                          if ((document.getElementById('rememberWorkspace') as HTMLInputElement)?.checked) {
                            localStorage.setItem('savedWorkspace', a);
                            localStorage.setItem('savedShowAll', 'true');
                          }
                        }}>
                  {a}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="rememberWorkspace"
                defaultChecked={localStorage.getItem('savedShowAll') !== null || localStorage.getItem('savedWorkspace') !== null}
                onChange={(e) => {
                  if (e.target.checked) {
                    // It will be saved when a button is clicked
                  } else {
                    localStorage.removeItem('savedWorkspace');
                    localStorage.removeItem('savedShowAll');
                  }
                }}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <label htmlFor="rememberWorkspace" style={{ cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                {t.workspace.dontShowAgain}
              </label>
            </div>
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                onClick={() => setShowWorkspaceManager(true)} 
                style={{ padding: '12px 24px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-main)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
              >
                {t.workspace.openManager}
              </button>
              <button 
                onClick={() => setShowPresetManager(true)} 
                style={{ padding: '12px 24px', background: '#eff6ff', color: '#2563eb', border: '1.5px solid #93c5fd', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
              >
                {t.workspace.loadPreset}
              </button>
              <button 
                onClick={() => {
                  setShowAllDomains(true);
                  if ((document.getElementById('rememberWorkspace') as HTMLInputElement)?.checked) {
                    localStorage.setItem('savedShowAll', 'true');
                  }
                }} 
                style={{ padding: '12px 24px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-main)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
              >
                {t.workspace.loadAll}
              </button>
            </div>
          </div>
        </div>
      )}

          <ReactFlow nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.05}
                     onInit={setRfInstance}
                     isValidConnection={(conn) => {
                       if (!conn.source || !conn.target || conn.source === conn.target) return false;
                       const srcNode = nodesRef.current.find(n => n.id === conn.source);
                       if (srcNode?.parentId && srcNode.parentId === conn.target) return false;
                       return true;
                     }}
        nodes={(() => {
          // CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 3.1 & 4.1:
          // 배지 Hover 시 글로벌 노드를 화면 중앙에 강제 소환(hidden: false, position: center)하지 않고,
          // 현재 캔버스에 이미 표시 중인 연결 노드들에만 경량 외곽선 하이라이트(.hovered-global-neighbor)를 부여합니다.
          if (!hoveredGlobalBadgeId) return nodes;
          return nodes.map(n => {
            if (n.hidden) return n;
            const badges = (n.data as any)?.badges || [];
            if (badges.some((b: any) => b.id === hoveredGlobalBadgeId)) {
              return { ...n, className: `${n.className || ''} hovered-global-neighbor` };
            }
            return n;
          });
        })()}
        edges={(() => {
          if (!hoveredGlobalBadgeId || !rfInstance) return visibleEdges;
          const globalNodeOnCanvas = nodes.find(gn => gn.id === hoveredGlobalBadgeId && !gn.hidden);
          if (!globalNodeOnCanvas) return visibleEdges;
          const tempEdges: Edge[] = [];
          nodes.forEach(n => {
            if (n.hidden) return;
            const badges = (n.data as any)?.badges || [];
            const badge = badges.find((b: any) => b.id === hoveredGlobalBadgeId);
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
        })()}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        // E. 연결 드래그 중에만 컨테이너에 .react-flow--connecting을 붙여 타겟 드롭 히트박스를 노드 전체로 확장
        onConnectStart={() => setIsConnecting(true)}
        onConnectEnd={() => setIsConnecting(false)}
        onPaneClick={() => {
          setSelectedNode(null);
          setSelectedEdge(null);
          setScopedAuditRootId(null);
          if (impactMode) deactivateImpact();
          setContextMenu(null);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            show: true
          });
        }}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        connectionMode={ConnectionMode.Loose}
        className={`${(selectedNode || selectedEdge || searchQuery.length > 0 || hoveredNode || hoveredEdge || hoveredGlobalBadgeId || scopedAuditRootId) ? 'has-selection' : ''} ${impactMode ? 'has-impact' : ''} ${isConnecting ? 'react-flow--connecting' : ''}`}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
      >
        <Controls />
        <Background />
        
        <Panel position="top-left">
          {error && <div className="error-toast" style={{ color: 'red', background: 'white', padding: 5, border: '1px solid red' }}>Error: {error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: 10 }}>
            <button 
              style={{ padding: 8, cursor: 'pointer' }}
              onClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
                setError(null);
                setIsCreatingNode(true);
              }}
            >
              Add Node
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                {filterText ? filterText : (showAllDomains ? t.workspace.all : 'None')}
              </span>
            </div>
              <button 
                className="primary"
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}
                title={t.toolbar.switchWorkspace}
                onClick={() => {
                  setFilterText('');
                  setShowAllDomains(false);
                  localStorage.removeItem('savedWorkspace');
                  localStorage.removeItem('savedShowAll');
                }}
              >
                Switch Workspace
              </button>
              <button 
                className="primary"
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#0284c7' }}
                title={t.toolbar.presets}
                onClick={() => setShowPresetManager(true)}
              >
                📂 Presets
              </button>
            <button 
              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '50%', fontWeight: 'bold' }}
              title={t.toolbar.help}
              onClick={() => setShowHelp(true)}
            >
              ?
            </button>
            <button 
              style={{ padding: 8, cursor: 'pointer' }}
              title={t.toolbar.relayout}
              onClick={async () => {
                // 1. Check if there is any active focus (selected or highlighted)
                const focusedNodes = nodes.filter(n => 
                  !n.hidden && (n.selected || (n.className && (n.className.includes('active') || n.className.includes('related'))))
                );
                
                // 2. Determine which nodes to layout
                let nodesToLayout = focusedNodes.length >= 2 ? [...focusedNodes] : nodes.filter(n => !n.hidden);
                
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
                }
              }}
            >
              ⟳ Re-layout
            </button>
          </div>
        </Panel>

        <Panel position="top-right" className="metrics-panel details-panel glass-panel" style={{ pointerEvents: 'none', width: '340px', maxWidth: '360px', margin: '20px', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', border: '1.5px solid #cbd5e1', boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0,0,0,0.05)', backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
          <div className="nowheel" style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', position: 'sticky', top: 0, zIndex: 5 }}>
              <button 
                style={{ flex: 1, padding: '8px 12px', background: rightPanelTab === 'view' ? '#ffffff' : 'transparent', color: rightPanelTab === 'view' ? '#2563eb' : '#64748b', border: 'none', fontWeight: rightPanelTab === 'view' ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s ease', borderRadius: '6px', boxShadow: rightPanelTab === 'view' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                onClick={() => setRightPanelTab('view')}
              >
                Filters
              </button>
              <button 
                style={{ flex: 1, padding: '8px 12px', background: rightPanelTab === 'edit' ? '#ffffff' : 'transparent', color: rightPanelTab === 'edit' ? '#2563eb' : '#64748b', border: 'none', fontWeight: rightPanelTab === 'edit' ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s ease', borderRadius: '6px', boxShadow: rightPanelTab === 'edit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                onClick={() => setRightPanelTab('edit')}
              >
                Edit
              </button>
              <button 
                style={{ flex: 1, padding: '8px 12px', background: rightPanelTab === 'globals' ? '#ffffff' : 'transparent', color: rightPanelTab === 'globals' ? '#2563eb' : '#64748b', border: 'none', fontWeight: rightPanelTab === 'globals' ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s ease', borderRadius: '6px', boxShadow: rightPanelTab === 'globals' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                onClick={() => setRightPanelTab('globals')}
              >
                Globals
              </button>
            </div>

            <div style={{ display: rightPanelTab === 'view' ? 'block' : 'none' }}>
              <div className="form-group">
              <label htmlFor="filterGraph" className="form-label">Filter Graph<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.filterGraph}>?</span></label>
              <div className="metrics" style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Passed Nodes: <span className="metrics-passed-count" style={{fontWeight: 'bold', color: 'var(--status-passed-text)'}}>{nodes.filter(n => (n.data as any).test_status === 'Passed').length}</span></div>
              <select
                id="filterGraph"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              >
                <option value="">All aliases...</option>
                {aliases.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ marginTop: '12px', marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>Search Highlight<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.searchHighlight}>?</span></label>
              <input 
                type="text" 
                placeholder="Type to highlight nodes..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a' }} 
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '6px' }}>Visibility Filter<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.visibilityFilter}>?</span></label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {['Screen', 'Component', 'TestCase', 'Data'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: '#1e293b', fontWeight: 500 }}>
                    <input type="checkbox" checked={visibleTypes.has(type)} onChange={e => {
                      const next = new Set(visibleTypes);
                      if (e.target.checked) next.add(type);
                      else next.delete(type);
                      setVisibleTypes(next);
                    }} style={{ cursor: 'pointer' }} />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="maxDepth" className="form-label">Max Depth<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.maxDepth}>?</span></label>
              <input id="maxDepth" type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
              />
            </div>
            </div>

            <div style={{ display: rightPanelTab === 'edit' ? 'block' : 'none', flex: 1 }}>
            {(selectedNode || selectedEdge || isCreatingNode) ? (
              <div style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>
                {isCreatingNode ? 'Add Node' : `Edit ${editFormData.type}`}
                {!isCreatingNode && <><span className="node-id" style={{display:'none'}}>{editFormData.id}</span><span className="node-label" style={{display:'none'}}>{editFormData.label}</span></>}
              </h3>
              
              {editFormData.type === 'node' && (
                <>
                  <div className="form-group"><label htmlFor="nodeLabel" className="form-label">Label:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeLabel}>?</span></label>
                    <select id="nodeLabel" value={editFormData.label || 'Node'} onChange={e => setEditFormData({...editFormData, label: e.target.value})}>
                      <option value="Feature">{t.nodeLabel.Feature}</option>
                      <option value="Screen">{t.nodeLabel.Screen}</option>
                      <option value="Content">{t.nodeLabel.Content}</option>
                      <option value="System">{t.nodeLabel.System}</option>
                      <option value="Component">{t.nodeLabel.Component}</option>
                      <option value="Data">{t.nodeLabel.Data}</option>
                      <option value="TestCase">{t.nodeLabel.TestCase}</option>
                      <option value="Node">{t.nodeLabel.Node}</option>
                    </select>
                  </div>
                  <div className="form-group"><label htmlFor="nodeName" className="form-label">Name:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeName}>?</span></label><input id="nodeName" type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} /></div>
                  <div className="form-group">
                    <label htmlFor="nodeCategory" className="form-label">Node Category:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.nodeCategory}>?</span></label>
                    <input 
                      id="nodeCategory" 
                      type="text" 
                      list="category-aliases"
                      autoComplete="off" 
                      value={editFormData.aliases || ""} 
                      onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} 
                    />
                    <datalist id="category-aliases">
                      {aliases.map(a => (
                        <option key={a} value={a} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group" style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    {(() => {
                      const isGlobalAllowed = ['Component', 'Data', 'TestCase'].includes(editFormData.label);
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: isGlobalAllowed ? 1 : 0.5 }}>
                            <input type="checkbox" id="nodeIsGlobal" disabled={!isGlobalAllowed} checked={editFormData.properties?.is_global === 'true'} onChange={e => {
                              const newProps = { ...(editFormData.properties || {}), is_global: e.target.checked ? 'true' : 'false' };
                              setEditFormData({...editFormData, properties: newProps});
                            }} style={{ cursor: isGlobalAllowed ? 'pointer' : 'not-allowed', width: '16px', height: '16px' }} />
                            <label htmlFor="nodeIsGlobal" className="form-label" style={{ marginBottom: 0, cursor: isGlobalAllowed ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{t.globalNode.title}<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.globalNode}>?</span></label>
                          </div>
                          {!isGlobalAllowed && (
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>
                              {t.globalNode.notAllowed}
                            </p>
                          )}
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                            {t.globalNode.hintBefore}<strong>{t.globalNode.hintBadge}</strong>{t.globalNode.hintAfter}
                            {t.globalNode.hintUsage}
                            {t.globalNode.hintClick}
                          </p>
                        </>
                      );
                    })()}
                    {editFormData.properties?.is_global === 'true' && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', color: '#1e293b' }}>Verification Guide (Description)</label>
                          <textarea 
                            value={editFormData.properties?.description || ''} 
                            onChange={e => {
                              const newProps = { ...(editFormData.properties || {}), description: e.target.value };
                              setEditFormData({...editFormData, properties: newProps});
                            }}
                            placeholder="e.g. Verify that all language keys are translated properly."
                            style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', minHeight: '60px', resize: 'vertical' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', color: '#1e293b' }}>{t.nodeForm.issueLink}</label>
                          <textarea 
                            rows={3}
                            value={editFormData.properties?.issue_link || ''} 
                            onChange={e => {
                              const newProps = { ...(editFormData.properties || {}), issue_link: e.target.value };
                              setEditFormData({...editFormData, properties: newProps});
                            }}
                            placeholder="https://jira...&#10;https://github..."
                            style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>Custom Properties</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Object.entries(editFormData.properties || {})
                        .filter(([k]) => !SYSTEM_RESERVED_KEYS.has(k))
                        .map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              value={k} 
                              readOnly
                              title={k}
                              style={{ 
                                flex: '0 0 110px', 
                                maxWidth: '120px', 
                                backgroundColor: '#f1f5f9', 
                                border: '1.5px solid #cbd5e1', 
                                color: '#334155', 
                                padding: '6px 8px', 
                                borderRadius: '6px', 
                                fontSize: '0.85rem', 
                                fontWeight: 600,
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}
                            />
                            <input 
                              type="text" 
                              value={v as string} 
                              title={String(v)}
                              onChange={e => {
                                const newProps = { ...editFormData.properties, [k]: e.target.value };
                                setEditFormData({...editFormData, properties: newProps});
                              }}
                              style={{ 
                                flex: 1, 
                                minWidth: 0,
                                border: '1.5px solid #cbd5e1', 
                                backgroundColor: '#ffffff', 
                                color: '#0f172a', 
                                padding: '6px 8px', 
                                borderRadius: '6px', 
                                fontSize: '0.85rem',
                                textOverflow: 'ellipsis'
                              }}
                            />
                            <button 
                              onClick={() => {
                                const newProps = { ...editFormData.properties };
                                delete newProps[k];
                                setEditFormData({...editFormData, properties: newProps});
                              }}
                              title={t.nodeForm.deleteProperty}
                              style={{ 
                                background: '#fee2e2', 
                                border: '1px solid #fca5a5', 
                                color: '#b91c1c', 
                                padding: '0 8px', 
                                borderRadius: '6px', 
                                cursor: 'pointer', 
                                fontSize: '0.85rem', 
                                fontWeight: 600,
                                height: '32px'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                      ))}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="Key" 
                          id="newPropKey"
                          style={{ flex: '0 0 110px', maxWidth: '120px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', padding: '6px 8px', borderRadius: '6px', fontSize: '0.85rem' }}
                        />
                        <input 
                          type="text" 
                          placeholder="Value" 
                          id="newPropVal"
                          style={{ flex: 1, minWidth: 0, border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', padding: '6px 8px', borderRadius: '6px', fontSize: '0.85rem' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const keyInput = document.getElementById('newPropKey') as HTMLInputElement;
                              const valInput = document.getElementById('newPropVal') as HTMLInputElement;
                              if (keyInput.value && !editFormData.properties?.[keyInput.value]) {
                                const newProps = { ...(editFormData.properties || {}), [keyInput.value]: valInput.value };
                                setEditFormData({...editFormData, properties: newProps});
                                keyInput.value = '';
                                valInput.value = '';
                              }
                            }
                          }}
                        />
                        <button 
                          className="primary"
                          onClick={() => {
                            const keyInput = document.getElementById('newPropKey') as HTMLInputElement;
                            const valInput = document.getElementById('newPropVal') as HTMLInputElement;
                            if (keyInput.value && !editFormData.properties?.[keyInput.value]) {
                              const newProps = { ...(editFormData.properties || {}), [keyInput.value]: valInput.value };
                              setEditFormData({...editFormData, properties: newProps});
                              keyInput.value = '';
                              valInput.value = '';
                            }
                          }}
                          style={{ padding: '0 12px', fontSize: '1rem', fontWeight: 'bold', height: '32px' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editFormData.type === 'edge' && (
                <>
                  <div className="form-group">
                    <label htmlFor="edgeType" className="form-label">Type:</label>
                    <select id="edgeType" value={editFormData.edgeType || 'Transition'} onChange={e => setEditFormData({...editFormData, edgeType: e.target.value})}>
                      <option value="Transition">{t.edgeType.Transition}</option>
                      <option value="Contains">{t.edgeType.Contains}</option>
                      <option value="Displays">{t.edgeType.Displays}</option>
                      <option value="Depends_On">{t.edgeType.Depends_On}</option>
                      <option value="Triggers">{t.edgeType.Triggers}</option>
                      <option value="Tests">{t.edgeType.Tests}</option>
                      <option value="Return">{t.edgeType.Return}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action / Trigger:</label>
                    <input type="text" value={editFormData.action || ''} onChange={e => setEditFormData({...editFormData, action: e.target.value})} placeholder="e.g. Android Back Button" />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Status:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.status}>?</span></label>
                <div style={{display:"flex", gap:"8px", marginTop:"5px", flexWrap: 'wrap'}}>
                  <button className="success" onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button>
                  <button className="danger" onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button>
                  <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }} style={{ border: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155' }}>Reset Status</button>
                  {/* B. 수동 차단(📌 Manual Override): 노드에서만 제공, 사유 필수 */}
                  {editFormData.type === 'node' && !isCreatingNode && (
                    <button
                      className="warning"
                      onClick={(e) => { e.preventDefault(); setBlockReasonDraft(prev => prev === null ? '' : null); }}
                    >
                      Mark Blocked
                    </button>
                  )}
                  {/* 결함 원인 역추적(Root Cause Tracing, AI_IMPLEMENTATION_SPEC 3.3): Failed 또는 Blocked 노드에서 활성 */}
                  {editFormData.type === 'node' && !isCreatingNode && (
                    ((liveEditNode?.data as any)?.test_status === 'Blocked' || (liveEditNode?.data as any)?.test_status === 'Failed')
                  ) && (
                    <button
                      type="button"
                      className={`trace-root-cause-btn${tracedRootNodeId === editFormData.id ? ' active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setTracedRootNodeId(prev => prev === editFormData.id ? null : editFormData.id);
                      }}
                    >
                      {tracedRootNodeId === editFormData.id ? t.rootCause.clearButton : t.rootCause.traceButton}
                    </button>
                  )}
                  {/* 화면(Screen/Container) 단위 다국어 스코프 감사 (CROSS_CUTTING_LOCALIZATION_AUDIT_SPEC 4.1) */}
                  {editFormData.type === 'node' && !isCreatingNode && (
                    (liveEditNode?.data as any)?.label === 'Screen' || Boolean((liveEditNode?.data as any)?.hasChildren)
                  ) && (
                    <button
                      type="button"
                      className={`scoped-audit-btn${scopedAuditRootId === editFormData.id ? ' active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const targetId = editFormData.id;
                        const nextId = scopedAuditRootId === targetId ? null : targetId;
                        if (nextId && (liveEditNode?.data as any)?.isCollapsed) {
                          window.dispatchEvent(new CustomEvent('toggleCollapseNode', { detail: targetId }));
                        }
                        setScopedAuditRootId(nextId);
                        if (nextId) {
                          fetch(`/api/qa/audit-cross-cutting?aspect=Localization&scope_root_id=${encodeURIComponent(nextId)}`).catch(() => {});
                        }
                      }}
                    >
                      {scopedAuditRootId === editFormData.id ? t.scopedAudit.clearButton : t.scopedAudit.startButton}
                    </button>
                  )}
                </div>
                {editFormData.type === 'node' && !isCreatingNode && tracedRootNodeId === editFormData.id && (
                  <div className="root-cause-banner">
                    {t.rootCause.banner(rootCauseScope.nodeIds.size)}
                  </div>
                )}
                {editFormData.type === 'node' && !isCreatingNode && scopedAuditRootId === editFormData.id && (
                  <div className="scoped-audit-banner">
                    {t.scopedAudit.banner(scopedAuditScope.matchedCount, scopedAuditScope.totalInScope)}
                  </div>
                )}
                {editFormData.type === 'node' && !isCreatingNode && blockReasonDraft !== null && (
                  <div className="override-reason-box">
                    <input
                      type="text"
                      autoFocus
                      aria-label={t.override.reasonLabel}
                      placeholder={t.override.reasonPlaceholder}
                      value={blockReasonDraft}
                      onChange={e => setBlockReasonDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && blockReasonDraft.trim()) {
                          handleSaveStatus('Blocked', { reason: blockReasonDraft.trim() });
                          setBlockReasonDraft(null);
                        }
                      }}
                    />
                    <div className="override-reason-actions">
                      <button
                        className="warning"
                        disabled={!blockReasonDraft.trim()}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!blockReasonDraft.trim()) return;
                          handleSaveStatus('Blocked', { reason: blockReasonDraft.trim() });
                          setBlockReasonDraft(null);
                        }}
                      >
                        {t.override.confirm}
                      </button>
                      <button onClick={(e) => { e.preventDefault(); setBlockReasonDraft(null); }}>{t.override.cancel}</button>
                    </div>
                    <p className="inspector-hint">{t.override.hint}</p>
                  </div>
                )}
                {editFormData.type === 'node' && !isCreatingNode && isOverridden(liveEditNode ?? undefined) && (
                  <div className="override-pin-banner">
                    📌 {t.override.pinnedLabel}: {(liveEditNode?.data as any)?.properties?.override_reason || t.override.noReason}
                    <div className="inspector-hint">{t.override.releaseHint}</div>
                  </div>
                )}
              </div>

              {/* C. B안 노드 내부 체크리스트 (TESTCASE 스펙 3.3) */}
              {editFormData.type === 'node' && !isCreatingNode && liveEditNode && (() => {
                const items: ChecklistItem[] = Array.isArray((liveEditNode.data as any)?.properties?.checklist)
                  ? (liveEditNode.data as any).properties.checklist
                  : [];
                const passedCount = items.filter(i => i.status === 'Passed').length;
                const overall = checklistStatus(items);
                return (
                  <div className="form-group checklist-section">
                    <h4 className="inspector-section-title">
                      {t.checklist.title}
                      {overall && <span className="checklist-summary">{STATUS_ICON[overall]} {passedCount}/{items.length}</span>}
                    </h4>
                    {items.length === 0 && <p className="inspector-hint">{t.checklist.empty}</p>}
                    {items.map(item => (
                      <div key={item.id} className="checklist-item">
                        {/* 상태 아이콘 1개 + 클릭 시 팝오버(⚪🟢🔴🟡)로 선택 → 텍스트 영역에 최대한 폭을 양보 */}
                        <div
                          className="checklist-status-picker"
                          onBlur={e => {
                            // 팝오버 바깥으로 포커스가 나가면 닫기 (팝오버 내부 버튼 클릭은 유지)
                            if (!e.currentTarget.contains(e.relatedTarget as HTMLElement | null)) {
                              setOpenChecklistStatusId(prev => (prev === item.id ? null : prev));
                            }
                          }}
                        >
                          <button
                            type="button"
                            className="checklist-status-trigger"
                            title={`${t.checklist.changeStatus}: ${t.status[(item.status || 'Untested') as StatusName]}`}
                            aria-haspopup="menu"
                            aria-expanded={openChecklistStatusId === item.id}
                            onClick={() => setOpenChecklistStatusId(prev => (prev === item.id ? null : item.id))}
                          >
                            {STATUS_ICON[item.status || 'Untested']}
                          </button>
                          {openChecklistStatusId === item.id && (
                            <div className="checklist-status-menu" role="menu">
                              {CHECKLIST_STATUS_CYCLE.map(st => (
                                <button
                                  key={st}
                                  type="button"
                                  role="menuitemradio"
                                  className={`checklist-status-btn${item.status === st ? ' selected' : ''}`}
                                  title={t.status[st]}
                                  aria-checked={item.status === st}
                                  onClick={() => {
                                    setOpenChecklistStatusId(null);
                                    if (item.status === st) return;
                                    saveChecklist(items.map(i => i.id === item.id ? { ...i, status: st } : i));
                                  }}
                                >
                                  {STATUS_ICON[st]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <textarea
                          // 텍스트가 바뀌면(저장/Undo) 다시 마운트되어 최신 값을 보여줍니다.
                          key={`${item.id}:${item.text}`}
                          rows={1}
                          className="checklist-text"
                          aria-label={t.checklist.itemLabel}
                          placeholder={t.checklist.itemPlaceholder}
                          defaultValue={item.text}
                          autoFocus={item.text === ''}
                          // 내용 길이에 맞춰 높이 자동 조절 (긴 문장은 폭에 맞춰 줄바꿈되어 전부 보임)
                          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                          onInput={e => {
                            const el = e.currentTarget;
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                          }}
                          onBlur={e => {
                            const text = e.target.value.trim();
                            if (text !== item.text) saveChecklist(items.map(i => i.id === item.id ? { ...i, text } : i));
                          }}
                          onKeyDown={e => {
                            // Enter = 저장(입력 종료), Shift+Enter = 줄바꿈
                            // 한글 IME 조합 중 Enter(isComposing)는 글자 확정용이므로 무시
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              (e.target as HTMLTextAreaElement).blur();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="checklist-delete-btn"
                          title={t.checklist.deleteItem}
                          onClick={() => saveChecklist(items.filter(i => i.id !== item.id))}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="checklist-add-btn"
                      onClick={() => saveChecklist([
                        ...items,
                        { id: `chk_${Date.now().toString(36)}_${items.length + 1}`, text: '', status: 'Untested' }
                      ])}
                    >
                      {t.checklist.addItem}
                    </button>
                    {items.length > 0 && <p className="inspector-hint">{t.checklist.autoStatusHint}</p>}
                  </div>
                );
              })()}

              {/* D. 변경 영향도 강조 (Change Impact Ripple, AI_IMPLEMENTATION_SPEC 4.4) */}
              {editFormData.type === 'node' && !isCreatingNode && liveEditNode && (() => {
                const props = (liveEditNode.data as any)?.properties || {};
                const isModified = props.is_modified === true || props.is_modified === 'true';
                return (
                  <div className="form-group modified-section">
                    <h4 className="inspector-section-title">{t.modified.sectionTitle}</h4>
                    {isModified ? (
                      <div className="modified-banner">
                        <div className="modified-banner-title">⚠️ {t.modified.bannerTitle}: {props.modified_note || t.modified.noNote}</div>
                        {props.modified_at && (
                          <div className="inspector-hint">{t.modified.modifiedAt} {new Date(props.modified_at).toLocaleString()}</div>
                        )}
                        <button className="success" onClick={(e) => { e.preventDefault(); handleAcknowledge(); }}>
                          {t.modified.acknowledge}
                        </button>
                      </div>
                    ) : (
                      <div className="modified-mark-row">
                        <input
                          type="text"
                          aria-label={t.modified.noteLabel}
                          placeholder={t.modified.notePlaceholder}
                          value={modifiedNoteDraft}
                          onChange={e => setModifiedNoteDraft(e.target.value)}
                        />
                        <button onClick={(e) => { e.preventDefault(); handleMarkModified(); }}>{t.modified.markButton}</button>
                      </div>
                    )}
                    <p className="inspector-hint">{t.modified.hint}</p>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="danger" style={{flex: 1}} onClick={handleDelete}>Delete</button>
                <button className="primary" style={{flex: 1}} onClick={handleSave}>Save</button>
              </div>

              {/* (Node Raw Inspector 디버그 패널은 FEATURE_PRUNING_GUIDE 1순위 정리 대상으로 제거됨) */}
            </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a node or edge on the graph, or click 'Add Node' to start editing.
              </div>
            )}
            </div>

            <div style={{ display: rightPanelTab === 'globals' ? 'block' : 'none', flex: 1 }}>
              <div style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--panel-border)', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Global Nodes<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content={t.tooltip.globalNodes}>?</span></h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Attach global nodes as badges to the currently selected node.
                </p>
              </div>

              {globalNodesList.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No global nodes found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {globalNodesList.map(g => (
                    <div key={g.id} style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px', background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={g.name}>{g.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{g.type}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
                        <button 
                          onClick={() => {
                            if (impactMode?.globalNodeId === g.id) {
                              deactivateImpact();
                            } else {
                              activateImpact(g.id, g.name);
                            }
                          }}
                          title={`Show impact: which nodes are affected by ${g.name}`}
                          style={{ 
                            padding: '5px 10px', fontSize: '12px', fontWeight: 600,
                            background: impactMode?.globalNodeId === g.id ? '#ede9fe' : '#f5f3ff',
                            border: impactMode?.globalNodeId === g.id ? '1.5px solid #7c3aed' : '1px solid #ddd6fe',
                            color: impactMode?.globalNodeId === g.id ? '#6d28d9' : '#7c3aed',
                            borderRadius: '6px'
                          }}
                        >
                          {impactMode?.globalNodeId === g.id ? '🔍 ON' : '🔍 Impact'}
                        </button>
                        <button 
                          className="primary" 
                          disabled={!selectedNode}
                          onClick={async () => {
                            if (!selectedNode) return;
                            try {
                              const res = await fetch('/api/edges', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  source: selectedNode.id,
                                  target: g.id,
                                  type: 'Depends_On',
                                  action: '',
                                  properties: {},
                                  test_status: 'Untested'
                                })
                              });
                              if (res.ok) {
                                const newEdgeId = await res.json();
                                setNodes(nds => nds.map(n => {
                                  if (n.id !== selectedNode.id) return n;
                                  const newBadges = [...((n.data as any).badges || []), { ...g, edgeId: newEdgeId, edgeType: 'Depends_On', test_status: 'Untested' }];
                                  return { ...n, data: { ...n.data, badges: newBadges } };
                                }));
                              } else {
                                const text = await res.text();
                                setError(text);
                              }
                            } catch (err: any) {
                              setError(err.message);
                            }
                          }}
                          title={selectedNode ? `Attach to ${(selectedNode.data as any)?.name || 'selected node'}` : 'Select a node on the canvas first to attach'}
                          style={{ padding: '4px 8px', fontSize: '12px', opacity: selectedNode ? 1 : 0.5 }}
                        >
                          [+] Attach
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Create New Global Node</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    id="newGlobalNodeName"
                    placeholder="e.g. Common Login" 
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }} 
                  />
                  <button 
                    className="primary"
                    onClick={async () => {
                      const input = document.getElementById('newGlobalNodeName') as HTMLInputElement;
                      if (!input || !input.value.trim()) return;
                      try {
                        const res = await fetch('/api/nodes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            label: 'Screen',
                            name: input.value.trim(),
                            aliases: [],
                            properties: { is_global: 'true' },
                            test_status: 'Untested'
                          })
                        });
                        if (res.ok) {
                          input.value = '';
                          fetchGlobals();
                          triggerRefresh();
                        } else {
                          const text = await res.text();
                          setError(text);
                        }
                      } catch (err: any) {
                        setError(err.message);
                      }
                    }}
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel position="bottom-right" style={{ margin: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--panel-bg)', padding: '6px 12px', borderRadius: '16px', border: '1px solid var(--panel-border)', backdropFilter: 'blur(12px)', boxShadow: 'var(--panel-shadow)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus === 'ok' ? '#22c55e' : (healthStatus === 'error' ? '#ef4444' : '#f59e0b'), boxShadow: `0 0 8px ${healthStatus === 'ok' ? '#22c55e' : (healthStatus === 'error' ? '#ef4444' : '#f59e0b')}` }}></div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {healthStatus === 'ok' ? 'System Online' : (healthStatus === 'error' ? 'System Offline' : 'Checking...')}
            </span>
          </div>
        </Panel>

      </ReactFlow>

      {/* Context Menu */}
      {contextMenu?.show && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div className="context-menu-item" onClick={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
            setIsCreatingNode(true);
            // contextMenu.show is still true to let initialPos capture its position
          }}>
            {t.contextMenu.addNode}
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => {
            if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 800 });
            setContextMenu(null);
          }}>
            {t.contextMenu.fitView}
          </div>
          <div className="context-menu-item" onClick={() => {
            triggerRefresh();
            setContextMenu(null);
          }}>
            {t.contextMenu.refresh}
          </div>
        </div>
      )}

      {/* Workspace Manager Modal */}
      {showWorkspaceManager && (
        <div className="workspace-manager-modal" onClick={() => setShowWorkspaceManager(false)}>
          <div className="glass-panel" style={{ width: '500px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{t.workspaceManager.title}</h2>
              <button onClick={() => setShowWorkspaceManager(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="workspace-list">
              {aliases.map(a => (
                <div key={a} className="workspace-item">
                  <span style={{ fontWeight: 500 }}>{a}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                      const newAlias = prompt(t.workspaceManager.renamePrompt(a), a);
                      if (newAlias && newAlias.trim() && newAlias.trim() !== a) {
                        if (confirm(t.workspaceManager.renameConfirm(a, newAlias.trim()))) {
                          try {
                            const res = await fetch(`/api/aliases/${encodeURIComponent(a)}?new_alias=${encodeURIComponent(newAlias.trim())}`, { method: 'PUT' });
                            if (res.ok) triggerRefresh();
                            else alert('Failed to rename workspace');
                          } catch (e) { alert('Error renaming workspace'); }
                        }
                      }
                    }}>{t.common.edit}</button>
                    <button className="danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                      if (confirm(t.workspaceManager.deleteConfirm(a))) {
                        try {
                          const res = await fetch(`/api/aliases/${encodeURIComponent(a)}`, { method: 'DELETE' });
                          if (res.ok) {
                            if (filterText === a) { setFilterText(''); localStorage.removeItem('savedWorkspace'); }
                            triggerRefresh();
                          }
                          else alert('Failed to delete workspace');
                        } catch (e) { alert('Error deleting workspace'); }
                      }
                    }}>{t.common.delete}</button>
                  </div>
                </div>
              ))}
              {aliases.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No workspaces found.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Preset Manager Modal */}
      <PresetManagerModal
        isOpen={showPresetManager}
        onClose={() => setShowPresetManager(false)}
        onPresetLoaded={() => {
          setFilterText('');
          setShowAllDomains(true);
          triggerRefresh();
          setTimeout(() => {
            if (rfInstance) rfInstance.fitView({ padding: 0.15, duration: 600 });
          }, 300);
        }}
      />

      {/* Impact Overlay Stats Bar */}
      {impactMode && (
        <div className="impact-stats-bar" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-floating-panel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>🔍</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c4b5fd' }}>{impactMode.globalNodeName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.impact.affected(impactMode.total)}</div>
            </div>
          </div>
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
          <div className="impact-stat-item">
            <div className="impact-stat-dot" style={{ background: '#22c55e' }} />
            <span style={{ color: '#4ade80' }}>{impactMode.stats.Passed}</span>
          </div>
          <div className="impact-stat-item">
            <div className="impact-stat-dot" style={{ background: '#ef4444' }} />
            <span style={{ color: '#f87171' }}>{impactMode.stats.Failed}</span>
          </div>
          <div className="impact-stat-item">
            <div className="impact-stat-dot" style={{ background: '#64748b' }} />
            <span style={{ color: '#94a3b8' }}>{impactMode.stats.Untested}</span>
          </div>
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
          <button className="impact-close-btn" onClick={deactivateImpact}>✕ Close</button>
        </div>
      )}
      
      {error && (
        <div className="error-toast glass-panel" style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'var(--status-failed-text)', background: 'var(--status-failed-bg)', border: '1px solid var(--status-failed-border)', zIndex: 'var(--z-toast)' }}>
          Error: {error}
        </div>
      )}
      
      {nodes.length === 0 && !loading && (
        <div className="empty-state-message glass-panel" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 'var(--z-canvas-controls)' }}>
          No nodes found.
        </div>
      )}
      {loading && (
        <div data-testid="loading-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(248, 250, 252, 0.85)', zIndex: 'var(--z-loading-overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
          <div className="glass-panel" style={{ fontWeight: '600', fontSize: '1.2rem', padding: '16px 32px' }}>
            Loading Graph...
          </div>
        </div>
      )}
      {showHelp && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)',
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{
            backgroundColor: 'var(--bg-color)', color: 'var(--text-main)',
            padding: '30px', borderRadius: '12px', width: '500px', maxWidth: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{t.help.title}</h2>
              <button onClick={() => setShowHelp(false)} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-main)' }}>&times;</button>
            </div>
            
            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>{t.help.highlightTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong style={{ color: '#3b82f6' }}>{t.help.incomingTitle}</strong>: {t.help.incomingBody}</li>
              <li><strong style={{ color: '#f59e0b' }}>{t.help.outgoingTitle}</strong>: {t.help.outgoingBody}</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.statusTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>{t.help.untestedTitle}</strong>: {t.help.untestedBody}</li>
              <li><strong style={{ color: '#10b981' }}>{t.help.passedTitle}</strong>: {t.help.passedBody}</li>
              <li><strong style={{ color: '#ef4444' }}>{t.help.failedTitle}</strong>: {t.help.failedBody}</li>
              <li><strong style={{ color: '#d97706' }}>{t.help.blockedTitle}</strong>: {t.help.blockedBody}</li>
              <li style={{ fontSize: '0.9rem', color: 'gray', marginTop: '5px' }}>{t.help.statusNote}</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.tipsTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>{t.help.connectTitle}</strong>: {t.help.connectBody}</li>
              <li><strong>{t.help.highlightTipTitle}</strong>: {t.help.highlightTipBody}</li>
              <li><strong>{t.help.depthTitle}</strong>: {t.help.depthBody}</li>
              <li><strong>{t.help.undoTitle}</strong>: {t.help.undoBody}</li>
            </ul>
            
            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>{t.help.globalTitle}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>{t.help.globalTypeTitle}</strong>: {t.help.globalTypeBody}</li>
              <li><strong>{t.help.globalDeleteTitle}</strong>: {t.help.globalDeleteBody}</li>
              <li><strong>{t.help.globalUsageTitle}</strong>: {t.help.globalUsageBody}</li>
            </ul>
            
            <div style={{ textAlign: 'right', marginTop: '30px' }}>
              <button onClick={() => setShowHelp(false)} className="success">{t.common.ok}</button>
            </div>
          </div>
        </div>
      )}
      <Tooltip id="app-tooltip" className="custom-tooltip" place="left" />
    </div>
  );
}








