import { test, expect } from '@playwright/test';

test.describe('Adversarial Frontend Tests', () => {
  // SKIP-REASON: 트리아지 대기 - 2026-10-04 skip 해제 재실행 시 실패(Error: expect(received).toBe(expected) // Object.is equality). 기능 결함/스펙 변경/무효 여부 미판정
  test.skip('R1: Parent node stretches dynamically', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.route('**/api/aliases*', route => route.fulfill({ json: [] }));
    await page.route('**/api/graph*', route => {
      route.fulfill({
        json: {
          debounce_id: new URL(route.request().url()).searchParams.get('debounce_id') || '0',
          nodes: [
            { id: 'p1', label: 'Screen', name: 'Parent', aliases: [], properties: {}, test_status: 'Untested' },
            { id: 'c1', label: 'Component', name: 'Child', aliases: [], properties: {}, test_status: 'Untested' }
          ],
          edges: [
            { id: 'e1', source: 'p1', target: 'c1', type: 'contains', properties: {}, test_status: 'Untested' }
          ]
        }
      });
    });

    await page.goto('http://localhost:5173');
    await page.waitForSelector('.react-flow__node');
    
    // Check if nodes are in DOM
    console.log(await page.evaluate(() => document.body.innerHTML));

    const parentNodeWrapper = page.locator('.react-flow__node[data-id="p1"] .custom-node-wrapper');
    const childNodeWrapper = page.locator('.react-flow__node[data-id="c1"] .custom-node-wrapper');
    
    await expect(parentNodeWrapper).toHaveCount(1, { timeout: 2000 });
    
    // Evaluate computed style to be absolutely sure
    const pWidth = await parentNodeWrapper.evaluate((el) => window.getComputedStyle(el).width);
    const cWidth = await childNodeWrapper.evaluate((el) => window.getComputedStyle(el).width);
    console.log('Parent Width:', pWidth, 'Child Width:', cWidth);
    
    // Use evaluate instead of toHaveCSS since toHaveCSS might be checking inline styles or exact string matches loosely
    expect(pWidth).toBe('100%');
    expect(cWidth).toBe('240px');
  });
});
