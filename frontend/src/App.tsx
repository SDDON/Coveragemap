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
import { getLayoutedElements, getGridLayoutedElements } from './layout';

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
  'is_global', 'description', 'issue_link', 'x', 'y'
]);


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

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, show: boolean } | null>(null);
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
  const [showCypherExport, setShowCypherExport] = useState(false);
  const [cypherQuery, setCypherQuery] = useState('');

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

  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['Screen', 'Component', 'TestCase', 'Data', 'Feature', 'System']));
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
      nds.forEach(n => {
        const type = (n.data as any)?.label || 'Data';
        if (!visibleTypes.has(type)) hiddenNodes.add(n.id);
      });

      const next = nds.map(n => {
        const type = (n.data as any)?.label || 'Data';
        const isHidden = !visibleTypes.has(type);
        
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
        await fetch(`/api/edges/${action.id}`, { method: 'DELETE' });
        setEdges(eds => eds.filter(e => e.id !== action.id));
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
        // Add edge back to local state with floating type
        setEdges(eds => calculateEdgeBundling([...eds, {
          id: newEdgeId,
          source: action.edgeData.source,
          target: action.edgeData.target,
          label: action.edgeData.type,
          type: 'floating',
          data: action.edgeData,
          style: { strokeWidth: 2 },
        }]));
      }
    } catch (err) {
      console.error("Undo failed", err);
    }
  }, [triggerRefresh, setNodes, setEdges]);

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
        return nds.map(n => {
          if (n.id === targetId) return { ...n, data: { ...n.data, isCollapsed } };
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
            hidden: !visibleTypesRef.current.has(n.label) || isGlobal,
            position: { x: 0, y: 0 },
            className: `status-${(n.test_status || 'untested').toLowerCase()}`,
          };
        });

        const edgeBundles: Record<string, ApiEdge[]> = {};
        for (const e of data.edges) {
          let isBadgeEdge = false;
          if (globalNodes.has(e.target)) {
            const sourceNode = initialNodes.find(n => n.id === e.source);
            if (sourceNode) ((sourceNode.data as any).badges as any[]).push({ ...globalNodes.get(e.target), edgeId: e.id, edgeType: e.type });
            isBadgeEdge = true;
          } else if (globalNodes.has(e.source)) {
            const targetNode = initialNodes.find(n => n.id === e.target);
            if (targetNode) ((targetNode.data as any).badges as any[]).push({ ...globalNodes.get(e.source), edgeId: e.id, edgeType: e.type });
            isBadgeEdge = true;
          }

          let isSubflowEdge = false;
          const eType = (e.type || '').toLowerCase();
          if (eType === 'contains' || eType === 'has') {
            const childNode = initialNodes.find(n => n.id === e.target);
            const parentId = initialNodes.find(n => n.id === e.source);
            if (childNode && parentId && !globalNodes.has(e.target)) {
              childNode.parentId = e.source;
              childNode.extent = parentId.hidden ? undefined : 'parent';
              (parentId.data as any).hasChildren = true;
            }
            isSubflowEdge = true;
          }

          if (!isBadgeEdge && !isSubflowEdge) {
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

        let rawEdges: Edge[] = [];
        Object.values(edgeBundles).forEach((bundle) => {
          bundle.forEach((e) => {
            rawEdges.push({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.type,
              data: { ...e },
              type: 'floating',
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
        setError(null);
        
        // Auto-fit view when the graph is loaded, but only if the workspace filter changed
        // We track the last fitted filter on the window object to avoid a ref for now
        if ((window as any).lastFittedFilter !== filterText) {
          (window as any).lastFittedFilter = filterText;
          setTimeout(() => {
            if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 800 });
          }, 150);
        }
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

  useEffect(() => {
    if (selectedNode) {
      const n = selectedNode.data as ApiNode;
      const cleanProps = { ...(n.properties || {}) };
      SYSTEM_RESERVED_KEYS.forEach(k => delete cleanProps[k]);
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
    setEdges(eds => eds.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target)));
  }, [pushUndo, edges, setEdges]);

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
  }, [pushUndo]);

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    const sourceIsGlobal = (sourceNode?.data as any)?.properties?.is_global === 'true';
    const targetIsGlobal = (targetNode?.data as any)?.properties?.is_global === 'true';

    let defaultType = "Transition";
    const sourceLabel = (sourceNode?.data as any)?.label;
    if (sourceLabel === 'System' || sourceLabel === 'Category') {
      defaultType = "Contains";
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

      if (defaultType.toLowerCase() === 'contains' || defaultType.toLowerCase() === 'has') {
        setNodes(nds => {
          const nextNds = nds.map(n => {
            if (n.id === connection.target) {
              return { ...n, parentId: connection.source!, extent: 'parent' as 'parent' };
            }
            if (n.id === connection.source) {
              return { ...n, data: { ...n.data, hasChildren: true } };
            }
            return n;
          });
          // React Flow requires parent nodes to appear before children in the array
          return nextNds.sort((a, b) => {
            if (a.parentId && !b.parentId) return 1;
            if (!a.parentId && b.parentId) return -1;
            return 0;
          });
        });
        return;
      }

      // Add edge to local state instead of re-fetching entire graph with floating type
      setEdges(eds => {
        const nextEds = [...eds, {
          id: newEdgeId,
          source: connection.source!,
          target: connection.target!,
          label: 'Transition',
          type: 'floating',
          data: { type: 'Transition', test_status: 'Untested', properties: (connection as any).properties || {}, markerColor: '#64748b' },
          style: { stroke: 'gray', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'gray' },
        }];
        const bundledEds = calculateEdgeBundling(nextEds);
        const targetId = connection.target!;
        const newTargetStatus = recalculateTargetStatus(targetId, bundledEds);
        setNodes(nds => nds.map(n => {
          if (n.id !== targetId || (n.data as any)?.test_status === newTargetStatus) return n;
          const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newTargetStatus.toLowerCase();
          return { ...n, data: { ...n.data, test_status: newTargetStatus }, className: cls.trim(), style: { ...(n.style || {}), backgroundColor: newTargetStatus === 'Passed' ? '#c8e6c9' : (newTargetStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } };
        }));
        return bundledEds;
      });
    } catch (err) {
      console.error("Failed to create edge:", err);
    }
  }, [pushUndo, setEdges, setNodes]);

  
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
      setNodes(nds => nds.filter(n => n.id !== editFormData.id)); 
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
      setEdges(eds => {
        const nextEds = eds.filter(e => e.id !== editFormData.id);
        if (edge) {
          const targetId = edge.target;
          const newTargetStatus = recalculateTargetStatus(targetId, nextEds);
          setNodes(nds => nds.map(n => {
            if (n.id !== targetId || (n.data as any)?.test_status === newTargetStatus) return n;
            const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newTargetStatus.toLowerCase();
            return { ...n, data: { ...n.data, test_status: newTargetStatus }, className: cls.trim(), style: { ...(n.style || {}), backgroundColor: newTargetStatus === 'Passed' ? '#c8e6c9' : (newTargetStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } };
          }));
        }
        return nextEds;
      }); 
    } 
    setEditFormData({}); 
    setSelectedNode(null); 
    setSelectedNode(null); 
    setSelectedEdge(null);
  }; 
  
  const recalculateTargetStatus = (targetId: string, currentEdges: Edge[]) => {
    const incoming = currentEdges.filter(e => e.target === targetId);
    if (incoming.length === 0) return 'Untested';
    let hasFailed = false, allPassed = true;
    for (const e of incoming) {
      const st = ((e.data as any)?.test_status || 'Untested').toLowerCase();
      if (st === 'failed') hasFailed = true;
      if (st !== 'passed') allPassed = false;
    }
    return hasFailed ? 'Failed' : (allPassed ? 'Passed' : 'Untested');
  };

  const handleSaveStatus = async (newStatus: string) => {
    if (editFormData.type === 'node') {
      const node = nodes.find(n => n.id === editFormData.id);
      const cleanProps = { ...(editFormData.properties || {}) };
      SYSTEM_RESERVED_KEYS.forEach(k => delete cleanProps[k]);
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
      } else {
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
      }
      setNodes(nds => nds.map(n => {
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
            badges: newBadges 
          } 
        };
      }));
      setEditFormData({ ...editFormData, status: newStatus, properties: cleanProps });
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
      await fetch(`/api/edges/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setEdges(eds => {
        const nextEds = eds.map(e => {
          if (e.id !== editFormData.id) return e;
          const cls = (e.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newStatus.toLowerCase();
          return { ...e, data: { ...(e.data || {}), test_status: newStatus, markerColor: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, className: cls.trim(), style: { ...(e.style || {}), stroke: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, markerEnd: { type: MarkerType.ArrowClosed, color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') } };
        });
        const targetId = edge.target;
        const newTargetStatus = recalculateTargetStatus(targetId, nextEds);
        setNodes(nds => nds.map(n => {
          if (n.id !== targetId || (n.data as any)?.test_status === newTargetStatus) return n;
          const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newTargetStatus.toLowerCase();
          return { ...n, data: { ...n.data, test_status: newTargetStatus }, className: cls.trim(), style: { ...(n.style || {}), backgroundColor: newTargetStatus === 'Passed' ? '#c8e6c9' : (newTargetStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } };
        }));
        return nextEds;
      });
      setEditFormData({ ...editFormData, status: newStatus });
    }
  };

  const handleSave = async () => {
    if (editFormData.type === 'node') {
      const node = nodes.find(n => n.id === editFormData.id);
      
      // Extract description and issue_link to top-level for the backend
      const props = { ...(editFormData.properties || {}) };
      const description = props.description;
      const issue_link = props.issue_link;
      SYSTEM_RESERVED_KEYS.forEach(k => delete props[k]);
      
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        test_status: editFormData.status,
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
        setTimeout(() => setSelectedNode(newNode as Node), 0);
      } else {
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
        setNodes(nds => nds.map(n => n.id === editFormData.id ? { 
          ...n, 
          className: (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + (editFormData.status || 'untested').toLowerCase(),
          data: { 
            ...n.data, 
            label: editFormData.label, 
            name: editFormData.name, 
            test_status: editFormData.status, 
            aliases: payload.aliases, 
            properties: { 
              ...payload.properties, 
              description: payload.description, 
              issue_link: payload.issue_link 
            } 
          } 
        } : n));
        setSelectedNode(prev => prev && prev.id === editFormData.id ? {
          ...prev,
          className: (prev.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + (editFormData.status || 'untested').toLowerCase(),
          data: {
            ...prev.data,
            label: editFormData.label,
            name: editFormData.name,
            test_status: editFormData.status,
            aliases: payload.aliases,
            properties: {
              ...payload.properties,
              description: payload.description,
              issue_link: payload.issue_link
            }
          }
        } : prev);
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
      setEdges(eds => {
        const nextEds = eds.map(e => e.id === editFormData.id ? { ...e, id: newId, type: e.type, label: payload.type || e.label, data: { ...e.data as any, action: payload.action, test_status: payload.test_status } } : e);
        const targetId = edge.target;
        const newTargetStatus = recalculateTargetStatus(targetId, nextEds);
        setNodes(nds => nds.map(n => {
          if (n.id !== targetId || (n.data as any)?.test_status === newTargetStatus) return n;
          const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newTargetStatus.toLowerCase();
          return { ...n, data: { ...n.data, test_status: newTargetStatus }, className: cls.trim(), style: { ...(n.style || {}), backgroundColor: newTargetStatus === 'Passed' ? '#c8e6c9' : (newTargetStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } };
        }));
        return nextEds;
      });
      if (newId !== editFormData.id) {
        setEditFormData({...editFormData, id: newId});
        setSelectedEdge(prev => prev ? {...prev, id: newId} : null);
      }
      if (payload.type?.toLowerCase() === 'contains' || payload.type?.toLowerCase() === 'has') {
        triggerRefresh();
      }
    }
    // Don't triggerRefresh for normal edits — local state is already updated
    // triggerRefresh would re-run dagre layout and reset all dragged positions
  };


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

    if (selectedNode) {
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

        // Impact mode classes
        if (impactMode) {
          if (n.id === impactMode.globalNodeId) {
            cls += ' impact-highlighted impact-source';
          } else if (impactMode.connectedIds.has(n.id)) {
            cls += ' impact-highlighted';
          }
        } else if (activeNodes.has(n.id) || hoveredNode === n.id) {
          cls += ' active';
          if (outgoing.has(n.id)) cls += ' highlight-outgoing';
          if (incoming.has(n.id)) cls += ' highlight-incoming';
        } else if (relatedNodes.has(n.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || searchSeeds.length > 0 || hoveredNode || hoveredEdge) {
          cls += ' de-emphasized';
        }
        
        if (n.className !== cls.trim()) {
          changed = true;
          return { ...n, className: cls.trim() };
        }
        return n;
      });
      return changed ? next : nds;
    });

    setEdges(eds => {
      let changed = false;
      const next = eds.map(e => {
        let cls = (e.className || '').replace(/\b(de-emphasized|active|related|highlight-edge|impact-[a-z-]+|status-[a-z-]+)\b/g, '').trim();
        const status = ((e.data as any)?.test_status || 'untested').toLowerCase();
        cls += ' status-' + status;

        // Impact mode edge classes
        if (impactMode && impactMode.edgeIds.has(e.id)) {
          cls += ' impact-edge';
        } else if (edgeHighlights.has(e.id) || hoveredEdge === e.id) {
          cls += ' active highlight-edge';
        } else if (relatedEdges.has(e.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || searchSeeds.length > 0 || hoveredNode || hoveredEdge) {
          cls += ' de-emphasized';
        }
        
        const currentMarkerColor = (e.data as any)?.markerColor;
        
        if (e.className !== cls || currentMarkerColor !== undefined) {
          changed = true;
          // Clean up old markerColor prop if present
          const newData = { ...e.data as any };
          delete newData.markerColor;
          return { ...e, className: cls.trim(), data: newData };
        }
        return e;
      });
      return changed ? next : eds;
    });
  }, [selectedNode, selectedEdge, hoveredNode, hoveredEdge, maxDepth, searchQuery, impactMode]);

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

  const generateCypher = useCallback(() => {
    let query = "// Exported Cypher Queries from CoverageMap\n";
    nodes.forEach(n => {
      const data = n.data as any;
      const label = data.label || 'Node';
      const name = (data.name || n.id).replace(/'/g, "\\'");
      const aliases = JSON.stringify(data.aliases || []);
      const status = data.test_status || 'Untested';
      query += `MERGE (n:\`${label}\` {name: '${name}'}) ON CREATE SET n.aliases = ${aliases}, n.test_status = '${status}' ON MATCH SET n.aliases = ${aliases}, n.test_status = '${status}';\n`;
    });
    edges.forEach(e => {
      const type = (e.label || (e.data as any)?.type || 'RELATED').replace(/[^a-zA-Z0-9_]/g, '_');
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      const sourceName = ((sourceNode?.data as any)?.name || e.source).replace(/'/g, "\\'");
      const targetName = ((targetNode?.data as any)?.name || e.target).replace(/'/g, "\\'");
      const status = (e.data as any)?.test_status || 'Untested';
      query += `MATCH (s {name: '${sourceName}'}), (t {name: '${targetName}'}) MERGE (s)-[r:\`${type}\`]->(t) ON CREATE SET r.test_status = '${status}';\n`;
    });
    setCypherQuery(query);
    setShowCypherExport(true);
  }, [nodes, edges]);

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
              작업할 도메인(모듈)을 선택하세요. 선택한 도메인과 1~2 Depth 내의 경계 노드들만 로드되어 최적의 성능으로 작업할 수 있습니다.
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
                다시 보지 않기 (자동 진입)
              </label>
            </div>
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                onClick={() => setShowWorkspaceManager(true)} 
                style={{ padding: '12px 24px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-main)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
              >
                ⚙️ Workspace 관리자
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
                전체 그래프 로드 (Heavy)
              </button>
            </div>
          </div>
        </div>
      )}

          <ReactFlow nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.05}
                     onInit={setRfInstance}
        nodes={(() => {
          if (!hoveredGlobalBadgeId || !rfInstance) return nodes;
          const center = rfInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          return nodes.map(n => {
            if (n.id === hoveredGlobalBadgeId) {
              return {
                ...n,
                hidden: false,
                position: center,
                style: { ...n.style, zIndex: 'var(--z-active-node)', boxShadow: '0 0 20px rgba(0, 229, 255, 0.5)' },
                className: `${n.className || ''} hovered-global-neighbor`,
              };
            }
            const badges = (n.data as any)?.badges || [];
            if (badges.some((b: any) => b.id === hoveredGlobalBadgeId)) {
              return { ...n, className: `${n.className || ''} hovered-global-neighbor` };
            }
            return n;
          });
        })()}
        edges={(() => {
          if (!hoveredGlobalBadgeId || !rfInstance) return visibleEdges;
          const tempEdges: Edge[] = [];
          nodes.forEach(n => {
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
        onPaneClick={() => {
          setSelectedNode(null);
          setSelectedEdge(null);
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
        className={`${(selectedNode || selectedEdge || searchQuery.length > 0 || hoveredNode || hoveredEdge || hoveredGlobalBadgeId) ? 'has-selection' : ''} ${impactMode ? 'has-impact' : ''}`}
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
                {filterText ? filterText : (showAllDomains ? '전체 워크스페이스' : 'None')}
              </span>
            </div>
              <button 
                className="primary"
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}
                title="워크스페이스(도메인) 선택 화면 열기"
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
                style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}
                title="현재 그래프를 Cypher 쿼리로 내보냅니다."
                onClick={generateCypher}
              >
                Export Cypher
              </button>
            <button 
              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '50%', fontWeight: 'bold' }}
              title="도움말 및 범례 (Help & Legend)"
              onClick={() => setShowHelp(true)}
            >
              ?
            </button>
            <button 
              style={{ padding: 8, cursor: 'pointer' }}
              title="선택된 노드만 또는 전체를 자동 정렬합니다"
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
            <button 
              style={{ padding: 8, cursor: 'pointer' }}
              title="노드의 Category(Alias) 기준으로 그룹핑하여 격자(Grid) 형태로 정렬합니다"
              onClick={() => {
                const { nodes: layoutedNodes } = getGridLayoutedElements(nodes);
                setNodes(layoutedNodes);
              }}
            >
              🗂 Grid Layout
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
              <label htmlFor="filterGraph" className="form-label">Filter Graph<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="선택한 카테고리(Alias)에 해당하는 노드들만 캔버스에 표시합니다.">?</span></label>
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
              <label className="form-label" style={{ marginBottom: '6px' }}>Search Highlight<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="검색어가 포함된 노드와 그 의존성 흐름을 하이라이트합니다.">?</span></label>
              <input 
                type="text" 
                placeholder="Type to highlight nodes..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a' }} 
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '6px' }}>Visibility Filter<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="체크한 타입의 노드들만 캔버스에 표시합니다.">?</span></label>
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
              <label htmlFor="maxDepth" className="form-label">Max Depth<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="선택한 노드로부터 지정한 단계(Depth)까지만 연관 노드를 표시합니다.">?</span></label>
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
                  <div className="form-group"><label htmlFor="nodeLabel" className="form-label">Label:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="노드의 역할을 나타내는 주요 타입입니다. (예: Screen, Feature 등)">?</span></label>
                    <select id="nodeLabel" value={editFormData.label || 'Node'} onChange={e => setEditFormData({...editFormData, label: e.target.value})}>
                      <option value="Feature">Feature (기능)</option>
                      <option value="Screen">Screen (화면)</option>
                      <option value="Content">Content (콘텐츠)</option>
                      <option value="System">System (시스템)</option>
                      <option value="Component">Component (컴포넌트)</option>
                      <option value="Data">Data (데이터)</option>
                      <option value="TestCase">TestCase (테스트케이스)</option>
                      <option value="Node">Node (기본)</option>
                    </select>
                  </div>
                  <div className="form-group"><label htmlFor="nodeName" className="form-label">Name:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="노드에 표시될 실제 이름입니다.">?</span></label><input id="nodeName" type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} /></div>
                  <div className="form-group">
                    <label htmlFor="nodeCategory" className="form-label">Node Category:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="그룹화나 검색에 쓰이는 카테고리 태그(Alias)입니다.">?</span></label>
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
                  {editFormData.aliases === "invalid_free_text" && <div className="validation-error" style={{color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', marginBottom: '8px', fontWeight: 600}}>Invalid</div>}
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
                            <label htmlFor="nodeIsGlobal" className="form-label" style={{ marginBottom: 0, cursor: isGlobalAllowed ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>🌐 전역 공통 노드 (Badge화)<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="체크 시 이 노드는 캔버스에서 숨겨지고, 이 노드와 연결된 다른 노드들의 하단에 뱃지(Pill) 형태로 표시됩니다.">?</span></label>
                          </div>
                          {!isGlobalAllowed && (
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>
                              System, Screen, Feature 등 큰 단위의 노드는 전역 노드화할 수 없습니다.
                            </p>
                          )}
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                            체크 시 이 노드는 캔버스에서 숨겨지고, 이 노드와 연결된 다른 노드들의 하단에 <strong>뱃지(Pill)</strong> 형태로 표시됩니다.
                            다국어(I18N), 공통 데이터 등 여러 노드에서 반복 연결되는 글로벌 의존성에 사용하세요.
                            뱃지를 클릭하면 테스트 상태를 변경할 수 있습니다.
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
                          <label className="form-label" style={{ fontSize: '0.8rem', color: '#1e293b' }}>Issue Link (e.g. Jira) - 쉼표(,)나 엔터(줄바꿈)로 여러 개 입력 가능</label>
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
                              title="속성 삭제"
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
                    <label className="form-label">Type:</label>
                    <select value={editFormData.edgeType || 'Transition'} onChange={e => setEditFormData({...editFormData, edgeType: e.target.value})}>
                      <option value="Transition">Transition (화면 이동)</option>
                      <option value="Contains">Contains (포함)</option>
                      <option value="Displays">Displays (표시)</option>
                      <option value="Depends_On">Depends_On (의존)</option>
                      <option value="Triggers">Triggers (호출)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action / Trigger:</label>
                    <input type="text" value={editFormData.action || ''} onChange={e => setEditFormData({...editFormData, action: e.target.value})} placeholder="e.g. Android Back Button" />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Status:<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="현재 테스트/개발 상태를 나타냅니다.">?</span></label>
                <div style={{display:"flex", gap:"8px", marginTop:"5px", flexWrap: 'wrap'}}>
                  <button className="success" onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button>
                  <button className="danger" onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button>
                  <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }} style={{ border: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155' }}>Reset Status</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="danger" style={{flex: 1}} onClick={handleDelete}>Delete</button>
                <button className="primary" style={{flex: 1}} onClick={handleSave}>Save</button>
              </div>

              {/* Debug: Real-time Node System Metadata Inspector */}
              <details style={{ marginTop: '16px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', color: '#475569' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#2563eb', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔍 Node Raw Inspector (Debug)</span>
                </summary>
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Status (Current):</span>
                    <span style={{ fontWeight: 700, color: editFormData.status === 'Passed' ? '#16a34a' : (editFormData.status === 'Failed' ? '#dc2626' : '#d97706') }}>
                      {editFormData.status || 'Untested'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Node ID:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#0f172a' }}>{editFormData.id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Label / Name:</span>
                    <span style={{ color: '#0f172a' }}>[{editFormData.label}] {editFormData.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Category (Aliases):</span>
                    <span style={{ color: '#0f172a' }}>{editFormData.aliases || '(none)'}</span>
                  </div>
                  {selectedNode && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Parent Node:</span>
                      <span style={{ color: '#0f172a' }}>{selectedNode.parentId ? selectedNode.parentId : '(Root / None)'}</span>
                    </div>
                  )}
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Active Properties Payload:</span>
                    <pre style={{ margin: 0, padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.7rem', maxHeight: '140px', overflowY: 'auto', color: '#0f172a' }}>
                      {JSON.stringify({
                        id: editFormData.id,
                        label: editFormData.label,
                        name: editFormData.name,
                        test_status: editFormData.status,
                        aliases: editFormData.aliases,
                        custom_properties: Object.fromEntries(
                          Object.entries(editFormData.properties || {}).filter(([k]) => !SYSTEM_RESERVED_KEYS.has(k))
                        )
                      }, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a node or edge on the graph, or click 'Add Node' to start editing.
              </div>
            )}
            </div>

            <div style={{ display: rightPanelTab === 'globals' ? 'block' : 'none', flex: 1 }}>
              <div style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--panel-border)', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Global Nodes<span className="info-icon-wrapper" data-tooltip-id="app-tooltip" data-tooltip-content="전역 노드를 다른 노드에 부착(Attach)하거나, 해당 전역 노드에 의존하는 모든 노드(Impact)를 시각화합니다.">?</span></h3>
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
            ➕ 새 노드 추가
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={() => {
            if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 800 });
            setContextMenu(null);
          }}>
            ⤢ 전체 화면 맞춤
          </div>
          <div className="context-menu-item" onClick={() => {
            triggerRefresh();
            setContextMenu(null);
          }}>
            🔄 새로고침
          </div>
        </div>
      )}

      {/* Workspace Manager Modal */}
      {showWorkspaceManager && (
        <div className="workspace-manager-modal" onClick={() => setShowWorkspaceManager(false)}>
          <div className="glass-panel" style={{ width: '500px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Workspace 관리자</h2>
              <button onClick={() => setShowWorkspaceManager(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="workspace-list">
              {aliases.map(a => (
                <div key={a} className="workspace-item">
                  <span style={{ fontWeight: 500 }}>{a}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                      const newAlias = prompt(`'${a}'의 새 이름을 입력하세요:`, a);
                      if (newAlias && newAlias.trim() && newAlias.trim() !== a) {
                        if (confirm(`'${a}' 태그를 가진 모든 노드의 태그가 '${newAlias.trim()}'(으)로 변경됩니다. 계속하시겠습니까?`)) {
                          try {
                            const res = await fetch(`/api/aliases/${encodeURIComponent(a)}?new_alias=${encodeURIComponent(newAlias.trim())}`, { method: 'PUT' });
                            if (res.ok) triggerRefresh();
                            else alert('Failed to rename workspace');
                          } catch (e) { alert('Error renaming workspace'); }
                        }
                      }
                    }}>수정</button>
                    <button className="danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                      if (confirm(`'${a}' 태그를 모든 노드에서 삭제합니다. 계속하시겠습니까?`)) {
                        try {
                          const res = await fetch(`/api/aliases/${encodeURIComponent(a)}`, { method: 'DELETE' });
                          if (res.ok) {
                            if (filterText === a) { setFilterText(''); localStorage.removeItem('savedWorkspace'); }
                            triggerRefresh();
                          }
                          else alert('Failed to delete workspace');
                        } catch (e) { alert('Error deleting workspace'); }
                      }
                    }}>삭제</button>
                  </div>
                </div>
              ))}
              {aliases.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No workspaces found.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Impact Overlay Stats Bar */}
      {impactMode && (
        <div className="impact-stats-bar" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-floating-panel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>🔍</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c4b5fd' }}>{impactMode.globalNodeName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>영향 받는 노드 {impactMode.total}개</div>
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
              <h2 style={{ margin: 0 }}>CoverageMap 가이드</h2>
              <button onClick={() => setShowHelp(false)} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-main)' }}>&times;</button>
            </div>
            
            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>🌈 하이라이트 색상 (의존성 방향)</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong style={{ color: '#3b82f6' }}>🔵 파란색 테두리 (Incoming)</strong>: 선택/검색된 노드로 <strong>들어오는(진입하는)</strong> 흐름입니다. 즉, 이 노드가 동작하기 위한 <strong>선행 조건</strong>이나 상위 진입점을 의미합니다.</li>
              <li><strong style={{ color: '#f59e0b' }}>🟠 주황색 테두리 (Outgoing)</strong>: 선택/검색된 노드에서 <strong>뻗어 나가는</strong> 흐름입니다. 해당 노드에서 파생되는 <strong>하위 결과물</strong>이나 다음 단계를 의미합니다.</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>✅ 노드 테스트 상태 (Test Status)</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>⬜ 흰색 (Untested)</strong>: 아직 테스트되지 않은 항목입니다.</li>
              <li><strong style={{ color: '#10b981' }}>🟢 초록색 (Passed)</strong>: 테스트를 성공적으로 통과한 항목입니다.</li>
              <li><strong style={{ color: '#ef4444' }}>🔴 빨간색 (Failed)</strong>: 테스트에 실패한(버그가 발견된) 항목입니다.</li>
              <li style={{ fontSize: '0.9rem', color: 'gray', marginTop: '5px' }}>※ 대상(Component/Data 등)을 검증하는 엣지들의 상태가 모두 Passed이면 자동으로 Passed로 변경됩니다.</li>
            </ul>

            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>🛠 주요 기능 팁</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>선 연결 (드래그)</strong>: 노드 아래쪽 파란 점(Handle)에서 다른 노드 위쪽 파란 점으로 드래그하면 선(Edge)이 생성됩니다.</li>
              <li><strong>다중 선택 하이라이트</strong>: 우측 패널의 <code>Search Highlight</code>에 단어(예: Arena)를 검색하면 해당 그룹의 의존성 흐름을 한눈에 볼 수 있습니다.</li>
              <li><strong>깊이 조절 (Max Depth)</strong>: 선택한 노드로부터 몇 단계(Depth)까지의 연관 관계를 볼 것인지 슬라이더로 조절할 수 있습니다.</li>
              <li><strong>Undo (되돌리기)</strong>: <kbd>Ctrl + Z</kbd>를 눌러 최근 작업을 취소할 수 있습니다.</li>
            </ul>
            
            <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginTop: '20px' }}>🌐 전역 노드 (Global Node) 정책</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
              <li><strong>타입 제약</strong>: <code>Component</code>, <code>Data</code>, <code>TestCase</code> 등 세부 단위의 노드만 전역 노드로 변환(Badge화)할 수 있습니다. <code>System</code>, <code>Screen</code> 등 그룹 단위의 노드는 전역 노드가 될 수 없습니다.</li>
              <li><strong>삭제 제약 (Borrow Checker)</strong>: 전역 노드가 하나 이상의 노드에 배지로 부착되어 사용 중일 경우, 원본을 삭제할 수 없습니다. 연결을 먼저 해제해야 합니다.</li>
              <li><strong>사용 방법</strong>: 우측 패널에서 노드를 전역 노드화한 뒤, 캔버스에서 부착할 다른 대상 노드를 선택하고 우측 패널의 <code>Globals</code> 탭에서 <code>[+] Attach</code> 버튼을 누르면 배지로 부착됩니다.</li>
            </ul>
            
            <div style={{ textAlign: 'right', marginTop: '30px' }}>
              <button onClick={() => setShowHelp(false)} className="success">확인</button>
            </div>
          </div>
        </div>
      )}
      {showCypherExport && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)',
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{
            backgroundColor: 'var(--bg-color)', color: 'var(--text-main)',
            padding: '24px', borderRadius: '12px', width: '650px', maxWidth: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Export Cypher Query</h2>
              <button onClick={() => setShowCypherExport(false)} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-main)' }}>&times;</button>
            </div>
            <textarea
              readOnly
              value={cypherQuery}
              style={{
                flex: 1, minHeight: '320px', backgroundColor: 'rgba(0,0,0,0.3)',
                color: '#4ade80', fontFamily: 'monospace', padding: '12px',
                borderRadius: '6px', border: '1px solid var(--panel-border)',
                resize: 'none', fontSize: '0.85rem'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button 
                className="primary" 
                onClick={() => {
                  navigator.clipboard.writeText(cypherQuery);
                  alert('Cypher 쿼리가 클립보드에 복사되었습니다.');
                }}
              >
                Copy to Clipboard
              </button>
              <button onClick={() => setShowCypherExport(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <Tooltip id="app-tooltip" className="custom-tooltip" place="left" />
    </div>
  );
}








