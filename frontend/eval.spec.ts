import { test, expect } from '@playwright/test';

test('Empirical Challenge', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');

  // Verify CoverageNode rendering
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  console.log('Nodes count:', count);
  expect(count).toBeGreaterThan(0);

  // Pick first node
  const firstNode = nodes.first();
  const innerHtml = await firstNode.innerHTML();
  console.log('Inner HTML of first node:', innerHtml);

  // Check if it renders data.label or data.name via CoverageNode
  // React Flow renders custom nodes, so if CoverageNode is active,
  // we should see the divs from CoverageNode.tsx
  
  // Force click to avoid viewport issues
  await firstNode.evaluate(node => node.scrollIntoView());
  await firstNode.dispatchEvent('click');
  await page.waitForTimeout(1000);

  // Check wrapper has selection
  const rfWrapper = page.locator('.react-flow');
  const hasSelectionClass = await rfWrapper.evaluate(el => el.className.includes('has-selection'));
  console.log('Has selection wrapper class:', hasSelectionClass);
  expect(hasSelectionClass).toBeTruthy();

  // The clicked node should have active class
  const isActive = await firstNode.evaluate(el => el.className.includes('active'));
  console.log('Clicked node has active class:', isActive);
  expect(isActive).toBeTruthy();

  // Find another node that is not a neighbor (if any)
  // or at least check if another node exists
  if (count > 1) {
     const lastNode = nodes.last();
     const isLastActive = await lastNode.evaluate(el => el.className.includes('active'));
     console.log('Last node active:', isLastActive);
  }
});
