import { test, expect } from '@playwright/test';

test('Check edge target coordinates', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const nodes = page.locator('.react-flow__node');
  const handleSource = nodes.nth(0).locator('.react-flow__handle-bottom');
  const handleTarget = nodes.nth(1).locator('.react-flow__handle-top');

  const sBox = await handleSource.boundingBox();
  const tBox = await handleTarget.boundingBox();

  // Drag from source to target
  await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 10 });
  await page.mouse.up();

  await page.waitForSelector('.react-flow__edge-path');
  const edge = page.locator('.react-flow__edge-path').first();
  const d = await edge.getAttribute('d');
  console.log('Edge path:', d);

  const nBox = await nodes.nth(1).boundingBox();
  console.log('Target node top y:', nBox.y);
});
