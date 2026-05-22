import { test, expect } from '@playwright/test';

test('Test connection exactly on handle', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const sourceHandle = node.locator('.react-flow__handle-bottom').first();
  const hBox = await sourceHandle.boundingBox();
  
  if (!hBox) return;

  const hX = hBox.x + hBox.width / 2;
  const hY = hBox.y + hBox.height / 2;

  await page.mouse.move(hX, hY);
  await page.mouse.down();
  await page.mouse.move(hX, hY + 100, { steps: 10 });
  await page.waitForTimeout(200);

  const connectionLine = page.locator('.react-flow__connection-path').first();
  const connected = await connectionLine.isVisible().catch(() => false);
  console.log('Connected dragging from exact center of handle:', connected);
  await page.mouse.up();
});
