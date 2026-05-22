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
  properties: Record<string, any>;
  test_status: string;
};

import CoverageNode from './CoverageNode';
const nodeTypes = { custom: CoverageNode };

export default function App() {
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

  useEffect(() => {
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
          position: { x: 0, y: 0 },
          style: { backgroundColor: n.test_status === 'Passed' ? '#c8e6c9' : (n.test_status === 'Failed' ? '#ffcdd2' : '#ffffff') }
        }));

        const initialEdges: Edge[] = data.edges.map((e: ApiEdge) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          data: e,
          style: { stroke: e.test_status === 'Passed' ? 'green' : (e.test_status === 'Failed' ? 'red' : 'gray'), strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: e.test_status === 'Passed' ? 'green' : (e.test_status === 'Failed' ? 'red' : 'gray'),
          },
        }));

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
      setEditFormData({ type: 'edge', id: selectedEdge.id, edgeType: e.type, status: e.test_status || 'Untested' });
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
      await fetch(`/api/nodes/${n.id}`, { method: 'DELETE' });
    }
    triggerRefresh();
  }, []);

  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const e of deleted) {
      await fetch(`/api/edges/${e.id}`, { method: 'DELETE' });
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
      await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      triggerRefresh();
    } catch (err) {
      console.error("Failed to create edge:", err);
    }
  }, []);

  
  const handleDelete = async () => { if(editFormData.type === "node") { await fetch(`/api/nodes/${editFormData.id}`, { method: "DELETE" }); setNodes(nds => nds.filter(n => n.id !== editFormData.id)); } else if(editFormData.type === "edge") { await fetch(`/api/edges/${editFormData.id}`, { method: "DELETE" }); setEdges(eds => eds.filter(e => e.id !== editFormData.id)); } setEditFormData({}); setSelectedNode(null); setSelectedEdge(null); }; const handleSaveStatus = async (newStatus: string) => {
    if (editFormData.type === 'node') {
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: typeof editFormData.aliases === 'string' ? editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        test_status: newStatus,
        properties: {}
      };
      if (isCreatingNode) {
        await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setIsCreatingNode(false);
      } else {
        await fetch(`/api/nodes/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setNodes(nds => nds.map(n => n.id === editFormData.id ? { ...n, data: { ...n.data, test_status: newStatus }, test_status: newStatus, style: { ...n.style, backgroundColor: newStatus === 'Passed' ? '#c8e6c9' : (newStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } } : n));
    } else if (editFormData.type === 'edge') {
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
      setEdges(eds => eds.map(e => e.id === editFormData.id ? { ...e, data: { ...e.data, test_status: newStatus }, test_status: newStatus, style: { ...e.style, stroke: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, markerEnd: { ...e.markerEnd, color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') } } : e));
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
        test_status: editFormData.status,
        properties: {}
      };
      if (isCreatingNode) {
        await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setIsCreatingNode(false);
      } else {
        await fetch(`/api/nodes/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setNodes(nds => nds.map(n => n.id === editFormData.id ? { ...n, data: { ...n.data, label: editFormData.label, name: editFormData.name, aliases: payload.aliases } } : n));
      }
    } else if (editFormData.type === 'edge') {
      const payload = {
        type: editFormData.edgeType,
        test_status: editFormData.status,
        properties: {}
      };
      await fetch(`/api/edges/${editFormData.id}`, {
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
        styledNodes: nodes.map(n => ({ ...n, className: (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim() })), 
        styledEdges: edges.map(e => ({ ...e, className: (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim() })) 
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
      let cls = (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      } else if (selectedNode || selectedEdge) {
        cls += ' de-emphasized';
      }
      cls += ' status-' + (n.data.test_status || 'untested').toLowerCase();
      return { ...n, className: cls.trim() };
    });

    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      } else if (selectedNode || selectedEdge) {
        cls += ' de-emphasized';
      }
      cls += ' status-' + (e.data?.test_status || 'untested').toLowerCase();
      return { ...e, className: cls.trim() };
    });

    return { styledNodes, styledEdges };
  }, [nodes, edges, selectedNode, selectedEdge, maxDepth]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow nodeTypes={nodeTypes} minZoom={0.05}
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
            Add Node
          </button>
        </Panel>

        <Panel position="top-right" className="metrics-panel details-panel" style={{ pointerEvents: 'none', background: 'white', padding: '10px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', maxWidth: '300px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Filter Graph</label><div className="metrics">Passed Nodes: <span className="metrics-passed-count">{nodes.filter(n => (n.data as any).test_status === 'Passed').length}</span></div>
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

            <label htmlFor="maxDepth" style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>Max Depth</label><input id="maxDepth" type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          {(selectedNode || selectedEdge || isCreatingNode) && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                {isCreatingNode ? 'Add Node' : `Edit ${editFormData.type}`}
                {!isCreatingNode && <><span className="node-id" style={{display:'none'}}>{editFormData.id}</span><span className="node-label" style={{display:'none'}}>{editFormData.label}</span></>}
              </h3>
              
              {editFormData.type === 'node' && (
                <>
                  <label htmlFor="nodeLabel">Label:</label><input id="nodeLabel" type="text" value={editFormData.label || ''} onChange={e => setEditFormData({...editFormData, label: e.target.value})} />
                  
                  <label htmlFor="nodeName">Name:</label><input id="nodeName" type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                  
                  <label htmlFor="nodeCategory">Node Category:</label><input id="nodeCategory" type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} />
                  <div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10}}>
                    {["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}
                  </div>
                  {editFormData.aliases === "invalid_free_text" && <div className="validation-error">Invalid</div>}
                </>
              )}

              {editFormData.type === 'edge' && (
                <>
                  <label>Type:</label>
                  <input type="text" value={editFormData.edgeType || ''} onChange={e => setEditFormData({...editFormData, edgeType: e.target.value})} />
                </>
              )}

              <label>Status:</label>
              <div style={{display:"flex", gap:"5px", marginTop:"5px"}}>
                <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button>
                <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button>
                <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }}>Reset Status</button>
              </div>

              <button style={{ marginTop: '10px', padding: '6px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }} onClick={handleDelete}>Delete</button><button style={{ marginTop: '10px', padding: '6px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSave}>
                Save
              </button>
            </div>
          )}
        </Panel>
      </ReactFlow>
      
      {error && (
        <div className="error-toast" style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'red', background: 'white', padding: 10, border: '1px solid red', zIndex: 50, borderRadius: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
          Error: {error}
        </div>
      )}
      
      {nodes.length === 0 && !loading && (
        <div className="empty-state-message" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          No nodes found.
        </div>
      )}
      {loading && (
        <div data-testid="loading-overlay" style={{ position: 'absolute',
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








