import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from '@xyflow/react';
import { getLayoutedElements } from './layout';
import CoverageNode from './CoverageNode';

type ApiNode = {
  id: string;
  label: string;
  name: string;
  aliases: string[];
  properties: Record<string, any>;
  status: string;
};

type ApiEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
  status: string;
};

export default function App() {
  const nodeTypes = useMemo(() => ({ coverage: CoverageNode }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [maxDepth, setMaxDepth] = useState<number>(1);
  const [filterText, setFilterText] = useState<string>('');
  const [aliases, setAliases] = useState<string[]>([]);

  const triggerRefresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const fetchAliases = async () => {
      try {
        const res = await fetch('http://localhost:8001/api/aliases');
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

  useEffect(() => {
    const controller = new AbortController();
    const currentDebounceId = Date.now().toString();

    const fetchGraph = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterText) params.append('filter', filterText);
        params.append('max_depth', maxDepth.toString());
        params.append('debounce_id', currentDebounceId);

        const res = await fetch(`http://localhost:8001/api/graph?${params.toString()}`, {
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
type: 'coverage',
          data: n,
          position: { x: 0, y: 0 },
          style: { backgroundColor: n.status === 'Passed' ? '#c8e6c9' : (n.status === 'Failed' ? '#ffcdd2' : '#ffffff') }
        }));

        const initialEdges: Edge[] = data.edges.map((e: ApiEdge) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          data: e,
          style: { stroke: e.status === 'Passed' ? 'green' : (e.status === 'Failed' ? 'red' : 'gray'), strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: e.status === 'Passed' ? 'green' : (e.status === 'Failed' ? 'red' : 'gray'),
          },
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          initialNodes,
          initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setError(null);
setTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 0, padding: 0.1 }); }, 50);
} catch (err: any) {
        if (err.name === 'AbortError') return;
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
      setEditFormData({ type: 'node', id: selectedNode.id, label: n.label || 'Node', name: n.name, aliases: (n.aliases || []).join(', '), status: n.status || 'Untested' });
    } else if (selectedEdge) {
      const e = selectedEdge.data as ApiEdge;
      setEditFormData({ type: 'edge', id: selectedEdge.id, edgeType: e.type, status: e.status || 'Untested' });
    } else if (isCreatingNode) {
      setEditFormData({ type: 'node', id: '', label: 'Node', name: '', aliases: '', status: 'Untested' });
    } else {
      setEditFormData({});
    }
  }, [selectedNode, selectedEdge, isCreatingNode]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const isSelected = params.nodes.length > 0 || params.edges.length > 0;
    setHasSelection(isSelected);
    setSelectedNode(params.nodes.length === 1 ? params.nodes[0] : null);
    setSelectedEdge(params.edges.length === 1 ? params.edges[0] : null);
    if (isSelected) setIsCreatingNode(false);
  }, []);

  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    for (const n of deleted) {
      await fetch(`http://localhost:8001/api/nodes/${n.id}`, { method: 'DELETE' });
    }
    triggerRefresh();
  }, []);

  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const e of deleted) {
      await fetch(`http://localhost:8001/api/edges/${e.id}`, { method: 'DELETE' });
    }
    triggerRefresh();
  }, []);

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
      await fetch('http://localhost:8001/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      triggerRefresh();
    } catch (err) {
      console.error("Failed to create edge:", err);
    }
  }, []);

  const handleSaveStatus = async (newStatus: string) => {
    if (editFormData.type === 'node') {
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        status: newStatus,
        properties: {}
      };
      if (isCreatingNode) {
        await fetch('http://localhost:8001/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setIsCreatingNode(false);
      } else {
        await fetch(http://localhost:8001/api/nodes/${editFormData.id}, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } else if (editFormData.type === 'edge') {
      const payload = {
        type: editFormData.edgeType,
        status: newStatus,
        properties: {}
      };
      await fetch(http://localhost:8001/api/edges/${editFormData.id}, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    setEditFormData({ ...editFormData, status: newStatus });
    triggerRefresh();
  };

  const handleSave = async () => {
    if (editFormData.type === 'node') {
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean),
        status: editFormData.status,
        properties: {}
      };
      if (isCreatingNode) {
        await fetch('http://localhost:8001/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setIsCreatingNode(false);
      } else {
        await fetch(`http://localhost:8001/api/nodes/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } else if (editFormData.type === 'edge') {
      const payload = {
        type: editFormData.edgeType,
        status: editFormData.status,
        properties: {}
      };
      await fetch(`http://localhost:8001/api/edges/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    triggerRefresh();
  };


  const { styledNodes, styledEdges } = useMemo(() => {
    if (!selectedNode && !selectedEdge) {
      return { 
        styledNodes: nodes.map(n => ({ ...n, className: ((n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\b/g, '').trim() + ' status-' + ((n.data && n.data.status) ? n.data.status.toLowerCase() : 'untested')).trim() })), 
        styledEdges: edges.map(e => ({ ...e, className: ((e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\b/g, '').trim() + ' status-' + ((e.status) ? e.status.toLowerCase() : 'untested')).trim() })) 
      };
    }

    const activeNodes = new Set();
    const incoming = new Set();
    const outgoing = new Set();
    const edgeHighlights = new Set();

    if (selectedNode) {
      activeNodes.add(selectedNode.id);

      let queue = [{ id: selectedNode.id, depth: 0 }];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        const id = item.id;
        const depth = item.depth;
        if (depth >= maxDepth) continue;

        const outEdges = edges.filter(e => e.source === id);
        for (const edge of outEdges) {
          edgeHighlights.add(edge.id);
          if (!outgoing.has(edge.target)) {
            outgoing.add(edge.target);
            activeNodes.add(edge.target);
            queue.push({ id: edge.target, depth: depth + 1 });
          }
        }
      }

      queue = [{ id: selectedNode.id, depth: 0 }];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        const id = item.id;
        const depth = item.depth;
        if (depth >= maxDepth) continue;

        const inEdges = edges.filter(e => e.target === id);
        for (const edge of inEdges) {
          edgeHighlights.add(edge.id);
          if (!incoming.has(edge.source)) {
            incoming.add(edge.source);
            activeNodes.add(edge.source);
            queue.push({ id: edge.source, depth: depth + 1 });
          }
        }
      }
    } else if (selectedEdge) {
      edgeHighlights.add(selectedEdge.id);
      activeNodes.add(selectedEdge.source);
      activeNodes.add(selectedEdge.target);
    }

    const styledNodes = nodes.map(n => {
      let cls = (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\b/g, '').trim(); cls += ' status-' + ((n.data && n.data.status) ? n.data.status.toLowerCase() : 'untested');
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      } else {
        cls += ' de-emphasized';
      }
      return { ...n, className: cls.trim() };
    });

    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\b/g, '').trim(); cls += ' status-' + ((e.status) ? e.status.toLowerCase() : 'untested');
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      } else {
        cls += ' de-emphasized';
      }
      return { ...e, className: cls.trim() };
    });

    return { styledNodes, styledEdges };
  }, [nodes, edges, selectedNode, selectedEdge, maxDepth]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow minZoom={0.05}
        nodeTypes={nodeTypes} onInit={(instance) => { window.rfInstance = instance; }} 
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        className={(selectedNode || selectedEdge) ? 'has-selection' : ''}
        fitView
      >
        <Controls />
        <Background />
        
        <Panel position="top-left">
          {error && <div className="error-toast" style={{ color: 'red', background: 'white', padding: 5, border: '1px solid red' }}>Error: {error}</div>}
          <button 
            style={{ marginTop: 10, padding: 8, cursor: 'pointer' }}
            onClick={() => {
              setHasSelection(false);
              setSelectedNode(null);
              setSelectedEdge(null);
              setIsCreatingNode(true);
            }}
          >
            Create Node
          </button>
        </Panel>

        <Panel position="top-right" style={{ background: 'white', padding: '10px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', maxWidth: '300px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Filter Graph</label>
            <select
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">All aliases...</option>
              {aliases.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <label style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>Max Depth</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          {(selectedNode || selectedEdge || isCreatingNode) && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                {isCreatingNode ? 'Create Node' : `Edit ${editFormData.type}`}
              </h3>
              
              {editFormData.type === 'node' && (
                <>
                  <label>Label:</label>
                  <input type="text" value={editFormData.label || ''} onChange={e => setEditFormData({...editFormData, label: e.target.value})} />
                  
                  <label>Name:</label>
                  <input type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                  
                  <label>Aliases (comma separated):</label>
                  <input type="text" list="alias-list" value={editFormData.aliases || ''} onChange={e => setEditFormData({...editFormData, aliases: e.target.value})} />
                </>
              )}

              {editFormData.type === 'edge' && (
                <>
                  <label>Type:</label>
                  <input type="text" value={editFormData.edgeType || ''} onChange={e => setEditFormData({...editFormData, edgeType: e.target.value})} />
                </>
              )}

              <label>Status:</label><div style={{display:"flex", gap:"5px", marginTop:"5px"}}><button onClick={(e) => { e.preventDefault(); setEditFormData({...editFormData, status: "Passed"}); }}>Mark Passed</button><button onClick={(e) => { e.preventDefault(); setEditFormData({...editFormData, status: "Failed"}); }}>Mark Failed</button><button onClick={(e) => { e.preventDefault(); setEditFormData({...editFormData, status: "Untested"}); }}>Reset Status</button></div>
              <select value={editFormData.status || 'Untested'} onChange={e => setEditFormData({...editFormData, status: e.target.value})}>
                <option value="Untested">Untested</option>
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
              </select>

              <button style={{ marginTop: '10px', padding: '6px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSave}>
                Save
              </button>
            </div>
          )}
        </Panel>
      </ReactFlow>
      
      {loading && (
        <div data-testid="loading-overlay" style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            fontWeight: 'bold'
          }}>
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}









