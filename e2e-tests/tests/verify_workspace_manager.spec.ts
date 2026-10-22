import { test, expect } from '@playwright/test';

test.describe('Context Menu & Content Focus Pinning Tests', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/dev/reset-seed');
  });

  test('should display context menu on right click and not show removed Workspace Manager button', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    // Select workspace or bypass
    if (await page.locator('text=Select Workspace').isVisible()) {
      await expect(page.locator('button:has-text("Workspace 관리자")')).toHaveCount(0);
      await page.locator('button:has-text("전체 그래프 로드")').click();
    }

    // Right click on the pane at empty coordinates to avoid hitting centered nodes
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 50, y: 150 } });
    
    // Context menu should be visible
    await expect(page.locator('.context-menu')).toBeVisible();
    await expect(page.locator('text=새 노드 추가')).toBeVisible();
    await expect(page.locator('text=전체 화면 맞춤')).toBeVisible();
    await expect(page.locator('text=새로고침')).toBeVisible();
  });

  test('should expand Parent+Children as Depth-0 Content Unit and retain Pinned Content Focus across status marking and pane clicks', async ({ page, request }) => {
    // Seed graph: TC1 --TESTS--> Game_Root --DEPENDS_ON--> Game_Child, Game_Settings (isolated)
    const graph = await (await request.get('/api/graph')).json();
    const byKey = (key: string) => graph.nodes.find((x: any) => x.properties?.id === key).id as string;
    const rootId = byKey('Game_Root');
    const childId = byKey('Game_Child');
    const settingsId = byKey('Game_Settings');
    const tc1Id = byKey('TC1');

    // Make Game_Root contain Game_Child (Contains), and Game_Child transition to Game_Settings (Transition)
    // Also create an unrelated node so we can verify .de-emphasized dimming
    const extraRes = await request.post('/api/nodes', {
      data: { label: 'Feature', name: 'Unrelated_Feature', aliases: ['Other'], test_status: 'Untested', properties: {} },
    });
    const extraId = await extraRes.json();

    await request.post('/api/edges', {
      data: { source: rootId, target: childId, type: 'Contains', test_status: 'Untested', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: childId, target: settingsId, type: 'Transition', test_status: 'Untested', properties: {} },
    });

    await page.addInitScript(() => localStorage.setItem('savedShowAll', 'true'));
    const graphLoaded = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('http://localhost:5173/');
    await graphLoaded;

    const nodeLoc = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
    await expect(nodeLoc(rootId)).toBeVisible();

    // 1) Select parent Game_Root at maxDepth=1:
    // Game_Root and its direct child Game_Child form Depth-0 Content Unit (.active without .highlight-outgoing),
    // and Game_Settings (1 hop from Game_Child) is highlighted as .active.highlight-outgoing!
    await nodeLoc(rootId).click({ position: { x: 40, y: 25 }, force: true });
    await expect(nodeLoc(rootId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(childId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(childId)).not.toHaveClass(/\bhighlight-outgoing\b/);
    await expect(nodeLoc(settingsId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(settingsId)).toHaveClass(/\bhighlight-outgoing\b/);
    await expect(nodeLoc(tc1Id)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(tc1Id)).toHaveClass(/\bhighlight-incoming\b/);
    await expect(nodeLoc(extraId)).toHaveClass(/\bde-emphasized\b/);

    // 2) Pin Content Focus on Game_Root
    const pinBtn = page.locator('.pin-focus-btn');
    await expect(pinBtn).toBeVisible();
    await pinBtn.click();
    await expect(pinBtn).toHaveClass(/\bactive\b/);

    const banner = page.locator('.pinned-focus-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Game Testing Root');

    // 3) Click TC1 and mark it Passed -> Pinned focus on Game_Root Content Unit must NOT be overwritten by TC1!
    await nodeLoc(tc1Id).click({ force: true });
    const putPromise = page.waitForResponse(res => res.url().includes('/api/nodes/') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: /mark passed/i }).click();
    await putPromise;

    await expect(nodeLoc(tc1Id)).toHaveClass(/\bstatus-passed\b/);
    // Game_Settings (2 hops from TC1, but 1 hop from pinned Game_Root's Content Unit) remains .active!
    await expect(nodeLoc(settingsId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(extraId)).toHaveClass(/\bde-emphasized\b/);

    // 4) Clicking empty pane clears selection in Inspector but preserves Pinned Content Focus
    await page.locator('.react-flow__pane').click({ position: { x: 200, y: 200 }, force: true });
    await expect(banner).toBeVisible();
    await expect(nodeLoc(rootId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(settingsId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(extraId)).toHaveClass(/\bde-emphasized\b/);

    // 5) Unpin via floating banner button -> restores full canvas context
    await banner.locator('.pinned-focus-unpin-btn').click();
    await page.mouse.move(200, 200);
    await expect(banner).toHaveCount(0);
    await expect(nodeLoc(extraId)).not.toHaveClass(/\bde-emphasized\b/);
  });

  test('should roll up collapsed parent when child is an outgoing neighbor and retain Search Highlight during status marking', async ({ page, request }) => {
    const graph = await (await request.get('/api/graph')).json();
    const byKey = (key: string) => graph.nodes.find((x: any) => x.properties?.id === key).id as string;
    const rootId = byKey('Game_Root');
    const childId = byKey('Game_Child');
    const settingsId = byKey('Game_Settings');
    const tc1Id = byKey('TC1');

    // Create a child inside Game_Settings (parent container) and link Game_Root -> that child
    const subCompRes = await request.post('/api/nodes', {
      data: { label: 'Component', name: 'Settings_Sub_Button', aliases: ['Settings'], test_status: 'Untested', properties: {} },
    });
    const subCompId = await subCompRes.json();

    await request.post('/api/edges', {
      data: { source: settingsId, target: subCompId, type: 'Contains', test_status: 'Untested', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: rootId, target: subCompId, type: 'Transition', test_status: 'Untested', properties: {} },
    });

    await page.addInitScript(() => localStorage.setItem('savedShowAll', 'true'));
    const graphLoaded = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('http://localhost:5173/');
    await graphLoaded;

    const nodeLoc = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

    // 1) Collapse Game_Settings parent container
    const collapseBtn = nodeLoc(settingsId).locator('.collapse-btn');
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click({ force: true });
    await expect(nodeLoc(subCompId)).toBeHidden();

    // 2) Click Game_Root -> collapsed parent Game_Settings must be rolled up as .active.highlight-outgoing (not dimmed!)
    await nodeLoc(rootId).click({ force: true });
    await expect(nodeLoc(settingsId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(settingsId)).toHaveClass(/\bhighlight-outgoing\b/);

    // 3) Clear selection, enter Search Highlight for "Testing Root", then click Game_Child to mark status -> Search Highlight scope stays on Game_Root
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 }, force: true });
    await page.getByRole('button', { name: 'Filters' }).click();
    const searchInput = page.locator('input[placeholder="Type to highlight nodes..."]');
    await searchInput.fill('Testing Root');
    await expect(nodeLoc(rootId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(tc1Id)).toHaveClass(/\bactive\b/);

    // Click Game_Child and mark it Passed -> TC1 (connected to Game_Root, not Game_Child) remains .active because Search Highlight seed is retained!
    await nodeLoc(childId).click({ force: true });
    const putPromise = page.waitForResponse(res => res.url().includes('/api/nodes/') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: /mark passed/i }).click();
    await putPromise;
    await expect(nodeLoc(tc1Id)).toHaveClass(/\bactive\b/);
  });

  test('should preserve incoming/outgoing direction across Contains edges at Max Depth >= 2 and traverse multi-hop collapsed parent chains', async ({ page, request }) => {
    const graph = await (await request.get('/api/graph')).json();
    const byKey = (key: string) => graph.nodes.find((x: any) => x.properties?.id === key).id as string;
    const rootId = byKey('Game_Root');
    const childId = byKey('Game_Child');
    const settingsId = byKey('Game_Settings');

    // Create ParentB (with ChildB1, ChildB2) and ParentC (with ChildC1)
    // Chain: Game_Root (contains Game_Child) -> ChildB1 (in ParentB); ChildB2 (in ParentB) -> ChildC1 (in ParentC)
    const createNode = async (label: string, name: string) => {
      const res = await request.post('/api/nodes', {
        data: { label, name, aliases: ['Chain'], test_status: 'Untested', properties: {} },
      });
      return (await res.json()) as string;
    };

    const childB1Id = await createNode('Component', 'Settings_Btn_1');
    const childB2Id = await createNode('Component', 'Settings_Btn_2');
    const parentCId = await createNode('Screen', 'Audio_Popup_Screen');
    const childC1Id = await createNode('Component', 'Audio_Slider_Comp');

    // Game_Root contains Game_Child
    await request.post('/api/edges', {
      data: { source: rootId, target: childId, type: 'Contains', test_status: 'Untested', properties: {} },
    });
    // Game_Settings (ParentB) contains ChildB1 and ChildB2
    await request.post('/api/edges', {
      data: { source: settingsId, target: childB1Id, type: 'Contains', test_status: 'Untested', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: settingsId, target: childB2Id, type: 'Contains', test_status: 'Untested', properties: {} },
    });
    // ParentC contains ChildC1
    await request.post('/api/edges', {
      data: { source: parentCId, target: childC1Id, type: 'Contains', test_status: 'Untested', properties: {} },
    });

    // Flow transitions:
    // Game_Child --Transition--> ChildB1 (Untested) AND Game_Child --Transition--> ChildB2 (Failed)
    await request.post('/api/edges', {
      data: { source: childId, target: childB1Id, type: 'Transition', test_status: 'Untested', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: childId, target: childB2Id, type: 'Transition', test_status: 'Failed', properties: {} },
    });
    // ChildB2 --Transition--> ChildC1
    await request.post('/api/edges', {
      data: { source: childB2Id, target: childC1Id, type: 'Transition', test_status: 'Untested', properties: {} },
    });

    await page.addInitScript(() => localStorage.setItem('savedShowAll', 'true'));
    const graphLoaded = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('http://localhost:5173/');
    await graphLoaded;

    const nodeLoc = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

    // 1) Selecting child component childB1Id directly keeps its parent settingsId .active without .highlight-incoming/.highlight-outgoing
    await nodeLoc(childB1Id).click({ force: true });
    await expect(nodeLoc(settingsId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(settingsId)).not.toHaveClass(/\bhighlight-incoming\b/);
    await expect(nodeLoc(settingsId)).not.toHaveClass(/\bhighlight-outgoing\b/);

    // 2) Set Max Depth = 2 and select settingsId:
    // Game_Root (which contains Game_Child transitioning INTO settingsId's children) is an INCOMING parent container.
    // Even at Max Depth = 2, Game_Root must have .highlight-incoming and MUST NOT be polluted with .highlight-outgoing!
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.locator('#maxDepth').fill('2');
    await nodeLoc(settingsId).click({ position: { x: 40, y: 25 }, force: true });
    await expect(nodeLoc(rootId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(rootId)).toHaveClass(/\bhighlight-incoming\b/);
    await expect(nodeLoc(rootId)).not.toHaveClass(/\bhighlight-outgoing\b/);

    // 3) Collapse both Game_Settings (ParentB) and Audio_Popup_Screen (ParentC), then select Game_Root at Max Depth = 2:
    // Both collapsed parents (1 hop and 2 hops away) must be highlighted as .active.highlight-outgoing,
    // and the rerouted edge between Game_Root/Game_Child and collapsed Game_Settings must prioritize .status-failed!
    await nodeLoc(settingsId).locator('.collapse-btn').click({ force: true });
    await nodeLoc(parentCId).locator('.collapse-btn').click({ force: true });
    await expect(nodeLoc(childB1Id)).toBeHidden();
    await expect(nodeLoc(childC1Id)).toBeHidden();

    await nodeLoc(rootId).click({ position: { x: 40, y: 25 }, force: true });
    await expect(nodeLoc(settingsId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(settingsId)).toHaveClass(/\bhighlight-outgoing\b/);
    await expect(nodeLoc(settingsId)).not.toHaveClass(/\bhighlight-incoming\b/);
    await expect(nodeLoc(parentCId)).toHaveClass(/\bactive\b/);
    await expect(nodeLoc(parentCId)).toHaveClass(/\bhighlight-outgoing\b/);

    const reroutedEdge = page.locator(`.react-flow__edge[data-id="${childId}-${settingsId}-Transition"]`);
    await expect(reroutedEdge).toHaveClass(/\bactive\b/);
    await expect(reroutedEdge).toHaveClass(/\bstatus-failed\b/);
  });
});



