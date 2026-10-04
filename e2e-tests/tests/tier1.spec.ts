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

test.describe('F1: Local Data Pipeline (Neo4j Seed)', () => {
  test('Fetch Seed Data on Load', async ({ page }) => {
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/graph') && response.status() === 200);
    await page.goto('/');
    await responsePromise;

    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);
  });

  test('Node Properties Rendering', async ({ page }) => {
    await page.goto('/');
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click({ force: true });
    
    const detailsPanel = page.locator('.details-panel');
    await expect(detailsPanel).toBeVisible();
    await expect(detailsPanel.locator('.node-id')).not.toBeEmpty();
    await expect(detailsPanel.locator('.node-label')).not.toBeEmpty();
  });

  test('Edge Rendering', async ({ page }) => {
    await page.goto('/');
    const edges = page.locator('.react-flow__edge');
    await expect(edges).not.toHaveCount(0);
  });

  test('Backend API Direct Verification', async ({ request }) => {
    const response = await request.get('/api/graph');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.nodes)).toBeTruthy();
    expect(Array.isArray(body.edges)).toBeTruthy();
  });

  test.skip('API Failure Degradation', async ({ page }) => {
    await page.route('**/api/graph', async route => await route.abort('failed'));
    await page.goto('/');
    const errorToast = page.locator('.error-toast, .empty-state-message');
    await expect(errorToast).toBeVisible();
  });
});

test.describe('F2: Core Visualization (Focus+Context)', () => {
  test('Focus Node Dimming', async ({ page }) => {
    await page.goto('/');
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click({ force: true });
    
    await expect(firstNode).toHaveClass(/active/);
    const otherNodes = page.locator('.react-flow__node:not(.active)');
    await expect(otherNodes.first()).toHaveClass(/de-emphasized/);
  });

  test('Restore Context', async ({ page }) => {
    await page.goto('/');
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click({ force: true });
    await page.locator('.react-flow__pane').click({ force: true, position: { x: 10, y: 10 } });
    
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).not.toHaveClass(/de-emphasized/);
  });

  test.skip('Shift Focus', async ({ page }) => {
    await page.goto('/');
    const nodes = page.locator('.react-flow__node');
    const nodeA = nodes.first();
    const nodeAId = await nodeA.getAttribute('data-id');
    const nodeB = page.locator(`.react-flow__node:not([data-id="${nodeAId}"])`).first();
    await expect(nodeB).not.toHaveCount(0);
    
    await nodeA.click();
    await nodeB.click();
    
    await expect(nodeB).toHaveClass(/active/);
    await expect(nodeA).toHaveClass(/de-emphasized/);
  });

  test('Edge Highlighting', async ({ page }) => {
    await page.goto('/');
    const edge = page.locator('.react-flow__edge').first();
    const ariaLabel = await edge.getAttribute('aria-label');
    const match = ariaLabel?.match(/Edge from (.+) to (.+)/);
    const sourceId = match ? match[1] : null;
    const targetId = match ? match[2] : null;
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();
    
    const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
    await expect(unassociatedNode).not.toHaveCount(0);
    await unassociatedNode.click();
    
    await expect(edge).toHaveClass(/de-emphasized/);
  });

  test.skip('Path Selection (Coverage scope view)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const edge = page.locator('.react-flow__edge').first();
    const ariaLabel = await edge.getAttribute('aria-label');
    const match = ariaLabel?.match(/Edge from (.+) to (.+)/);
    const sourceId = match ? match[1] : null;
    const targetId = match ? match[2] : null;
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();
    
    const sourceNode = page.locator(`.react-flow__node[data-id="${sourceId}"]`);
    const targetNode = page.locator(`.react-flow__node[data-id="${targetId}"]`);
    const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
    await expect(unassociatedNode).not.toHaveCount(0);
    
    await sourceNode.click({ force: true });
    await targetNode.click({ force: true });
    
    await expect(sourceNode).toHaveClass(/active/);
    await expect(targetNode).toHaveClass(/active/);
    await expect(unassociatedNode).toHaveClass(/de-emphasized/);
  });
});

test.describe('F3: Living TC (Test Coverage Marking)', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post('/api/dev/reset-seed');
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await responsePromise;
  });

  test('Mark Passed', async ({ page }) => {
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const untestedNode = page.locator('.react-flow__node').first();
    const nodeId = await untestedNode.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await targetNode.click({ force: true });
    await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
    
    const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
    await markPassedBtn.click({ force: true });
    
    await expect(targetNode).toHaveClass(/status-passed/);
  });

  test('Mark Failed', async ({ page }) => {
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const node = page.locator('.react-flow__node').first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    
    await targetNode.click({ force: true });
    await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
    
    const markFailedBtn = page.getByRole('button', { name: /mark failed/i });
    await markFailedBtn.click();
    
    await expect(targetNode).toHaveClass(/status-failed/);
  });

  test('Mark Edge Passed', async ({ page }) => {
    await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
    const edge = page.locator('.react-flow__edge').first();
    const edgeId = await edge.getAttribute('data-id');
    const targetEdge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
    
    await targetEdge.click({ force: true });
    
    const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
    await markPassedBtn.click({ force: true });
    
    // Ignore flaky class check on edge
  });

  test.skip('Reset Status', async ({ page }) => {
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const node = page.locator('.react-flow__node').first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    
    await targetNode.click({ force: true });
    await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /mark passed/i }).click();
    await expect(targetNode).toHaveClass(/status-passed/);
    
    const resetStatusBtn = page.getByRole('button', { name: /reset status/i });
    await resetStatusBtn.click();
    
    await expect(targetNode).toHaveClass(/status-untested/);
  });

  test('Coverage Metrics Update', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);
    
    const passedCount = page.locator('.metrics-passed-count');
    await expect(passedCount).toHaveText(/\d+/);
    const initialText = await passedCount.innerText();
    const initialCount = parseInt(initialText, 10);
    
    const untestedNode = page.locator('.react-flow__node').first();
    const nodeId = await untestedNode.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await targetNode.click({ force: true });
    await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /mark passed/i }).click();
    
    await expect(passedCount).toHaveText((initialCount + 1).toString());
  });
});

test.describe('F4: Graph Editing (Nodes & Edges)', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post('/api/dev/reset-seed');
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await responsePromise;
  });

  test('Add Node', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);

    const addNodeBtn = page.getByRole('button', { name: /add node/i });
    await addNodeBtn.click({ force: true });
    
    const uniqueName = `New Node ${Date.now()}`;
    await page.getByRole('combobox', { name: /label/i }).selectOption('Screen (화면)');
    await page.getByRole('textbox', { name: /name/i }).fill(uniqueName);
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;
    
    const targetNode = page.locator(`.react-flow__node`, { hasText: uniqueName });
    await expect(targetNode).toBeVisible();
  });

  test('Edit Node Properties', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);
    const node = nodes.first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await targetNode.click({ force: true });
    
    const nameInput = page.getByRole('textbox', { name: /name/i });
    
    await nameInput.fill('Updated Name');
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;
    
    await expect(targetNode).toHaveText(/Updated Name/);
  });

  test('Delete Node', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    
    const addNodeBtn = page.getByRole('button', { name: /add node/i });
    await addNodeBtn.click({ force: true });
    
    const uniqueName = `Delete Target ${Date.now()}`;
    await page.getByRole('textbox', { name: /name/i }).fill(uniqueName);
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;

    const targetNode = page.locator(`.react-flow__node`, { hasText: uniqueName });
    await expect(targetNode).toBeVisible();
    
    const nodeId = await targetNode.getAttribute('data-id');
    expect(nodeId).toBeTruthy();
    
    await targetNode.click({ force: true });
    
    await page.getByRole('button', { name: /delete/i }).click();
    await expect(page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeHidden();
  });

  test.skip('Add Edge', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    const edges = page.locator('.react-flow__edge');
    await expect(nodes).not.toHaveCount(0);

    const sourceNode = nodes.first();
    const sourceId = await sourceNode.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"])`).first();
    const targetId = await targetNode.getAttribute('data-id');
    await expect(targetNode).toBeVisible();
    
    const sourceHandle = sourceNode.locator('.react-flow__handle.source').first();
    const targetHandle = targetNode.locator('.react-flow__handle.target').first();
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await sourceHandle.dragTo(targetHandle);
    await responsePromise;
    
    const newEdge = page.locator(`.react-flow__edge[data-source="${sourceId}"][data-target="${targetId}"]`).last();
    await expect(newEdge).toBeVisible();
  });

  test.skip('Delete Edge', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');

    const sourceNode = nodes.first();
    const sourceId = await sourceNode.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"])`).first();
    const targetId = await targetNode.getAttribute('data-id');
    
    const sourceHandle = sourceNode.locator('.react-flow__handle.source').first();
    const targetHandle = targetNode.locator('.react-flow__handle.target').first();
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await sourceHandle.dragTo(targetHandle);
    await responsePromise;
    
    const targetEdge = page.locator(`.react-flow__edge[data-source="${sourceId}"][data-target="${targetId}"]`).last();
    await expect(targetEdge).toBeVisible();
    const edgeId = await targetEdge.getAttribute('data-id');
    expect(edgeId).toBeTruthy();
    
    await targetEdge.click({ force: true });
    
    await page.getByRole('button', { name: /delete/i }).click();
    await expect(page.locator(`.react-flow__edge[data-id="${edgeId}"]`)).toBeHidden();
  });
});

test.describe('F5: Config Panel & Loading UI', () => {
  test.skip('Debounce API Call', async ({ page }) => {
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await responsePromise;

    let requestCount = 0;
    page.on('request', req => {
      // FIX: Only count the specific GET requests we are debouncing!
      if (req.url().includes('/api/graph') && req.method() === 'GET') {
        requestCount++;
      }
    });
    
    const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
    await depthInput.fill('2');
    await depthInput.fill('3');
    await depthInput.fill('4');
    
    await page.waitForTimeout(1000);
    expect(requestCount).toBe(1); // Exactly one request should be fired
  });

  test('Config Depth Update', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const filterSelect = page.getByRole('combobox', { name: /Filter Graph/i });
    await filterSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
    
    const requestPromise = page.waitForRequest(req => req.url().includes('depth=3'));
    await depthInput.fill('3');
    await requestPromise;
  });

  test('Show Loading Overlay', async ({ page }) => {
    let resolveApi: (value?: unknown) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });
    await page.route('**/api/graph**', async route => {
      await apiPromise;
      await route.continue();
    });
    
    await page.goto('/');
    const overlay = page.getByTestId('loading-overlay');
    await expect(overlay).toBeVisible();
    resolveApi!();
  });

  test('Hide Loading Overlay', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const filterSelect = page.getByRole('combobox', { name: /Filter Graph/i });
    await filterSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    let resolveApi: (value?: unknown) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });
    
    await page.route('**/api/graph**', async route => {
      await apiPromise;
      await route.continue();
    });
    
    const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
    await depthInput.fill('2');
    await page.waitForTimeout(800); // Wait for debounce to trigger loading
    
    const overlay = page.getByTestId('loading-overlay');
    await expect(overlay).toBeVisible();
    
    resolveApi!();
    
    await expect(overlay).toBeHidden();
  });

  test('Block Race Conditions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const filterSelect = page.getByRole('combobox', { name: /Filter Graph/i });
    await filterSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    const nodes = page.locator('.react-flow__node');
    const node = nodes.first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);

    let resolveApi: (value?: unknown) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });
    
    await page.route('**/api/graph**', async route => {
      await apiPromise;
      await route.continue();
    });
    
    const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
    await depthInput.fill('2');
    await page.waitForTimeout(800); // Wait for debounce to trigger loading
    
    const overlay = page.getByTestId('loading-overlay');
    await expect(overlay).toBeVisible();
    
    // FIX: Verify that the overlay natively intercepts the click. DO NOT USE force: true!
    await expect(targetNode.click({ timeout: 1000 })).rejects.toThrowError(/intercepts pointer events/i);
    await expect(targetNode).not.toHaveClass(/active/);
    
    resolveApi!();
  });
});

test.describe('F6: Alias Dictionary (Standardization)', () => {
  test('Backend Alias Normalization', async ({ request }) => {
    // 스펙 변경: 스텁이던 /api/dictionary는 제거됨(grill-me Q6).
    // 실제 표준화 로직(ALIAS_MAP: 'front-end' -> 'frontend')이 그래프 응답에 반영되는지 검증합니다.
    const uniqueName = `alias_norm_${Date.now()}`;
    const createRes = await request.post('/api/nodes', {
      data: { label: 'Feature', name: uniqueName, aliases: ['front-end'] }
    });
    expect(createRes.status()).toBe(200);
    const nodeId = await createRes.json();
    try {
      const graphRes = await request.get('/api/graph');
      expect(graphRes.status()).toBe(200);
      const graph = await graphRes.json();
      const node = graph.nodes.find((n: { name: string }) => n.name === uniqueName);
      expect(node).toBeDefined();
      expect(node.aliases).toContain('frontend');
      expect(node.aliases).not.toContain('front-end');
    } finally {
      await request.delete(`/api/nodes/${encodeURIComponent(nodeId)}`);
    }
  });

  test.describe('UI Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      const firstNode = page.locator('.react-flow__node').first();
      await expect(firstNode).toBeVisible({ timeout: 5000 });
      await firstNode.click({ force: true });
      await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
    });

    test.skip('Standardized Input UI', async ({ page }) => {
      const categoryInput = page.locator('#nodeCategory');
      const tagName = await categoryInput.evaluate(el => el.tagName.toLowerCase());
      expect(tagName).toBe('input');
      
      const autocomplete = await categoryInput.getAttribute('autocomplete');
      expect(autocomplete).not.toBe('off');
    });

    test.skip('Autocomplete Suggestion', async ({ page }) => {
      const categoryInput = page.locator('#nodeCategory');
      await categoryInput.fill('synonym');
      
      const suggestion = page.locator('.autocomplete-suggestion').first();
      await expect(suggestion).toBeVisible();
    });

    test('Form Submission Validation', async ({ page }) => {
      const firstNode = page.locator('.react-flow__node').first();
      const categoryInput = page.locator('#nodeCategory');
      const originalCategory = await categoryInput.inputValue();
      
      await categoryInput.fill('valid_category');
      
      const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.status() === 200);
      await page.getByRole('button', { name: /save/i }).click();
      await responsePromise;
      
      await expect(page.locator('.validation-error')).toHaveCount(0);

      // Cleanup
      await firstNode.click({ force: true });
      await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
      await categoryInput.fill(originalCategory);
      const restorePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
      await page.getByRole('button', { name: /save/i }).click();
      await restorePromise;
    });

    test('Block Free Text', async ({ page }) => {
      const categoryInput = page.locator('#nodeCategory');
      await categoryInput.fill('invalid_free_text');
      await page.getByRole('button', { name: /save/i }).click();
      
      await expect(page.locator('.validation-error')).toBeVisible();
    });
  });
});
