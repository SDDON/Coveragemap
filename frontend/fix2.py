import re
with open('src/syncManager.ts', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('fetch(/api/sync,', 'fetch(${baseUrl}/api/sync,')
with open('src/syncManager.ts', 'w', encoding='utf-8') as f:
    f.write(c)
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'const newEdgeId = .*?;', 'const newEdgeId = 	mp-edge-;', c)
c = re.sub(r'const newNodeId = .*?;', 'const newNodeId = 	mp-node-;', c)
with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
