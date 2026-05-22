import { test, expect } from '@playwright/test';

test('Dispatch exactly on handle', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(1000);

  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  let targetNode = null;
  let targetBox = null;

  for (let i = 0; i < count; i++) {
    const node = nodes.nth(i);
    const box = await node.boundingBox();
    if (box && box.x > 100 && box.y > 100 && box.x < 600 && box.y < 600) {
      targetNode = node;
      targetBox = box;
      break;
    }
  }

  const handle = targetNode.locator('.react-flow__handle-bottom');
  const hBox = await handle.boundingBox();
  
  const hX = hBox.x + hBox.width / 2;
  const hY = hBox.y + hBox.height / 2;

  await page.mouse.move(hX, hY);
  await page.mouse.down();
  await page.mouse.move(hX, hY + 100, { steps: 10 });
  
  const path = await page.locator('.react-flow__connection').count();
  console.log("Connection count:", path);
  
  await page.mouse.up();
});
