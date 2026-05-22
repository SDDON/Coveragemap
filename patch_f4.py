import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("test('Add Node', async ({ page }) => {",
              "});\n\ntest.describe('F4: Graph Editing (Nodes & Edges)', () => {\n  test.beforeEach(async ({ page }) => { await page.goto('/'); });\n\n  test('Add Node', async ({ page }) => {")

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)
