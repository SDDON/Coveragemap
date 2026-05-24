import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to frontend
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  
  // Select "Arena" workspace
  await page.click('button:has-text("Arena")');
  await page.waitForTimeout(1500);

  // 1. Verify Globals tab exists
  const hasGlobalsTab = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Globals'));
  });
  console.log('Globals tab exists:', hasGlobalsTab);

  if (hasGlobalsTab) {
    // Click globals tab
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Globals'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    // Verify global node exists in the list
    const hasGlobalItem = await page.evaluate(() => {
      return document.body.innerText.includes('Dummy Node with 5 Badges');
    });
    console.log('Global node listed in panel:', hasGlobalItem);
  }

  // 2. Verify window.confirm is hooked up
  page.on('dialog', async dialog => {
    console.log('Dialog appeared:', dialog.message());
    await dialog.dismiss();
  });

  // Click disconnect button
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Disconnect Dependency (Edge only)');
    if (btn) btn.click();
  });

  await page.waitForTimeout(1000);
  
  await browser.close();
})();
