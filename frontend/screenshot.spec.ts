import { test, expect } from '@playwright/test';

test('Take screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'graph_screenshot.png' });
});
