import { test, expect } from '../fixtures';

test.describe('Badge Selection API and Focus Verification', () => {

  test.beforeEach(async ({ page, request }) => {
    const resetRes = await request.post('/api/dev/reset-seed');
    expect(resetRes.ok()).toBeTruthy();

    const graphRes = await request.get('/api/graph');
    expect(graphRes.ok()).toBeTruthy();
    const graph = await graphRes.json();
    const rootNode = graph.nodes.find((n: any) => n.properties?.id === 'Game_Root' || n.name === 'Game Testing Root');
    expect(rootNode).toBeDefined();

    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Component',
        name: 'Badge_Selection_Node',
        test_status: 'Untested',
        properties: { is_global: 'true', description: 'Badge Selection Test' },
      },
    });
    expect(gRes.ok()).toBeTruthy();
    const gId = await gRes.json();

    const edgeRes = await request.post('/api/edges', {
      data: { source: rootNode.id, target: gId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });
    expect(edgeRes.ok()).toBeTruthy();

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('savedShowAll', 'true');
    });
  });

  test('Clicking badge fetches API without 405 error and highlights badge', async ({ page }) => {
    const graphPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphPromise;

    // Wait for the graph to load and root node to be visible
    const rootNodeLocator = page.locator('.react-flow__node', { hasText: 'Game Testing Root' });
    await expect(rootNodeLocator).toBeVisible({ timeout: 15000 });

    // Strict assertion: Find badge scoped to root node and click it natively
    const badge = rootNodeLocator.locator('.badge-pill', { hasText: 'Badge_Selection_Node' });
    await expect(badge).toBeVisible({ timeout: 15000 });
    await badge.click();

    // Verify badge selection highlight is applied via .badge-selected class
    await expect(badge).toHaveClass(/badge-selected/, { timeout: 15000 });

    // Verify the right panel shifted to Edit tab for this node
    await expect(page.locator('.details-panel')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#nodeName')).toHaveValue('Badge_Selection_Node', { timeout: 15000 });
    await expect(page.locator('label', { hasText: 'Issue Link' })).toBeVisible({ timeout: 15000 });
  });
});
