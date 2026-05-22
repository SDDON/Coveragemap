import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r"className: \$\{hasSelection.*?\n",
    r"className: `${hasSelection ? (selectedNode?.id === n.id ? 'active' : 'dimmed') : ''} status-${(n.data?.status || 'untested').toLowerCase()}`\n",
    content
)

content = re.sub(
    r"className: \$\{hasSelection.*?\n",
    r"className: `${hasSelection ? (selectedEdge?.id === e.id ? 'active' : 'dimmed') : ''} status-${(e.data?.status || 'untested').toLowerCase()}`\n",
    content
)
# Wait, I need to distinguish nodes vs edges in the regex. 
