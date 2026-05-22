import { test, expect } from '@playwright/test';

test('check if dragging handle creates connection', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  await page.evaluate(() => {
    const node = document.querySelector('.react-flow__node') as HTMLElement;
    if (node) node.style.transform = 'translate(200px, 200px)';
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (vp) vp.style.transform = 'translate(0px, 0px) scale(1)';
  });
  await page.waitForTimeout(500);

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  if (!nodeBox) return;

  const sourceY = nodeBox.y + nodeBox.height;

  // drag from 3px inside (on the handle)
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, sourceY - 3);
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 50, sourceY + 100, { steps: 10 });
  
  await page.waitForTimeout(200);

  const connectionLine = page.locator('.react-flow__connection-path');
  const count = await connectionLine.count();
  console.log('Connection line count when dragging handle:', count);

  await page.mouse.up();
});
