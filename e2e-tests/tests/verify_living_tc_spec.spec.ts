import { test, expect } from '@playwright/test';

test.describe('Living TC & Specification Integrity Verification (Tier 2-B)', () => {

  test.beforeEach(async ({ page }) => {
    // Suppress workspace selection modal for automated test runs
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
  });

  test('1. 12-Tier Standard Z-Index Token Hierarchy Integrity', async ({ page }) => {
    await page.goto('/');

    // Evaluate CSS variables on document.documentElement
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        canvasBg: style.getPropertyValue('--z-canvas-bg').trim(),
        edge: style.getPropertyValue('--z-edge').trim(),
        parentNode: style.getPropertyValue('--z-parent-node').trim(),
        childNode: style.getPropertyValue('--z-child-node').trim(),
        activeNode: style.getPropertyValue('--z-active-node').trim(),
        nodeBadge: style.getPropertyValue('--z-node-badge').trim(),
        canvasControls: style.getPropertyValue('--z-canvas-controls').trim(),
        floatingPanel: style.getPropertyValue('--z-floating-panel').trim(),
        contextMenu: style.getPropertyValue('--z-context-menu').trim(),
        tooltip: style.getPropertyValue('--z-tooltip').trim(),
        loadingOverlay: style.getPropertyValue('--z-loading-overlay').trim(),
        modal: style.getPropertyValue('--z-modal').trim(),
        toast: style.getPropertyValue('--z-toast').trim(),
      };
    });

    expect(tokens.canvasBg).toBe('0');
    expect(tokens.edge).toBe('10');
    expect(tokens.parentNode).toBe('20');
    expect(tokens.childNode).toBe('30');
    expect(tokens.activeNode).toBe('40');
    expect(tokens.nodeBadge).toBe('50');
    expect(tokens.canvasControls).toBe('100');
    expect(tokens.floatingPanel).toBe('200');
    expect(tokens.contextMenu).toBe('500');
    expect(tokens.tooltip).toBe('1000');
    expect(tokens.loadingOverlay).toBe('2000');
    expect(tokens.modal).toBe('3000');
    expect(tokens.toast).toBe('9999');
  });

  test('2. 4-Stage Status Color Tokens (Passed, Failed, Blocked, Untested)', async ({ page }) => {
    await page.goto('/');

    const statusColors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        passedText: style.getPropertyValue('--status-passed-text').trim(),
        failedText: style.getPropertyValue('--status-failed-text').trim(),
        blockedText: style.getPropertyValue('--status-blocked-text').trim(),
        untestedText: style.getPropertyValue('--status-untested-text').trim(),
      };
    });

    expect(statusColors.passedText).toBe('#15803d');
    expect(statusColors.failedText).toBe('#b91c1c');
    expect(statusColors.blockedText).toBe('#b45309');
    expect(statusColors.untestedText).toBe('#475569');
  });

  test('3. Inner Content vs Outer Rim Isolation (Halo Handle Click Stealing Prevention)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });

    const firstNode = page.locator('.react-flow__node').first();
    const haloHandle = firstNode.locator('.halo-handle');

    if (await haloHandle.count() > 0) {
      // 1) Verify halo-handle z-index is strictly <= 0 (var(--z-canvas-bg))
      const zIndex = await haloHandle.evaluate(el => window.getComputedStyle(el).zIndex);
      expect(Number(zIndex) || 0).toBeLessThanOrEqual(0);

      // 2) Verify node content or badge receives direct clicks without handle interception
      const badge = firstNode.locator('.badge-pill').first();
      if (await badge.count() > 0) {
        // Click the badge directly
        await badge.click({ force: false }); // force: false ensures no overlying element intercepts the click

        // Ensure badge click was processed and highlighted or opened in panel
        await page.waitForTimeout(500);
        const style = await badge.getAttribute('style');
        const isBoxShadowApplied = style && style.includes('box-shadow');
        expect(isBoxShadowApplied).toBeTruthy();
      }
    }
  });

  test('4. Focus+Context Pure CSS Rule (Class-based Dimming)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });

    const nodes = page.locator('.react-flow__node');
    const count = await nodes.count();
    if (count >= 2) {
      const targetNode = nodes.first();
      await targetNode.click({ force: true });

      // Active node gets .active class
      await expect(targetNode).toHaveClass(/active/);

      // Surrounding unrelated nodes get .de-emphasized class via pure CSS
      const otherNodes = page.locator('.react-flow__node:not(.active)');
      await expect(otherNodes.first()).toHaveClass(/de-emphasized/);

      // Verify no inline opacity style was injected directly on node container
      const inlineStyle = await otherNodes.first().getAttribute('style') || '';
      expect(inlineStyle).not.toMatch(/opacity:\s*0\./);
    }
  });

  test('5. Root Cause Tracing CSS Animation Definition', async ({ page }) => {
    await page.goto('/');

    // Verify keyframes and class rules in CSSOM
    const hasRootCauseStyles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let foundNodeRule = false;
      let foundEdgeRule = false;
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule.cssText.includes('.highlight-root-cause')) {
              if (rule.cssText.includes('pulse-root-cause')) foundNodeRule = true;
              if (rule.cssText.includes('react-flow__edge')) foundEdgeRule = true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return { foundNodeRule, foundEdgeRule };
    });

    expect(hasRootCauseStyles.foundNodeRule).toBe(true);
    expect(hasRootCauseStyles.foundEdgeRule).toBe(true);
  });
});
