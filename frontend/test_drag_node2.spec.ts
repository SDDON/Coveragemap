import { test, expect } from '@playwright/test';

test('Test drag node using built-in dragTo', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  
  await node.dragTo(page.locator('.react-flow__pane'));
  await page.waitForTimeout(500);

  const newBox = await node.boundingBox();
  const moved = newBox.x !== box.x || newBox.y !== box.y;
  console.log('Node moved via dragTo:', moved);
});
