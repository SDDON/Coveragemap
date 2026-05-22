import { test, expect } from '@playwright/test';

test('Node selection via mouse click', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  
  if (!box) throw new Error('No bounding box');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.click(startX, startY);
  await node.dispatchEvent('click');

  // Wait a bit
  await page.waitForTimeout(500);

  // Is it selected?
  const classList = await node.getAttribute('class');
  expect(classList).toContain('active');
});
