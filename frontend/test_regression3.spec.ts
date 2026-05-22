import { test, expect } from '@playwright/test';

test('regression: drag from source handle', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  
  if (!nodeBox) throw new Error("No node found");

  // Source handle center is at Y = nodeBox.y + nodeBox.height
  const sourceY = nodeBox.y + nodeBox.height;

  // Click EXACTLY on the handle's center.
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY);
  await page.mouse.down();
  
  // Drag a bit
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY + 50);
  
  // Check if a connection line is being drawn
  const connectionLine = page.locator('.react-flow__connection-path');
  const count = await connectionLine.count();
  
  console.log('Connection line count when dragging from node boundary (bottom):', count);
  
  await page.mouse.up();
  
  // Now try dragging from 3px BELOW the node (which should hit the handle if it extends downwards)
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY + 3);
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY + 50);
  
  const countOutside = await page.locator('.react-flow__connection-path').count();
  console.log('Connection line count when dragging from 3px BELOW node:', countOutside);
  await page.mouse.up();
  
  // Now try dragging from 3px ABOVE the bottom boundary (INSIDE the node)
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY - 3);
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY + 50);
  
  const countInside = await page.locator('.react-flow__connection-path').count();
  console.log('Connection line count when dragging from 3px INSIDE node (near bottom):', countInside);
  await page.mouse.up();
});
