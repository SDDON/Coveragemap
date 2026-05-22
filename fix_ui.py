import codecs
import re
content = codecs.open('frontend/src/App.tsx', 'r', 'utf-8').read()

content = content.replace(
    '<button onClick={handleAddNode} style={{ marginTop: ''10px'' }}>Create Node</button>',
    '<button onClick={handleAddNode} style={{ marginTop: ''10px'' }}>Add Node</button>'
)

content = content.replace(
    '<h3>{selectedNode ? ''Edit Node'' : selectedEdge ? ''Edit Edge'' : ''Create Node''}</h3>',
    '<h3>{selectedNode ? ''Edit Node'' : selectedEdge ? ''Edit Edge'' : ''Add Node''}</h3>'
)

content = re.sub(
    r'<label>Status:</label>\s*<select.*?/select>',
    '<label>Status:</label><div style={{display:"flex", gap:"5px", marginTop:"5px"}}><button onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button><button onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button><button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }}>Reset Status</button></div>',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'<label>Aliases \(comma separated\):</label>\s*<input type="text" list="alias-list" .*?/>\s*<datalist id="alias-list">.*?</datalist>',
    '<label>Node Category:</label><input type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} /><div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10}}>{["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}</div>{editFormData.aliases === "invalid_free_text" && <div className="validation-error">Invalid</div>}',
    content,
    flags=re.DOTALL
)

codecs.open('frontend/src/App.tsx', 'w', 'utf-8').write(content)
