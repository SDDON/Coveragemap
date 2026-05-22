import { test, expect } from '@playwright/test';

test('Verify handles and node dragging', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  // Pan right to bring node into view
  await page.mouse.move(500, 500);
  await page.mouse.down();
  await page.mouse.move(2000, 500, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const targetHandle = node.locator('.react-flow__handle-top').first();
  const sourceHandle = node.locator('.react-flow__handle-bottom').first();

  const topBox = await targetHandle.boundingBox();
  const bottomBox = await sourceHandle.boundingBox();

  console.log('Node:', box);
  console.log('Top Handle:', topBox);
  console.log('Bottom Handle:', bottomBox);

  // Test dragging node center
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 100, centerY + 100, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const newBox = await node.boundingBox();
  const nodeMoved = newBox && (newBox.x > box.x + 50);
  console.log('Node moved by center drag:', nodeMoved);
  
  // Test handle connection from left half of the handle
  const handleDragStartX = newBox.x + 5; // close to left edge
  const handleDragStartY = newBox.y + newBox.height - 2;

  await page.mouse.move(handleDragStartX, handleDragStartY);
  await page.mouse.down();
  await page.mouse.move(handleDragStartX, handleDragStartY + 100, { steps: 10 });
  await page.waitForTimeout(200);
  
  let lineVisible = await page.locator('.react-flow__connection-path').first().isVisible().catch(() => false);
  console.log('Left edge connection line visible:', lineVisible);
  await page.mouse.up();

  // Test handle connection from right half of the node
  const handleRightStartX = newBox.x + newBox.width - 5; // close to right edge
  const handleRightStartY = newBox.y + newBox.height - 2;

  await page.mouse.move(handleRightStartX, handleRightStartY);
  await page.mouse.down();
  await page.mouse.move(handleRightStartX, handleRightStartY + 100, { steps: 10 });
  await page.waitForTimeout(200);

  let lineRightVisible = await page.locator('.react-flow__connection-path').first().isVisible().catch(() => false);
  console.log('Right edge connection line visible:', lineRightVisible);
  await page.mouse.up();

});
