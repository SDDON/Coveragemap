import re

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find the start of the useMemo block for styledNodes
usememo_start = content.find("  const { styledNodes, styledEdges } = useMemo(() => {")
if usememo_start != -1:
    # Find the end of the useMemo block
    usememo_end = content.find("  }, [nodes, edges, selectedNode, selectedEdge, maxDepth]);") + len("  }, [nodes, edges, selectedNode, selectedEdge, maxDepth]);")
    
    usememo_code = content[usememo_start:usememo_end]
    
    # We will replace it with a useEffect that updates nodes and edges directly
    useeffect_code = """  useEffect(() => {
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

    setNodes(nds => {
      let changed = false;
      const next = nds.map(n => {
        let cls = (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\\b/g, '').trim();
        if (activeNodes.has(n.id)) {
          cls += ' active';
          if (outgoing.has(n.id)) cls += ' highlight-outgoing';
          if (incoming.has(n.id)) cls += ' highlight-incoming';
        } else if (selectedNode || selectedEdge) {
          cls += ' de-emphasized';
        }
        cls += ' status-' + ((n.data as any).test_status || 'untested').toLowerCase();
        cls = cls.trim();
        
        if (n.className !== cls) {
          changed = true;
          return { ...n, className: cls };
        }
        return n;
      });
      return changed ? next : nds;
    });

    setEdges(eds => {
      let changed = false;
      const next = eds.map(e => {
        let cls = (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z-]+)\\b/g, '').trim();
        if (edgeHighlights.has(e.id)) {
          cls += ' active highlight-edge';
        } else if (selectedNode || selectedEdge) {
          cls += ' de-emphasized';
        }
        cls += ' status-' + ((e.data as any)?.test_status || 'untested').toLowerCase();
        cls = cls.trim();
        
        if (e.className !== cls) {
          changed = true;
          return { ...e, className: cls };
        }
        return e;
      });
      return changed ? next : eds;
    });
  }, [selectedNode, selectedEdge, maxDepth, edges]);"""

    content = content.replace(usememo_code, useeffect_code)

# Now fix the ReactFlow props
content = content.replace("nodes={styledNodes}", "nodes={nodes}")
content = content.replace("edges={styledEdges}", "edges={edges}")

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Applied perfect rendering optimization to App.tsx")
