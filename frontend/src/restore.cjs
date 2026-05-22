const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const useMemoCode = \
  const { styledNodes, styledEdges } = useMemo(() => {
    if (!selectedNode && !selectedEdge) {
      return { 
        styledNodes: nodes.map(n => ({ ...n, className: (n.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim() })), 
        styledEdges: edges.map(e => ({ ...e, className: (e.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim() })) 
      };
    }

    const activeNodes = new Set();
    const incoming = new Set();
    const outgoing = new Set();
    const edgeHighlights = new Set();

    if (selectedNode) {
      activeNodes.add(selectedNode.id);

      let queue = [{ id: selectedNode.id, depth: 0 }];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        const id = item.id;
        const depth = item.depth;
        if (depth >= maxDepth) continue;

        const outEdges = edges.filter(e => e.source === id);
        for (const edge of outEdges) {
          edgeHighlights.add(edge.id);
          if (!outgoing.has(edge.target)) {
            outgoing.add(edge.target);
            activeNodes.add(edge.target);
            queue.push({ id: edge.target, depth: depth + 1 });
          }
        }
      }

      queue = [{ id: selectedNode.id, depth: 0 }];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        const id = item.id;
        const depth = item.depth;
        if (depth >= maxDepth) continue;

        const inEdges = edges.filter(e => e.target === id);
        for (const edge of inEdges) {
          edgeHighlights.add(edge.id);
          if (!incoming.has(edge.source)) {
            incoming.add(edge.source);
            activeNodes.add(edge.source);
            queue.push({ id: edge.source, depth: depth + 1 });
          }
        }
      }
    } else if (selectedEdge) {
      edgeHighlights.add(selectedEdge.id);
      activeNodes.add(selectedEdge.source);
      activeNodes.add(selectedEdge.target);
    }

    const styledNodes = nodes.map(n => {
      let cls = (n.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (outgoing.has(n.id)) cls += ' highlight-outgoing';
        if (incoming.has(n.id)) cls += ' highlight-incoming';
      }
      return { ...n, className: cls.trim() };
    });

    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      }
      return { ...e, className: cls.trim() };
    });

    return { styledNodes, styledEdges };
  }, [nodes, edges, selectedNode, selectedEdge, maxDepth]);

  return (
\;

code = code.replace(/return\s*\(\s*<div style=\{\{ width: '100vw'/g, useMemoCode + "    <div style={{ width: '100vw'");

code = code.replace("nodes={nodes}", "nodes={styledNodes}");
code = code.replace("edges={edges}", "edges={styledEdges}");
code = code.replace("className={hasSelection ? 'has-selection' : ''}", "className={(selectedNode || selectedEdge) ? 'has-selection' : ''}");

if (!code.includes("useMemo(")) {
  code = code.replace("useState, useCallback", "useState, useCallback, useMemo");
}

fs.writeFileSync('App.tsx', code);
console.log('App.tsx restored styledNodes');
