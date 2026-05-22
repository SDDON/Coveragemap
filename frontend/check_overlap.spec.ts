import { test } from '@playwright/test';

test('Check overlap', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__edge-path');
  await page.waitForTimeout(1000);

  const edge = page.locator('.react-flow__edge-path').first();
  const d = await edge.getAttribute('d');
  console.log('Edge path:', d);

  // Find marker end
  const markerUrl = await edge.getAttribute('marker-end');
  console.log('Marker URL:', markerUrl);

  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  console.log('Nodes count:', count);
  for (let i = 0; i < count; i++) {
    const box = await nodes.nth(i).boundingBox();
    console.log('Node', i, 'box:', box);
  }
});
