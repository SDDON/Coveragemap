import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const initGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method() === 'GET');\n    await page.goto('/');\n    await initGraph;",
    "await page.goto('/');\n    await page.waitForTimeout(500);"
)

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
