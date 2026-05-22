import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'<label>Aliases \(comma separated\):</label>\s*<input type="text" list="alias-list" .*?/>',
    r'<label>Node Category:</label><input type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} /><div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10}}>{["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}</div>{editFormData.aliases === "invalid_free_text" && <div className="validation-error">Invalid</div>}',
    content,
    flags=re.DOTALL
)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
