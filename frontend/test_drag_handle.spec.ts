import { test, expect } from '@playwright/test';

test('Click right half of top handle creates connection', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node-coverage').nth(10);
  await node.scrollIntoViewIfNeeded();

  const box = await node.boundingBox();
  
  // Right half of top 10px
  const targetX = box!.x + box!.width * 0.8;
  const targetY = box!.y + 5; // inside the top handle

  // drag from there to somewhere else
  await page.mouse.move(targetX, targetY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY - 100, { steps: 10 });
  await page.mouse.up();

  // If a connection was created or attempted, an edge or a connection line is visible
  const connLine = await page.locator('.react-flow__connection-path').count();
  // Since we released the mouse, the connection might disappear if not dropped on a handle.
  // Let's hold it and check.
});
