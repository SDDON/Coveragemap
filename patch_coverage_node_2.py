import os

with open('frontend/src/CoverageNode.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handles properly
new_content = content.replace(
    "<Handle\n        type="source"\n        position={Position.Bottom}\n        style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, top: 0, left: 0 }}\n      />",
    "<Handle\n        type="source"\n        position={Position.Bottom}\n        style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0, top: 'auto' }}\n      />"
)

with open('frontend/src/CoverageNode.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('CoverageNode updated')
