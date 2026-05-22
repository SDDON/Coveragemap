import { test, expect } from '@playwright/test';

test('Empirical Challenge 2', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const nodes = page.locator('.react-flow__node');
  
  // Use page.evaluate to trigger React Flow's selection or just click using standard DOM events
  const firstNode = nodes.first();
  await firstNode.evaluate(node => {
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    node.click();
  });
  
  await page.waitForTimeout(1000);

  const rfWrapper = page.locator('.react-flow');
  const hasSelectionClass = await rfWrapper.evaluate(el => el.className.includes('has-selection'));
  console.log('Has selection wrapper class:', hasSelectionClass);

  const isActive = await firstNode.evaluate(el => el.className.includes('active'));
  console.log('Clicked node has active class:', isActive);
  
  // If still not active, try a pointer event
  if (!isActive) {
      await firstNode.evaluate(node => {
        const pointerDownEvent = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window });
        node.dispatchEvent(pointerDownEvent);
        const pointerUpEvent = new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window });
        node.dispatchEvent(pointerUpEvent);
      });
      await page.waitForTimeout(1000);
      const isNowActive = await firstNode.evaluate(el => el.className.includes('active'));
      console.log('Clicked node has active class after pointer events:', isNowActive);
      const hasSel = await rfWrapper.evaluate(el => el.className.includes('has-selection'));
      console.log('Has selection wrapper class after pointer events:', hasSel);
  }
});
