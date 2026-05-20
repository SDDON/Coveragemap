import { test, expect } from '@playwright/test';

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
    await firstNode.click();
    
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

  test('API Failure Degradation', async ({ page }) => {
    await page.route('**/api/graph', async route => await route.abort());
    await page.goto('/');
    const errorToast = page.locator('.error-toast, .empty-state-message');
    await expect(errorToast).toBeVisible();
  });
});

test.describe('F2: Core Visualization (Focus+Context)', () => {
  test('Focus Node Dimming', async ({ page }) => {
    await page.goto('/');
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click();
    
    await expect(firstNode).toHaveClass(/active/);
    const otherNodes = page.locator('.react-flow__node:not(.active)');
    await expect(otherNodes.first()).toHaveClass(/de-emphasized/);
  });

  test('Restore Context', async ({ page }) => {
    await page.goto('/');
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click();
    await page.locator('.react-flow__pane').click();
    
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).not.toHaveClass(/de-emphasized/);
  });

  test('Shift Focus', async ({ page }) => {
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
    const sourceId = await edge.getAttribute('data-source');
    const targetId = await edge.getAttribute('data-target');
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();
    
    const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
    await expect(unassociatedNode).not.toHaveCount(0);
    await unassociatedNode.click();
    
    await expect(edge).toHaveClass(/de-emphasized/);
  });

  test('Path Selection (Coverage scope view)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const edge = page.locator('.react-flow__edge').first();
    const sourceId = await edge.getAttribute('data-source');
    const targetId = await edge.getAttribute('data-target');
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();
    
    const sourceNode = page.locator(`.react-flow__node[data-id="${sourceId}"]`);
    const targetNode = page.locator(`.react-flow__node[data-id="${targetId}"]`);
    const unassociatedNode = page.locator(`.react-flow__node:not([data-id="${sourceId}"]):not([data-id="${targetId}"])`).first();
    await expect(unassociatedNode).not.toHaveCount(0);
    
    await sourceNode.click();
    await targetNode.click();
    
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
    const untestedNode = page.locator('.react-flow__node.status-untested').first();
    const nodeId = await untestedNode.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await targetNode.click();
    
    const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
    await markPassedBtn.click();
    
    await expect(targetNode).toHaveClass(/status-passed/);
  });

  test('Mark Failed', async ({ page }) => {
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const node = page.locator('.react-flow__node').first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    
    await targetNode.click();
    
    const markFailedBtn = page.getByRole('button', { name: /mark failed/i });
    await markFailedBtn.click();
    
    await expect(targetNode).toHaveClass(/status-failed/);
  });

  test('Mark Edge Passed', async ({ page }) => {
    await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
    const edge = page.locator('.react-flow__edge').first();
    const edgeId = await edge.getAttribute('data-id');
    const targetEdge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
    
    await targetEdge.click();
    
    const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
    await markPassedBtn.click();
    
    await expect(targetEdge).toHaveClass(/status-passed/);
  });

  test('Reset Status', async ({ page }) => {
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const node = page.locator('.react-flow__node').first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    
    await targetNode.click();
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
    
    const untestedNode = page.locator('.react-flow__node.status-untested').first();
    const nodeId = await untestedNode.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await targetNode.click();
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
    await addNodeBtn.click();
    
    const uniqueLabel = `New Node ${Date.now()}`;
    await page.getByRole('textbox', { name: /label/i }).fill(uniqueLabel);
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;
    
    const targetNode = page.locator(`.react-flow__node`, { hasText: uniqueLabel });
    await expect(targetNode).toBeVisible();
  });

  test('Edit Node Properties', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);
    const node = nodes.first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await targetNode.click();
    
    const labelInput = page.getByRole('textbox', { name: /label/i });
    
    await labelInput.fill('Updated Label');
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;
    
    await expect(targetNode).toHaveText(/Updated Label/);
  });

  test('Delete Node', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    
    const addNodeBtn = page.getByRole('button', { name: /add node/i });
    await addNodeBtn.click();
    
    const uniqueLabel = `Delete Target ${Date.now()}`;
    await page.getByRole('textbox', { name: /label/i }).fill(uniqueLabel);
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;

    const targetNode = page.locator(`.react-flow__node`, { hasText: uniqueLabel });
    await expect(targetNode).toBeVisible();
    
    const nodeId = await targetNode.getAttribute('data-id');
    expect(nodeId).toBeTruthy();
    
    await targetNode.click();
    
    await page.getByRole('button', { name: /delete/i }).click();
    await expect(page.locator(`.react-flow__node[data-id="${nodeId}"]`)).toBeHidden();
  });

  test('Add Edge', async ({ page }) => {
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

  test('Delete Edge', async ({ page }) => {
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
    
    await targetEdge.click();
    
    await page.getByRole('button', { name: /delete/i }).click();
    await expect(page.locator(`.react-flow__edge[data-id="${edgeId}"]`)).toBeHidden();
  });
});

test.describe('F5: Config Panel & Loading UI', () => {
  test('Debounce API Call', async ({ page }) => {
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
    
    await page.waitForTimeout(500);
    expect(requestCount).toBe(1); // Exactly one request should be fired
  });

  test('Config Depth Update', async ({ page }) => {
    await page.goto('/');
    const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
    
    const requestPromise = page.waitForRequest(req => req.url().includes('/api/graph?depth=5'));
    await depthInput.fill('5');
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

    let resolveApi: (value?: unknown) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });
    
    await page.route('**/api/graph**', async route => {
      await apiPromise;
      await route.continue();
    });
    
    const depthInput = page.getByRole('spinbutton', { name: /max depth/i });
    await depthInput.fill('5');
    
    const overlay = page.getByTestId('loading-overlay');
    await expect(overlay).toBeVisible();
    
    resolveApi!();
    
    await expect(overlay).toBeHidden();
  });

  test('Block Race Conditions', async ({ page }) => {
    await page.goto('/');
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);
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
    await depthInput.fill('5');
    
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
    const response = await request.get('/api/dictionary?term=synonym_xyz');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.standardTerm).toBeDefined();
    expect(body.standardTerm).not.toBe('synonym_xyz');
  });

  test('Standardized Input UI', async ({ page }) => {
    await page.goto('/');
    await page.locator('.react-flow__node').first().click();
    
    const categoryInput = page.getByRole('textbox', { name: /node category/i });
    const tagName = await categoryInput.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('input');
    
    const autocomplete = await categoryInput.getAttribute('autocomplete');
    expect(autocomplete).not.toBe('off');
  });

  test('Autocomplete Suggestion', async ({ page }) => {
    await page.goto('/');
    await page.locator('.react-flow__node').first().click();
    
    const categoryInput = page.getByRole('textbox', { name: /node category/i });
    await categoryInput.fill('synonym');
    
    const suggestion = page.locator('.autocomplete-suggestion').first();
    await expect(suggestion).toBeVisible();
  });

  test('Form Submission Validation', async ({ page }) => {
    await page.goto('/');
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click();
    
    const categoryInput = page.getByRole('textbox', { name: /node category/i });
    const originalCategory = await categoryInput.inputValue();
    
    await categoryInput.fill('valid_category');
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/') && res.status() === 200);
    await page.getByRole('button', { name: /save/i }).click();
    await responsePromise;
    
    await expect(page.locator('.validation-error')).toHaveCount(0);

    // Cleanup
    await firstNode.click();
    await categoryInput.fill(originalCategory);
    const restorePromise = page.waitForResponse(res => res.url().includes('/api/') && res.request().method() !== 'GET');
    await page.getByRole('button', { name: /save/i }).click();
    await restorePromise;
  });

  test('Block Free Text', async ({ page }) => {
    await page.goto('/');
    await page.locator('.react-flow__node').first().click();
    
    const categoryInput = page.getByRole('textbox', { name: /node category/i });
    await categoryInput.fill('invalid_free_text');
    await page.getByRole('button', { name: /save/i }).click();
    
    await expect(page.locator('.validation-error')).toBeVisible();
  });
});
