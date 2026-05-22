import { test, expect } from '@playwright/test';

test('drag node via handle area vs center', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  // Force node to 200, 200
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

  // Try dragging node from center
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 50, nodeBox.y + nodeBox.height / 2 + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  
  const boxAfterCenterDrag = await node.boundingBox();
  console.log('Node moved after center drag?', boxAfterCenterDrag.x !== nodeBox.x);

  // Try dragging node from 3px inside the bottom boundary (on the handle)
  await page.mouse.move(boxAfterCenterDrag.x + boxAfterCenterDrag.width / 2, boxAfterCenterDrag.y + boxAfterCenterDrag.height - 3);
  await page.mouse.down();
  await page.mouse.move(boxAfterCenterDrag.x + boxAfterCenterDrag.width / 2 + 50, boxAfterCenterDrag.y + boxAfterCenterDrag.height - 3 + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const boxAfterHandleDrag = await node.boundingBox();
  console.log('Node moved after handle drag?', boxAfterHandleDrag.x !== boxAfterCenterDrag.x);
});
