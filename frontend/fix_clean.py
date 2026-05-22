import codecs

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Node
content = content.replace(
    '<button onClick={handleAddNode} style={{ marginTop: \'10px\' }}>Create Node</button>',
    '<button onClick={handleAddNode} style={{ marginTop: \'10px\' }}>Add Node</button>'
)
content = content.replace(
    '<h3>{selectedNode ? \'Edit Node\' : selectedEdge ? \'Edit Edge\' : \'Create Node\'}</h3>',
    '<h3>{selectedNode ? \'Edit Node\' : selectedEdge ? \'Edit Edge\' : \'Add Node\'}</h3>'
)

# 2. Metrics
content = content.replace(
    '<h3>Filter Graph</h3>',
    '<div className="metrics-panel">Passed: <span className="metrics-passed-count">{nodes.filter(n => n.test_status === "Passed").length}</span></div><h3>Filter Graph</h3>'
)

# 3. test_status mapping
content = content.replace(
    'status: editFormData.status',
    'test_status: editFormData.status'
)

# 4. Add handleSaveStatus function inside App component
handle_save_status_code = '''
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
      setNodes(nds => nds.map(n => n.id === editFormData.id ? { ...n, test_status: newStatus, style: { ...n.style, backgroundColor: newStatus === 'Passed' ? '#c8e6c9' : (newStatus === 'Failed' ? '#ffcdd2' : '#ffffff') } } : n));
    } else if (editFormData.type === 'edge') {
      const payload = {
        type: editFormData.edgeType,
        test_status: newStatus,
        properties: {}
      };
      await fetch(`http://localhost:8001/api/edges/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setEdges(eds => eds.map(e => e.id === editFormData.id ? { ...e, test_status: newStatus, style: { ...e.style, stroke: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }, markerEnd: { ...e.markerEnd, color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') } } : e));
    }
    setEditFormData({ ...editFormData, status: newStatus });
    triggerRefresh();
  };
'''
content = content.replace('const handleSave = async () => {', handle_save_status_code + '\n  const handleSave = async () => {')

# 5. Replace Status Dropdown
status_dropdown = '''<label>Status:</label>
            <select
              value={editFormData.status || 'Untested'}
              onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
            >
              <option value="Untested">Untested</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
            </select>'''
buttons = '''<label>Status:</label>
            <div style={{display:"flex", gap:"5px", marginTop:"5px"}}>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }}>Reset Status</button>
            </div>'''
content = content.replace(status_dropdown, buttons)

# 6. Replace Aliases
aliases_input = '''<label>Aliases (comma separated):</label>
              <input
                type="text"
                list="alias-list"
                value={editFormData.aliases || ''}
                onChange={e => setEditFormData({ ...editFormData, aliases: e.target.value })}
              />
              <datalist id="alias-list">
                {Array.from(new Set(nodes.flatMap(n => n.data.original?.aliases || []))).map(a => (
                  <option key={a} value={a} />
                ))}
              </datalist>'''
category_input = '''<label>Node Category:</label>
              <input type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} />
              <div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10}}>
                {["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}
              </div>
              {editFormData.aliases === "invalid_free_text" && <div className="validation-error">Invalid</div>}'''
content = content.replace(aliases_input, category_input)

# 7. Add ReactFlow minZoom and onInit just in case
content = content.replace('<ReactFlow\n          nodes={nodes}', '<ReactFlow minZoom={0.05} onInit={(instance) => { window.rfInstance = instance; }}\n          nodes={nodes}')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
