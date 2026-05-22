import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await page.route('**/api/graph*', async route => await route.abort());\n    const loadPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method() === 'GET');\n    await page.goto('/');\n    await loadPromise;", "await page.route('**/api/graph*', async route => await route.abort());\n    await page.goto('/');")

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
