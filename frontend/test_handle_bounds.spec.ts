import { test, expect } from '@playwright/test';

test('Handles stay strictly within node bounds', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  await page.waitForSelector('.react-flow__node-coverage');
  
  const node = page.locator('.react-flow__node-coverage').first();
  const nodeBox = await node.boundingBox();
  expect(nodeBox).not.toBeNull();
  
  const topHandle = node.locator('.react-flow__handle-top');
  const bottomHandle = node.locator('.react-flow__handle-bottom');
  
  const topBox = await topHandle.boundingBox();
  const bottomBox = await bottomHandle.boundingBox();
  
  expect(topBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();
  
  console.log('Node:', nodeBox);
  console.log('Top Handle:', topBox);
  console.log('Bottom Handle:', bottomBox);
  
  expect(Math.abs(topBox!.x - nodeBox!.x)).toBeLessThan(1);
  expect(Math.abs(topBox!.width - nodeBox!.width)).toBeLessThan(1);
  expect(Math.abs(topBox!.y - nodeBox!.y)).toBeLessThan(1);
  expect(topBox!.height).toBe(10);
  expect(Math.abs((bottomBox!.y + bottomBox!.height) - (nodeBox!.y + nodeBox!.height))).toBeLessThan(1);
  expect(bottomBox!.height).toBe(10);
});
