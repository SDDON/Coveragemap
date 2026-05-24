import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to frontend
  await page.goto('http://localhost:5173');
  
  // Wait for React Flow to load initially
  await page.waitForTimeout(1000);
  
  // Get the initial viewport transform
  const getTransform = async () => {
    return await page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      return viewport ? viewport.getAttribute('style') : null;
    });
  };
  
  const initialTransform = await getTransform();
  console.log('Initial transform:', initialTransform);
  
  // Select "Arena" workspace
  await page.click('button:has-text("Arena")');
  
  // Wait for the graph to load and layout, and fitView to trigger (150ms + 800ms animation)
  await page.waitForTimeout(2000);
  
  const postWorkspaceTransform = await getTransform();
  console.log('Post-workspace transform:', postWorkspaceTransform);
  
  if (initialTransform !== postWorkspaceTransform) {
    console.log('Camera moved successfully (fitView triggered).');
  } else {
    console.log('Camera DID NOT MOVE.');
  }
  
  // Verify if Dummy Node badge exists
  const hasBadge = await page.evaluate(() => {
    return document.body.innerText.includes('Dummy Node with 5 Badges');
  });
  
  console.log('Badge exists in DOM:', hasBadge);
  
  await browser.close();
})();
