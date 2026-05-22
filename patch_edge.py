import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const n of json.nodes) {
        if (n.id === nodeId) n.status = 'Passed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Passed');
    await page.getByRole('button', { name: /save/i }).click();
    
    await expect(targetEdge.locator('path.react-flow__edge-path').first()).toHaveCSS('stroke', 'rgb(0, 128, 0)');''',
    '''    await page.route('**/api/graph*', async route => {
      const response = await route.fetch();
      const json = await response.json();
      for (const e of json.edges) {
        if (e.id === edgeId) e.status = 'Passed';
      }
      await route.fulfill({ response, json });
    });
    await page.locator('select').last().selectOption('Passed');
    await page.getByRole('button', { name: /save/i }).click();
    
    await expect(targetEdge.locator('path.react-flow__edge-path').first()).toHaveCSS('stroke', 'rgb(0, 128, 0)');''')

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Patched Mark Edge Passed mock')
