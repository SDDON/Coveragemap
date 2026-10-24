import { test, expect } from '../fixtures';

test.describe('Badge Usability UI/UX Verification', () => {

  test.beforeEach(async ({ request }) => {
    await request.post('/api/dev/reset-seed');
  });

  test('Workspace Modal - "Do not show again" functionality', async ({ page }) => {
    // Clear localStorage to ensure the workspace selection modal appears
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // Check if modal is visible initially
    await expect(page.locator('text=Select Workspace')).toBeVisible();

    // Check the "Do not show again" checkbox
    const checkbox = page.locator('input#rememberWorkspace');
    await checkbox.check();

    // Click "전체 그래프 로드 (Heavy)" to save and proceed
    const loadAllBtn = page.locator('button:has-text("전체 그래프 로드")');
    await loadAllBtn.click();

    // Verify modal is gone
    await expect(page.locator('text=Select Workspace')).not.toBeVisible();

    // Verify localStorage was set
    const savedShowAll = await page.evaluate(() => localStorage.getItem('savedShowAll'));
    expect(savedShowAll).toBe('true');

    // Reload the page
    await page.reload();

    // Verify modal does not show up again
    await expect(page.locator('text=Select Workspace')).not.toBeVisible();
  });

  test('Focus retention / Optimistic update on badge status change', async ({ page, request }) => {
    // Deterministic fixture: create a global badge attached to Game_Root
    const graph = await (await request.get('/api/graph')).json();
    const rootNode = graph.nodes.find((n: any) => n.properties?.id === 'Game_Root' || n.name === 'Game Testing Root');
    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Component',
        name: 'UIUX_Test_Badge',
        test_status: 'Untested',
        properties: { is_global: 'true', description: 'Badge for optimistic update test' },
      },
    });
    const globalId = await gRes.json();
    await request.post('/api/edges', {
      data: { source: rootNode.id, target: globalId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });

    // Navigate and bypass modal
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
    const graphPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphPromise;

    // Strict assertion: badge must be visible without conditional guards
    const badge = page.locator('.badge-pill').first();
    await expect(badge).toBeVisible();

    // Intercept /api/graph to verify optimistic update does not trigger a full graph reload
    let refreshCalled = false;
    page.on('request', req => {
      if (req.url().includes('/api/graph')) {
        refreshCalled = true;
      }
    });

    // Click "Mark Passed" on the badge
    const passBtn = badge.locator('button[title="Mark Passed"]');
    await passBtn.click();

    // Optimistic UI check: checkmark ✔ is immediately visible
    await expect(badge.locator('text=✔')).toBeVisible();

    // Verify triggerRefresh was NOT called (no new /api/graph request)
    expect(refreshCalled).toBe(false);
  });

  test('Tooltip visibility on hover', async ({ page, request }) => {
    // Deterministic fixture: create global badge with explicit description and issue_link
    const graph = await (await request.get('/api/graph')).json();
    const rootNode = graph.nodes.find((n: any) => n.properties?.id === 'Game_Root' || n.name === 'Game Testing Root');
    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Component',
        name: 'UIUX_Tooltip_Badge',
        test_status: 'Untested',
        properties: {
          is_global: 'true',
          description: 'Tooltip Test Verification Description',
          issue_link: 'https://jira.example.com/CM-1',
        },
      },
    });
    const globalId = await gRes.json();
    await request.post('/api/edges', {
      data: {
        source: rootNode.id,
        target: globalId,
        type: 'Depends_On',
        test_status: 'Untested',
        properties: {
          description: 'Tooltip Test Verification Description',
          issue_link: 'https://jira.example.com/CM-1',
        },
      },
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
    const graphPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphPromise;

    // Strict assertions: badge and tooltip must exist and transition on hover
    const badge = page.locator('.badge-pill').first();
    await expect(badge).toBeVisible();

    const tooltip = badge.locator('.badge-tooltip');
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip).not.toBeVisible();

    await badge.hover();
    await expect(tooltip).toBeVisible();
  });
});
