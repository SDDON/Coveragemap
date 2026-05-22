import { test, expect } from '@playwright/test';

test('Eval2', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport');
    return vp ? vp.getAttribute('style') : 'No vp';
  });
  console.log('Viewport style:', data);
});
