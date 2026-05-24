import { test, expect } from '@playwright/test';

test('UI behavior for converting a node to global', async ({ page }) => {
  let putPayload: any = null;
  await page.route('**/api/aliases', async route => {
    await route.fulfill({ json: ['Arena'] });
  });
  await page.route('**/api/graph*', async route => {
    await route.fulfill({
      json: {
        debounce_id: new URL(route.request().url()).searchParams.get('debounce_id'),
        nodes: [
          { id: 'node1', label: 'Screen', name: 'Node1', aliases: ['Arena'], test_status: 'Untested', properties: {} }
        ],
        edges: []
      }
    });
  });

  await page.route('**/api/nodes/node1', async route => {
    if (route.request().method() === 'PUT') {
      putPayload = route.request().postDataJSON();
      await route.fulfill({ json: {} });
    }
  });

  await page.goto('http://localhost:5173');
  await page.click('text="Arena"');
  await page.waitForSelector('.react-flow__node');

  // Select node1
  await page.click('.react-flow__node[data-id="node1"]');
  
  // Check the global checkbox
  await page.check('#nodeIsGlobal');

  // Save
  await page.click('button:has-text("Save")');
  
  // Assert the payload contains properties.is_global
  expect(putPayload).toBeDefined();
  expect(putPayload.properties.is_global).toBe('true');
});
