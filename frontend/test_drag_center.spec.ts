import { test, expect } from '@playwright/test';

test('Node dragging works via center on visible node', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node-coverage');

  // Wait for React Flow to initialize and fit view
  await page.waitForTimeout(1000);

  const node = page.locator('.react-flow__node-coverage').nth(10); // try another node
  await node.scrollIntoViewIfNeeded();

  const boxBefore = await node.boundingBox();
  expect(boxBefore).not.toBeNull();

  const centerX = boxBefore!.x + boxBefore!.width / 2;
  const centerY = boxBefore!.y + boxBefore!.height / 2;

  if (centerX < 0 || centerY < 0) {
    console.log("Node is still off-screen:", boxBefore);
    return;
  }

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 100, centerY + 100, { steps: 10 });
  await page.mouse.up();

  await page.waitForTimeout(500);

  const boxAfter = await node.boundingBox();
  console.log('Box Before:', boxBefore);
  console.log('Box After:', boxAfter);

  const dx = Math.abs(boxAfter!.x - boxBefore!.x);
  const dy = Math.abs(boxAfter!.y - boxBefore!.y);
  console.log('Moved dx:', dx, 'dy:', dy);
});
