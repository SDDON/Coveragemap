import { test, expect } from '@playwright/test';

test('Verify node center is draggable and handles are at top/bottom 10px', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  let targetNode = null;
  let targetBox = null;

  // Find an onscreen node
  for (let i = 0; i < count; i++) {
    const node = nodes.nth(i);
    const box = await node.boundingBox();
    if (box && box.x > 100 && box.y > 100 && box.x < 600 && box.y < 600) {
      targetNode = node;
      targetBox = box;
      break;
    }
  }

  if (!targetNode || !targetBox) {
    throw new Error('No onscreen node found to test!');
  }

  // 1. Center is draggable
  const centerX = targetBox.x + targetBox.width / 2;
  const centerY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 100, centerY + 100, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const newBox = await targetNode.boundingBox();
  const moved = newBox && (Math.abs(newBox.x - targetBox.x) > 50) && (Math.abs(newBox.y - targetBox.y) > 50);
  expect(moved).toBe(true);

  // 2. Connection from bottom handle
  const bottomHandle = targetNode.locator('.react-flow__handle-bottom');
  const bottomBox = await bottomHandle.boundingBox();
  if (!bottomBox) throw new Error('Bottom handle bounding box not found');
  
  const bottomX = bottomBox.x + bottomBox.width / 2;
  const bottomY = bottomBox.y + bottomBox.height / 2;

  await page.mouse.move(bottomX, bottomY);
  await page.mouse.down();
  await page.mouse.move(bottomX, bottomY + 100, { steps: 10 });
  
  const connectionBottom = page.locator('.react-flow__connection');
  const hasBottomConnection = await connectionBottom.count() > 0;
  await page.mouse.up();
  
  expect(hasBottomConnection).toBe(true);

  // 3. Connection from top handle
  const topHandle = targetNode.locator('.react-flow__handle-top');
  const topBox = await topHandle.boundingBox();
  if (!topBox) throw new Error('Top handle bounding box not found');

  const topX = topBox.x + topBox.width / 2;
  const topY = topBox.y + topBox.height / 2;

  await page.mouse.move(topX, topY);
  await page.mouse.down();
  await page.mouse.move(topX, topY - 100, { steps: 10 });
  
  const connectionTop = page.locator('.react-flow__connection');
  const hasTopConnection = await connectionTop.count() > 0;
  await page.mouse.up();
  
  expect(hasTopConnection).toBe(true);
});
