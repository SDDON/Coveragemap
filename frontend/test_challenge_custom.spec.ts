import { test, expect } from '@playwright/test';

test('dump edges', async ({ page }) => {
  await page.route('**/api/aliases*', route => route.fulfill({ json: [] }));
  await page.route('**/api/graph*', route => {
    route.fulfill({
      json: {
        debounce_id: '0',
        nodes: [
          { id: 'n1', label: 'Screen', name: 'A', aliases: [], properties: {}, test_status: 'Untested' },
          { id: 'n2', label: 'Screen', name: 'B', aliases: [], properties: {}, test_status: 'Untested' }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', type: 'Transition', properties: {}, test_status: 'Untested' },
          { id: 'e2', source: 'n1', target: 'n2', type: 'Transition', properties: {}, test_status: 'Untested' }
        ]
      }
    });
  });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000); // wait for render
  const html = await page.evaluate(() => document.querySelector('.react-flow__edges')?.innerHTML);
  console.log('EDGES HTML:', html);
  
  const nodesHtml = await page.evaluate(() => document.querySelector('.react-flow__nodes')?.innerHTML);
  console.log('NODES HTML:', nodesHtml);
});
