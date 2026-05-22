import re

with open('App_original.tsx', 'r', encoding='utf-16') as f:
    content = f.read()

use_memo_code = '''
  const { styledNodes, styledEdges } = useMemo(() => {
    if (!selectedNode && !selectedEdge) {
      return { 
        styledNodes: nodes.map(n => ({ ...n, className: (n.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim() })), 
        styledEdges: edges.map(e => ({ ...e, className: (e.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim() })) 
      };
    }

    const activeNodes = new Set<string>();
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    const edgeHighlights = new Set<string>();

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
      } else {
        cls += ' de-emphasized';
      }
      return { ...n, className: cls.trim() };
    });

    const styledEdges = edges.map(e => {
      let cls = (e.className || '').replace(/\\\\b(de-emphasized|active|highlight-[a-z-]+)\\\\b/g, '').trim();
      if (edgeHighlights.has(e.id)) {
        cls += ' active highlight-edge';
      } else {
        cls += ' de-emphasized';
      }
      return { ...e, className: cls.trim() };
    });

    return { styledNodes, styledEdges };
  }, [nodes, edges, selectedNode, selectedEdge, maxDepth]);

  return (
    <div'''

content = re.sub(r'([ \t]*)return\s*\(\s*<div', use_memo_code, content, count=1)

content = content.replace('nodes={nodes}', 'nodes={styledNodes}')
content = content.replace('edges={edges}', 'edges={styledEdges}')
content = content.replace("className={hasSelection ? 'has-selection' : ''}", "")

datalist_code = '''
            <datalist id="alias-list">
              {aliases.map(a => <option key={a} value={a} />)}
            </datalist>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Filter Graph</label>
'''
content = content.replace("<label style={{ fontSize: '14px', fontWeight: 'bold' }}>Filter Graph</label>", datalist_code)

if 'useMemo' not in content[:200]:
    content = content.replace('useState, useCallback', 'useState, useCallback, useMemo')

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('App.tsx patched!')
