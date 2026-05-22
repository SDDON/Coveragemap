import { test, expect } from '@playwright/test';

test('Pan and test node drag', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  // pan right
  await page.mouse.move(500, 500);
  await page.mouse.down();
  await page.mouse.move(2000, 500, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  console.log('Node box after pan:', box);
  if (!box || box.x < 0) {
      console.log('Still out of view!');
      return;
  }
});
