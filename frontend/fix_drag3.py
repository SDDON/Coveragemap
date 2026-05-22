import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('expect(moved).toBe(true);', '''console.log(box, newBox);
  expect(moved).toBe(true);''')
with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
