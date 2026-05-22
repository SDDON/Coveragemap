import { test, expect } from '@playwright/test';
test('debug node bounds', async ({ page }) => {
  const loadPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
  await page.goto('/');
  await loadPromise;
  await page.waitForTimeout(500);
  await page.locator('.react-flow__controls-fitview').click();
  await page.waitForTimeout(500);
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  console.log('Nodes count:', count);
  for (let i = 0; i < count; i++) {
    const box = await nodes.nth(i).boundingBox();
    console.log(`Node ${i} box:`, box);
  }
  const pane = await page.locator('.react-flow__pane').boundingBox();
  console.log('Pane box:', pane);
});
