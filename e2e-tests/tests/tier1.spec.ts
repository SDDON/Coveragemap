import { test, expect } from '../fixtures';

test.beforeAll(async ({ request }) => {
  await request.post('/api/dev/reset-seed');
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('savedShowAll', 'true'));
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

  test('API Failure Degradation', async ({ page }) => {
    // 트리아지 ②: 기존 '**/api/graph' 패턴은 쿼리스트링이 붙은 요청과 매칭되지 않아 실패 주입이 안 되던 테스트 결함
    await page.route('**/api/graph**', async route => await route.abort('failed'));
    await page.goto('/');
    const errorToast = page.locator('.error-toast, .empty-state-message').first();
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

  test('Shift Focus', async ({ page }) => {
    // 트리아지 ②(스펙 변경): 노드를 연속 클릭하면 Path Selection으로 누적 선택되므로,
    // 포커스 이동은 '빈 캔버스 클릭(선택 해제) → 다른 노드 클릭' 흐름으로 검증합니다.
    await page.goto('/');
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).not.toHaveCount(0);
    const nodeA = nodes.first();
    const nodeAId = await nodeA.getAttribute('data-id');
    const nodeB = page.locator(`.react-flow__node:not([data-id="${nodeAId}"])`).first();
    await expect(nodeB).not.toHaveCount(0);

    await nodeA.click({ force: true });
    await expect(nodeA).toHaveClass(/active/);
    await page.locator('.react-flow__pane').click({ force: true, position: { x: 10, y: 10 } });
    await nodeB.click({ force: true });

    await expect(nodeB).toHaveClass(/active/);
    // A가 B의 이웃이면 하이라이트로 active가 유지될 수 있으므로, 포커스 대상은 상세 패널의 노드 ID로 확인합니다.
    const nodeBId = await nodeB.getAttribute('data-id');
    await expect(page.locator('.details-panel .node-id')).toContainText(nodeBId as string);
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

  test('Path Selection (Coverage scope view)', async ({ page }) => {
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
    await expect(page.locator('.react-flow__node.de-emphasized').first()).toBeVisible();
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
    await expect(targetNode).toBeVisible({ timeout: 5000 });
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
    await expect(targetNode).toBeVisible({ timeout: 5000 });
    
    await targetNode.click({ force: true });
    await expect(page.locator('.details-panel')).toBeVisible({ timeout: 3000 });
    
    const markFailedBtn = page.getByRole('button', { name: /mark failed/i });
    await markFailedBtn.click();
    
    await expect(targetNode).toHaveClass(/status-failed/);
  });

  test('Mark Edge Passed', async ({ page, request }) => {
    await expect(page.locator('.react-flow__edge')).not.toHaveCount(0);
    const edge = page.locator('.react-flow__edge').first();
    const edgeId = await edge.getAttribute('data-id');
    const targetEdge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
    
    await targetEdge.click({ force: true });
    
    // 검증 복원: 기존에는 '// Ignore flaky class check on edge'로 아무것도 확인하지 않았음.
    // CSS 클래스 대신 저장 요청 결과와 백엔드 상태로 검증합니다.
    const putPromise = page.waitForResponse(res => res.url().includes('/api/edges/') && res.request().method() === 'PUT');
    const markPassedBtn = page.getByRole('button', { name: /mark passed/i });
    await markPassedBtn.click({ force: true });
    const putRes = await putPromise;
    expect(putRes.ok()).toBeTruthy();
    const { new_id } = await putRes.json();

    const graph = await (await request.get('/api/graph')).json();
    const saved = graph.edges.find((e: { id: string }) => e.id === new_id);
    expect(saved).toBeDefined();
    expect(saved.test_status).toBe('Passed');
  });

  test('Reset Status', async ({ page }) => {
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const node = page.locator('.react-flow__node').first();
    const nodeId = await node.getAttribute('data-id');
    const targetNode = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await expect(targetNode).toBeVisible({ timeout: 5000 });
    
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
    
    const targetNode = page.locator('.react-flow__node').filter({ hasText: 'Game Settings' }).first();
    await expect(targetNode).toBeVisible({ timeout: 5000 });
    // Target isolated node without cascading dependencies
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
    await expect(targetNode).toBeVisible({ timeout: 5000 });
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

  // 실제 사용자 흐름으로 엣지 생성: 소스 노드 외곽(Halo 핸들, 바깥 4px)에서 드래그 → 대상 노드 중앙에서 놓기
  const dragConnect = async (page: import('@playwright/test').Page, sourceId: string, targetId: string) => {
    const sb = await page.locator(`.react-flow__node[data-id="${sourceId}"]`).boundingBox();
    const tb = await page.locator(`.react-flow__node[data-id="${targetId}"]`).boundingBox();
    if (!sb || !tb) throw new Error('node bounding box not found');
    const postPromise = page.waitForResponse(res => res.url().includes('/api/edges') && res.request().method() === 'POST');
    await page.mouse.move(sb.x - 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 15 });
    await page.mouse.up();
    const res = await postPromise;
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as string;
  };

  // 부모(Subflow) 내부 자식이 아닌, 서로 겹치지 않는 최상위 노드 2개를 고릅니다.
  const pickTwoTopLevelNodes = async (page: import('@playwright/test').Page) => {
    const ids = await page.locator('.react-flow__node').evaluateAll(els =>
      els.filter(el => !el.parentElement?.closest('.react-flow__node') && !el.querySelector('.react-flow__node'))
         .map(el => el.getAttribute('data-id') as string));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    return [ids[0], ids[1]];
  };

  test('Add Edge', async ({ page, request }) => {
    // 트리아지 ②(스펙 변경): 상/하단 핸들 → 외곽 Halo 핸들 구조로 바뀌어 기존 dragTo(타깃 핸들)가 불가능했음
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const [sourceId, targetId] = await pickTwoTopLevelNodes(page);
    const newEdgeId = await dragConnect(page, sourceId, targetId);

    const graph = await (await request.get('/api/graph')).json();
    const saved = graph.edges.find((e: { id: string }) => e.id === newEdgeId);
    expect(saved).toBeDefined();
    expect(saved.source).toBe(sourceId);
    expect(saved.target).toBe(targetId);
  });

  test('Delete Edge', async ({ page, request }) => {
    // 트리아지 ②(스펙 변경): Add Edge와 같은 사유. 생성 후 API로 삭제하지 않고 UI(엣지 선택 → Delete)로 삭제합니다.
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const [sourceId, targetId] = await pickTwoTopLevelNodes(page);
    const newEdgeId = await dragConnect(page, sourceId, targetId);

    const targetEdge = page.locator(`.react-flow__edge[data-id="${newEdgeId}"]`);
    await expect(targetEdge).toHaveCount(1);
    // 새 엣지가 툴바/패널 아래에 그려지면 좌표 클릭이 가로채지므로, 엣지 경로에 click 이벤트를 직접 전달합니다.
    // (React Flow 엣지의 onClick은 이벤트 버블링으로 동작)
    await targetEdge.locator('path').first().dispatchEvent('click');

    const delPromise = page.waitForResponse(res => res.url().includes('/api/edges/') && res.request().method() === 'DELETE');
    await page.getByRole('button', { name: /delete/i }).click();
    expect((await delPromise).ok()).toBeTruthy();
    await expect(targetEdge).toHaveCount(0);

    const graph = await (await request.get('/api/graph')).json();
    expect(graph.edges.find((e: { id: string }) => e.id === newEdgeId)).toBeUndefined();
  });
});

test.describe('F5: Config Panel & Loading UI', () => {
  test('Debounce API Call', async ({ page }) => {
    // 트리아지 ②(스펙 변경): 필터가 비어 있으면 depth 변경 시 재조회를 생략(레이아웃 보존)하므로 요청이 0건이었음.
    // Config Depth Update와 같이 필터를 먼저 선택한 뒤 디바운스를 검증합니다.
    await page.goto('/');
    await expect(page.locator('.react-flow__node')).not.toHaveCount(0);
    const filterSelect = page.getByRole('combobox', { name: /Filter Graph/i });
    const filterRes = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await filterSelect.selectOption({ index: 1 });
    await filterRes;
    await expect(page.getByTestId('loading-overlay')).toBeHidden();

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

    test('Standardized Input UI', async ({ page }) => {
      // 트리아지 ②(스펙 변경): 표준 카테고리 제안은 <datalist id="category-aliases">로 제공됩니다.
      // autoComplete="off"는 브라우저 입력 기록만 끄는 설정이라 기존 검증(autocomplete != off)은 의도와 무관했음.
      const categoryInput = page.locator('#nodeCategory');
      const tagName = await categoryInput.evaluate(el => el.tagName.toLowerCase());
      expect(tagName).toBe('input');
      await expect(categoryInput).toHaveAttribute('list', 'category-aliases');
      await expect(page.locator('datalist#category-aliases')).toHaveCount(1);
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
  });
});
