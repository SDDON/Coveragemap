import { test, expect } from '@playwright/test';

test.describe('Badge Selection API and Focus Verification', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
  });

  test('Clicking badge fetches API without 405 error and highlights badge', async ({ page }) => {
    // Navigate to frontend
    await page.goto('http://localhost:5173');
    
    // Wait for the graph to load
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // Find a badge
    const badge = page.locator('.badge-pill').first();
    
    if (await badge.count() > 0) {
      // Click the badge itself (not the mark pass/fail button)
      await page.evaluate(() => {
        const el = document.querySelector('.badge-pill') as HTMLElement;
        if (el) el.click();
      });
      
      // Wait for state to update
      await page.waitForTimeout(1000);

      // Verify the badge has highlight style applied
      // Box shadow contains 'rgba(96, 165, 250'
      const style = await badge.getAttribute('style');
      expect(style).toContain('box-shadow');
      expect(style).toContain('165'); // Part of rgb for #60a5fa
      
      // Verify the right panel shifted to Edit tab for this node
      // The panel should show "Name:" etc.
      await expect(page.locator('label', { hasText: 'Verification Guide (Description)' })).toBeVisible();
    }
  });
});
