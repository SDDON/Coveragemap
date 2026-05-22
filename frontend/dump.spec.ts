import { test, expect } from '@playwright/test';

test('Dump box', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 100, centerY + 100, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const newBox = await node.boundingBox();
  console.log("OLD", box);
  console.log("NEW", newBox);
});
