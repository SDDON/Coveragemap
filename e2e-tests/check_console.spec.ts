import { test, expect } from '@playwright/test';

test('Check console', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(5000);
  const edges = await page.locator('.react-flow__edge').count();
  console.log('Edges rendered:', edges);
});
