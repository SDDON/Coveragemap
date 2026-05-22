import { test, expect } from '@playwright/test';

test('Force click', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10000 });
  const node = page.locator('.react-flow__node').first();
  await node.click({ force: true });
  const rf = page.locator('.react-flow').first();
  await expect(rf).toHaveClass(/has-selection/);
});
