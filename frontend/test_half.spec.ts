import { test, expect } from '@playwright/test';

test('Test connection on right half vs left half', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  if (!box) return;

  // Try to drag from Bottom-Left part of the node
  const leftX = box.x + box.width * 0.25;
  const bottomY = box.y + box.height - 2;

  await page.mouse.move(leftX, bottomY);
  await page.mouse.down();
  await page.mouse.move(leftX, bottomY + 100, { steps: 10 });
  await page.waitForTimeout(200);

  let connectionLine = page.locator('.react-flow__connection-path').first();
  const leftConnected = await connectionLine.isVisible().catch(() => false);
  console.log('Left half connection:', leftConnected);
  await page.mouse.up();

  await page.waitForTimeout(500);

  // Try to drag from Bottom-Right part of the node
  const rightX = box.x + box.width * 0.75;

  await page.mouse.move(rightX, bottomY);
  await page.mouse.down();
  await page.mouse.move(rightX, bottomY + 100, { steps: 10 });
  await page.waitForTimeout(200);

  connectionLine = page.locator('.react-flow__connection-path').first();
  const rightConnected = await connectionLine.isVisible().catch(() => false);
  console.log('Right half connection:', rightConnected);
  await page.mouse.up();
  
  // Both should be true if it spans the whole width!
});
