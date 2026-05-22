import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<button onClick={handleAddNode} style={{ marginTop: \'10px\' }}>Create Node</button>',
    '<button onClick={handleAddNode} style={{ marginTop: \'10px\' }}>Add Node</button>'
)

content = content.replace(
    "<h3>{selectedNode ? 'Edit Node' : selectedEdge ? 'Edit Edge' : 'Create Node'}</h3>",
    "<h3>{selectedNode ? 'Edit Node' : selectedEdge ? 'Edit Edge' : 'Add Node'}</h3>"
)

if '<div className="metrics-panel">' not in content:
    content = content.replace(
        '<h3>Filter Graph</h3>',
        '<div className="metrics-panel">Passed: <span className="metrics-passed-count">{nodes.filter(n => n.data && n.data.status === "Passed").length}</span></div><h3>Filter Graph</h3>'
    )

content = re.sub(
    r'<label>Status:</label>\s*<select.*?/select>',
    r'<label>Status:</label><div style={{display:"flex", gap:"5px", marginTop:"5px"}}><button onClick={(e) => { e.preventDefault(); setEditFormData({...editFormData, status: "Passed"}); }}>Mark Passed</button><button onClick={(e) => { e.preventDefault(); setEditFormData({...editFormData, status: "Failed"}); }}>Mark Failed</button><button onClick={(e) => { e.preventDefault(); setEditFormData({...editFormData, status: "Untested"}); }}>Reset Status</button></div>',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'<label>Aliases \(comma separated\):</label>\s*<input type="text" list="alias-list" .*?/>\s*<datalist id="alias-list">.*?</datalist>',
    r'<label>Node Category:</label><input type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} /><div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10}}>{["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}</div>{editFormData.aliases === "invalid_free_text" && <div className="validation-error">Invalid</div>}',
    content,
    flags=re.DOTALL
)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
