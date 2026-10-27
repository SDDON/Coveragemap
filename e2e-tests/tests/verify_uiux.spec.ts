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

  test('Page title is CoverageMap and enterprise preset (40 nodes / 300 edges) loads cleanly', async ({ page, request }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
    const graphPromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphPromise;

    await expect(page).toHaveTitle('CoverageMap');

    // Open Presets modal
    await page.locator('button:has-text("Presets")').click();
    const featuredCard = page.getByTestId('preset-card-honkai_starrail_full_qa');
    await expect(featuredCard).toBeVisible();
    await expect(featuredCard).toContainText('노드 40개');
    await expect(featuredCard).toContainText('엣지 300개');

    // Click Load on featured preset
    const loadRespPromise = page.waitForResponse(
      res => res.url().includes('/api/presets/honkai_starrail_full_qa/load') && res.status() === 200
    );
    await featuredCard.locator('button:has-text("불러오기")').click();
    const loadResp = await loadRespPromise;
    const loadJson = await loadResp.json();
    expect(loadJson.nodes_created).toBe(40);
    expect(loadJson.edges_created).toBe(300);

    // Verify backend /api/graph returns 40 nodes and 300 edges
    const verifyGraph = await (await request.get('/api/graph')).json();
    expect(verifyGraph.nodes.length).toBe(40);
    expect(verifyGraph.edges.length).toBe(300);

    // Wait for modal auto-close (700ms timer), then re-open Presets modal to verify collapsible auto-backup section and merge mode (clean=false)
    await expect(featuredCard).not.toBeVisible();
    await page.locator('button:has-text("Presets")').click();
    const backupToggleBtn = page.locator('button:has-text("자동 백업 복원 목록")');
    await expect(backupToggleBtn).toBeVisible();
    await backupToggleBtn.click();
    await expect(page.locator('[data-testid^="preset-card-_autobackup_"]').first()).toBeVisible();

    // Uncheck Clean Load to test Merge mode (clean=false) idempotency on the 40-node / 300-edge graph
    const cleanCheckbox = page.locator('#cleanLoadCheckbox');
    await cleanCheckbox.uncheck();

    const mergeRespPromise = page.waitForResponse(
      res => res.url().includes('/api/presets/honkai_starrail_full_qa/load?clean=false') && res.status() === 200
    );
    await page.getByTestId('preset-card-honkai_starrail_full_qa').locator('button:has-text("불러오기")').click();
    const mergeResp = await mergeRespPromise;
    const mergeJson = await mergeResp.json();
    expect(mergeJson.clean_mode).toBe(false);

    // Verify graph did not duplicate nodes or edges after merge load
    const verifyMergedGraph = await (await request.get('/api/graph')).json();
    expect(verifyMergedGraph.nodes.length).toBe(40);
    expect(verifyMergedGraph.edges.length).toBe(300);

    // Verify the latest auto-backup of the 40-node graph preserved semantic node IDs
    const presetsList = await (await request.get('/api/presets')).json();
    const latestBackup = presetsList.find((p: any) => p.id.startsWith('_autobackup_') && p.node_count === 40);
    expect(latestBackup).toBeTruthy();
    const backupDetail = await (await request.get(`/api/presets/${latestBackup.id}`)).json();
    expect(backupDetail.nodes.some((n: any) => n.id === 'Screen_Title_Express')).toBe(true);
  });
});

