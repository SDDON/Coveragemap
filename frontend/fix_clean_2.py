import codecs

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

status_target = """              <label>Status:</label>
              <select value={editFormData.status || 'Untested'} onChange={e => setEditFormData({...editFormData, status: e.target.value})}>
                <option value="Untested">Untested</option>
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
              </select>"""

status_replace = """              <label>Status:</label>
              <div style={{display:"flex", gap:"5px", marginTop:"5px"}}>
                <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Passed"); }}>Mark Passed</button>
                <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Failed"); }}>Mark Failed</button>
                <button onClick={(e) => { e.preventDefault(); handleSaveStatus("Untested"); }}>Reset Status</button>
              </div>"""

content = content.replace(status_target, status_replace)

alias_target = """                  <label>Aliases (comma separated):</label>
                  <input type="text" list="alias-list" value={editFormData.aliases || ''} onChange={e => setEditFormData({...editFormData, aliases: e.target.value})} />"""

alias_replace = """                  <label>Node Category:</label>
                  <input type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} />
                  <div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10}}>
                    {["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}
                  </div>
                  {editFormData.aliases === "invalid_free_text" && <div className="validation-error">Invalid</div>}"""

content = content.replace(alias_target, alias_replace)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
