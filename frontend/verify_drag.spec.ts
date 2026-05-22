import { test, expect } from '@playwright/test';

test('Verify Manual Drag & Drop', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  
  // Wait for nodes
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  
  // Find two nodes
  const nodes = page.locator('.react-flow__node');
  await expect(nodes).not.toHaveCount(0);
  
  const nodeA = nodes.nth(0);
  const nodeB = nodes.nth(1);
  
  // Get handles
  const sourceHandle = nodeA.locator('.react-flow__handle-bottom');
  const targetHandle = nodeB.locator('.react-flow__handle-top');
  
  // Get coordinates
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  
  if (!sourceBox || !targetBox) throw new Error("Handles not found");
  
  // Take screenshot before
  await page.screenshot({ path: 'before_drag.png' });
  
  // Start drag
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  
  // Move to target
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  
  // Take screenshot during drag
  await page.screenshot({ path: 'during_drag.png' });
  
  // Drop
  const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
  await page.mouse.up();
  await responsePromise;
  
  // Wait a moment for React Flow to render the new edge
  await page.waitForTimeout(500);
  
  // Take screenshot after
  await page.screenshot({ path: 'after_drag.png' });
});
