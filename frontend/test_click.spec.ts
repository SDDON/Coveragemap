import { test, expect } from '@playwright/test';

test('Node can be selected by clicking', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  const node = page.locator('.react-flow__node').first();
  await node.evaluate(node => node.scrollIntoView());
  await node.dispatchEvent('click');

  await expect(node).toHaveClass(/active/);
});
