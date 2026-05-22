import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__node');
  
  const node = page.locator('.react-flow__node').first();
  const box = await node.boundingBox();
  console.log('Node:', box);
  
  const target = node.locator('.react-flow__handle-top').first();
  const targetBox = await target.boundingBox();
  console.log('Target Handle:', targetBox);
  
  const source = node.locator('.react-flow__handle-bottom').first();
  const sourceBox = await source.boundingBox();
  console.log('Source Handle:', sourceBox);
  
  await browser.close();
})();
