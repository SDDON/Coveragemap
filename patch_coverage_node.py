import os

with open('frontend/src/CoverageNode.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handles
new_content = content.replace(
    "style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', position: 'absolute', top: 0, left: 0, zIndex: 1, opacity: 0, borderRadius: 0 }}",
    "style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, top: 0, left: 0 }}"
).replace(
    "style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', position: 'absolute', top: 0, left: 0, zIndex: 1, opacity: 0, borderRadius: 0 }}",
    "style={{ width: '100%', height: '10px', background: 'transparent', border: 'none', position: 'absolute', zIndex: 1, opacity: 0, borderRadius: 0, bottom: 0, left: 0 }}"
)

with open('frontend/src/CoverageNode.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('CoverageNode updated')
