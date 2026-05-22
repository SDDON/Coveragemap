import { test, expect } from '@playwright/test';

test('Focus+Context classes are applied correctly', async ({ page }) => {
  await page.goto('http://localhost:5173');
  // Wait for react flow nodes to load
  await page.waitForSelector('.react-flow__node');

  // Verify there are nodes. We need at least one node.
  const nodes = page.locator('.react-flow__node');
  const nodeCount = await nodes.count();
  expect(nodeCount).toBeGreaterThan(0);

  // Click the first node to select it
  await nodes.first().evaluate(node => node.scrollIntoView());
  await nodes.first().dispatchEvent('click');

  // Check if .has-selection is added to .react-flow
  await expect(page.locator('.react-flow')).toHaveClass(/has-selection/);

  // Wait a bit to ensure React state updates
  await page.waitForTimeout(500);

  // Take a screenshot or check specific classes
  // In our logic, the clicked node is .selected
  await expect(nodes.first()).toHaveClass(/active/);

});
