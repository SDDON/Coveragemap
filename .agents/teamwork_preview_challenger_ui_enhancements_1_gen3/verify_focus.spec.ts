import { test, expect } from '@playwright/test';

test('Verify Focus+Context functionality', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for React Flow nodes to render
  const nodes = page.locator('.react-flow__node');
  await expect(nodes.first()).toBeVisible({ timeout: 10000 });

  const firstNode = nodes.first();
  console.log('First node ID:', await firstNode.getAttribute('data-id'));

  const content = await firstNode.innerHTML();
  console.log('Node content:', content);

  const box = await firstNode.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await firstNode.click({ force: true });
  }

  const rfWrapper = page.locator('.react-flow');
  await expect(rfWrapper).toHaveClass(/has-selection/);

  await expect(firstNode).toHaveClass(/active/);

  console.log('Verification PASSED: .has-selection and .active applied correctly.');
});
