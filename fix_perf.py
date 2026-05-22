import codecs
import re

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

# 1. Remove styledNodes useMemo block
usememo_pattern = re.compile(r'const \{ styledNodes, styledEdges \} = useMemo\(\(\) => \{.*?\n  \}, \[nodes, edges, hasSelection, selectedNode, selectedEdge, maxDepth\]\);', re.DOTALL)
content = usememo_pattern.sub('', content)

# 2. Add useEffect for BFS highlighting
bfs_effect = """
  useEffect(() => {
    if (!hasSelection) {
      setNodes(nds => nds.map(n => ({ ...n, className: (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim() })));
      setEdges(eds => eds.map(e => ({ ...e, className: (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim() })));
      return;
    }

    setNodes(nds => {
      const activeNodes = new Set<string>();
      const activeEdges = new Set<string>();
      const highlightIncoming = new Set<string>();
      const highlightOutgoing = new Set<string>();

      if (selectedNode) {
        activeNodes.add(selectedNode.id);
        
        let currentOutgoing = [selectedNode.id];
        for (let i = 0; i < maxDepth; i++) {
          const nextOutgoing: string[] = [];
          for (const edge of edges) {
            if (currentOutgoing.includes(edge.source)) {
              nextOutgoing.push(edge.target);
              activeNodes.add(edge.target);
              highlightOutgoing.add(edge.target);
              activeEdges.add(edge.id);
            }
          }
          currentOutgoing = nextOutgoing;
        }

        let currentIncoming = [selectedNode.id];
        for (let i = 0; i < maxDepth; i++) {
          const nextIncoming: string[] = [];
          for (const edge of edges) {
            if (currentIncoming.includes(edge.target)) {
              nextIncoming.push(edge.source);
              activeNodes.add(edge.source);
              highlightIncoming.add(edge.source);
              activeEdges.add(edge.id);
            }
          }
          currentIncoming = nextIncoming;
        }
      } else if (selectedEdge) {
        activeNodes.add(selectedEdge.source);
        activeNodes.add(selectedEdge.target);
        activeEdges.add(selectedEdge.id);
      }

      return nds.map(n => {
        let cls = n.className || '';
        cls = cls.replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();

        if (!activeNodes.has(n.id)) {
          cls += ' de-emphasized';
        } else {
          if (n.id === selectedNode?.id) {
            cls += ' active';
          } else if (highlightIncoming.has(n.id)) {
            cls += ' highlight-incoming';
          } else if (highlightOutgoing.has(n.id)) {
            cls += ' highlight-outgoing';
          } else if (selectedEdge && (n.id === selectedEdge.source || n.id === selectedEdge.target)) {
            cls += ' active';
          }
        }
        return { ...n, className: cls.trim() };
      });
    });

    setEdges(eds => eds.map(e => {
      let cls = e.className || '';
      cls = cls.replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();

      const isActive = selectedNode ? 
        (activeNodes.has(e.source) && activeNodes.has(e.target) && (e.source === selectedNode.id || e.target === selectedNode.id || (highlightOutgoing.has(e.source) && highlightOutgoing.has(e.target)) || (highlightIncoming.has(e.source) && highlightIncoming.has(e.target))))
        : (selectedEdge && e.id === selectedEdge.id);

      if (!isActive) {
        cls += ' de-emphasized';
      } else {
        if (selectedNode) {
          if (highlightIncoming.has(e.source) && (highlightIncoming.has(e.target) || e.target === selectedNode.id)) {
            cls += ' highlight-incoming';
          } else if (highlightOutgoing.has(e.target) && (highlightOutgoing.has(e.source) || e.source === selectedNode.id)) {
            cls += ' highlight-outgoing';
          }
        } else if (selectedEdge && e.id === selectedEdge.id) {
          cls += ' active';
        }
      }
      return { ...e, className: cls.trim() };
    }));
  }, [hasSelection, selectedNode, selectedEdge, maxDepth, edges]);
"""

# Insert bfs_effect before onSelectionChange
content = content.replace("const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {", bfs_effect + "\n\n  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {")

# 3. Change ReactFlow nodes={styledNodes} back to nodes={nodes}
content = content.replace("nodes={styledNodes}", "nodes={nodes}")
content = content.replace("edges={styledEdges}", "edges={edges}")

# Also I need to define activeNodes somewhere? No, it's inside the setState updater! But wait, edges updater needs activeNodes!
# So I should define them OUTSIDE setNodes and setEdges!
