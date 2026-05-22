import { test, expect } from '@playwright/test';

test.describe('Debug', () => {
  test('Print bounding box', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10000 });
    const node = page.locator('.react-flow__node').first();
    const box = await node.boundingBox();
    console.log('Bounding Box:', box);
    const rfBox = await page.locator('.react-flow').boundingBox();
    console.log('ReactFlow Box:', rfBox);
  });
});
