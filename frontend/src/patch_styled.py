import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

styled_nodes_code = """
  const styledNodes = nodes.map(n => ({
    ...n,
    className: ${hasSelection ? (selectedNode?.id === n.id ? 'active' : 'dimmed') : ''} status-
  }));

  const styledEdges = edges.map(e => ({
    ...e,
    className: ${hasSelection ? (selectedEdge?.id === e.id ? 'active' : 'dimmed') : ''} status-
  }));
"""

content = content.replace('return (', styled_nodes_code + '\n  return (')
content = content.replace('nodes={nodes}', 'nodes={styledNodes}')
content = content.replace('edges={edges}', 'edges={styledEdges}')

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
