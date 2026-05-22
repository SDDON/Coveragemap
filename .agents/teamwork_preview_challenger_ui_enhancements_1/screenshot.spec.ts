import { test } from '@playwright/test';

test('Screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e:/Workspace/coveragemap/.agents/teamwork_preview_challenger_ui_enhancements_1/screenshot.png' });
});
