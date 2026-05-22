import { test, expect } from '@playwright/test';

test('Mouse click', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10000 });
  const box = await page.locator('.react-flow__node').first().boundingBox();
  if (!box) throw new Error('No box');
  // Scroll the page? No, we can't scroll ReactFlow using window.scroll.
  // Just move the viewport using ReactFlow's setViewport? No.
  // But wait, Playwright says it is out of viewport.
  // We can just use page.mouse.click(box.x + box.width/2, box.y + box.height/2)
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  const rf = page.locator('.react-flow').first();
  await expect(rf).toHaveClass(/has-selection/);
});
