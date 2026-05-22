import { test, expect } from '@playwright/test';

test('Dump box after pan', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  let node = page.locator('.react-flow__node').first();
  let box = await node.boundingBox();
  console.log("BOX BEFORE", box);

  if (box && box.x < 0) {
     const pane = page.locator('.react-flow__pane');
     await pane.dragTo(pane, { sourcePosition: {x: 100, y: 100}, targetPosition: {x: 100 - box.x + 200, y: 100} });
     await page.waitForTimeout(1000);
     box = await node.boundingBox();
     console.log("BOX AFTER PAN X", box);
  }

  if (box && box.y < 0) {
     const pane = page.locator('.react-flow__pane');
     await pane.dragTo(pane, { sourcePosition: {x: 100, y: 100}, targetPosition: {x: 100, y: 100 - box.y + 200} });
     await page.waitForTimeout(1000);
     box = await node.boundingBox();
     console.log("BOX AFTER PAN Y", box);
  }
});
