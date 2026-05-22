import { test, expect } from '@playwright/test';

test('Click handle to select node', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');

  const node = page.locator('.react-flow__node-coverage').first();
  const topHandle = node.locator('.react-flow__handle-top');

  await topHandle.click();
  await page.waitForTimeout(500);

  // Check if node is selected
  const isSelected = await node.evaluate((n) => n.classList.contains('selected'));
  console.log('Is Selected:', isSelected);
});
