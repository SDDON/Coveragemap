import { test, expect } from '@playwright/test';

test('Eval3', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
    return nodes.map(n => n.getAttribute('style'));
  });
  console.log('Node styles:', data);
});
