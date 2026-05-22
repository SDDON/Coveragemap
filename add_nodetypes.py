import codecs

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("export default function App() {", "const nodeTypes = { custom: CoverageNode };\n\nexport default function App() {")
content = content.replace("<ReactFlow\n", "<ReactFlow nodeTypes={nodeTypes}\n")
content = content.replace("<ReactFlow", "<ReactFlow nodeTypes={nodeTypes}")

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
