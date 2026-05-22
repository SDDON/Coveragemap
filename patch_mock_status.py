import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Mock GET /api/graph for Mark Passed
mock_passed = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Passed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Passed'); await page.getByRole('button', { name: /save/i }).click();'''
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Passed'\); await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_passed, c, count=1)

# Mock GET /api/graph for Mark Failed
mock_failed = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Failed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Failed'); await page.getByRole('button', { name: /save/i }).click();'''
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Failed'\); await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_failed, c, count=1)

# Mock GET /api/graph for Mark Edge Passed
mock_edge = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.edges && json.edges.length > 0) {
        json.edges[0].status = 'Passed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Passed'); await page.getByRole('button', { name: /save/i }).click();'''
# Be careful here! The first one was Mark Passed, the second one is Mark Edge Passed!
# So we use count=1 for the remaining one!
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Passed'\); await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_edge, c, count=1)


# Mock GET /api/graph for Reset Status
mock_reset = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Untested';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Untested'); await page.getByRole('button', { name: /save/i }).click();'''
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Untested'\); await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_reset, c, count=1)


with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched mocks for status')
