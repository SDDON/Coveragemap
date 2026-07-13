import { test, expect } from '@playwright/test';

test.describe('Workspace Manager & Context Menu Tests', () => {
  test('should display context menu on right click', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    // Select workspace or bypass
    if (await page.locator('text=Select Workspace').isVisible()) {
      await page.locator('button:has-text("전체 그래프 로드")').click();
    }

    // Right click on the pane
    await page.locator('.react-flow__pane').click({ button: 'right' });
    
    // Context menu should be visible
    await expect(page.locator('.context-menu')).toBeVisible();
    await expect(page.locator('text=새 노드 추가')).toBeVisible();
    await expect(page.locator('text=전체 화면 맞춤')).toBeVisible();
    await expect(page.locator('text=새로고침')).toBeVisible();
  });

  test('should open Workspace Manager modal', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    // Select workspace or bypass
    if (await page.locator('text=Select Workspace').isVisible()) {
      await page.locator('button:has-text("Workspace 관리자")').click();
      await expect(page.locator('.workspace-manager-modal')).toBeVisible();
      await expect(page.locator('h2:has-text("Workspace 관리자")')).toBeVisible();
    }
  });
});
