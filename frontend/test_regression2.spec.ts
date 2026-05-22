import { test, expect } from '@playwright/test';

test('regression: drag from center of target handle', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  
  if (!nodeBox) throw new Error("No node found");

  // Click EXACTLY on the handle's center. 
  // Target handle center is at Y = nodeBox.y (because it's shifted up 50% of its 10px height, from top: 0)
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y);
  await page.mouse.down();
  
  // Drag a bit
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y - 50);
  
  // Check if a connection line is being drawn
  const connectionLine = page.locator('.react-flow__connection-path');
  const count = await connectionLine.count();
  
  console.log('Connection line count when dragging from node boundary:', count);
  
  await page.mouse.up();
});
