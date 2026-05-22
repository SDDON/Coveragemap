import { test, expect } from '@playwright/test';

test.describe('Iteration 3 UI Enhancements Stress Test', () => {
  test('verify Focus+Context, Directional Colors, and Full-boundary connections', async ({ page }) => {
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
        const newNode = { id: 'node-' + Math.random(), label: postData.label, name: postData.label, aliases: [], properties: {}, test_status: 'Untested' };
        fakeNodes.push(newNode);
        await route.fulfill({ json: { id: newNode.id } });
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
      await page.waitForSelector('text=Add Node');
      await page.fill('input[type="text"] >> nth=0', name);
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
      const srcHandle = src.locator('.react-flow__handle.source').first();
      const tgtHandle = tgt.locator('.react-flow__handle.target').first();
      const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
      await srcHandle.dragTo(tgtHandle);
      await responsePromise;
    };

    await createEdge(node1, node2);
    await createEdge(node2, node3);
    await createEdge(node1, node3);

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
