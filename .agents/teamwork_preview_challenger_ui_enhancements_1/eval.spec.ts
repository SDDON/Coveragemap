import { test, expect } from '@playwright/test';

test('Eval', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => {
    const node = document.querySelector('.react-flow__node');
    if (!node) return 'No node';
    const rect = node.getBoundingClientRect();
    const computed = window.getComputedStyle(node);
    return { rect: rect.toJSON(), transform: computed.transform };
  });
  console.log(data);
});
