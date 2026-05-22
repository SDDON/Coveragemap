content = \"\"\"import { test, expect } from '@playwright/test';

test.describe('Iteration 3 UI Enhancements Stress Test', () => {
  test('verify Focus+Context, Directional Colors, and Full-boundary connections', async ({ page }) => {
    // Mock the graph so fitView centers our new nodes cleanly without being influenced by seed data
    await page.route('**/api/graph*', async route => {
      if (route.request().method() === 'GET') {
        const response = await route.fetch(); const json = await response.json(); json.nodes = json.nodes.filter((n) => n.label && n.label.startsWith('TestNode')); const testNodeIds = new Set(json.nodes.map((n) => n.id)); json.edges = json.edges.filter((e) => testNodeIds.has(e.source) && testNodeIds.has(e.target)); await route.fulfill({ response, json });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Create a new node 1
    await page.click('button:has-text("Create Node")');
    await page.waitForSelector('text=Create Node');
    await page.fill('input[type="text"] >> nth=0', 'TestNode1');
    await page.fill('input[type="text"] >> nth=2', 'TestNode1, t1, alias1');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);
    
    // Create a new node 2
    await page.click('button:has-text("Create Node")');
    await page.waitForSelector('text=Create Node');
    await page.fill('input[type="text"] >> nth=0', 'TestNode2');
    await page.fill('input[type="text"] >> nth=2', 'TestNode2, t2, alias2');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);
    
    // Create a new node 3
    await page.click('button:has-text("Create Node")');
    await page.waitForSelector('text=Create Node');
    await page.fill('input[type="text"] >> nth=0', 'TestNode3');
    await page.fill('input[type="text"] >> nth=2', 'TestNode3, t3, alias3');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);

    // Find the created nodes
    const node1 = page.locator('.react-flow__node:has-text("TestNode1")').first();
    const node2 = page.locator('.react-flow__node:has-text("TestNode2")').first();
    const node3 = page.locator('.react-flow__node:has-text("TestNode3")').first();

    await expect(node1).toBeVisible();
    await expect(node2).toBeVisible();
    await expect(node3).toBeVisible();

    // Verify connection mechanism
    const box1 = await node1.boundingBox();
    const box2 = await node2.boundingBox();
    const box3 = await node3.boundingBox();
    
    if (!box1 || !box2 || !box3) throw new Error('Bounding boxes not found');

    // Click Fit View so nodes are in viewport
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

    // Refresh depth to apply updates to active set properly
    const depthPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.request().method() === 'GET');
    await page.fill('input[type="number"]', '2');
    await depthPromise;
    await page.waitForTimeout(500);

    // Click on node 1 to focus
    await node1.click();
    await page.waitForTimeout(500);

    // 1. Verify ReactFlow container has .has-selection
    const reactFlow = page.locator('.react-flow').first();
    await expect(reactFlow).toHaveClass(/.*has-selection.*/);

    // 2. Node 1 should be active
    await expect(node1).toHaveClass(/.*active.*/);
    
    // 3. Node 2 and Node 3 should be active and highlight-outgoing (since 1->2 and 1->3)
    await expect(node2).toHaveClass(/.*active.*/);
    await expect(node2).toHaveClass(/.*highlight-outgoing.*/);
    await expect(node3).toHaveClass(/.*active.*/);
    await expect(node3).toHaveClass(/.*highlight-outgoing.*/);

    // 4. Verify edges
    const activeEdges = page.locator('.react-flow__edge.active.highlight-edge');
    const edgeCount = await activeEdges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(3);

    // Click background to deselect
    await page.mouse.click(10, 10);
    await page.waitForTimeout(500);

    // Click Node 2
    await node2.click();
    await page.waitForTimeout(500);

    // Node 2 is selected. Node 1 is incoming, Node 3 is outgoing
    await expect(node1).toHaveClass(/.*highlight-incoming.*/);
    await expect(node3).toHaveClass(/.*highlight-outgoing.*/);

    console.log('Stress test passed: Full-boundary handles, directional colors, and focus+context verified.');
  });
});\"\"\"
with open('e:/Workspace/coveragemap/e2e-tests/tests/ui_iter3_stress_test.spec.ts', 'w') as f:
    f.write(content)
