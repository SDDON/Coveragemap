import { test } from '@playwright/test';

test('Dump default style', async ({ page }) => {
  await page.setContent('<div class="react-flow__handle react-flow__handle-top"></div>');
  const handle = page.locator('.react-flow__handle-top');
  const styles = await handle.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return { top: s.top, left: s.left, transform: s.transform };
  });
  console.log(styles);
});
