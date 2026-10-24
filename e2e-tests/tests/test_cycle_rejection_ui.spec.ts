import { test, expect, APIRequestContext } from '../fixtures';

type SeedIds = { tc1: string; root: string; child: string; settings: string };

const getSeedIds = async (request: APIRequestContext): Promise<SeedIds> => {
  const graph = await (await request.get('/api/graph')).json();
  const byKey = (key: string) => {
    const n = graph.nodes.find((x: any) =>
      x.properties?.id === key ||
      x.id === key ||
      x.name === key ||
      (key === 'Game_Root' && (x.name === 'Game Testing Root' || x.aliases?.includes('Root'))) ||
      (key === 'Game_Child' && (x.name === 'Game Testing Child' || x.aliases?.includes('Sub'))) ||
      (key === 'Game_Settings' && (x.name === 'Game Settings' || x.aliases?.includes('Settings'))) ||
      (key === 'TC1' && (x.label === 'TestCase' || x.name === 'Initial TC' || x.properties?.title === 'Initial TC'))
    );
    if (!n) throw new Error(`seed node ${key} not found in graph`);
    return n.id as string;
  };
  return {
    tc1: byKey('TC1'),
    root: byKey('Game_Root'),
    child: byKey('Game_Child'),
    settings: byKey('Game_Settings'),
  };
};

test.describe('F4: Dependency Cycle Rejection & Self-Loop Prevention UI Tests', () => {
  let ids: SeedIds;

  test.beforeEach(async ({ page, request }) => {
    await request.post('/api/dev/reset-seed');
    ids = await getSeedIds(request);
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
  });

  test('UI rejects circular Depends_On edge update with error toast and preserves graph integrity', async ({ page, request }) => {
    // Seed: Game_Root --Depends_On--> Game_Child
    // Create reverse edge Game_Child --Transition--> Game_Root
    const edgeRes = await request.post('/api/edges', {
      data: {
        source: ids.child,
        target: ids.root,
        type: 'Transition',
        test_status: 'Untested',
        properties: {},
      },
    });
    expect(edgeRes.ok()).toBeTruthy();
    const reverseEdgeId = await edgeRes.json();

    const graphLoaded = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphLoaded;

    // Switch Inspector to Edit tab first so selecting an edge immediately displays EditEdgeForm
    await page.getByRole('button', { name: 'Edit' }).click();

    // Locate the reverse edge on the canvas and click its path to select
    const edgeLocator = page.locator(`.react-flow__edge[data-id="${reverseEdgeId}"]`);
    await expect(edgeLocator).toBeVisible();
    await edgeLocator.locator('path').first().dispatchEvent('click');

    // Verify Inspector opens for the edge
    const edgeTypeSelect = page.locator('#edgeType');
    await expect(edgeTypeSelect).toBeVisible();

    // Attempt to change type to Depends_On (creating cycle: Root -> Child -> Root)
    await edgeTypeSelect.selectOption('Depends_On');

    // Click "Save" button in Inspector
    const saveBtn = page.locator('.details-panel button.primary:has-text("Save")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verification: Backend returns HTTP 400 and ErrorToast surfaces on screen
    const errorToast = page.locator('.error-toast');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(/Dependency cycle detected/i);

    // Verify database state: edge remains Transition, not Depends_On
    const graphAfter = await (await request.get('/api/graph')).json();
    const edgeInDb = graphAfter.edges.find((e: any) => e.id === reverseEdgeId);
    expect(edgeInDb.type).toBe('Transition');
  });

  test('Backend rejects direct circular Depends_On and Tests edges with HTTP 400', async ({ request }) => {
    // Direct cycle: Game_Child -> Game_Root (Depends_On)
    const cycleRes = await request.post('/api/edges', {
      data: {
        source: ids.child,
        target: ids.root,
        type: 'Depends_On',
        test_status: 'Untested',
        properties: {},
      },
    });
    expect(cycleRes.status()).toBe(400);
    const errData = await cycleRes.json();
    expect(errData.detail).toContain('Dependency cycle detected');

    // Tests cycle: Game_Root -> TC1 (Tests) when TC1 already tests Game_Root
    const testsCycleRes = await request.post('/api/edges', {
      data: {
        source: ids.root,
        target: ids.tc1,
        type: 'Tests',
        test_status: 'Untested',
        properties: {},
      },
    });
    expect(testsCycleRes.status()).toBe(400);
  });

  test('Self-loop dependency edge creation is rejected with HTTP 400', async ({ request }) => {
    const selfLoopRes = await request.post('/api/edges', {
      data: {
        source: ids.root,
        target: ids.root,
        type: 'Depends_On',
        test_status: 'Untested',
        properties: {},
      },
    });
    expect(selfLoopRes.status()).toBe(400);
    const errData = await selfLoopRes.json();
    expect(errData.detail).toContain('Self-loop');
  });

  test('SPEC Rule 12: Return edge allows navigation cycle without dependency blocking', async ({ page, request }) => {
    // Game Cycle with Return edge: Game_Child -> Game_Root (Return, Weight=0)
    const returnRes = await request.post('/api/edges', {
      data: {
        source: ids.child,
        target: ids.root,
        type: 'Return',
        test_status: 'Untested',
        properties: { action: 'Back to Lobby' },
      },
    });
    expect(returnRes.status()).toBe(200);
    const returnEdgeId = await returnRes.json();

    const graphLoaded = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphLoaded;

    // Return edge must be rendered cleanly on canvas without error
    const returnEdge = page.locator(`.react-flow__edge[data-id="${returnEdgeId}"]`);
    await expect(returnEdge).toBeVisible();
    await expect(page.locator('.error-toast')).toHaveCount(0);
  });
});
