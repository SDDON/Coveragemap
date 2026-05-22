import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the remaining selectOption('Passed') in Reset Status
mock_passed_reset = r'''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Passed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Passed'); await page.getByRole('button', { name: /save/i }).click();'''
c = re.sub(r"await page\.locator\('select'\)\.last\(\)\.selectOption\('Passed'\); await page\.getByRole\('button', \{ name: /save/i \}\)\.click\(\);", mock_passed_reset, c, count=1)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched Reset Status Passed mock')
