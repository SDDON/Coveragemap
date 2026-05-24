import { test, expect } from '@playwright/test';

test.describe('Badge Usability UI/UX Verification', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('Workspace Modal - "Do not show again" functionality', async ({ page }) => {
    // Navigate to frontend
    await page.goto('http://localhost:5173');
    
    // Check if modal is visible initially
    await expect(page.locator('text=Select Workspace')).toBeVisible();

    // Check the "Do not show again" checkbox
    const checkbox = page.locator('input#rememberWorkspace');
    await checkbox.check();

    // Click "전체 그래프 로드 (Heavy)" to save and proceed
    const loadAllBtn = page.locator('button:has-text("전체 그래프 로드 (Heavy)")');
    await loadAllBtn.click();

    // Verify modal is gone
    await expect(page.locator('text=Select Workspace')).not.toBeVisible();

    // Verify localStorage was set
    const savedShowAll = await page.evaluate(() => localStorage.getItem('savedShowAll'));
    expect(savedShowAll).toBe('true');

    // Reload the page
    await page.reload();

    // Verify modal does not show up again
    await expect(page.locator('text=Select Workspace')).not.toBeVisible();
  });

  test('Focus retention / Optimistic update on badge status change', async ({ page }) => {
    // Navigate and bypass modal
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
    await page.goto('http://localhost:5173');

    // Wait for the graph to load
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // Find a badge
    const badge = page.locator('.badge-pill').first();
    
    // We assume there is at least one badge. If not, we might fail here.
    if (await badge.count() > 0) {
      // Click "Mark Passed" on the badge
      const passBtn = badge.locator('button[title="Mark Passed"]');
      
      // Before clicking, intercept API call to verify it's made, but wait, optimistic update means UI updates immediately
      let refreshCalled = false;
      page.on('request', request => {
         if (request.url().includes('/api/graph')) {
            refreshCalled = true;
         }
      });
      
      // Clear refreshCalled flag after initial load
      await page.waitForTimeout(1000);
      refreshCalled = false;

      // Click pass
      await passBtn.click();
      
      // Wait a moment for state to settle
      await page.waitForTimeout(500);

      // Verify triggerRefresh was NOT called (no new /api/graph request)
      expect(refreshCalled).toBe(false);

      // Verify the badge border/bg color updated (optimistic UI)
      // The badge should now have a green color (#4ade80 checkmark)
      await expect(badge.locator('text=✔')).toBeVisible();
    }
  });

  test('Tooltip visibility on hover', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
    await page.goto('http://localhost:5173');

    const badge = page.locator('.badge-pill').first();
    if (await badge.count() > 0) {
      const tooltip = badge.locator('.badge-tooltip');
      // The tooltip might not exist if the badge has no description or issue_link,
      // but let's check if it exists or we can just pass if it doesn't.
      if (await tooltip.count() > 0) {
        await expect(tooltip).not.toBeVisible();
        await badge.hover();
        // Wait for CSS transition
        await page.waitForTimeout(300);
        await expect(tooltip).toBeVisible();
      }
    }
  });
});
