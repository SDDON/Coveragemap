import { test, expect } from '@playwright/test';

test('dump DOM while dragging', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node').first();
  const sourceHandle = node.locator('.react-flow__handle-bottom').first();
  const bottomBox = await sourceHandle.boundingBox();

  const handleDragStartX = bottomBox.x + bottomBox.width / 2;
  const handleDragStartY = bottomBox.y + bottomBox.height / 2; 

  await page.mouse.move(handleDragStartX, handleDragStartY);
  await page.mouse.down();
  await page.mouse.move(handleDragStartX, handleDragStartY + 100, { steps: 10 });
  await page.waitForTimeout(200);
  
  const pane = page.locator('.react-flow__pane').first();
  const allSvg = await page.locator('svg').all();
  for (const svg of allSvg) {
      console.log('SVG:', await svg.innerHTML());
  }
  
  await page.mouse.up();
});
