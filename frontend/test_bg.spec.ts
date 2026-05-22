import { test, expect } from '@playwright/test';

test('Check node background color', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');

  const node = page.locator('.react-flow__node-coverage').first();
  const bg = await node.evaluate((n) => window.getComputedStyle(n).backgroundColor);
  console.log('Background:', bg);
});
