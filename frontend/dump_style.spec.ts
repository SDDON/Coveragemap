import { test } from '@playwright/test';

test('Dump style', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__handle-top');
  const handle = page.locator('.react-flow__handle-top').first();
  const styles = await handle.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return { height: s.height, width: s.width, transform: s.transform, top: s.top, bottom: s.bottom };
  });
  console.log(styles);
});
