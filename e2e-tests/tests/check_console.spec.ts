import { test, expect } from '@playwright/test';
test('check console', async ({ page }) => {
  page.on('request', req => console.log('REQ:', req.method(), req.url()));
  page.on('response', res => console.log('RES:', res.status(), res.url()));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  await page.goto('/');
  await page.waitForTimeout(5000);
});