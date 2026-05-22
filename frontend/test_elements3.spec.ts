import { test, expect } from '@playwright/test';

test('force viewport and check elements', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  // Force the node to be at 200, 200 via CSS transform
  await page.evaluate(() => {
    const node = document.querySelector('.react-flow__node') as HTMLElement;
    if (node) {
      node.style.transform = 'translate(200px, 200px)';
    }
    // Also remove the viewport transform so it's 1:1
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (vp) {
      vp.style.transform = 'translate(0px, 0px) scale(1)';
    }
  });

  // wait a bit for any react-flow re-renders to settle
  await page.waitForTimeout(500);

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  console.log('Forced Node Box:', nodeBox);

  if (nodeBox) {
    const sourceY = nodeBox.y + nodeBox.height;

    const checkPoint = async (yOffset) => {
      return await page.evaluate(({x, y}) => {
        const el = document.elementFromPoint(x, y);
        return el ? { className: el.className, tagName: el.tagName } : null;
      }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY + yOffset });
    };

    console.log('Element 5px below:', await checkPoint(5));
    console.log('Element 3px below:', await checkPoint(3));
    console.log('Element on boundary:', await checkPoint(0));
    console.log('Element 3px inside:', await checkPoint(-3));
    console.log('Element 5px inside:', await checkPoint(-5));
    console.log('Element 7px inside:', await checkPoint(-7));
  }
});
