import { test, expect } from '@playwright/test';

test('Test node drag right half vs left half', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  if (!box) return;

  const leftX = box.x + box.width * 0.25;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(leftX, centerY);
  await page.mouse.down();
  await page.mouse.move(leftX + 50, centerY + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  let newBox = await node.boundingBox();
  const leftMoved = newBox.x > box.x + 20;
  console.log('Moved when dragged from left half:', leftMoved);

  // reset box
  const rightX = newBox.x + newBox.width * 0.75;
  const newCenterY = newBox.y + newBox.height / 2;

  await page.mouse.move(rightX, newCenterY);
  await page.mouse.down();
  await page.mouse.move(rightX + 50, newCenterY + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const finalBox = await node.boundingBox();
  const rightMoved = finalBox.x > newBox.x + 20;
  console.log('Moved when dragged from right half:', rightMoved);
});
