import { test, expect } from '@playwright/test';
test('debug dom', async ({ page }) => {
  const loadPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
  await page.goto('/');
  await loadPromise;
  await page.waitForTimeout(500);
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  for (let i = 0; i < count; i++) {
    console.log(await nodes.nth(i).getAttribute('class'));
  }
});
