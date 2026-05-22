import { test, expect } from '@playwright/test';

test('Empirical Verification of Focus+Context', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  
  await page.waitForSelector('.react-flow__node');
  
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  console.log(Found  nodes);
  
  const firstNode = nodes.first();
  await firstNode.click({ force: true });
  
  await page.waitForTimeout(500);
  
  const rf = page.locator('.react-flow').first();
  const classAttr = await rf.getAttribute('class');
  console.log(React Flow classes:  + classAttr);
  
  const nodeClassAttr = await firstNode.getAttribute('class');
  console.log(First Node classes:  + nodeClassAttr);
});
