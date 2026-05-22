import { test, expect } from '@playwright/test';

test('pan and check elements', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  // get the node
  const node = page.locator('.react-flow__node').first();
  
  // Wait, let's just zoom to fit using the react flow instance or by finding the fitview button
  const fitViewButton = page.locator('.react-flow__controls-fitview');
  if (await fitViewButton.count() > 0) {
    await fitViewButton.click();
    await page.waitForTimeout(500); // wait for animation
  } else {
    // try to dispatch wheel events to zoom out
    await page.mouse.move(500, 500);
    await page.mouse.wheel(0, 1000);
    await page.mouse.wheel(0, 1000);
    await page.mouse.down();
    await page.mouse.move(1000, 500);
    await page.mouse.up();
  }

  const nodeBox = await node.boundingBox();
  console.log('Node Box after trying to bring into view:', nodeBox);

  if (nodeBox && nodeBox.x > 0 && nodeBox.y > 0) {
    const sourceY = nodeBox.y + nodeBox.height;

    const elBelow = await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      return el ? { className: el.className, tagName: el.tagName } : null;
    }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY + 3 });

    const elBoundary = await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      return el ? { className: el.className, tagName: el.tagName } : null;
    }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY });

    const elInside = await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      return el ? { className: el.className, tagName: el.tagName } : null;
    }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY - 3 });

    console.log('Element 3px below:', elBelow);
    console.log('Element on boundary:', elBoundary);
    console.log('Element 3px inside:', elInside);
  }
});
