import codecs

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('await fetch(http://localhost:8001/api/nodes/, {', 'await fetch(`http://localhost:8001/api/nodes/${editFormData.id}`, {')
content = content.replace('await fetch(http://localhost:8001/api/edges/, {', 'await fetch(`http://localhost:8001/api/edges/${editFormData.id}`, {')

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
