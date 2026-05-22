import { test, expect } from '@playwright/test';

test('Eval click', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => {
    const node = document.querySelector('.react-flow__node');
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const rf = page.locator('.react-flow').first();
  await expect(rf).toHaveClass(/has-selection/);
});
