import codecs

with codecs.open('frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

handle_save_orig = '''  const handleSave = async () => {
    if (editFormData.type === 'node') {'''

handle_save_new = '''  const handleSaveStatus = async (newStatus: string) => {
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
        await fetch(http://localhost:8001/api/nodes/, {
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
      await fetch(http://localhost:8001/api/edges/, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    setEditFormData({ ...editFormData, status: newStatus });
    triggerRefresh();
  };

  const handleSave = async () => {
    if (editFormData.type === 'node') {'''

content = content.replace(handle_save_orig, handle_save_new)

select_orig = '''            <label>Status:</label>
            <select value={editFormData.status || 'Untested'} onChange={e => setEditFormData({...editFormData, status: e.target.value})}>
              <option value="Untested">Untested</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
            </select>

            <button style={{ marginTop: '10px', padding: '6px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSave}>
              Save
            </button>'''

select_new = '''            <label>Status:</label>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Passed'); }}>Mark Passed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Failed'); }}>Mark Failed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Untested'); }}>Reset Status</button>
            </div>
            <button style={{ marginTop: '10px', padding: '6px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSave}>
              Save
            </button>'''

content = content.replace(select_orig, select_new)

# BFS Logic Replacement
bfs_orig = '''    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [filterText, maxDepth, setNodes, setEdges, refreshKey]);

  useEffect(() => {'''

bfs_new = '''    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [filterText, maxDepth, setNodes, setEdges, refreshKey]);

  const { styledNodes, styledEdges } = useMemo(() => {
    if (!hasSelection) {
      return {
        styledNodes: nodes.map(n => {
          let cls = n.className || '';
          cls = cls.replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
          return { ...n, className: cls };
        }),
        styledEdges: edges.map(e => {
          let cls = e.className || '';
          cls = cls.replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
          return { ...e, className: cls };
        })
      };
    }

    const activeNodes = new Set();
    const highlightOutgoing = new Set();
    const highlightIncoming = new Set();
    const activeEdges = new Set();

    if (selectedNode) {
      activeNodes.add(selectedNode.id);
      let currentOutgoing = [selectedNode.id];
      let currentIncoming = [selectedNode.id];
      for (let depth = 0; depth < maxDepth; depth++) {
        const nextOutgoing = [];
        for (const edge of edges) {
          if (currentOutgoing.includes(edge.source)) {
            nextOutgoing.push(edge.target);
            activeNodes.add(edge.target);
            highlightOutgoing.add(edge.target);
            activeEdges.add(edge.id);
          }
        }
        currentOutgoing = nextOutgoing;

        const nextIncoming = [];
        for (const edge of edges) {
          if (currentIncoming.includes(edge.target)) {
            nextIncoming.push(edge.source);
            activeNodes.add(edge.source);
            highlightIncoming.add(edge.source);
            activeEdges.add(edge.id);
          }
        }
        currentIncoming = nextIncoming;
      }
    } else if (selectedEdge) {
      activeNodes.add(selectedEdge.source);
      activeNodes.add(selectedEdge.target);
      activeEdges.add(selectedEdge.id);
    }

    return {
      styledNodes: nodes.map(n => {
        let cls = n.className || '';
        cls = cls.replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
        if (activeNodes.has(n.id)) {
          cls += ' active';
          if (highlightOutgoing.has(n.id)) cls += ' highlight-outgoing';
          if (highlightIncoming.has(n.id)) cls += ' highlight-incoming';
        }
        return { ...n, className: cls.trim() };
      }),
      styledEdges: edges.map(e => {
        let cls = e.className || '';
        cls = cls.replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
        if (activeEdges.has(e.id)) {
          cls += ' active highlight-edge';
        }
        return { ...e, className: cls.trim() };
      })
    };
  }, [nodes, edges, hasSelection, selectedNode, selectedEdge, maxDepth]);

  useEffect(() => {'''

content = content.replace(bfs_orig, bfs_new)

rf_orig = '''<ReactFlow
        nodes={nodes}
        edges={edges}'''

rf_new = '''<ReactFlow className={hasSelection ? 'has-selection' : ''}
        nodes={styledNodes}
        edges={styledEdges}'''

content = content.replace(rf_orig, rf_new)

with codecs.open('frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)

print("SUCCESS")
