import codecs

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

delete_btn = """{!isCreatingNode && <button style={{ marginTop: '10px', marginLeft: '5px', padding: '6px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={async () => {
                if (editFormData.type === 'node') {
                  await fetch(`http://localhost:8001/api/nodes/${editFormData.id}`, { method: 'DELETE' });
                } else {
                  await fetch(`http://localhost:8001/api/edges/${editFormData.id}`, { method: 'DELETE' });
                }
                setEditFormData({});
                setHasSelection(false);
                setSelectedNode(null);
                setSelectedEdge(null);
                triggerRefresh();
              }}>Delete</button>}"""

content = content.replace(">Save</button>", ">Save</button>\n              " + delete_btn)

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
