import { test, expect } from '@playwright/test';

test('check handle bounds and vertical alignment', async ({ page }) => {
  await page.goto('http://localhost:5173');
  // Wait for nodes to render
  await page.waitForSelector('.react-flow__node');

  // get bounding boxes of the first node and its handles
  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();
  
  const sourceHandle = node.locator('.react-flow__handle-bottom');
  const targetHandle = node.locator('.react-flow__handle-top');
  
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  
  const styleSource = await sourceHandle.evaluate(el => window.getComputedStyle(el).transform);
  const styleTarget = await targetHandle.evaluate(el => window.getComputedStyle(el).transform);
  
  const cssTextSource = await sourceHandle.evaluate(el => el.style.cssText);
  const cssTextTarget = await targetHandle.evaluate(el => el.style.cssText);
  
  console.log('Node Box:', nodeBox);
  console.log('Source Box:', sourceBox);
  console.log('Target Box:', targetBox);
  console.log('Source Transform CSS:', styleSource);
  console.log('Target Transform CSS:', styleTarget);
  console.log('Source style:', cssTextSource);
  console.log('Target style:', cssTextTarget);

  if (nodeBox && sourceBox && targetBox) {
    // 1. Horizontal bounds
    console.log('Target Handle horizontal check: x=', targetBox.x, ' nodeX=', nodeBox.x, ' width=', targetBox.width, ' nodeWidth=', nodeBox.width);
    
    // 2. Vertical alignment check (centers)
    const targetCenterY = targetBox.y + targetBox.height / 2;
    console.log('Target Handle Center Y:', targetCenterY, ' Node Top:', nodeBox.y);
    
    const sourceCenterY = sourceBox.y + sourceBox.height / 2;
    console.log('Source Handle Center Y:', sourceCenterY, ' Node Bottom:', nodeBox.y + nodeBox.height);
  }
});
