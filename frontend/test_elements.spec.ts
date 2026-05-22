import { test, expect } from '@playwright/test';

test('check element at handle point', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  if (!nodeBox) throw new Error("No node found");

  const sourceY = nodeBox.y + nodeBox.height;

  // Check 3px below the node
  const elBelow = await page.evaluate(({x, y}) => {
    const el = document.elementFromPoint(x, y);
    return el ? { className: el.className, tagName: el.tagName } : null;
  }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY + 3 });

  // Check exactly on boundary
  const elBoundary = await page.evaluate(({x, y}) => {
    const el = document.elementFromPoint(x, y);
    return el ? { className: el.className, tagName: el.tagName } : null;
  }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY });

  // Check 3px inside the node
  const elInside = await page.evaluate(({x, y}) => {
    const el = document.elementFromPoint(x, y);
    return el ? { className: el.className, tagName: el.tagName } : null;
  }, { x: nodeBox.x + nodeBox.width / 2, y: sourceY - 3 });

  console.log('Element 3px below:', elBelow);
  console.log('Element on boundary:', elBoundary);
  console.log('Element 3px inside:', elInside);
});
