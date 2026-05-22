import re

with open('src/syncManager.ts', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('await fetch(${baseUrl}/api/sync,', 'await fetch(`${baseUrl}/api/sync`,')
with open('src/syncManager.ts', 'w', encoding='utf-8') as f:
    f.write(c)

with open('src/App.txx', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(r'const newEdgeId = .*;', 'const newEdgeId = `tmp-edge-${Date.now()}`;', c)
c = re.sub(r'const newNodeId = .*;', 'const newNodeId = `tmp-node-${Date.now()}`;', c)
with open('src/App.txx', 'w', encoding='utf-8') as f:
    f.write(c)