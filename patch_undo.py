import re

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add useRef and useEffect for Undo
undo_hook = """
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
        await fetch(`/api/nodes/${action.id}`, { method: 'DELETE' });
      } else if (action.type === 'UPDATE_NODE') {
        await fetch(`/api/nodes/${action.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.previousData)
        });
      } else if (action.type === 'DELETE_NODE') {
        // Recreate node
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.nodeData)
        });
        const newId = await res.json();
        // Recreate edges with new ID
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
      } else if (action.type === 'CREATE_EDGE') {
        await fetch(`/api/edges/${action.id}`, { method: 'DELETE' });
      } else if (action.type === 'UPDATE_EDGE') {
        await fetch(`/api/edges/${action.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.previousData)
        });
      } else if (action.type === 'DELETE_EDGE') {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.edgeData)
        });
      }
      triggerRefresh();
    } catch (err) {
      console.error("Undo failed", err);
    }
  }, [triggerRefresh]);

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
"""

# Inject after const [loading, setLoading]
content = content.replace("  const [loading, setLoading] = useState(true);", "  const [loading, setLoading] = useState(true);\n" + undo_hook)


# 2. Update onNodesDelete
content = content.replace(
"""  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    for (const n of deleted) {
      await fetch(`/api/nodes/${n.id}`, { method: 'DELETE' });
    }
    triggerRefresh();
  }, []);""",
"""  const onNodesDelete = useCallback(async (deleted: Node[]) => {
    for (const n of deleted) {
      // Find connected edges
      setEdges(eds => {
        const connectedEdges = eds.filter(e => e.source === n.id || e.target === n.id);
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
        return eds;
      });
      await fetch(`/api/nodes/${n.id}`, { method: 'DELETE' });
    }
    triggerRefresh();
  }, [pushUndo]);"""
)

# 3. Update onEdgesDelete
content = content.replace(
"""  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const e of deleted) {
      await fetch(`/api/edges/${e.id}`, { method: 'DELETE' });
    }
    triggerRefresh();
  }, []);""",
"""  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
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
    triggerRefresh();
  }, [pushUndo]);"""
)

# 4. Update onConnect
content = content.replace(
"""      await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      triggerRefresh();""",
"""      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newEdgeId = await res.json();
      pushUndo({ type: 'CREATE_EDGE', id: newEdgeId });
      triggerRefresh();"""
)

# 5. Update handleDelete
content = content.replace(
"""  const handleDelete = async () => { if(editFormData.type === "node") { await fetch(`/api/nodes/${editFormData.id}`, { method: "DELETE" }); setNodes(nds => nds.filter(n => n.id !== editFormData.id)); } else if(editFormData.type === "edge") { await fetch(`/api/edges/${editFormData.id}`, { method: "DELETE" }); setEdges(eds => eds.filter(e => e.id !== editFormData.id)); } setEditFormData({}); setSelectedNode(null); setSelectedEdge(null); };""",
"""  const handleDelete = async () => {
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
      setEdges(eds => eds.filter(e => e.id !== editFormData.id)); 
    } 
    setEditFormData({}); 
    setSelectedNode(null); 
    setSelectedEdge(null);
    triggerRefresh();
  };"""
)

# 6. Update handleSaveStatus
content = content.replace(
"""  const handleSaveStatus = async (newStatus: string) => {
    if (editFormData.type === 'node') {
      const payload = {""",
"""  const handleSaveStatus = async (newStatus: string) => {
    if (editFormData.type === 'node') {
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
      const payload = {"""
)

content = content.replace(
"""    } else if (editFormData.type === 'edge') {
      const payload = {""",
"""    } else if (editFormData.type === 'edge') {
      const edge = edges.find(e => e.id === editFormData.id);
      if (edge) {
        pushUndo({
          type: 'UPDATE_EDGE',
          id: edge.id,
          previousData: {
            test_status: (edge.data as any)?.test_status || 'Untested',
            properties: {}
          }
        });
      }
      const payload = {"""
)

# 7. Update handleSave
content = content.replace(
"""        await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });""",
"""        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const newId = await res.json();
        pushUndo({ type: 'CREATE_NODE', id: newId });"""
)

content = content.replace(
"""        await fetch(`/api/nodes/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });""",
"""        const node = nodes.find(n => n.id === editFormData.id);
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
        });"""
)

content = content.replace(
"""        await fetch(`/api/edges/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });""",
"""        const edge = edges.find(e => e.id === editFormData.id);
        if (edge) {
          pushUndo({
            type: 'UPDATE_EDGE',
            id: edge.id,
            previousData: {
              type: edge.label || (edge.data as any)?.type || 'RELATED',
              test_status: (edge.data as any)?.test_status || 'Untested',
              properties: {}
            }
          });
        }
        await fetch(`/api/edges/${editFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });"""
)

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied Undo functionality to App.tsx")
