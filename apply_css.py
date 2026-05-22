import re

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace Add Node button panel
content = content.replace(
"""        <Panel position="top-left" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => {
              setEditFormData({ type: 'node', label: 'NewNode', name: 'New Node', aliases: '' });
              setIsCreatingNode(true);
            }}
            style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          >
            Add Node
          </button>
        </Panel>""",
"""        <Panel position="top-left" style={{ pointerEvents: 'auto', padding: '20px' }}>
          <button
            className="primary"
            onClick={() => {
              setEditFormData({ type: 'node', label: 'NewNode', name: 'New Node', aliases: '' });
              setIsCreatingNode(true);
            }}
            style={{ boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}
          >
            + Add Node
          </button>
        </Panel>"""
)

# Replace Metrics & Config Panel
content = content.replace(
"""        <Panel position="top-right" className="metrics-panel details-panel" style={{ pointerEvents: 'none', background: 'white', padding: '10px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', maxWidth: '300px' }}>
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
          </div>""",
"""        <Panel position="top-right" className="metrics-panel details-panel glass-panel" style={{ pointerEvents: 'none', maxWidth: '320px', margin: '20px' }}>
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
              <label htmlFor="maxDepth" className="form-label">Max Depth</label>
              <input id="maxDepth" type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>"""
)

# Replace Edit Panel body
content = content.replace(
"""          {(selectedNode || selectedEdge || isCreatingNode) && (
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
          )}""",
"""          {(selectedNode || selectedEdge || isCreatingNode) && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>
                {isCreatingNode ? 'Add Node' : `Edit ${editFormData.type}`}
                {!isCreatingNode && <><span className="node-id" style={{display:'none'}}>{editFormData.id}</span><span className="node-label" style={{display:'none'}}>{editFormData.label}</span></>}
              </h3>
              
              {editFormData.type === 'node' && (
                <>
                  <div className="form-group"><label htmlFor="nodeLabel" className="form-label">Label:</label><input id="nodeLabel" type="text" value={editFormData.label || ''} onChange={e => setEditFormData({...editFormData, label: e.target.value})} /></div>
                  <div className="form-group"><label htmlFor="nodeName" className="form-label">Name:</label><input id="nodeName" type="text" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} /></div>
                  <div className="form-group"><label htmlFor="nodeCategory" className="form-label">Node Category:</label><input id="nodeCategory" type="text" value={editFormData.aliases || ""} onChange={e => {setEditFormData({...editFormData, aliases: e.target.value});}} /></div>
                  <div className="autocomplete-suggestions" style={{position:"absolute", background:"white", zIndex:10, border: '1px solid var(--node-border)', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
                    {["synonym", "valid_category"].map(s => <div key={s} className="autocomplete-suggestion" style={{padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem'}} onClick={() => setEditFormData({...editFormData, aliases: s})}>{s}</div>)}
                  </div>
                  {editFormData.aliases === "invalid_free_text" && <div className="validation-error" style={{color: 'red', fontSize: '0.8rem', marginTop: '-8px', marginBottom: '8px'}}>Invalid</div>}
                </>
              )}

              {editFormData.type === 'edge' && (
                <div className="form-group">
                  <label className="form-label">Type:</label>
                  <input type="text" value={editFormData.edgeType || ''} onChange={e => setEditFormData({...editFormData, edgeType: e.target.value})} />
                </div>
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
          )}"""
)

# Replace Overlays
content = content.replace(
"""      {error && (
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
      )}""",
"""      {error && (
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
        <div data-testid="loading-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(248, 250, 252, 0.7)', backdropFilter: 'blur(4px)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
          <div className="glass-panel" style={{ fontWeight: '600', fontSize: '1.2rem', padding: '16px 32px' }}>
            Loading Graph...
          </div>
        </div>
      )}"""
)

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied CSS classes to App.tsx")
