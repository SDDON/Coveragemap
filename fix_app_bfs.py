import codecs
import re

with codecs.open('frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

bfs_new = '''  return () => {
    clearTimeout(timerId);
    controller.abort();
  };
}, [filterText, maxDepth, setNodes, setEdges, refreshKey]);

const { styledNodes, styledEdges } = useMemo(() => {
  if (!hasSelection) {
    return {
      styledNodes: nodes.map(n => {
        let cls = n.className || '';
        cls = cls.replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();
        return { ...n, className: cls };
      }),
      styledEdges: edges.map(e => {
        let cls = e.className || '';
        cls = cls.replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();
        return { ...e, className: cls };
      })
    };
  }

  const activeNodes = new Set();
  const highlightOutgoing = new Set();
  const highlightIncoming = new Set();
  const activeEdges = new Set();

  if (selectedNode) {
    activeNodes.add(selectedNode.id);
    let currentOutgoing = [selectedNode.id];
    let currentIncoming = [selectedNode.id];
    for (let depth = 0; depth < maxDepth; depth++) {
      const nextOutgoing = [];
      for (const edge of edges) {
        if (currentOutgoing.includes(edge.source)) {
          nextOutgoing.push(edge.target);
          activeNodes.add(edge.target);
          highlightOutgoing.add(edge.target);
          activeEdges.add(edge.id);
        }
      }
      currentOutgoing = nextOutgoing;

      const nextIncoming = [];
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

  return {
    styledNodes: nodes.map(n => {
      let cls = n.className || '';
      cls = cls.replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();
      if (activeNodes.has(n.id)) {
        cls += ' active';
        if (highlightOutgoing.has(n.id)) cls += ' highlight-outgoing';
        if (highlightIncoming.has(n.id)) cls += ' highlight-incoming';
      } else {
        cls += ' de-emphasized';
      }
      return { ...n, className: cls.trim() };
    }),
    styledEdges: edges.map(e => {
      let cls = e.className || '';
      cls = cls.replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();
      if (activeEdges.has(e.id)) {
        cls += ' active highlight-edge';
      } else {
        cls += ' de-emphasized';
      }
      return { ...e, className: cls.trim() };
    })
  };
}, [nodes, edges, hasSelection, selectedNode, selectedEdge, maxDepth]);

useEffect(() => {'''

content = re.sub(r'\s*return \(\) => \{\s*clearTimeout\(timerId\);\s*controller\.abort\(\);\s*\};\s*\}, \[filterText, maxDepth, setNodes, setEdges, refreshKey\]\);\s*useEffect\(\(\) => \{', '\\n' + bfs_new, content)

content = content.replace('nodes={nodes}', 'nodes={styledNodes}').replace('edges={edges}', 'edges={styledEdges}')
content = content.replace('<ReactFlow', '<ReactFlow minZoom={0.05} onInit={(instance) => { window.rfInstance = instance; }} className={hasSelection ? "has-selection" : ""}')

with codecs.open('frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)

print("SUCCESS")
