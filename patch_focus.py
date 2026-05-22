import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/focus_test.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("await page.fill('input[type=\"text\"] >> nth=0', 'H1Node');", 
              "await page.fill('input[type=\"text\"] >> nth=0', 'H1Node'); await page.fill('input[type=\"text\"] >> nth=1', 'H1Node_name');")

with open('e:/Workspace/coveragemap/e2e-tests/tests/focus_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched focus_test.spec.ts')
