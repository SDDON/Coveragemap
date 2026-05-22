with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await page.goto('/');", "const initGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method() === 'GET');\n    await page.goto('/');\n    await initGraph;")

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
