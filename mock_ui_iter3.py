import re

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add a mock for the graph to start empty, but allow POST requests to go through
mock_code = '''    await page.route('**/api/graph*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { nodes: [], edges: [] } });
      } else {
        await route.continue();
      }
    });
    await page.goto('/');'''

content = content.replace("await page.goto('/');", mock_code)

with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
