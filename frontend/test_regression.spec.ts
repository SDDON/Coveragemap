import { test, expect } from '@playwright/test';

test('regression: handle intercepts clicks outside node', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  
  if (!nodeBox) throw new Error("No node found");

  // Click 2 pixels ABOVE the node (should be empty space)
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y - 2);
  await page.mouse.down();
  
  // Drag a bit
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y - 50);
  
  // Check if a connection line is being drawn
  const connectionLine = page.locator('.react-flow__connection-path');
  const count = await connectionLine.count();
  
  console.log('Connection line count when dragging from ABOVE node:', count);
  
  await page.mouse.up();
});
