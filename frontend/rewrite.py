import json
import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace("import { getLayoutedElements } from './layout';", "import { getLayoutedElements } from './layout';\nimport { enqueueSyncOperation, syncWithBackend, getSyncQueue } from './syncManager';")

# Add state
state_code = '''
  const [syncStatus, setSyncStatus] = useState<string>('Saved');
  const [pendingCount, setPendingCount] = useState<number>(0);
'''
content = content.replace("const [refreshKey, setRefreshKey] = useState(0);", "const [refreshKey, setRefreshKey] = useState(0);\n" + state_code)

# Add useEffect for sync
sync_effect = '''
  useEffect(() => {
    const updateQueueSize = () => {
      setPendingCount(getSyncQueue().length);
    };
    const timer1 = setInterval(updateQueueSize, 1000);
    const timer2 = setInterval(async () => {
      const q = getSyncQueue();
      if (q.length > 0) {
        setSyncStatus('Syncing...');
        const success = await syncWithBackend('http://localhost:8001');
        if (success) {
          setSyncStatus('Saved');
          setPendingCount(0);
        } else {
          setSyncStatus('Sync Failed');
        }
      }
    }, 10000);
    updateQueueSize();
    return () => { clearInterval(timer1); clearInterval(timer2); };
  }, []);
'''
content = content.replace("const triggerRefresh = () => setRefreshKey(k => k + 1);", "const triggerRefresh = () => setRefreshKey(k => k + 1);\n" + sync_effect)

# Replace onNodesDelete
nodes_delete_re = re.compile(r'const onNodesDelete = useCallback\(async \(deleted: Node\[\]\) => \{[\s\S]*?\}, \[\]\);')
nodes_delete_new = '''const onNodesDelete = useCallback((deleted: Node[]) => {
    for (const n of deleted) {
      enqueueSyncOperation({ type: 'node', action: 'delete', id: n.id });
    }
  }, []);'''
content = nodes_delete_re.sub(nodes_delete_new, content)

# Replace onEdgesDelete
edges_delete_re = re.compile(r'const onEdgesDelete = useCallback\(async \(deleted: Edge\[\]\) => \{[\s\S]*?\}, \[\]\);')
edges_delete_new = '''const onEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const e of deleted) {
      enqueueSyncOperation({ type: 'edge', action: 'delete', id: e.id });
    }
  }, []);'''
content = edges_delete_re.sub(edges_delete_new, content)

# Replace onConnect
connect_re = re.compile(r'const onConnect = useCallback\(async \(connection: Connection\) => \{[\s\S]*?\}, \[\]\);')
connect_new = '''const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const payload = { source: connection.source, target: connection.target, type: "Transition", status: "Untested", properties: {} };
    const newEdgeId = 	mp-edge-;
    const newEdge: Edge = { id: newEdgeId, source: connection.source, target: connection.target, data: payload };
    setEdges(eds => [...eds, newEdge]);
    enqueueSyncOperation({ type: 'edge', action: 'create', temp_id: newEdgeId, data: payload });
  }, [setEdges]);'''
content = connect_re.sub(connect_new, content)

# Replace handleSave
save_re = re.compile(r'const handleSave = async \(\) => \{[\s\S]*?triggerRefresh\(\);\n  \};')
save_new = '''const handleSave = async () => {
    if (editFormData.type === 'node') {
      const payload = {
        label: editFormData.label,
        name: editFormData.name,
        aliases: editFormData.aliases.split(',').map((s: string) => s.trim()).filter(Boolean),
        status: editFormData.status,
        properties: {}
      };
      if (isCreatingNode) {
        const newNodeId = 	mp-node-;
        const newNode: Node = {
          id: newNodeId,
          position: { x: 0, y: 0 },
          data: payload,
          style: { backgroundColor: payload.status === 'Passed' ? '#c8e6c9' : (payload.status === 'Failed' ? '#ffcdd2' : '#ffffff') }
        };
        setNodes(nds => [...nds, newNode]);
        enqueueSyncOperation({ type: 'node', action: 'create', temp_id: newNodeId, data: payload });
        setIsCreatingNode(false);
      } else {
        setNodes(nds => nds.map(n => {
          if (n.id === editFormData.id) {
            return {
              ...n,
              data: { ...n.data, ...payload },
              style: { backgroundColor: payload.status === 'Passed' ? '#c8e6c9' : (payload.status === 'Failed' ? '#ffcdd2' : '#ffffff') }
            };
          }
          return n;
        }));
        enqueueSyncOperation({ type: 'node', action: 'update', id: editFormData.id, data: payload });
      }
    } else if (editFormData.type === 'edge') {
      const payload = {
        type: editFormData.edgeType,
        status: editFormData.status,
        properties: {}
      };
      setEdges(eds => eds.map(e => {
        if (e.id === editFormData.id) {
          return { ...e, data: { ...e.data, ...payload } };
        }
        return e;
      }));
      enqueueSyncOperation({ type: 'edge', action: 'update', id: editFormData.id, data: payload });
    }
  };'''
content = save_re.sub(save_new, content)

# Add Sync status UI
ui_re = re.compile(r'(<Panel position="top-left">[\s\S]*?<button[\s\S]*?Create Node\n\s*</button>)')
ui_new = r'\1\n          <div style={{ marginTop: 10, padding: 8, background: "#fff", borderRadius: 4, fontSize: 12 }}>\n            Sync: {syncStatus} {pendingCount > 0 && ( pending)}\n            <button onClick={() => syncWithBackend("http://localhost:8001")} style={{ marginLeft: 8 }}>Sync Now</button>\n          </div>'
content = ui_re.sub(ui_new, content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

