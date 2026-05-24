import { test, expect } from '@playwright/test';

test('R3: Dynamically created edges lack floating type and overlap', async ({ page }) => {
  await page.route('**/api/aliases', async route => {
    await route.fulfill({ json: ['Arena'] });
  });
  await page.route('**/api/graph*', async route => {
    await route.fulfill({
      json: {
        debounce_id: new URL(route.request().url()).searchParams.get('debounce_id'),
        nodes: [
          { id: 'node1', label: 'Screen', name: 'Node1', aliases: ['Arena'], test_status: 'Untested', properties: {} },
          { id: 'node2', label: 'Screen', name: 'Node2', aliases: ['Arena'], test_status: 'Untested', properties: {} }
        ],
        edges: []
      }
    });
  });

  await page.route('**/api/edges', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: `new_edge_${Date.now()}` });
    }
  });

  await page.goto('http://localhost:5173');
  await page.click('text="Arena"');
  await page.waitForSelector('.react-flow__node');

  // Simulate drawing two edges between node1 and node2
  // Using page.evaluate to trigger onConnect directly since drag and drop can be flaky
  await page.evaluate(() => {
    // The App component might not be directly accessible, let's just use DOM events or React Flow's window object
  });
});
