import { test, expect } from '@playwright/test';

test('Check edge connection points', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');
  await page.waitForSelector('.react-flow__edge-path');

  const edge = page.locator('.react-flow__edge-path').first();
  const d = await edge.getAttribute('d');
  console.log('Edge path:', d);
  
  const targetNode = page.locator('.react-flow__node-coverage').nth(1); // just get some node
  const box = await targetNode.boundingBox();
  console.log('Node 2 box:', box);
});
