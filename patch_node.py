import sys
path = 'frontend/src/CoverageNode.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = '''<Handle
        type="target"
        position={Position.Top}
        style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, top: 0, left: 0 }}
      />'''

replacement1 = '''<Handle
        type="target"
        position={Position.Top}
        style={{ width: '100%', height: '50%', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, top: 0, left: 0 }}
      />'''

target2 = '''<Handle
        type="source"
        position={Position.Bottom}
        style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0 }}
      />'''

replacement2 = '''<Handle
        type="source"
        position={Position.Bottom}
        style={{ width: '100%', height: '50%', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0 }}
      />'''

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1).replace(target2, replacement2)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully.")
else:
    print("Target not found.")

