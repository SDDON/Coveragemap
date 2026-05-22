const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  
  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  
  if (box) {
    console.log('Node found at:', box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 10 });
    await page.mouse.up();
    
    const newBox = await node.boundingBox();
    console.log('Node new position:', newBox);
    
    if (Math.abs(newBox.x - box.x) < 5 && Math.abs(newBox.y - box.y) < 5) {
      console.log('FAILED: Node did not move! It is likely because the handle covers the node.');
    } else {
      console.log('SUCCESS: Node moved.');
    }
  } else {
    console.log('No node box');
  }
  await browser.close();
})();
