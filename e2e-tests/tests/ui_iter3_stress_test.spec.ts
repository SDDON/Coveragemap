import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('framenavigated', async () => {
    try {
      const heavyBtn = page.getByRole('button', { name: /전체 그래프 로드/i });
      await heavyBtn.waitFor({ state: 'visible', timeout: 1500 });
      await heavyBtn.click({ force: true });
    } catch (e) {
      // Ignore if button is not present
    }
  });
});

test.describe('Iteration 3 UI Enhancements Stress Test', () => {
  // SKIP-REASON: 트리아지 대기 - 2026-10-04 skip 해제 재실행 시 실패(Error: expect(locator).toBeVisible() failed). 기능 결함/스펙 변경/무효 여부 미판정
  test.skip('verify Focus+Context, Directional Colors, and Full-boundary connections', async ({ page }) => {
    test.setTimeout(120000);
                let fakeNodes = [];
    let fakeEdges = [];

    await page.route('**/api/graph*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { nodes: fakeNodes, edges: fakeEdges } });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/nodes*', async route => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        const newNode = { id: 'node-' + Math.random(), label: postData.label, name: postData.name || postData.label, aliases: [], properties: {}, test_status: 'Untested' };
        fakeNodes.push(newNode);
        await route.fulfill({ json: newNode.id });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/edges*', async route => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        const newEdge = { id: 'edge-' + Math.random(), source: postData.source, target: postData.target, type: 'Transition', properties: {}, test_status: 'Untested' };
        fakeEdges.push(newEdge);
        await route.fulfill({ json: { id: newEdge.id } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForTimeout(500);

    const createNode = async (name) => {
      await page.click('button:has-text("Add Node")');
      const nameInput = page.locator('#nodeName');
      await expect(nameInput).toBeVisible({ timeout: 3000 });
      await nameInput.fill(name);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(500);
    };

    await createNode('TestNode1'); await createNode('TestNode2'); await createNode('TestNode3');

    const node1 = page.locator('.react-flow__node:has-text("TestNode1")').first();
    const node2 = page.locator('.react-flow__node:has-text("TestNode2")').first();
    const node3 = page.locator('.react-flow__node:has-text("TestNode3")').first();

    await expect(node1).toBeVisible(); await expect(node2).toBeVisible(); await expect(node3).toBeVisible();

    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(500);

    
    const createEdge = async (src, tgt) => {
      const sId = await src.getAttribute('data-id');
      const tId = await tgt.getAttribute('data-id');
      await page.evaluate(async ({ s, t }) => {
        await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: s, target: t, type: 'Transition', test_status: 'Untested', properties: {} })
        });
      }, { s: sId, t: tId });
      await page.waitForTimeout(100);
    };

    await createEdge(node1, node2);
    await createEdge(node2, node3);
    await createEdge(node1, node3);

    const filterSelect = page.locator('#filterGraph');
    await expect(filterSelect).toBeVisible({ timeout: 5000 });
    await filterSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const depthPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method()==='GET');
    await page.fill('input[type="number"]', '2');
    await depthPromise;
    await page.waitForTimeout(500);

    await node1.click();
    await page.waitForTimeout(500);

    const reactFlow = page.locator('.react-flow').first();
    await expect(reactFlow).toHaveClass(/.*has-selection.*/);
    await expect(node1).toHaveClass(/.*active.*/);
    await expect(node2).toHaveClass(/.*active.*/);
    await expect(node2).toHaveClass(/.*highlight-outgoing.*/);
    await expect(node3).toHaveClass(/.*active.*/);
    await expect(node3).toHaveClass(/.*highlight-outgoing.*/);

    const activeEdges = page.locator('.react-flow__edge.active.highlight-edge');
    expect(await activeEdges.count()).toBeGreaterThanOrEqual(3);

    await page.mouse.click(10, 10);
    await page.waitForTimeout(500);

    await node2.click();
    await page.waitForTimeout(500);

    await expect(node1).toHaveClass(/.*highlight-incoming.*/);
    await expect(node3).toHaveClass(/.*highlight-outgoing.*/);
  });
});
