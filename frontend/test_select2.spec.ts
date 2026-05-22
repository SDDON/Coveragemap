import { test, expect } from '@playwright/test';

test('Click handle to select node', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');

  const node = page.locator('.react-flow__node-coverage').first();
  const topHandle = node.locator('.react-flow__handle-top').first();

  await topHandle.dispatchEvent('click');
  await page.waitForTimeout(500);

  // Check if node is selected
  const isSelected = await node.evaluate((n) => n.classList.contains('selected'));
  console.log('Is Selected (via handle click):', isSelected);

  // Dispatch click on the node body itself
  const nodeBody = node.locator('div').nth(1);
  await nodeBody.dispatchEvent('click');
  await page.waitForTimeout(500);

  const isSelectedBody = await node.evaluate((n) => n.classList.contains('selected'));
  console.log('Is Selected (via body click):', isSelectedBody);
});
