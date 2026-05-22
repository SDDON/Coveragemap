import { test, expect } from '@playwright/test';

test('Dump handle CSS', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');
  
  const handle = page.locator('.react-flow__handle-top').first();
  const inlineStyle = await handle.getAttribute('style');
  const heightStr = await handle.evaluate((node) => {
    return window.getComputedStyle(node).height;
  });
  console.log('Inline Style:', inlineStyle);
  console.log('Computed Height:', heightStr);
});
