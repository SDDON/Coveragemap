import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const box = await node.boundingBox();", '''await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();''')
with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
