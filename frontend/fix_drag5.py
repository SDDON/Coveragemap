import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await page.waitForSelector('.react-flow__node');", '''await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);''')
with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
