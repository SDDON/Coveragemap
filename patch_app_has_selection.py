import os

app_file = "frontend/src/App.tsx"
with open(app_file, "r", encoding="utf-8") as f:
    content = f.read()

old_early_return = '''    if (!selectedNode && !selectedEdge) {
      return { 
        styledNodes: nodes.map(n => ({ ...n, className: (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim() })), 
        styledEdges: edges.map(e => ({ ...e, className: (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim() })) 
      };
    }'''
new_early_return = '''    if (!selectedNode && !selectedEdge) {
      return { 
        styledNodes: nodes.map(n => {
          const cls = (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
          return cls === (n.className || '') ? n : { ...n, className: cls };
        }), 
        styledEdges: edges.map(e => {
          const cls = (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
          return cls === (e.className || '') ? e : { ...e, className: cls };
        })
      };
    }'''
content = content.replace(old_early_return, new_early_return)

old_styled_nodes = '''    const styledNodes = nodes.map(n => {
      let cls = (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      } else {
        cls += ' de-emphasized';
      }
      return { ...n, className: cls.trim() };
    });'''
new_styled_nodes = '''    const styledNodes = nodes.map(n => {
      let cls = (n.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      }
      cls = cls.trim();
      if (cls === (n.className || '')) return n;
      return { ...n, className: cls };
    });'''
content = content.replace(old_styled_nodes, new_styled_nodes)

old_styled_edges = '''    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      } else {
        cls += ' de-emphasized';
      }
      return { ...e, className: cls.trim() };
    });'''
new_styled_edges = '''    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\b(de-emphasized|active|highlight-[a-z-]+)\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      }
      cls = cls.trim();
      if (cls === (e.className || '')) return e;
      return { ...e, className: cls };
    });'''
content = content.replace(old_styled_edges, new_styled_edges)

old_react_flow = '''      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        
        fitView
      >'''
new_react_flow = '''      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        className={(selectedNode || selectedEdge) ? 'has-selection' : ''}
        fitView
      >'''
content = content.replace(old_react_flow, new_react_flow)

with open(app_file, "w", encoding="utf-8") as f:
    f.write(content)
