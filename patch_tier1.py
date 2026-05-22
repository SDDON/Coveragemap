import re

path = 'E:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "await page.mouse.move(500, 500); await page.mouse.down(); await page.mouse.move(2000, 500, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(500);"

content = content.replace(target, "await page.waitForTimeout(500);")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
