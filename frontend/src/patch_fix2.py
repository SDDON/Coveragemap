import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all styledNodes and styledEdges blocks
content = re.sub(r'const styledNodes = .*?\n  \}\)\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'const styledEdges = .*?\n  \}\)\);\n', '', content, flags=re.DOTALL)

styled_code = """
  const styledNodes = nodes.map(n => ({
    ...n,
    className: `${hasSelection ? (selectedNode?.id === n.id ? 'active' : 'dimmed') : ''} status-${(n.data?.status || 'untested').toLowerCase()}`
  }));

  const styledEdges = edges.map(e => ({
    ...e,
    className: `${hasSelection ? (selectedEdge?.id === e.id ? 'active' : 'dimmed') : ''} status-${(e.data?.status || 'untested').toLowerCase()}`
  }));
"""

content = content.replace('return (', styled_code + '\n  return (')

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
