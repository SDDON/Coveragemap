import re

with open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'CoverageNode' not in content:
    content = content.replace("import { getLayoutedElements } from './layout';", "import { getLayoutedElements } from './layout';\nimport CoverageNode from './CoverageNode';")

# Add nodeTypes
if 'nodeTypes =' not in content:
    content = content.replace("const [nodes, setNodes, onNodesChange] = useNodesState([]);", "const nodeTypes = useMemo(() => ({ coverage: CoverageNode }), []);\n  const [nodes, setNodes, onNodesChange] = useNodesState([]);")

# Add to ReactFlow
if 'nodeTypes={nodeTypes}' not in content:
    content = content.replace("<ReactFlow", "<ReactFlow\n        nodeTypes={nodeTypes}")

# Set type in initialNodes
if "type: 'coverage'" not in content:
    content = content.replace("id: n.id,\n            data: n,", "id: n.id,\n            type: 'coverage',\n            data: n,")

with open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
