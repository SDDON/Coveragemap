import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('await page.mouse.up();', '''await page.mouse.up();
  await page.waitForTimeout(500);''')
with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
