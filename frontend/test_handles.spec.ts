import { test, expect } from '@playwright/test';

test('Node dragging vs Edge creation check bounding boxes', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  
  const handleTop = node.locator('.react-flow__handle-top').first();
  const handleBottom = node.locator('.react-flow__handle-bottom').first();
  
  const boxTop = await handleTop.boundingBox();
  const boxBottom = await handleBottom.boundingBox();
  
  console.log('Node:', box);
  console.log('HandleTop:', boxTop);
  console.log('HandleBottom:', boxBottom);
});
