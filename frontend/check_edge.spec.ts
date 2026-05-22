import { test, expect } from '@playwright/test';

test('check edge arrowhead overlap', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__edge');

  const node = page.locator('.react-flow__node').first();
  const nodeBox = await node.boundingBox();

  // Find an edge
  const edgePath = page.locator('.react-flow__edge-path').first();
  const edgeD = await edgePath.getAttribute('d');
  console.log('Edge d:', edgeD);
  
  // Find marker
  const marker = page.locator('marker').first();
  const markerHtml = await marker.innerHTML();
  console.log('Marker HTML:', markerHtml);
  
  // Wait, let's just see if we can get the actual arrowhead path and node box.
});
