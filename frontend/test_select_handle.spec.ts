import { test, expect } from '@playwright/test';

test('click handle selects node', async ({ page }) => {
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
  if (nodeBox) {
    const sourceY = nodeBox.y + nodeBox.height;

    // click 3px inside (on the handle)
    await page.mouse.click(nodeBox.x + nodeBox.width / 2, sourceY - 3);
    await page.waitForTimeout(100);

    // check if node has 'selected' class or 'has-selection' is triggered
    const isSelected = await node.evaluate(el => el.classList.contains('selected'));
    console.log('Node is selected after clicking handle:', isSelected);

    // clear selection
    await page.mouse.click(10, 10);
    await page.waitForTimeout(100);

    // click center of node
    await page.mouse.click(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
    await page.waitForTimeout(100);
    const isSelectedCenter = await node.evaluate(el => el.classList.contains('selected'));
    console.log('Node is selected after clicking center:', isSelectedCenter);
  }
});
