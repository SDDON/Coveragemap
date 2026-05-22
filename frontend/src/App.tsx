import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);const [error, setError] = useState<string | null>(null);

  const [maxDepth, setMaxDepth] = useState<number>(1);
  const [filterText, setFilterText] = useState<string>('');
  const [aliases, setAliases] = useState<string[]>([]);

  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['Screen', 'Component', 'TestCase', 'Data', 'Feature']));
  const visibleTypesRef = useRef(visibleTypes);
  useEffect(() => { visibleTypesRef.current = visibleTypes; }, [visibleTypes]);

  useEffect(() => {
    setNodes(nds => {
      let changed = false;
      const next = nds.map(n => {
        const type = (n.data as any)?.label || 'Data';
        const isHidden = !visibleTypes.has(type);
        if (n.hidden !== isHidden) {
          changed = true;
          return { ...n, hidden: isHidden };
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
            properties: {}
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
        // Add edge back to local state
        setEdges(eds => [...eds, {
          id: newEdgeId,
          source: action.edgeData.source,
          target: action.edgeData.target,
          label: action.edgeData.type,
          data: action.edgeData,
          style: { strokeWidth: 2 },
        }]);
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
        }
      } catch (err) {
        console.error('Failed to fetch aliases', err);
      }
    };
    fetchAliases();
  }, [refreshKey]);

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

        const initialNodes: Node[] = data.nodes.map((n: ApiNode) => ({
          id: n.id,
          type: 'custom',
          data: n,
          hidden: !visibleTypesRef.current.has(n.label),
          position: { x: 0, y: 0 },
          style: { backgroundColor: n.test_status === 'Passed' ? '#c8e6c9' : (n.test_status === 'Failed' ? '#ffcdd2' : '#ffffff') }
        }));

        // 두 노드(A, B) 사이에 있는 모든 엣지(방향 무관)를 그룹화합니다.
        const edgeBundles: Record<string, ApiEdge[]> = {};
        for (const e of data.edges) {
          // 항상 ID가 작은 노드를 앞에 두어 고유 키(canonical key)를 만듭니다.
          const key = e.source < e.target ? `${e.source}→${e.target}` : `${e.target}→${e.source}`;
          if (!edgeBundles[key]) edgeBundles[key] = [];
          edgeBundles[key].push(e);
        }

        const initialEdges: Edge[] = [];
        Object.values(edgeBundles).forEach((bundle) => {
          const N = bundle.length;
          
          bundle.forEach((e, i) => {
            const isReverse = e.source > e.target;
            
            // 그룹 내의 엣지들을 양옆으로 균등하게 부채꼴처럼 펼칩니다.
            // N=1 -> [0]
            // N=2 -> [-40, 40]
            // N=3 -> [-80, 0, 80]
            const absoluteShift = (i - (N - 1) / 2) * 80;
            
            // 역방향 엣지는 기준 법선 벡터 자체가 반대이므로, 절대적인 오프셋 방향을 맞추기 위해 부호를 뒤집습니다.
            const pathOffset = isReverse ? -absoluteShift : absoluteShift;

            initialEdges.push({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.type,
              data: { ...e, pathOffset, edgeIndex: i, totalEdges: N, isReverse },
              type: 'floating',
              style: { strokeWidth: 2 },
            });
          });
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          initialNodes,
          initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setError(null);
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
      setEditFormData({ type: 'node', id: selectedNode.id, label: n.label || 'Node', name: n.name, aliases: (n.aliases || []).join(', '), status: n.test_status || 'Untested' });
    } else if (selectedEdge) {
      const e = selectedEdge.data as ApiEdge;
      setEditFormData({ type: 'edge', id: selectedEdge.id, edgeType: e.type, action: e.action || '', status: e.test_status || 'Untested' });
    } else if (isCreatingNode) {
      setEditFormData({ type: 'node', id: '', label: 'Screen', name: '', aliases: '', status: 'Untested' });
    } else {
      setEditFormData({});
    }
  }, [selectedNode, selectedEdge, isCreatingNode]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const isSelected = params.nodes.length > 0 || params.edges.length > 0;

    setSelectedNode(params.nodes.length === 1 ? params.nodes[0] : null);
    setSelectedEdge(params.edges.length === 1 ? params.edges[0] : null);
    if (isSelected) setIsCreatingNode(false);
  }, []);

  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    for (const n of deleted) {
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
          properties: {}
        },
        connectedEdges
      });
      await fetch(`/api/nodes/${n.id}`, { method: 'DELETE' });
    }
    // ReactFlow already removes node from local state via onNodesChange
    // Remove connected edges from local state
    const deletedIds = new Set(deleted.map(n => n.id));
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
          properties: {}
        }
      });
      await fetch(`/api/edges/${e.id}`, { method: 'DELETE' });
    }
    // ReactFlow already removes edges from local state via onEdgesChange
  }, [pushUndo]);

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    
    const payload = {
      source: connection.source,
      target: connection.target,
      type: "Transition",
      status: "Untested",
      properties: {}
    };
    
    try {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newEdgeId = await res.json();
      pushUndo({ type: 'CREATE_EDGE', id: newEdgeId });
      // Add edge to local state instead of re-fetching entire graph
      setEdges(eds => {
        const nextEds = [...eds, {
          id: newEdgeId,
          source: connection.source!,
          target: connection.target!,
          label: 'Transition',
          data: { type: 'Transition', test_status: 'Untested', properties: {} },
          style: { stroke: 'gray', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'gray' },
        }];
        const targetId = connection.target!;
        const newTargetStatus = recalculateTargetStatus(targetId, nextEds);
        setNodes(nds => nds.map(n => {
          if (n.id !== targetId || (n.data as any)?.test_status === newTargetStatus) return n;
          const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newTargetStatus.toLowerCase();
          return { ...n, data: { ...n.data, test_status: newTargetStatus }, className: cls.trim(), style: { ...(n.style || {}), backgroundColor: newTargetStatus === 'Passed' ? '#c8e6c9' : (newTargetStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } };
        }));
        return nextEds;
      });
    } catch (err) {
      console.error("Failed to create edge:", err);
    }
  }, [pushUndo, setEdges, setNodes]);

  
  const handleDelete = async () => {
    if (editFormData.type === "node") {
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
            properties: {}
          },
          connectedEdges
        });
      }
      await fetch(`/api/nodes/${editFormData.id}`, { method: "DELETE" }); 
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
            properties: {}
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
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        test_status: newStatus,
        properties: {}
      };
      if (isCreatingNode) {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const newId = await res.json();
        pushUndo({ type: 'CREATE_NODE', id: newId });
        setIsCreatingNode(false);
        triggerRefresh(); // New node needs layout
      } else {
        const node = nodes.find(n => n.id === editFormData.id);
        if (node) {
          pushUndo({
            type: 'UPDATE_NODE',
            id: node.id,
            previousData: {
              name: (node.data as any).name,
              aliases: (node.data as any).aliases || [],
              test_status: (node.data as any).test_status || 'Untested',
              properties: {}
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
        if (n.id !== editFormData.id) return n;
        // Update className: replace old status-xxx with new one
        const cls = (n.className || '').replace(/\bstatus-[a-z]+\b/g, '').trim() + ' status-' + newStatus.toLowerCase();
        return { ...n, data: { ...(n.data || {}), test_status: newStatus }, className: cls.trim(), style: { ...(n.style || {}), backgroundColor: newStatus === 'Passed' ? '#c8e6c9' : (newStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } };
      }));
    } else if (editFormData.type === 'edge') {
      const edge = edges.find(e => e.id === editFormData.id);
      if (!edge) return;
      
      pushUndo({
        type: 'UPDATE_EDGE',
        id: edge.id,
        previousData: {
          test_status: (edge.data as any)?.test_status || 'Untested',
          properties: {}
        }
      });
      const payload = {
        type: editFormData.edgeType,
        test_status: newStatus,
        properties: {}
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
          return { ...e, data: { ...(e.data || {}), test_status: newStatus }, className: cls.trim(), style: { ...(e.style || {}), stroke: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, markerEnd: { type: MarkerType.ArrowClosed, color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') } };
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
    }
    setEditFormData({ ...editFormData, status: newStatus });
  };

  const handleSave = async () => {
    if (editFormData.type === 'node') {
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean),
        test_status: editFormData.status,
        properties: {}
      };
      if (isCreatingNode) {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const newId = await res.json();
        pushUndo({ type: 'CREATE_NODE', id: newId });
        setIsCreatingNode(false);
        triggerRefresh(); // New node needs layout
      } else {
        const node = nodes.find(n => n.id === editFormData.id);
        if (node) {
          pushUndo({
            type: 'UPDATE_NODE',
            id: node.id,
            previousData: {
              name: (node.data as any).name,
              aliases: (node.data as any).aliases || [],
              test_status: (node.data as any).test_status || 'Untested',
              properties: {}
            }
          });
        }
        await fetch(`/api/nodes/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setNodes(nds => nds.map(n => n.id === editFormData.id ? { ...n, data: { ...n.data, label: editFormData.label, name: editFormData.name, aliases: payload.aliases } } : n));
      }
    } else if (editFormData.type === 'edge') {
      const edge = edges.find(e => e.id === editFormData.id);
      if (!edge) return;
      
      pushUndo({
        type: 'UPDATE_EDGE',
        id: edge.id,
        previousData: {
          test_status: (edge.data as any)?.test_status || 'Untested',
          properties: {}
        }
      });
      const payload = {
        type: editFormData.edgeType,
        action: editFormData.action,
        test_status: editFormData.status,
        properties: {}
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
    }
    // Don't triggerRefresh for edits — local state is already updated
    // triggerRefresh would re-run dagre layout and reset all dragged positions
  };


  useEffect(() => {
    const activeNodes = new Set();
    const relatedNodes = new Set();
    const incoming = new Set();
    const outgoing = new Set();
    const edgeHighlights = new Set();
    const relatedEdges = new Set();

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
        let cls = (n.className || '').replace(/\b(de-emphasized|active|related|highlight-[a-z-]+|status-[a-z-]+)\b/g, '').trim();
        const status = ((n.data as any)?.test_status || 'untested').toLowerCase();
        cls += ' status-' + status;

        if (activeNodes.has(n.id) || hoveredNode === n.id) {
          cls += ' active';
          if (outgoing.has(n.id)) cls += ' highlight-outgoing';
          if (incoming.has(n.id)) cls += ' highlight-incoming';
        } else if (relatedNodes.has(n.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || hoveredNode || hoveredEdge) {
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
        let cls = (e.className || '').replace(/\b(de-emphasized|active|related|highlight-edge|status-[a-z-]+)\b/g, '').trim();
        const status = ((e.data as any)?.test_status || 'untested').toLowerCase();
        cls += ' status-' + status;

        if (edgeHighlights.has(e.id) || hoveredEdge === e.id) {
          cls += ' active highlight-edge';
        } else if (relatedEdges.has(e.id)) {
          cls += ' related';
        } else if (selectedNode || selectedEdge || hoveredNode || hoveredEdge) {
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
  }, [selectedNode, selectedEdge, hoveredNode, hoveredEdge, maxDepth, edges]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.05}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        connectionMode={ConnectionMode.Loose}
        className={(selectedNode || selectedEdge || hoveredNode || hoveredEdge) ? 'has-selection' : ''}
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
                setIsCreatingNode(true);
              }}
            >
              Add Node
            </button>
            <button 
              style={{ padding: 8, cursor: 'pointer' }}
              title="선택된 노드만 또는 전체를 자동 정렬합니다"
              onClick={() => {
                const selectedNodes = nodes.filter(n => n.selected);
                if (selectedNodes.length >= 2) {
                  // Partial re-layout: selected nodes only
                  const selectedIds = new Set(selectedNodes.map(n => n.id));
                  const selectedEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target));
                  
                  // Remember original top-left position of selection
                  const minX = Math.min(...selectedNodes.map(n => n.position.x));
                  const minY = Math.min(...selectedNodes.map(n => n.position.y));
                  
                  // Run dagre on selected subset
                  const { nodes: layouted } = getLayoutedElements(selectedNodes, selectedEdges);
                  
                  // Calculate offset to keep group at original position
                  const newMinX = Math.min(...layouted.map(n => n.position.x));
                  const newMinY = Math.min(...layouted.map(n => n.position.y));
                  const offsetX = minX - newMinX;
                  const offsetY = minY - newMinY;
                  
                  // Build position map with offset applied
                  const posMap = new Map(layouted.map(n => [n.id, { x: n.position.x + offsetX, y: n.position.y + offsetY }]));
                  
                  // Update only selected nodes' positions
                  setNodes(nds => nds.map(n => posMap.has(n.id) ? { ...n, position: posMap.get(n.id)! } : n));
                } else {
                  // Full re-layout
                  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
                  setNodes(layoutedNodes);
                  setEdges(layoutedEdges);
                }
              }}
            >
              ⟳ Re-layout
            </button>
          </div>
        </Panel>

        <Panel position="top-right" className="metrics-panel details-panel glass-panel" style={{ pointerEvents: 'none', maxWidth: '320px', margin: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
            <div className="form-group">
              <label className="form-label">Filter Graph</label>
              <div className="metrics" style={{ marginBottom: '8px', fontSize: '0.85rem' }}>Passed Nodes: <span className="metrics-passed-count" style={{fontWeight: 'bold', color: 'var(--status-passed-text)'}}>{nodes.filter(n => (n.data as any).test_status === 'Passed').length}</span></div>
              <select
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              >
                <option value="">All aliases...</option>
                {aliases.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '6px' }}>Visibility Filter</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {['Screen', 'Component', 'TestCase', 'Data'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input type="checkbox" checked={visibleTypes.has(type)} onChange={e => {
                      const next = new Set(visibleTypes);
                      if (e.target.checked) next.add(type);
                      else next.delete(type);
                      setVisibleTypes(next);
                    }} />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="maxDepth" className="form-label">Max Depth</label>
              <input id="maxDepth" type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {(selectedNode || selectedEdge || isCreatingNode) && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>
                {isCreatingNode ? 'Add Node' : `Edit ${editFormData.type}`}
                {!isCreatingNode && <><span className="node-id" style={{display:'none'}}>{editFormData.id}</span><span className="node-label" style={{display:'none'}}>{editFormData.label}</span></>}
              </h3>
              
              {editFormData.type === 'node' && (
                <>
                  <div className="form-group"><label htmlFor="nodeLabel" className="form-label">Label:</label>
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
                  <div className="form-group"><label htmlFor="nodeName" className="form-label">Name:</label><input id="nodeName" type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} /></div>
                  <div className="form-group"><label htmlFor="nodeCategory" className="form-label">Node Category:</label><input id="nodeCategory" type="text" list="alias-suggestions" autoComplete="off" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} /></div>
                  <datalist id="alias-suggestions">
                    {aliases.map(a => <option key={a} value={a} />)}
                  </datalist>
                  {editFormData.aliases === "invalid_free_text" && <div className="validation-error" style={{color: 'red', fontSize: '0.8rem', marginTop: '-8px', marginBottom: '8px'}}>Invalid</div>}
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
                <label className="form-label">Status:</label>
                <div style={{display:"flex", gap:"8px", marginTop:"5px", flexWrap: 'wrap'}}>
                  <button className="success" onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button>
                  <button className="danger" onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button>
                  <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }}>Reset Status</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="danger" style={{flex: 1}} onClick={handleDelete}>Delete</button>
                <button className="primary" style={{flex: 1}} onClick={handleSave}>Save</button>
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
      
      {error && (
        <div className="error-toast glass-panel" style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'var(--status-failed-text)', background: 'var(--status-failed-bg)', border: '1px solid var(--status-failed-border)', zIndex: 50 }}>
          Error: {error}
        </div>
      )}
      
      {nodes.length === 0 && !loading && (
        <div className="empty-state-message glass-panel" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          No nodes found.
        </div>
      )}
      {loading && (
        <div data-testid="loading-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(248, 250, 252, 0.85)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
          <div className="glass-panel" style={{ fontWeight: '600', fontSize: '1.2rem', padding: '16px 32px' }}>
            Loading Graph...
          </div>
        </div>
      )}
    </div>
  );
}








