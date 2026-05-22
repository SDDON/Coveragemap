import { test, expect } from '@playwright/test';
test('debug network status', async ({ page }) => {
  page.on('response', res => console.log('RES:', res.url(), res.status()));
  await page.goto('/');
  await page.waitForTimeout(2000);
});
