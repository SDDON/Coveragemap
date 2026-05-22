with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('useNodesState([])', 'useNodesState<Node>([])')
content = content.replace('useEdgesState([])', 'useEdgesState<Edge>([])')

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
