const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.react-flow__handle');
  
  const data = await page.evaluate(() => {
    const node = document.querySelector('.react-flow__node');
    const handles = document.querySelectorAll('.react-flow__handle');
    return {
      node: node ? node.getBoundingClientRect().toJSON() : null,
      handles: Array.from(handles).slice(0, 2).map(h => ({
        rect: h.getBoundingClientRect().toJSON(),
        style: h.getAttribute('style'),
        className: h.className,
        computedTransform: window.getComputedStyle(h).transform,
        computedLeft: window.getComputedStyle(h).left
      }))
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
