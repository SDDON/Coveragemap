import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<ReactFlow minZoom={0.05}',
    '<ReactFlow minZoom={0.05} onInit={(instance) => { window.rfInstance = instance; }}'
)

if 'setTimeout(() => { if (window.rfInstance)' not in content:
    content = content.replace(
        'setNodes(layoutedNodes);',
        'setNodes(layoutedNodes);\n        setTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 0, padding: 0.1 }); }, 50);'
    )

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
