const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  
  // Click an edge
  const edge = page.locator('.react-flow__edge').first();
  await edge.click();
  
  // Wait a moment for state to update
  await page.waitForTimeout(500);
  
  const node = page.locator('.react-flow__node').first();
  const opacity = await node.evaluate(el => window.getComputedStyle(el).opacity);
  console.log('Node opacity after clicking edge:', opacity);
  
  if (parseFloat(opacity) < 1) {
    console.log('FAILED: Nodes are dimmed when an edge is selected.');
  } else {
    console.log('SUCCESS: Nodes are NOT dimmed when an edge is selected.');
  }
  await browser.close();
})();
