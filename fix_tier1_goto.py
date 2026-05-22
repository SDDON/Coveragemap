import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all page.goto('/') with waitForResponse logic, except where it's already there
goto_replacement = '''const loadPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await loadPromise;
    await page.waitForTimeout(500);'''

# Only replace those that are exactly "await page.goto('/');"
content = re.sub(r"await page\.goto\('/'\);", goto_replacement, content)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
