import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# I will replace all instances of selectOption('Passed') followed by click() with the mock
mock_passed_node = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Passed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Passed');\n    await page.getByRole('button', { name: /save/i }).click();'''

mock_failed_node = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Failed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Failed');\n    await page.getByRole('button', { name: /save/i }).click();'''

mock_untested_node = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Untested';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Untested');\n    await page.getByRole('button', { name: /save/i }).click();'''

c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Passed'\);\s*await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_passed_node, c)
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Failed'\);\s*await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_failed_node, c)
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Untested'\);\s*await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_untested_node, c)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched mocks for ALL status changes')
