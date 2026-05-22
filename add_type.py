import codecs

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("id: n.id,\n          data: n,", "id: n.id,\n          type: 'custom',\n          data: n,")

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
