import re

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix lag for styledNodes
content = content.replace(
"""    const styledNodes = nodes.map(n => {
      let cls = (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      } else if (selectedNode || selectedEdge) {
        cls += ' de-emphasized';
      }
      cls += ' status-' + (n.data.test_status || 'untested').toLowerCase();
      return { ...n, className: cls.trim() };
    });""",
"""    const styledNodes = nodes.map(n => {
      let cls = (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      } else if (selectedNode || selectedEdge) {
        cls += ' de-emphasized';
      }
      cls += ' status-' + (n.data.test_status || 'untested').toLowerCase();
      cls = cls.trim();
      
      if (n.className === cls) {
        return n; // Preserve object reference to prevent re-rendering and fix drag lag
      }
      return { ...n, className: cls };
    });"""
)

# Fix lag for styledEdges
content = content.replace(
"""    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      } else if (selectedNode || selectedEdge) {
        cls += ' de-emphasized';
      }
      cls += ' status-' + (e.data?.test_status || 'untested').toLowerCase();
      return { ...e, className: cls.trim() };
    });""",
"""    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      } else if (selectedNode || selectedEdge) {
        cls += ' de-emphasized';
      }
      cls += ' status-' + (e.data?.test_status || 'untested').toLowerCase();
      cls = cls.trim();
      
      if (e.className === cls) {
        return e; // Preserve object reference
      }
      return { ...e, className: cls };
    });"""
)

# Add deleteKeyCode
content = content.replace(
"""        <ReactFlow nodeTypes={nodeTypes} minZoom={0.05}
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          fitView
        >""",
"""        <ReactFlow nodeTypes={nodeTypes} minZoom={0.05}
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
        >"""
)

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied lag fix and Del key support to App.tsx")
