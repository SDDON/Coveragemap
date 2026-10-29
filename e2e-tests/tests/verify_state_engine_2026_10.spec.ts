import { test, expect, Page } from '../fixtures';

/**
 * 2026-10-09 기획서 구현 검증 (AI_IMPLEMENTATION_SPEC 3.5 / 4.4 / Rule 5-3, TESTCASE_MODELING 4~7)
 *
 * 시드 그래프 (scripts/seed.py):
 *   TC1 --TESTS--> Game_Root --DEPENDS_ON--> Game_Child,  Game_Settings(고립)
 *
 * - A. 연쇄 상태 전파: TC1 Failed → Game_Root Failed(Tests 실패 우선) → Game_Child Blocked
 * - B. Mark Blocked(📌 수동 고정, 사유 필수) → 핀 표시 + 선행 노드가 바뀌어도 덮어쓰지 않음
 * - C. 노드 내부 체크리스트 → 진행률 배지 + 노드 상태 자동 판정
 * - D. Change Impact Ripple → .node-modified-pulse / .highlight-affected → Acknowledge 시 해제
 * - E. Target Drop Hitbox → 평소에는 클릭을 가로채지 않음(pointer-events: none)
 */

type SeedIds = { tc1: string; root: string; child: string; settings: string };

// 페이지 응답 그래프 페이로드로부터 시드 노드의 elementId를 직접 추출하여 캔버스와 100% 동기화합니다.
const extractSeedIds = (graph: { nodes: any[] }): SeedIds => {
  const byKey = (key: string) => {
    const n = graph.nodes.find((x: any) =>
      x.properties?.id === key ||
      x.id === key ||
      x.name === key ||
      (key === 'Game_Root' && (x.name === 'Game Testing Root' || x.properties?.name === 'Game Testing Root')) ||
      (key === 'Game_Child' && (x.name === 'Game Testing Child' || x.properties?.name === 'Game Testing Child')) ||
      (key === 'Game_Settings' && (x.name === 'Game Settings' || x.properties?.name === 'Game Settings')) ||
      (key === 'TC1' && (x.label === 'TestCase' || x.name === 'TC1' || x.properties?.title === 'Initial TC'))
    );
    if (!n) throw new Error(`seed node ${key} not found in graph payload`);
    return n.id as string;
  };
  return { tc1: byKey('TC1'), root: byKey('Game_Root'), child: byKey('Game_Child'), settings: byKey('Game_Settings') };
};

const nodeLocator = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

const selectNode = async (page: Page, id: string) => {
  await nodeLocator(page, id).click({ force: true });
  await expect(page.locator('.details-panel .node-id')).toContainText(id);
};

test.describe('2026-10 Spec: Living TC State Engine', () => {
  let ids: SeedIds;

  test.beforeEach(async ({ page, request }) => {
    await page.goto('about:blank');
    // 단일 확정 호출로 DB 시드 초기화 (타임아웃 여유 확보로 중복/경합 실행 방지)
    const resetRes = await request.post('/api/dev/reset-seed', { timeout: 30000 });
    expect(resetRes.ok()).toBeTruthy();

    // 워크스페이스 선택 오버레이(전체 화면 모달)를 건너뛰고 전체 그래프를 바로 로드합니다.
    // (오버레이가 떠 있으면 force 클릭이 노드 대신 오버레이의 별칭 버튼을 눌러 필터가 걸림)
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('savedShowAll', 'true');
    });
    // 브라우저가 직접 수신하는 /api/graph 응답을 캡처하여 ids를 추출함으로써 캔버스 DOM과 100% 일치 보장
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    const graphRes = await responsePromise;
    const graphData = await graphRes.json();
    ids = extractSeedIds(graphData);

    await expect(page.locator('.react-flow__node')).toHaveCount(4);
    await expect(nodeLocator(page, ids.root)).toBeVisible();
    await expect(nodeLocator(page, ids.child)).toBeVisible();
    await expect(nodeLocator(page, ids.settings)).toBeVisible();
    await expect(nodeLocator(page, ids.tc1)).toBeVisible();
  });

  test.afterAll(async ({ request }) => {
    await request.post('/api/dev/reset-seed');
  });

  test('A. Cascading propagation: TC1 Failed -> Game_Root Failed -> Game_Child Blocked', async ({ page, request }) => {
    await selectNode(page, ids.tc1);
    const putPromise = page.waitForResponse(res => res.url().includes('/api/nodes/') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: /mark failed/i }).click();
    expect((await putPromise).ok()).toBeTruthy();

    // 낙관적 업데이트로 화면에 즉시 반영 (Tests 소스 실패 → 대상 Failed, Depends_On 하류 → Blocked)
    await expect(nodeLocator(page, ids.root)).toHaveClass(/status-failed/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/status-blocked/);

    // 서버(SSOT)도 동일한 결과여야 함
    const statuses = await (await request.get('/api/node-statuses')).json();
    expect(statuses[ids.tc1]).toBe('Failed');
    expect(statuses[ids.root]).toBe('Failed');
    expect(statuses[ids.child]).toBe('Blocked');

    // TC1을 Passed로 복구하면 Game_Child의 Blocked가 해제됨
    await page.getByRole('button', { name: /mark passed/i }).click();
    await expect(nodeLocator(page, ids.child)).not.toHaveClass(/status-blocked/);
    await expect.poll(async () => (await (await request.get('/api/node-statuses')).json())[ids.child]).not.toBe('Blocked');
  });

  test('B. Mark Blocked requires a reason, shows a pin, and survives upstream changes', async ({ page, request }) => {
    await selectNode(page, ids.root);
    await page.getByRole('button', { name: /mark blocked/i }).click();

    const reasonBox = page.locator('.override-reason-box');
    await expect(reasonBox).toBeVisible();
    const confirmBtn = reasonBox.locator('button.warning');
    // 사유 미입력 시 확정 불가
    await expect(confirmBtn).toBeDisabled();

    await reasonBox.locator('input').fill('build not delivered');
    const putPromise = page.waitForResponse(res => res.url().includes('/api/nodes/') && res.request().method() === 'PUT');
    await confirmBtn.click();
    expect((await putPromise).ok()).toBeTruthy();

    const rootNode = nodeLocator(page, ids.root);
    await expect(rootNode).toHaveClass(/status-blocked/);
    await expect(rootNode.locator('.override-pin')).toBeVisible();
    await expect(page.locator('.override-pin-banner')).toContainText('build not delivered');

    // 선행 TC1이 Failed가 되어도 📌 고정 노드는 합성 엔진이 덮어쓰지 않음
    await request.put(`/api/nodes/${encodeURIComponent(ids.tc1)}`, { data: { test_status: 'Failed' } });
    const statuses = await (await request.get('/api/node-statuses')).json();
    expect(statuses[ids.root]).toBe('Blocked');

    const graph = await (await request.get('/api/graph')).json();
    const saved = graph.nodes.find((n: { id: string }) => n.id === ids.root);
    expect([true, 'true']).toContain(saved.is_manual_override ?? saved.properties?.is_manual_override);
    expect(saved.override_reason ?? saved.properties?.override_reason).toBe('build not delivered');
  });

  test('C. Node checklist drives progress badge and node status', async ({ page, request }) => {
    await selectNode(page, ids.settings);
    const section = page.locator('.checklist-section');
    await expect(section).toBeVisible();

    await section.locator('.checklist-add-btn').click();
    const item = section.locator('.checklist-item').first();
    await expect(item).toBeVisible();
    await item.locator('.checklist-text').fill('Popup dimmed background');
    await item.locator('.checklist-text').press('Enter');

    // 상태 아이콘 클릭 → 팝오버(Untested, Passed, Failed, Blocked 순)에서 Failed 선택
    const putPromise = page.waitForResponse(res => res.url().includes('/api/nodes/') && res.request().method() === 'PUT');
    const firstItem = section.locator('.checklist-item').first();
    await firstItem.locator('.checklist-status-trigger').click();
    await firstItem.locator('.checklist-status-menu .checklist-status-btn').nth(2).click();
    expect((await putPromise).ok()).toBeTruthy();

    const settingsNode = nodeLocator(page, ids.settings);
    await expect(settingsNode).toHaveClass(/status-failed/);
    await expect(settingsNode.locator('.checklist-badge-failed')).toBeVisible();

    await expect.poll(async () => (await (await request.get('/api/node-statuses')).json())[ids.settings]).toBe('Failed');
    const graph = await (await request.get('/api/graph')).json();
    const saved = graph.nodes.find((n: { id: string }) => n.id === ids.settings);
    expect(Array.isArray(saved.properties.checklist)).toBeTruthy();
    expect(saved.properties.checklist[0].text).toBe('Popup dimmed background');
    expect(saved.properties.checklist[0].status).toBe('Failed');
  });

  test('D. Change Impact Ripple: mark modified highlights downstream until acknowledged', async ({ page, request }) => {
    await selectNode(page, ids.root);
    const section = page.locator('.modified-section');
    await section.locator('.modified-mark-row input').fill('shop shortcut UI revamp');
    const markPromise = page.waitForResponse(res => res.url().includes('/mark-modified') && res.request().method() === 'POST');
    await section.locator('.modified-mark-row button').click();
    expect((await markPromise).ok()).toBeTruthy();

    await expect(nodeLocator(page, ids.root).locator('.custom-node')).toHaveClass(/node-modified-pulse/);
    await expect(nodeLocator(page, ids.root).locator('.modified-chip')).toBeVisible();
    // Game_Root --DEPENDS_ON--> Game_Child: 하류 영향권 강조
    await expect(nodeLocator(page, ids.child)).toHaveClass(/highlight-affected/);

    const ackPromise = page.waitForResponse(res => res.url().includes('/acknowledge') && res.request().method() === 'POST');
    await section.locator('.modified-banner button.success').click();
    expect((await ackPromise).ok()).toBeTruthy();

    await expect(nodeLocator(page, ids.root).locator('.custom-node')).not.toHaveClass(/node-modified-pulse/);
    await expect(nodeLocator(page, ids.child)).not.toHaveClass(/highlight-affected/);

    // Acknowledge는 테스트 상태를 바꾸지 않음 (Untested 유지)
    const statuses = await (await request.get('/api/node-statuses')).json();
    expect(statuses[ids.root]).toBe('Untested');
    const graph = await (await request.get('/api/graph')).json();
    const saved = graph.nodes.find((n: { id: string }) => n.id === ids.root);
    expect([false, 'false']).toContain(saved.properties.is_modified);
  });

  test('E. Target drop hitbox stays inert while idle', async ({ page }) => {
    const handle = nodeLocator(page, ids.root).locator('.react-flow__handle.target-drop-handle');
    await expect(handle).toHaveCount(1);
    const style = await handle.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { pointerEvents: cs.pointerEvents, width: parseFloat(cs.width), zIndex: cs.zIndex };
    });
    // 평소에는 1px 점 + pointer-events 차단 → 배지/버튼 클릭을 가로채지 않음 (AGENTS.md #9)
    expect(style.pointerEvents).toBe('none');
    expect(style.width).toBeLessThanOrEqual(1);
    expect(Number(style.zIndex) || 0).toBeLessThanOrEqual(0);
  });

  test('F. Root Cause Tracing highlights the upstream failing path with .highlight-root-cause', async ({ page }) => {
    await selectNode(page, ids.tc1);
    const putPromise = page.waitForResponse(res => res.url().includes('/api/nodes/') && res.request().method() === 'PUT');
    await page.getByRole('button', { name: /mark failed/i }).click();
    expect((await putPromise).ok()).toBeTruthy();

    await selectNode(page, ids.child);
    const traceBtn = page.locator('.trace-root-cause-btn');
    await expect(traceBtn).toBeVisible();
    await traceBtn.click();

    await expect(page.locator('.root-cause-banner')).toBeVisible();
    await expect(nodeLocator(page, ids.tc1)).toHaveClass(/highlight-root-cause/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/highlight-root-cause/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/highlight-root-cause/);
    await expect(nodeLocator(page, ids.settings)).not.toHaveClass(/highlight-root-cause/);

    await traceBtn.click();
    await expect(nodeLocator(page, ids.tc1)).not.toHaveClass(/highlight-root-cause/);
  });

  test('G. Parent Collapse hides children and displays summary progress badge', async ({ page, request }) => {
    const putRes = await request.put(`/api/nodes/${encodeURIComponent(ids.settings)}`, { data: { test_status: 'Passed' } });
    expect(putRes.ok()).toBeTruthy();
    const postEdgeRes = await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    expect(postEdgeRes.ok()).toBeTruthy();

    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await responsePromise;

    const parentNode = nodeLocator(page, ids.root);
    const collapseBtn = parentNode.locator('.collapse-btn');
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click({ force: true });

    await expect(nodeLocator(page, ids.settings)).toBeHidden();
    const summaryBadge = parentNode.locator('.parent-collapse-summary');
    await expect(summaryBadge).toBeVisible();
    await expect(summaryBadge).toContainText('100%');
  });

  test('H. Global badge hover does not teleport global node, and Scoped Localization Audit highlights only i18n children', async ({ page, request }) => {
    // 1. Create a global Localization badge node and attach it ONLY to ids.settings (a Contains child of ids.root)
    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Component',
        name: 'Localization',
        aliases: ['i18n'],
        test_status: 'Untested',
        properties: {
          is_global: 'true',
          description: '다국어 말줄임 확인',
          checklist: [{ id: 'i18n_1', text: '독일어 말줄임(...) 처리 확인', status: 'Passed' }],
        },
      },
    });
    expect(gRes.ok()).toBeTruthy();
    const globalId = await gRes.json();

    const e1 = await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    const e2 = await request.post('/api/edges', {
      data: { source: ids.root, target: ids.child, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    const e3 = await request.post('/api/edges', {
      data: { source: ids.settings, target: globalId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });
    expect(e1.ok() && e2.ok() && e3.ok()).toBeTruthy();

    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await responsePromise;

    // 2. Hover over the Localization badge on ids.settings -> global node must remain hidden, and tooltip renders checklist item
    const settingsNode = nodeLocator(page, ids.settings);
    const badgePill = settingsNode.locator('.badge-pill').first();
    await expect(badgePill).toBeVisible();
    await badgePill.hover({ force: true });
    await expect(nodeLocator(page, globalId)).toBeHidden();
    await expect(badgePill.locator('.badge-tooltip')).toContainText('🟢');
    await expect(badgePill.locator('.badge-tooltip')).toContainText('독일어 말줄임(...) 처리 확인');

    // 3. Select parent container (ids.root) -> Edit panel has unified Checklist + Issue Link (no Verification Guide textarea and no redundant .scoped-audit-btn)
    await selectNode(page, ids.root);
    await expect(page.locator('.details-panel label', { hasText: 'Verification Guide (Description)' })).toHaveCount(0);
    await expect(page.locator('.scoped-audit-btn')).toHaveCount(0);
    await expect(page.locator('.scoped-audit-banner')).toHaveCount(0);

    // Backend /api/qa/audit-cross-cutting endpoint remains available for MCP & QA automation
    const auditRes = await request.get(`/api/qa/audit-cross-cutting?aspect=Localization&scope_root_id=${ids.root}`);
    expect(auditRes.ok()).toBeTruthy();

    // Hovering the global Localization badge highlights connected nodes with .hovered-global-neighbor
    await badgePill.hover({ force: true });
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bhovered-global-neighbor\b/);

    // 4. Mark the Localization badge Failed -> dynamic fault chip appears on ids.settings
    const markFailBtn = badgePill.locator('button[title="Mark Failed"]');
    await markFailBtn.click({ force: true });
    await expect(settingsNode.locator('.fault-chip')).toBeVisible();
  });

  test('I. Edge connection line (.react-flow__connectionline) remains draggable from any node outer rim after Contains connection', async ({ page, request }) => {
    // 1. Create a System container node and connect it with Contains to Game_Settings via onConnect
    const sysRes = await request.post('/api/nodes', {
      data: { label: 'System', name: 'Subflow_Container', aliases: [], test_status: 'Untested', properties: {} },
    });
    expect(sysRes.ok()).toBeTruthy();
    const sysId = await sysRes.json();

    const graphRefresh1 = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await graphRefresh1;

    // Drag from Subflow_Container's outer rim to Game_Settings to trigger onConnect (System -> Contains)
    const sysCustom = nodeLocator(page, sysId).locator('.custom-node');
    const settingsCustom = nodeLocator(page, ids.settings).locator('.custom-node');
    await expect(sysCustom).toBeVisible();
    await expect(settingsCustom).toBeVisible();
    const sysBox = await sysCustom.boundingBox();
    const settingsBox = await settingsCustom.boundingBox();
    expect(sysBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();

    const graphRefresh2 = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.mouse.move(sysBox!.x + sysBox!.width / 2, sysBox!.y + sysBox!.height + 4);
    await page.mouse.down();
    await page.mouse.move(settingsBox!.x + settingsBox!.width / 2, settingsBox!.y + settingsBox!.height / 2, { steps: 10 });
    await page.mouse.up();
    await graphRefresh2;
    await page.waitForTimeout(800);

    // 2. Select the parent container header (sysId) and verify child node still sits above parent container in z-index
    await nodeLocator(page, sysId).click({ position: { x: 40, y: 30 }, force: true });
    await expect(page.locator('.details-panel .node-id')).toContainText(sysId);
    const parentZ = await nodeLocator(page, sysId).evaluate(el => Number(window.getComputedStyle(el).zIndex) || 0);
    const childZ = await nodeLocator(page, ids.settings).evaluate(el => Number(window.getComputedStyle(el).zIndex) || 0);
    expect(childZ).toBeGreaterThan(parentZ);

    // 3. Drag from the child node's outer rim (.halo-handle) and verify .react-flow__connectionline renders with a non-zero path
    const childRect = await settingsCustom.boundingBox();
    expect(childRect).not.toBeNull();
    await page.mouse.move(childRect!.x - 4, childRect!.y + childRect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(childRect!.x - 90, childRect!.y + childRect!.height / 2 - 40, { steps: 8 });

    const connLine = page.locator('.react-flow__connectionline path');
    await expect(connLine).toHaveCount(1);
    const dAttr = await connLine.getAttribute('d');
    expect(dAttr).toBeTruthy();
    const [mPart, lPart] = (dAttr || '').split(' ');
    expect(mPart?.slice(1)).not.toBe(lPart?.slice(1));
    await page.mouse.move(10, 10);
    await page.mouse.up();
  });

  test('J. Contains edge remains visible on canvas with .edge-contains dashed styling and deleting it unparents child', async ({ page, request }) => {
    const createRes = await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    expect(createRes.ok()).toBeTruthy();

    const graphRefresh = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await graphRefresh;
    await expect(nodeLocator(page, ids.root)).toBeVisible({ timeout: 10000 });
    await expect(nodeLocator(page, ids.root).locator('.collapse-btn')).toBeVisible({ timeout: 10000 });

    // 1. Contains edge must be rendered on canvas with .edge-contains class, dashed stroke-dasharray, idle opacity 0, and no "Contains" text label noise
    const containsEdge = page.locator('.react-flow__edge.edge-contains').first();
    await expect(containsEdge).toBeVisible();
    const dashArray = await containsEdge.locator('path.react-flow__edge-path').evaluate(
      el => window.getComputedStyle(el).strokeDasharray
    );
    expect(dashArray).not.toBe('none');
    const idleOpacity = await containsEdge.locator('path.react-flow__edge-path').evaluate(
      el => window.getComputedStyle(el).opacity
    );
    expect(idleOpacity).toBe('0');
    await expect(page.locator('.react-flow__edgelabel-renderer', { hasText: 'Contains' })).toHaveCount(0);

    // 2. Collapsing parent hides child and Contains edge; expanding parent restores Contains edge (Spec 5.3)
    const collapseBtn = nodeLocator(page, ids.root).locator('.collapse-btn');
    await collapseBtn.click();
    await expect(nodeLocator(page, ids.settings)).toBeHidden();
    await expect(page.locator('.react-flow__edge.edge-contains')).toHaveCount(0);

    await collapseBtn.click();
    await expect(nodeLocator(page, ids.settings)).toBeVisible();
    await expect(containsEdge).toBeVisible();

    // 3. Clicking the Contains edge selects it in the Inspector so QA can mark status or delete it
    await containsEdge.locator('.react-flow__edge-interaction').click({ force: true });
    await expect(page.locator('#edgeType')).toHaveValue(/Contains/i);

    // 4. Marking the Contains edge Failed in Inspector updates its status class
    const statusPutPromise = page.waitForResponse(
      res => res.url().includes('/api/edges/') && res.request().method() === 'PUT'
    );
    await page.locator('.details-panel button.danger', { hasText: 'Mark Failed' }).click();
    await statusPutPromise;
    await expect(containsEdge).toHaveClass(/\bstatus-failed\b/);

    // 5. Selecting the child node reveals the dashed Contains edge (opacity 0.85) and shows the parent relation box in Inspector
    await selectNode(page, ids.settings);
    await expect(containsEdge).toHaveClass(/\bactive\b/);
    const activeOpacity = await containsEdge.locator('path.react-flow__edge-path').evaluate(
      el => window.getComputedStyle(el).opacity
    );
    expect(activeOpacity).toBe('0.85');

    const parentBox = page.locator('.details-panel .parent-relation-box');
    await expect(parentBox).toBeVisible();
    await expect(parentBox).toContainText('Game Testing Root');

    // [🔗 관계 변경] immediately selects the Contains edge in the Inspector
    await parentBox.locator('.parent-relation-btn', { hasText: '관계 변경' }).click();
    await expect(page.locator('#edgeType')).toHaveValue(/Contains/i);

    // Re-selecting child node and clicking [⏏ 분리] deletes the Contains edge and unparents the child immediately without /api/graph reload
    await selectNode(page, ids.settings);
    await expect(parentBox).toBeVisible();
    const delResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/edges/') && res.request().method() === 'DELETE'
    );
    await parentBox.locator('.parent-relation-btn.detach').click();
    await delResponsePromise;

    await expect(page.locator('.react-flow__edge.edge-contains')).toHaveCount(0);
    await expect(nodeLocator(page, ids.root).locator('.collapse-btn')).toHaveCount(0);
    await expect(nodeLocator(page, ids.settings)).toBeVisible();

    // 6. Pressing Ctrl+Z (Undo) immediately restores the Contains edge and re-parents the child node
    const undoPostPromise = page.waitForResponse(
      res => res.url().includes('/api/edges') && res.request().method() === 'POST'
    );
    await page.keyboard.press('Control+z');
    await undoPostPromise;
    await selectNode(page, ids.settings);
    await expect(parentBox).toBeVisible();
    await expect(page.locator('.react-flow__edge.edge-contains')).toHaveCount(1);
    await expect(nodeLocator(page, ids.root)).toBeVisible({ timeout: 10000 });
    await expect(nodeLocator(page, ids.root).locator('.collapse-btn')).toBeVisible({ timeout: 10000 });
  });

  test('K. Collapsed parent Screen rolls up child Change Impact (.highlight-affected) and Global Impact (.impact-highlighted) with summary badge', async ({ page, request }) => {
    // 1. Create global node and attach Contains children (ids.settings, ids.child) under ids.root
    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Component',
        name: 'Localization',
        aliases: ['i18n'],
        test_status: 'Untested',
        properties: { is_global: 'true', description: '다국어 검증' },
      },
    });
    expect(gRes.ok()).toBeTruthy();
    const globalId = await gRes.json();

    const e1 = await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    expect(e1.ok()).toBeTruthy();
    const e2 = await request.post('/api/edges', {
      data: { source: ids.root, target: ids.child, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    expect(e2.ok()).toBeTruthy();
    const e3 = await request.post('/api/edges', {
      data: { source: ids.settings, target: globalId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });
    expect(e3.ok()).toBeTruthy();

    // Mark child (ids.settings) as modified
    const modRes = await request.post(`/api/nodes/${encodeURIComponent(ids.settings)}/mark-modified`, {
      data: { note: '옵션 슬라이더 UI 개편' },
    });
    expect(modRes.ok()).toBeTruthy();

    const graphRefresh = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await graphRefresh;

    // 2. Collapse parent Screen (ids.root) -> parent must have .highlight-affected and show "⚡ 영향 하위 컴포넌트 1개"
    const parentNode = nodeLocator(page, ids.root);
    await expect(parentNode).toBeVisible({ timeout: 10000 });
    const collapseBtn = parentNode.locator('.collapse-btn');
    await expect(collapseBtn).toBeVisible({ timeout: 10000 });
    await collapseBtn.click({ force: true });

    await expect(nodeLocator(page, ids.settings)).toBeHidden();
    await expect(parentNode).toHaveClass(/\bhighlight-affected\b/);
    const impactBadge = parentNode.locator('.parent-collapse-impact-summary');
    await expect(impactBadge).toBeVisible();
    await expect(impactBadge).toContainText('1');

    // 3. Activate Global Impact Mode for Localization in Globals tab while parent is collapsed -> parent gets .impact-highlighted
    await page.getByRole('button', { name: 'Globals' }).click();
    const impactBtn = page.locator('button[title="Show impact: which nodes are affected by Localization"]');
    await expect(impactBtn).toBeVisible();
    await impactBtn.click();

    await expect(parentNode).toHaveClass(/\bimpact-highlighted\b/);
    await expect(impactBadge).toBeVisible();
    await expect(impactBadge).toContainText('1');
  });

  test('L. GET /api/nodes/{id}/details returns full node metadata, checklist, parent/children, and incoming/outgoing edges', async ({ request }) => {
    await request.put(`/api/nodes/${encodeURIComponent(ids.settings)}`, {
      data: {
        test_status: 'Passed',
        properties: {
          description: '환경설정 팝업 상세 스펙',
          checklist: [
            { id: 'chk_1', text: '배경음 볼륨 슬라이더 동작 확인', status: 'Passed' },
            { id: 'chk_2', text: '효과음 음소거 토글 확인', status: 'Untested' },
          ],
        },
      },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });

    // Query by node ID and by node name
    const resById = await request.get(`/api/nodes/${encodeURIComponent(ids.settings)}/details`);
    expect(resById.ok()).toBeTruthy();
    const detailsById = await resById.json();
    expect(detailsById.id).toBe(ids.settings);
    expect(detailsById.name).toBe('Game Settings');
    expect(detailsById.is_global).toBe(false);
    expect(Array.isArray(detailsById.checklist)).toBe(true);
    expect(detailsById.checklist.length).toBe(2);
    expect(detailsById.parent?.id).toBe(ids.root);
    expect(detailsById.incoming_edges.some((e: any) => e.source_id === ids.root && e.type.toLowerCase() === 'contains')).toBe(true);

    const resByName = await request.get(`/api/nodes/${encodeURIComponent('Game Settings')}/details`);
    expect(resByName.ok()).toBeTruthy();
    const detailsByName = await resByName.json();
    expect(detailsByName.id).toBe(ids.settings);
  });

  test('M. Cloning a parent node duplicates Contains children, checklist, and global badges as Untested while excluding external edges', async ({ page, request }) => {
    // 1. Setup parent ('파티 편성 #일반던전') + Contains child ('영웅 슬롯 #일반던전') + Checklist + Global badge
    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Component',
        name: 'Global_I18N',
        aliases: ['i18n'],
        test_status: 'Passed',
        properties: { is_global: 'true', description: '다국어 검증 배지' },
      },
    });
    expect(gRes.ok()).toBeTruthy();
    const globalId = await gRes.json();

    await request.put(`/api/nodes/${encodeURIComponent(ids.root)}`, {
      data: {
        name: '파티 편성 #일반던전',
        aliases: ['일반던전'],
        test_status: 'Passed',
      },
    });
    await request.put(`/api/nodes/${encodeURIComponent(ids.settings)}`, {
      data: {
        name: '영웅 슬롯 #일반던전',
        aliases: ['일반던전'],
        test_status: 'Passed',
        properties: {
          checklist: [
            { id: 'chk_slot_1', text: '영웅 드래그 배치 정상 동작 확인', status: 'Passed' },
          ],
        },
      },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.settings, target: globalId, type: 'Depends_On', test_status: 'Passed', properties: {} },
    });

    const reloadGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadGraph;

    // 2. Select parent node header and open inline clone box
    await expect(nodeLocator(page, ids.root)).toBeVisible({ timeout: 10000 });
    await nodeLocator(page, ids.root).click({ position: { x: 40, y: 30 }, force: true });
    await expect(page.locator('.details-panel .node-id')).toContainText(ids.root);
    const openCloneBtn = page.locator('.details-panel .node-clone-open-btn');
    await expect(openCloneBtn).toBeVisible();
    await openCloneBtn.click();

    const cloneBox = page.locator('.details-panel .node-clone-box');
    await expect(cloneBox).toBeVisible();
    await cloneBox.locator('.node-clone-tag-input').fill('#아레나');

    const clonePostPromise = page.waitForResponse(
      res => res.url().includes(`/api/nodes/${encodeURIComponent(ids.root)}/clone`) && res.request().method() === 'POST'
    );
    const graphRefreshAfterClone = page.waitForResponse(
      res => res.url().includes('/api/graph') && res.status() === 200
    );
    await cloneBox.locator('.node-clone-confirm-btn').click();

    const cloneRes = await clonePostPromise;
    expect(cloneRes.ok()).toBeTruthy();
    const cloneData = await cloneRes.json();
    expect(cloneData.name).toBe('파티 편성 #아레나');
    expect(cloneData.cloned_node_ids.length).toBe(2);
    await graphRefreshAfterClone;

    // 3. Verify cloned parent and child nodes in graph and on canvas
    const graphAfter = await (await request.get('/api/graph')).json();
    const clonedParent = graphAfter.nodes.find((n: any) => n.name === '파티 편성 #아레나');
    const clonedChild = graphAfter.nodes.find((n: any) => n.name === '영웅 슬롯 #아레나');
    expect(clonedParent).toBeTruthy();
    expect(clonedChild).toBeTruthy();
    expect(clonedParent.test_status).toBe('Untested');
    expect(clonedChild.test_status).toBe('Untested');
    expect(clonedChild.properties.checklist).toEqual([
      { id: 'chk_slot_1', text: '영웅 드래그 배치 정상 동작 확인', status: 'Untested' },
    ]);

    // Contains edge and Global_I18N edge exist for cloned nodes with Untested status, while external TC1/Game_Child edges are NOT cloned
    const clonedContains = graphAfter.edges.find(
      (e: any) => e.source === clonedParent.id && e.target === clonedChild.id && e.type.toLowerCase() === 'contains'
    );
    expect(clonedContains).toBeTruthy();
    expect(clonedContains.test_status).toBe('Untested');

    const clonedGlobalEdge = graphAfter.edges.find(
      (e: any) => e.source === clonedChild.id && e.target === globalId
    );
    expect(clonedGlobalEdge).toBeTruthy();
    expect(clonedGlobalEdge.test_status).toBe('Untested');

    const externalClonedEdges = graphAfter.edges.filter(
      (e: any) =>
        (e.source === ids.tc1 && e.target === clonedParent.id) ||
        (e.source === clonedParent.id && e.target === ids.child)
    );
    expect(externalClonedEdges.length).toBe(0);

    await expect(page.locator('.details-panel .node-id')).toContainText(clonedParent.id);
    await expect(nodeLocator(page, clonedParent.id)).toHaveClass(/\bstatus-untested\b/);
    await expect(nodeLocator(page, clonedChild.id)).toHaveClass(/\bstatus-untested\b/);
    await expect(nodeLocator(page, ids.settings).locator('.badge-pill')).toContainText('✔');
    const clonedBadge = nodeLocator(page, clonedChild.id).locator('.badge-pill');
    await expect(clonedBadge).toContainText('Global_I18N');
    await expect(clonedBadge).not.toContainText('✔');
    await expect(clonedBadge).not.toContainText('✖');

    // 4. Undo (Ctrl+Z) removes the cloned subgraph
    const refreshAfterUndo = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.keyboard.press('Control+z');
    await refreshAfterUndo;
    await expect(nodeLocator(page, clonedParent.id)).toHaveCount(0);
    await expect(nodeLocator(page, clonedChild.id)).toHaveCount(0);
  });

  test('N. Immediate UI update without reload when connecting edges between Contains child and external/sibling components (C1->C2, C2->C1, C1->C3)', async ({ page, request }) => {
    // 1. Setup: [Screen (ids.root) - Contains - Component 1 (ids.settings), Component 3 (comp3Id)] and standalone [Component 2 (ids.child)]
    const initialGraph = await (await request.get('/api/graph')).json();
    for (const e of initialGraph.edges) {
      if (e.source === ids.root && e.target === ids.child) {
        await request.delete(`/api/edges/${encodeURIComponent(e.id)}`);
      }
    }
    const comp3Res = await request.post('/api/nodes', {
      data: { label: 'Component', name: 'Component_3', aliases: [], test_status: 'Untested', properties: {} },
    });
    expect(comp3Res.ok()).toBeTruthy();
    const comp3Id = await comp3Res.json();

    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: comp3Id, type: 'Contains', test_status: 'Passed', properties: {} },
    });

    const initialLoad = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await initialLoad;
    await page.waitForTimeout(600);

    // Helper to drag a connection from source node's outer rim (.halo-handle) to target node center without reloading
    const dragConnectNodes = async (sourceId: string, targetId: string): Promise<string> => {
      const srcBox = await nodeLocator(page, sourceId).locator('.custom-node').boundingBox();
      const tgtBox = await nodeLocator(page, targetId).locator('.custom-node').boundingBox();
      expect(srcBox).not.toBeNull();
      expect(tgtBox).not.toBeNull();

      // Pick the outer rim side of source closest to target
      const srcCenterX = srcBox!.x + srcBox!.width / 2;
      const tgtCenterX = tgtBox!.x + tgtBox!.width / 2;
      const startX = tgtCenterX >= srcCenterX ? srcBox!.x + srcBox!.width + 4 : srcBox!.x - 4;
      const startY = srcBox!.y + srcBox!.height / 2;
      const endX = tgtBox!.x + tgtBox!.width / 2;
      const endY = tgtBox!.y + tgtBox!.height / 2;

      const postEdgePromise = page.waitForResponse(
        res => res.url().includes('/api/edges') && res.request().method() === 'POST'
      );
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 12 });
      await page.mouse.up();

      const postRes = await postEdgePromise;
      expect(postRes.ok()).toBeTruthy();
      return (await postRes.json()) as string;
    };

    // Select Component 1 (ids.settings) first -> Component 2 (ids.child) and sibling Component 3 (comp3Id) are initially de-emphasized
    await selectNode(page, ids.settings);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bde-emphasized\b/);
    await expect(nodeLocator(page, comp3Id)).toHaveClass(/\bde-emphasized\b/);

    // 2. Scenario 1: Connect Component 1 (ids.settings) -> Component 2 (ids.child) WITHOUT reload
    const edgeC1ToC2 = await dragConnectNodes(ids.settings, ids.child);
    const edge1El = page.locator(`.react-flow__edge[data-id="${edgeC1ToC2}"]`);
    await expect(edge1El).toBeVisible();
    await expect(edge1El).toHaveClass(/\bstatus-untested\b/);
    await expect(edge1El).toHaveClass(/\bactive\b/);
    await expect(edge1El).toHaveClass(/\bhighlight-edge\b/);
    await expect(edge1El).not.toHaveClass(/\bde-emphasized\b/);
    const d1 = await edge1El.locator('path.react-flow__edge-path').getAttribute('d');
    expect(d1).toBeTruthy();
    // Component 2 (ids.child) must immediately transition from .de-emphasized to .active.highlight-outgoing without reload
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bhighlight-outgoing\b/);
    await expect(nodeLocator(page, ids.child)).not.toHaveClass(/\bde-emphasized\b/);

    // 3. Scenario 2: Reverse direction Component 2 (ids.child) -> Component 1 (ids.settings) WITHOUT reload
    const edgeC2ToC1 = await dragConnectNodes(ids.child, ids.settings);
    const edge2El = page.locator(`.react-flow__edge[data-id="${edgeC2ToC1}"]`);
    await expect(edge2El).toBeVisible();
    await expect(edge2El).toHaveClass(/\bstatus-untested\b/);
    await expect(edge2El).toHaveClass(/\bactive\b/);
    await expect(edge2El).toHaveClass(/\bhighlight-edge\b/);
    await expect(edge2El).not.toHaveClass(/\bde-emphasized\b/);
    const d2 = await edge2El.locator('path.react-flow__edge-path').getAttribute('d');
    expect(d2).toBeTruthy();
    // Bidirectional bundling must curve both paths ('Q') immediately
    expect(d2).toContain('Q');

    // Select Component 2 (ids.child) and verify Component 1 + parent Screen are active and highlighted
    await selectNode(page, ids.child);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(edge1El).toHaveClass(/\bactive\b/);
    await expect(edge2El).toHaveClass(/\bactive\b/);

    // 4. Scenario 3: Sibling connection Component 1 (ids.settings) -> Component 3 (comp3Id) inside same parent Screen WITHOUT reload
    await selectNode(page, ids.settings);
    await expect(nodeLocator(page, comp3Id)).toHaveClass(/\bde-emphasized\b/);

    const edgeC1ToC3 = await dragConnectNodes(ids.settings, comp3Id);
    const edge3El = page.locator(`.react-flow__edge[data-id="${edgeC1ToC3}"]`);
    await expect(edge3El).toBeVisible();
    await expect(edge3El).toHaveClass(/\bstatus-untested\b/);
    await expect(edge3El).toHaveClass(/\bactive\b/);
    await expect(edge3El).toHaveClass(/\bhighlight-edge\b/);
    await expect(edge3El).not.toHaveClass(/\bde-emphasized\b/);
    const d3 = await edge3El.locator('path.react-flow__edge-path').getAttribute('d');
    expect(d3).toBeTruthy();

    // Sibling Component 3 must immediately become .active.highlight-outgoing while shared parent Screen stays .active without directional border pollution
    await expect(nodeLocator(page, comp3Id)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, comp3Id)).toHaveClass(/\bhighlight-outgoing\b/);
    await expect(nodeLocator(page, comp3Id)).not.toHaveClass(/\bde-emphasized\b/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.root)).not.toHaveClass(/\bhighlight-outgoing\b/);
    await expect(nodeLocator(page, ids.root)).not.toHaveClass(/\bhighlight-incoming\b/);

    // 5. Scenario 4: Drag connection with NO prior node selection (selectedNode === null, cursor hovers target on drop)
    await page.locator('.react-flow__pane').click({ position: { x: 10, y: 300 } });
    await expect(page.locator('.details-panel .node-id')).toHaveCount(0);

    const edgeC3ToC2 = await dragConnectNodes(comp3Id, ids.child);
    const edge4El = page.locator(`.react-flow__edge[data-id="${edgeC3ToC2}"]`);
    await expect(edge4El).toBeVisible();
    await expect(edge4El).toHaveClass(/\bstatus-untested\b/);
    await expect(edge4El).toHaveClass(/\bactive\b/);
    await expect(edge4El).toHaveClass(/\bhighlight-edge\b/);
    await expect(edge4El).not.toHaveClass(/\bde-emphasized\b/);
    const edge4Opacity = await edge4El.evaluate(el => window.getComputedStyle(el).opacity);
    expect(edge4Opacity).toBe('1');
    await expect(nodeLocator(page, comp3Id)).not.toHaveClass(/\bde-emphasized\b/);
    await expect(nodeLocator(page, ids.child)).not.toHaveClass(/\bde-emphasized\b/);

    // 6. Scenario 5: Drag connection when an UNRELATED node (ids.tc1) was previously selected
    await selectNode(page, ids.tc1);
    await expect(nodeLocator(page, ids.tc1)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bde-emphasized\b/);
    await expect(nodeLocator(page, comp3Id)).toHaveClass(/\bde-emphasized\b/);

    const edgeC2ToC3 = await dragConnectNodes(ids.child, comp3Id);
    const edge5El = page.locator(`.react-flow__edge[data-id="${edgeC2ToC3}"]`);
    await expect(edge5El).toBeVisible();
    await expect(edge5El).toHaveClass(/\bstatus-untested\b/);
    await expect(edge5El).toHaveClass(/\bactive\b/);
    await expect(edge5El).toHaveClass(/\bhighlight-edge\b/);
    await expect(edge5El).not.toHaveClass(/\bde-emphasized\b/);
    const edge5Opacity = await edge5El.evaluate(el => window.getComputedStyle(el).opacity);
    expect(edge5Opacity).toBe('1');
    const d5 = await edge5El.locator('path.react-flow__edge-path').getAttribute('d');
    expect(d5).toBeTruthy();
    expect(d5).toContain('Q');
  });

  test('O. Viewport preservation on edge edit & Long-Distance Quick Connect (Pattern A Popover & Pattern B 2-Step Click)', async ({ page, request }) => {
    // 1. Pan/zoom viewport to a custom transform and verify editing an edge does NOT reset camera viewport
    const viewportEl = page.locator('.react-flow__viewport');
    await page.locator('.react-flow__pane').hover({ position: { x: 400, y: 300 } });
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(200);
    const transformBeforeEdit = await viewportEl.getAttribute('style');

    // Select existing edge (ids.root -> ids.child) via API lookup + click
    const initialGraph = await (await request.get('/api/graph')).json();
    const rootToChildEdge = initialGraph.edges.find((e: any) => e.source === ids.root && e.target === ids.child);
    expect(rootToChildEdge).toBeTruthy();

    const edgeLocator = page.locator(`.react-flow__edge[data-id="${rootToChildEdge.id}"]`);
    await edgeLocator.locator('.react-flow__edge-interaction').click({ force: true });
    await expect(page.locator('#edgeType')).toBeVisible();

    // Update Action/Trigger without changing edge type -> elementId and camera viewport must remain identical
    const actionInput = page.locator('.details-panel input[placeholder*="Android Back Button"]');
    await actionInput.fill('Click Start Button');
    const putEdgePromise = page.waitForResponse(
      res => res.url().includes('/api/edges/') && res.request().method() === 'PUT'
    );
    await page.locator('.details-panel button.primary:has-text("Save")').click();
    const putRes = await putEdgePromise;
    expect(putRes.ok()).toBeTruthy();
    const putData = await putRes.json();
    expect(putData.new_id).toBe(rootToChildEdge.id);

    await page.waitForTimeout(150);
    const transformAfterEdit = await viewportEl.getAttribute('style');
    expect(transformAfterEdit).toBe(transformBeforeEdit);

    // 2. Pattern A: Drag from ids.root outer rim (.halo-handle) and drop on empty pane (>= 50px) -> Quick Connect Popover opens
    const rootBox = await nodeLocator(page, ids.root).locator('.custom-node').boundingBox();
    expect(rootBox).not.toBeNull();
    const startX = rootBox!.x + rootBox!.width + 4;
    const startY = rootBox!.y + rootBox!.height / 2;
    const dropX = Math.max(60, rootBox!.x - 160);
    const dropY = Math.max(60, rootBox!.y - 140);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 10 });
    await page.mouse.up();

    const popover = page.locator('.quick-connect-popover');
    await expect(popover).toBeVisible();
    await expect(popover.locator('.quick-connect-type-pills')).toBeVisible();
    await expect(popover.locator('.quick-connect-close-btn')).toBeVisible();

    // Verify #alias search works (strip leading # when matching node aliases) and candidate item label is rendered
    await popover.locator('.quick-connect-search-input').fill('#sub');
    await expect(popover.locator('.quick-connect-item', { hasText: 'Game Testing Child' })).toBeVisible();
    await expect(popover.locator('.quick-connect-item-label').first()).toBeVisible();

    // Choose Depends_On pill, search for 'Game Settings', and click candidate
    await popover.locator('.quick-connect-type-pill', { hasText: 'Depends_On' }).click();
    await popover.locator('.quick-connect-search-input').fill('Game Settings');
    const postQuickEdge = page.waitForResponse(
      res => res.url().includes('/api/edges') && res.request().method() === 'POST'
    );
    await popover.locator('.quick-connect-item', { hasText: 'Game Settings' }).click();
    const quickEdgeRes = await postQuickEdge;
    expect(quickEdgeRes.ok()).toBeTruthy();
    const quickEdgeId = await quickEdgeRes.json();
    await expect(popover).toBeHidden();
    await expect(page.locator(`.react-flow__edge[data-id="${quickEdgeId}"]`)).toBeVisible();

    // 3. Pattern B: Select ids.settings, click .start-connect-mode-btn, then click ids.child on canvas
    await selectNode(page, ids.settings);
    const startConnectBtn = page.locator('.details-panel .start-connect-mode-btn');
    await expect(startConnectBtn).toBeVisible();
    await startConnectBtn.click();

    const pendingBanner = page.locator('.pending-connect-banner');
    await expect(pendingBanner).toBeVisible();

    const postStepEdge = page.waitForResponse(
      res => res.url().includes('/api/edges') && res.request().method() === 'POST'
    );
    await nodeLocator(page, ids.child).click({ force: true });
    const stepEdgeRes = await postStepEdge;
    expect(stepEdgeRes.ok()).toBeTruthy();
    const stepEdgeId = await stepEdgeRes.json();
    await expect(pendingBanner).toBeHidden();
    await expect(page.locator(`.react-flow__edge[data-id="${stepEdgeId}"]`)).toBeVisible();
  });

  test('P. Badge selection clearing on pane click & Un-globalizing a Global Node restores it and its edges to canvas', async ({ page, request }) => {
    // 1. Create a global node and attach it to ids.root and ids.child
    const gRes = await request.post('/api/nodes', {
      data: {
        label: 'Screen',
        name: 'Common_Auth_Global',
        aliases: ['auth'],
        test_status: 'Passed',
        properties: { is_global: 'true' },
      },
    });
    expect(gRes.ok()).toBeTruthy();
    const globalId = await gRes.json();

    await request.post('/api/edges', {
      data: { source: ids.root, target: globalId, type: 'Depends_On', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.child, target: globalId, type: 'Depends_On', test_status: 'Passed', properties: {} },
    });

    const reloadGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadGraph;

    // 2. Click the badge pill on ids.root -> badge pill highlights, holder nodes (ids.root, ids.child) are .active, unrelated (ids.settings) is .de-emphasized
    await expect(nodeLocator(page, ids.root)).toBeVisible({ timeout: 10000 });
    const badgePill = nodeLocator(page, ids.root).locator('.badge-pill', { hasText: 'Common_Auth_Global' });
    await expect(badgePill).toBeVisible({ timeout: 10000 });
    await badgePill.click();

    await expect(page.locator('#nodeName')).toHaveValue('Common_Auth_Global');
    await expect(badgePill).toHaveCSS('box-shadow', /rgba\(96,\s*165,\s*250,\s*0\.5\)/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bde-emphasized\b/);

    // 3. Click empty pane -> badge pill selection highlight and canvas .has-selection must clear immediately
    await page.locator('.react-flow__pane').click({ position: { x: 25, y: 250 } });
    await expect(badgePill).not.toHaveCSS('box-shadow', /rgba\(96,\s*165,\s*250,\s*0\.5\)/);
    await expect(page.locator('.react-flow')).not.toHaveClass(/\bhas-selection\b/);

    // 4. Open Globals tab, click [✎ 편집] (.global-node-edit-btn), uncheck #nodeIsGlobal (even though label was 'Screen'), and Save
    await page.getByRole('button', { name: 'Globals' }).click();
    const editGlobalBtn = page.locator('.global-node-edit-btn').first();
    await expect(editGlobalBtn).toBeVisible();
    await editGlobalBtn.click();

    const globalCheckbox = page.locator('#nodeIsGlobal');
    await expect(globalCheckbox).toBeVisible();
    await expect(globalCheckbox).toBeEnabled();
    await expect(globalCheckbox).toBeChecked();

    await globalCheckbox.uncheck();
    const refreshAfterUnglobal = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.locator('.details-panel button.primary:has-text("Save")').click();
    await refreshAfterUnglobal;

    // Verify Common_Auth_Global is now a visible canvas node and its edges are visible on the canvas
    await expect(nodeLocator(page, globalId)).toBeVisible({ timeout: 10000 });
    await expect(nodeLocator(page, ids.root).locator('.badge-pill', { hasText: 'Common_Auth_Global' })).toHaveCount(0);
  });

  test('Q. Distinct highlight classes (.highlight-selected, .highlight-search-match, .highlight-incoming, .highlight-outgoing) & Multi-Global OR/AND Impact Overlay', async ({ page, request }) => {
    // 1. Select ids.root -> ids.root gets .highlight-selected, ids.tc1 gets .highlight-incoming, ids.child gets .highlight-outgoing with amber border
    await selectNode(page, ids.root);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bhighlight-selected\b/);
    await expect(nodeLocator(page, ids.tc1)).toHaveClass(/\bhighlight-incoming\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bhighlight-outgoing\b/);

    // Verify .highlight-outgoing custom-node border color is amber (rgb(217, 119, 6)), NOT overridden by active blue
    await expect(nodeLocator(page, ids.child).locator('.custom-node')).toHaveCSS('border-color', 'rgb(217, 119, 6)');

    // 2. Search Highlight -> search seed gets .highlight-search-match (cyan border rgb(8, 145, 178))
    await page.locator('.react-flow__pane').click({ position: { x: 25, y: 250 } });
    await page.getByRole('button', { name: 'Filters' }).click();
    const searchInput = page.locator('input[placeholder="Type to highlight nodes..."]');
    await searchInput.fill('Game Testing Root');
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bhighlight-search-match\b/);
    await expect(nodeLocator(page, ids.root).locator('.custom-node')).toHaveCSS('border-color', 'rgb(8, 145, 178)');
    await searchInput.fill('');

    // 3. Create 2 Global Nodes: Global_Alpha (attached to ids.root & ids.child) and Global_Beta (attached to ids.child & ids.settings)
    const g1Res = await request.post('/api/nodes', {
      data: { label: 'Component', name: 'Global_Alpha', aliases: [], test_status: 'Passed', properties: { is_global: 'true' } },
    });
    const g2Res = await request.post('/api/nodes', {
      data: { label: 'Component', name: 'Global_Beta', aliases: [], test_status: 'Failed', properties: { is_global: 'true' } },
    });
    const g1Id = await g1Res.json();
    const g2Id = await g2Res.json();

    const e1 = await request.post('/api/edges', { data: { source: ids.root, target: g1Id, type: 'Depends_On', test_status: 'Passed', properties: {} } });
    const e2 = await request.post('/api/edges', { data: { source: ids.child, target: g1Id, type: 'Depends_On', test_status: 'Passed', properties: {} } });
    const e3 = await request.post('/api/edges', { data: { source: ids.child, target: g2Id, type: 'Depends_On', test_status: 'Failed', properties: {} } });
    const e4 = await request.post('/api/edges', { data: { source: ids.settings, target: g2Id, type: 'Depends_On', test_status: 'Failed', properties: {} } });
    expect(e1.ok() && e2.ok() && e3.ok() && e4.ok()).toBeTruthy();

    const reloadGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadGraph;

    // 4. Activate BOTH Global_Alpha and Global_Beta in Globals tab
    await page.getByRole('button', { name: 'Globals' }).click();
    const alphaToggleBtn = page.locator('button[title="Show impact: which nodes are affected by Global_Alpha"]');
    const betaToggleBtn = page.locator('button[title="Show impact: which nodes are affected by Global_Beta"]');
    await alphaToggleBtn.click();
    await betaToggleBtn.click();

    await expect(alphaToggleBtn).toHaveClass(/\bimpact-slot-0\b/);
    await expect(betaToggleBtn).toHaveClass(/\bimpact-slot-1\b/);

    const statsBar = page.locator('.impact-stats-bar');
    await expect(statsBar).toBeVisible();
    await expect(statsBar.locator('.impact-chip.impact-slot-0')).toBeVisible();
    await expect(statsBar.locator('.impact-chip.impact-slot-1')).toBeVisible();
    await expect(statsBar.locator('.impact-slot-dot.slot-0')).toBeVisible();
    await expect(statsBar.locator('.impact-slot-dot.slot-1')).toBeVisible();
    await expect(statsBar).toContainText('영향 받는 노드 3개');

    // In OR mode: ids.root has impact-slot-0, ids.settings has impact-slot-1, and overlapping ids.child has impact-multi-overlap + badge-impact-slot-0 & badge-impact-slot-1
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bimpact-slot-0\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bimpact-slot-1\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bimpact-multi-overlap\b/);
    await expect(nodeLocator(page, ids.child).locator('.badge-pill.badge-impact-slot-0')).toBeVisible();
    await expect(nodeLocator(page, ids.child).locator('.badge-pill.badge-impact-slot-1')).toBeVisible();

    // 5. Switch to AND (교집합) filter -> only ids.child (affected by both) stays .impact-highlighted
    await statsBar.locator('.impact-operator-btn', { hasText: '교집합 (AND)' }).click();
    await expect(statsBar).toContainText('영향 받는 노드 1개');
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bimpact-highlighted\b/);
    await expect(nodeLocator(page, ids.root)).not.toHaveClass(/\bimpact-highlighted\b/);
    await expect(nodeLocator(page, ids.settings)).not.toHaveClass(/\bimpact-highlighted\b/);
  });

  test('R. Global Impact Isolation, Impact Navigator Drawer & Fly-to, and Domain Filter Bar', async ({ page, request }) => {
    // 1. Assign domain '전투' to ids.root in Inspector EditNodeForm
    await selectNode(page, ids.root);
    const domainPresetBtn = page.locator('.domain-preset-pill', { hasText: '전투' });
    await expect(domainPresetBtn).toBeVisible();
    await domainPresetBtn.click();
    await expect(page.locator('#nodeDomain')).toHaveValue('Battle');

    const putDomain = page.waitForResponse(
      res => res.url().includes(`/api/nodes/${encodeURIComponent(ids.root)}`) && res.request().method() === 'PUT'
    );
    await page.locator('.details-panel button.primary:has-text("Save")').click();
    expect((await putDomain).ok()).toBeTruthy();

    // Verify domain badge & accent bar on ids.root and DomainFilterBar at top of canvas
    await expect(nodeLocator(page, ids.root).locator('.node-domain-badge')).toContainText('전투');
    await expect(nodeLocator(page, ids.root).locator('.node-domain-accent')).toBeVisible();

    // Also create a node with '#도메인:성장' hashtag fallback and Failed status to verify hashtag domain & visible fault dot
    const growthRes = await request.post('/api/nodes', {
      data: { label: 'Screen', name: 'Hero_Upgrade_Screen #도메인:성장', aliases: ['#도메인:성장'], test_status: 'Failed', properties: {} },
    });
    const growthNodeId = await growthRes.json();
    const reloadAfterGrowth = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadAfterGrowth;

    await expect(nodeLocator(page, growthNodeId).locator('.node-domain-badge')).toContainText('성장');
    await expect(nodeLocator(page, growthNodeId).locator('.node-domain-accent')).toBeVisible();

    const domainBar = page.locator('.domain-filter-bar');
    await expect(domainBar).toBeVisible();
    const battleChip = domainBar.locator('.domain-chip-btn', { hasText: '전투' });
    await expect(battleChip).toBeVisible();
    const growthChip = domainBar.locator('.domain-chip-btn', { hasText: '성장' });
    await expect(growthChip).toBeVisible();
    const faultDot = growthChip.locator('.domain-fault-dot');
    await expect(faultDot).toBeVisible();
    const dotBox = await faultDot.boundingBox();
    expect(dotBox).not.toBeNull();
    expect(dotBox!.width).toBeGreaterThanOrEqual(5);
    expect(dotBox!.height).toBeGreaterThanOrEqual(5);

    // 2. Click '전투' domain chip -> .react-flow gets .domain-active, ids.root gets .domain-matched
    await battleChip.click();
    await expect(page.locator('.react-flow')).toHaveClass(/\bdomain-active\b/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bdomain-matched\b/);
    await expect(nodeLocator(page, ids.settings)).not.toHaveClass(/\bdomain-matched\b/);

    // Toggle domain isolation -> .react-flow gets .domain-isolated and non-matched node becomes opacity: 0
    const domainIsolateBtn = domainBar.locator('.domain-isolate-toggle-btn');
    await expect(domainIsolateBtn).toBeVisible();
    await domainIsolateBtn.click();
    await expect(page.locator('.react-flow')).toHaveClass(/\bdomain-isolated\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveCSS('opacity', '0');

    // Switch to '성장' domain while isolated -> edges on Game_Root are not in Growth domain, so their labels become opacity: 0
    await growthChip.click();
    const nonDomainEdgeLabel = page.locator('.floating-edge-label:not(.is-domain-edge)').first();
    await expect(nonDomainEdgeLabel).toHaveCSS('opacity', '0');

    // Clear domain filter
    await domainBar.locator('.domain-chip-all').click();
    await expect(page.locator('.react-flow')).not.toHaveClass(/\bdomain-active\b/);

    // 3. Global Impact Isolation & Impact Navigator Drawer
    const gRes = await request.post('/api/nodes', {
      data: { label: 'Component', name: 'Global_Net_Guard', aliases: [], test_status: 'Passed', properties: { is_global: 'true' } },
    });
    const gId = await gRes.json();
    await request.post('/api/edges', {
      data: { source: ids.root, target: gId, type: 'Depends_On', test_status: 'Passed', properties: {} },
    });

    const reloadGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadGraph;

    await page.getByRole('button', { name: 'Globals' }).click();
    await page.locator('button[title="Show impact: which nodes are affected by Global_Net_Guard"]').click();

    const statsBar = page.locator('.impact-stats-bar');
    await expect(statsBar).toBeVisible();

    // Toggle Impact Isolation ON
    const isolateBtn = statsBar.locator('.impact-isolate-btn');
    await expect(isolateBtn).toBeVisible();
    await isolateBtn.click();
    await expect(page.locator('.react-flow')).toHaveClass(/\bis-isolated\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveCSS('opacity', '0');

    // Open Impact Navigator Drawer and click item to Fly-to & select node
    const listToggleBtn = statsBar.locator('.impact-list-toggle-btn');
    await listToggleBtn.click();
    const drawer = page.locator('.impact-navigator-drawer');
    await expect(drawer).toBeVisible();
    const navItem = drawer.locator('.impact-navigator-item', { hasText: 'Game Testing Root' });
    await expect(navItem).toBeVisible();
    await navItem.click();
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bhighlight-selected\b/);
  });

  test('S. Overview Collapse All & Proxy Edges, Quick Connect Create & Connected Badge, Hide Unconnected Edges, and Clone with #골드던전 under Active Filter', async ({ page, request }) => {
    // 1. Setup parent-child hierarchy (ids.root --Contains--> subId) and inter-group edge (subId --Transition--> ids.settings)
    const subRes = await request.post('/api/nodes', {
      data: { label: 'Component', name: 'Sub_Hero_Slot #일반던전', aliases: ['subslot'], test_status: 'Failed', properties: {} },
    });
    const subId = await subRes.json();
    await request.post('/api/edges', {
      data: { source: ids.root, target: subId, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: subId, target: ids.settings, type: 'Transition', test_status: 'Failed', properties: {} },
    });

    const reloadGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadGraph;

    // 2. Item A: Collapse All button in TopToolbar -> child node hides and proxy edge delegates to ids.root -> ids.settings
    const collapseAllBtn = page.locator('.toolbar-collapse-all-btn');
    await expect(collapseAllBtn).toBeVisible();
    await collapseAllBtn.click();

    await expect(nodeLocator(page, subId)).toHaveCount(0);
    await expect(nodeLocator(page, ids.root).locator('.parent-collapse-summary')).toBeVisible();
    const proxyEdge = page.locator(`.react-flow__edge[data-id="${ids.root}-${ids.settings}-Transition"]`);
    await expect(proxyEdge).toBeVisible();


    // Expand all back
    await collapseAllBtn.click();
    await expect(nodeLocator(page, subId)).toBeVisible();

    // 3. Item H: Hide Unconnected Edges when focused
    await page.getByRole('button', { name: 'Filters' }).click();
    const hideUnconnectedCheckbox = page.locator('#hideUnconnectedEdges');
    await expect(hideUnconnectedCheckbox).toBeVisible();
    await hideUnconnectedCheckbox.check();
    await expect(page.locator('.react-flow')).toHaveClass(/\bhide-unconnected-edges\b/);

    await selectNode(page, ids.tc1);
    const deEmphasizedEdge = page.locator('.react-flow__edge.de-emphasized').first();
    await expect(deEmphasizedEdge).toHaveCSS('opacity', '0');

    await page.getByRole('button', { name: 'Filters' }).click();
    await hideUnconnectedCheckbox.uncheck();

    // 4. Items C & D: Quick Connect Popover shows already-connected badge and supports inline node creation + immediate connection
    const rootBox = await nodeLocator(page, ids.root).locator('.custom-node').boundingBox();
    expect(rootBox).not.toBeNull();
    const startX = rootBox!.x + rootBox!.width + 4;
    const startY = rootBox!.y + rootBox!.height / 2;
    const dropX = Math.max(60, rootBox!.x - 160);
    const dropY = Math.max(60, rootBox!.y - 120);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 10 });
    await page.mouse.up();

    const popover = page.locator('.quick-connect-popover');
    await expect(popover).toBeVisible();

    // Item D: Search 'Game Testing Child' (already connected from ids.root via Depends_On) -> verify connected badge is visible
    await popover.locator('.quick-connect-search-input').fill('Game Testing Child');
    const childCandidate = popover.locator('.quick-connect-item', { hasText: 'Game Testing Child' });
    await expect(childCandidate).toBeVisible();
    await expect(childCandidate.locator('.quick-connect-connected-badge')).toBeVisible();

    // Item C: Type a new node name and click inline Create & Connect button
    await popover.locator('.quick-connect-search-input').fill('Quick_Created_Dungeon');
    const createBtn = popover.locator('.quick-connect-create-btn');
    await expect(createBtn).toBeVisible();

    const postNewNode = page.waitForResponse(res => res.url().includes('/api/nodes') && res.request().method() === 'POST');
    const postNewEdge = page.waitForResponse(res => res.url().includes('/api/edges') && res.request().method() === 'POST');
    await createBtn.click();
    const createdNodeId = await (await postNewNode).json();
    expect((await postNewEdge).ok()).toBeTruthy();

    await expect(popover).toBeHidden();
    await expect(nodeLocator(page, createdNodeId)).toBeVisible();

    // 5. Item B: Clone a node with '#골드던전' while a workspace filter is active -> cloned node is immediately visible without refresh
    await page.getByRole('button', { name: 'Filters' }).click();
    const filterGraphRes = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.locator('#filterGraph').selectOption('subslot');
    await filterGraphRes;
    await page.waitForTimeout(300);

    await nodeLocator(page, subId).locator('.custom-node').click({ force: true });
    await expect(page.locator('.details-panel .node-id')).toContainText(subId);
    await page.getByRole('button', { name: '📋 노드 복제' }).click();
    await page.locator('.node-clone-tag-input').fill('#골드던전');
    const cloneApiRes = page.waitForResponse(res => res.url().includes('/clone') && res.request().method() === 'POST');
    await page.locator('.node-clone-confirm-btn').click();
    const cloneData = await (await cloneApiRes).json();
    const clonedNodeId = cloneData.cloned_root_id;

    // Cloned node must be immediately visible on the canvas without needing a browser reload
    await expect(nodeLocator(page, clonedNodeId)).toBeVisible({ timeout: 10000 });
    await expect(nodeLocator(page, clonedNodeId)).toContainText('Sub_Hero_Slot #골드던전');
  });

  test('T. Half-Screen (960×1080) Top HUD Zero-Overlap, Add Node after Edge Selection & Right-Click, and HelpModal Changelog & Inline Tooltips', async ({ page, request }) => {
    // Seed domain property on root and child so DomainFilterBar is rendered with multiple domain chips
    await request.put(`/api/nodes/${ids.root}`, {
      data: { label: 'Feature', name: 'Game Testing Root', aliases: ['root_alias'], properties: { domain: '전투' } },
    });
    await request.put(`/api/nodes/${ids.child}`, {
      data: { label: 'Feature', name: 'Game Testing Child', aliases: ['child_alias'], properties: { domain: '성장' } },
    });
    await request.put(`/api/nodes/${ids.settings}`, {
      data: { label: 'Screen', name: 'Game_Settings', aliases: ['settings'], properties: { domain: '경제' } },
    });
    const globalId = await (
      await request.post('/api/nodes', {
        data: { label: 'Component', name: 'Global_HUD_Check', aliases: ['global'], properties: { is_global: 'true' } },
      })
    ).json();
    await request.post('/api/edges', {
      data: { source: ids.settings, target: globalId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });

    const graphReload = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await graphReload;
    await page.waitForTimeout(400);

    // 1. Resize viewport to half-screen (960×1080) and verify 0px bounding-box overlap among TopToolbar, DomainFilterBar, and InspectorPanel
    await page.setViewportSize({ width: 960, height: 1080 });
    await page.waitForTimeout(300);

    const topToolbar = page.locator('.top-toolbar');
    const domainBar = page.locator('.domain-filter-bar');
    const inspectorPanel = page.locator('.details-panel');
    await expect(topToolbar).toBeVisible();
    await expect(domainBar).toBeVisible();
    await expect(inspectorPanel).toBeVisible();

    const toolbarBox = await topToolbar.boundingBox();
    const domainBox = await domainBar.boundingBox();
    const inspectorBox = await inspectorPanel.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(domainBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();

    const boxesOverlap = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number }
    ) => {
      const noHorizontalOverlap = a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
      const noVerticalOverlap = a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1;
      return !(noHorizontalOverlap || noVerticalOverlap);
    };

    expect(boxesOverlap(toolbarBox!, domainBox!)).toBe(false);
    expect(boxesOverlap(toolbarBox!, inspectorBox!)).toBe(false);
    expect(boxesOverlap(domainBox!, inspectorBox!)).toBe(false);

    // Verify TopToolbar semantic CSS classes (.toolbar-btn-presets distinct sky-blue color & .toolbar-btn-help circular style)
    const presetsBtn = topToolbar.locator('.toolbar-btn-presets');
    const helpBtn = topToolbar.locator('.toolbar-btn-help');
    await expect(presetsBtn).toHaveCSS('background-color', 'rgb(2, 132, 199)');
    await expect(helpBtn).toHaveCSS('border-radius', '50%');

    // 2. Select an edge, modify EditEdgeForm without saving, then click 'Add Node' in TopToolbar -> EditNodeForm (#nodeName) must appear cleanly
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(300);
    const edgeInteraction = page.locator('.react-flow__edge:not(.edge-contains) .react-flow__edge-interaction').first();
    await edgeInteraction.click({ force: true });
    await expect(page.locator('.details-panel h3').first()).toContainText('연결선(Edge) 편집');
    await expect(page.locator('#edgeType')).toBeVisible();
    await page.locator('#edgeType').selectOption('Return');
    await page.locator('#edgeAction').fill('Unsaved_Edge_Trigger');

    await topToolbar.getByRole('button', { name: 'Add Node' }).click();
    await expect(page.locator('.details-panel h3').first()).toContainText('Add Node');
    await expect(page.locator('#nodeName')).toBeVisible();
    await expect(page.locator('#edgeType')).toHaveCount(0);

    await page.locator('#nodeName').fill('Created_After_Edge_Toolbar');
    const createToolbarNodeRes = page.waitForResponse(res => res.url().includes('/api/nodes') && res.request().method() === 'POST');
    await page.locator('.details-panel button.primary', { hasText: 'Save' }).click();
    const createdToolbarNodeId = await (await createToolbarNodeRes).json();
    await expect(nodeLocator(page, createdToolbarNodeId)).toBeVisible();

    // 3. Select an edge again, then right-click canvas pane and click '➕ 새 노드 추가' -> context menu closes and EditNodeForm (#nodeName) appears
    await edgeInteraction.click({ force: true });
    await expect(page.locator('.details-panel h3').first()).toContainText('연결선(Edge) 편집');

    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 260, y: 500 } });
    const contextMenu = page.locator('.context-menu');
    await expect(contextMenu).toBeVisible();
    await contextMenu.locator('.context-menu-item', { hasText: '새 노드 추가' }).click();
    await expect(contextMenu).toBeHidden();
    await expect(page.locator('.details-panel h3').first()).toContainText('Add Node');
    await expect(page.locator('#nodeName')).toBeVisible();

    await page.locator('#nodeName').fill('Created_After_Edge_ContextMenu');
    const createCtxNodeRes = page.waitForResponse(res => res.url().includes('/api/nodes') && res.request().method() === 'POST');
    await page.locator('.details-panel button.primary', { hasText: 'Save' }).click();
    const createdCtxNodeId = await (await createCtxNodeRes).json();
    await expect(nodeLocator(page, createdCtxNodeId)).toBeVisible();

    // 4. Select an edge (editFormData.type = 'edge'), activate Global Impact and click a node in Impact Navigator drawer -> must switch to EditNodeForm for that node
    await edgeInteraction.click({ force: true });
    await expect(page.locator('#edgeType')).toBeVisible();
    await page.locator('.panel-tab-btn', { hasText: 'Globals' }).click();
    const impactBtn = page.locator('.impact-toggle-btn').first();
    await impactBtn.click();
    const listToggleBtn = page.locator('.impact-list-toggle-btn');
    await expect(listToggleBtn).toBeVisible();
    await listToggleBtn.click();
    const firstImpactItem = page.locator('.impact-navigator-item').first();
    await expect(firstImpactItem).toBeVisible();
    await firstImpactItem.click();
    await expect(page.locator('#nodeName')).toBeVisible();
    await expect(page.locator('#edgeType')).toHaveCount(0);
    await expect(page.locator('#nodeName')).toHaveValue('Game_Settings');
    await page.locator('.impact-close-btn').click();

    // 5. Verify inline '?' tooltips exist and HelpModal Changelog tab displays version history
    await expect(domainBar.locator('[data-tooltip-id="app-tooltip"]')).toBeVisible();
    await topToolbar.locator('.toolbar-btn-help').click();
    const changelogTabBtn = page.getByRole('button', { name: /변경 이력/ });
    await expect(changelogTabBtn).toBeVisible();
    await changelogTabBtn.click();
    await expect(page.getByText('v0.5.1')).toBeVisible();
    await expect(page.getByText('v0.5.0')).toBeVisible();
  });

  test('U. Edge Action Persistence across Reload, Edge Attribute Search Highlight, Unified 9 Node / 7 Edge Types in QuickConnect & Forms, and Domain Isolation Camera Positioning', async ({ page, request }) => {
    // 1. Item 2: Save Edge Action/Trigger & Edge Type, then verify persistence across full page reload (F5)
    const initialGraph = await (await request.get('/api/graph')).json();
    const rootChildEdge = initialGraph.edges.find((e: any) => e.source === ids.root && e.target === ids.child);
    expect(rootChildEdge).toBeTruthy();

    const targetEdgeEl = page.locator(`.react-flow__edge[data-id="${rootChildEdge.id}"]`);
    await expect(targetEdgeEl).toBeVisible();
    await targetEdgeEl.locator('.react-flow__edge-interaction').click({ force: true });

    await expect(page.locator('#edgeType')).toBeVisible();
    await expect(page.locator('#edgeAction')).toBeVisible();

    // Verify 7 unified edge types in EditEdgeForm (#edgeType)
    const editEdgeOptions = await page.locator('#edgeType option').evaluateAll(
      opts => opts.map(o => (o as HTMLOptionElement).value)
    );
    expect(editEdgeOptions).toEqual([
      'Transition',
      'Contains',
      'Displays',
      'Depends_On',
      'Triggers',
      'Tests',
      'Return',
    ]);

    await page.locator('#edgeType').selectOption('Triggers');
    await page.locator('#edgeAction').fill('상점 버튼 클릭');

    const putEdgePromise = page.waitForResponse(
      res => res.url().includes('/api/edges/') && res.request().method() === 'PUT'
    );
    await page.locator('.details-panel button.primary', { hasText: 'Save' }).click();
    const putEdgeRes = await putEdgePromise;
    expect(putEdgeRes.ok()).toBeTruthy();

    // FloatingEdge badge must immediately display the saved action
    await expect(page.locator('.floating-edge-label', { hasText: '(상점 버튼 클릭)' })).toBeVisible();

    // Reload browser (F5) and confirm edge action persists on canvas and in EditEdgeForm
    const reloadGraph = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    const reloadedGraphData = await (await reloadGraph).json();
    const updatedEdge = reloadedGraphData.edges.find((e: any) => e.source === ids.root && e.target === ids.child);
    expect(updatedEdge).toBeTruthy();
    expect(updatedEdge.action).toBe('상점 버튼 클릭');

    const reloadedActionBadge = page.locator('.floating-edge-label', { hasText: '(상점 버튼 클릭)' });
    await expect(reloadedActionBadge).toBeVisible({ timeout: 10000 });

    const reloadedEdgeEl = page.locator(`.react-flow__edge[data-id="${updatedEdge.id}"]`);
    await reloadedEdgeEl.locator('.react-flow__edge-interaction').click({ force: true });
    await expect(page.locator('#edgeAction')).toHaveValue('상점 버튼 클릭');
    await expect(page.locator('#edgeType')).toHaveValue('Triggers');

    // Clear selection by clicking pane
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 300 } });

    // 2. Item 1: Filters -> Search Highlight matches edge attributes (action, type) and highlights edge + endpoints
    await page.getByRole('button', { name: 'Filters' }).click();
    const searchInput = page.locator('#searchHighlight');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('상점 버튼 클릭');
    await expect(page.locator('.react-flow')).toHaveClass(/\bhas-selection\b/);
    const matchedEdge = page.locator('.react-flow__edge.highlight-search-match');
    await expect(matchedEdge).toHaveCount(1);
    await expect(matchedEdge).toHaveClass(/\bactive\b/);
    await expect(matchedEdge).toHaveClass(/\bhighlight-edge\b/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.root)).not.toHaveClass(/\bde-emphasized\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.child)).not.toHaveClass(/\bde-emphasized\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bde-emphasized\b/);

    // Also match by edge type ('Triggers')
    await searchInput.fill('Triggers');
    await expect(page.locator('.react-flow__edge.highlight-search-match')).toHaveCount(1);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bde-emphasized\b/);

    await searchInput.fill('');
    await expect(reloadedEdgeEl.first()).toBeVisible();

    // 3. Item 4: Verify Unified 9 Node Labels & 7 Edge Types in EditNodeForm and QuickConnectPopover
    await selectNode(page, ids.root);
    const editNodeOptions = await page.locator('#nodeLabel option').evaluateAll(
      opts => opts.map(o => (o as HTMLOptionElement).value)
    );
    expect(editNodeOptions).toEqual([
      'Feature',
      'Screen',
      'Popup',
      'Component',
      'Content',
      'System',
      'Data',
      'TestCase',
      'Node',
    ]);

    const rootBox = await nodeLocator(page, ids.root).locator('.custom-node').boundingBox();
    expect(rootBox).not.toBeNull();
    await page.mouse.move(rootBox!.x + rootBox!.width + 4, rootBox!.y + rootBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(Math.max(60, rootBox!.x - 150), Math.max(120, rootBox!.y - 100), { steps: 10 });
    await page.mouse.up();

    const popover = page.locator('.quick-connect-popover');
    await expect(popover).toBeVisible();
    await popover.locator('.quick-connect-search-input').fill('New_Popup_Node');

    const quickConnectLabels = await popover.locator('[data-testid="quick-connect-label"] option').evaluateAll(
      opts => opts.map(o => (o as HTMLOptionElement).value)
    );
    expect(quickConnectLabels).toEqual(editNodeOptions);

    const quickConnectEdges = await popover.locator('.quick-connect-type-pill').evaluateAll(
      btns => btns.map(b => (b.textContent || '').trim())
    );
    expect(quickConnectEdges).toEqual(editEdgeOptions);

    await popover.locator('.quick-connect-close-btn').click();
    await expect(popover).toBeHidden();

    // 4. Item 3: Domain Tag Selection & Isolation Camera Positioning + Sibling Non-Pollution
    await request.put(`/api/nodes/${encodeURIComponent(ids.root)}`, {
      data: { label: 'Screen', name: 'Main Lobby Screen', aliases: ['Outgame'], test_status: 'Passed', properties: { domain: 'Outgame' } },
    });
    await request.put(`/api/nodes/${encodeURIComponent(ids.child)}`, {
      data: { label: 'Popup', name: 'Diamond Shop Popup', aliases: ['Payment'], test_status: 'Passed', properties: { domain: 'Payment' } },
    });
    await request.put(`/api/nodes/${encodeURIComponent(ids.settings)}`, {
      data: { label: 'Component', name: 'Sound Option Button', aliases: ['Outgame'], test_status: 'Passed', properties: { domain: 'Outgame' } },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.child, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });

    const reloadForDomain = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadForDomain;
    await page.waitForTimeout(500);

    const domainBar = page.locator('.domain-filter-bar');
    const paymentChip = domainBar.locator('.domain-chip', { hasText: 'Payment' });
    await expect(paymentChip).toBeVisible();
    await paymentChip.click();
    await page.waitForTimeout(550);

    // Child 'Diamond Shop Popup' (#Payment) and its parent container must be .domain-matched,
    // while sibling 'Sound Option Button' (#Outgame) must NOT be polluted with .domain-matched
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bdomain-matched\b/);
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bdomain-matched\b/);
    await expect(nodeLocator(page, ids.settings)).not.toHaveClass(/\bdomain-matched\b/);

    // Toggle Domain Isolation ON -> sibling 'Sound Option Button' is hidden (opacity 0), and target node is centered in unoccluded canvas area
    const isolateBtn = domainBar.locator('.domain-isolate-btn');
    await isolateBtn.click();
    await page.waitForTimeout(550);

    await expect(page.locator('.react-flow')).toHaveClass(/\bdomain-isolated\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveCSS('opacity', '0');

    const childRect = await nodeLocator(page, ids.child).boundingBox();
    const inspectorRect = await page.locator('.details-panel').boundingBox();
    const hudRect = await page.locator('.top-hud-panel').boundingBox();
    expect(childRect).not.toBeNull();
    expect(inspectorRect).not.toBeNull();
    expect(hudRect).not.toBeNull();

    const childCenterX = childRect!.x + childRect!.width / 2;
    const childCenterY = childRect!.y + childRect!.height / 2;
    expect(childCenterX).toBeGreaterThan(40);
    expect(childCenterX).toBeLessThan(inspectorRect!.x);
    expect(childCenterY).toBeGreaterThan(hudRect!.y + hudRect!.height);

    // 5. Collapsed-parent proxy edge Action/Trigger edit & persistence across reload
    await request.post('/api/edges', {
      data: { source: ids.child, target: ids.tc1, type: 'Transition', test_status: 'Passed', properties: {} },
    });
    const reloadBeforeProxy = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    await reloadBeforeProxy;

    // Collapse parent ids.root -> child->tc1 edge becomes a rerouted proxy edge (${ids.root}-${ids.tc1}-Transition)
    await page.locator('.toolbar-collapse-all-btn').click();
    const proxyEdgeId = `${ids.root}-${ids.tc1}-Transition`;
    const proxyEdgeEl = page.locator(`.react-flow__edge[data-id="${proxyEdgeId}"]`);
    await expect(proxyEdgeEl).toBeVisible();
    await proxyEdgeEl.dispatchEvent('click');

    await expect(page.locator('#edgeAction')).toBeVisible();
    await page.locator('#edgeAction').fill('접힌 그룹 대리 간선 액션');
    const putProxyEdgePromise = page.waitForResponse(
      res => res.url().includes('/api/edges/') && res.request().method() === 'PUT'
    );
    await page.locator('.details-panel button.primary', { hasText: 'Save' }).click();
    expect((await putProxyEdgePromise).ok()).toBeTruthy();

    await expect(page.locator('.floating-edge-label', { hasText: '(접힌 그룹 대리 간선 액션)' })).toBeVisible();

    const reloadAfterProxy = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.reload();
    const afterProxyData = await (await reloadAfterProxy).json();
    const persistedUnderlyingEdge = afterProxyData.edges.find((e: any) => e.source === ids.child && e.target === ids.tc1);
    expect(persistedUnderlyingEdge).toBeTruthy();
    expect(persistedUnderlyingEdge.action).toBe('접힌 그룹 대리 간선 액션');

    // 6. Node Category (#nodeCategory / aliases) edit & Save immediately updates Switch Workspace overlay without reload
    await selectNode(page, ids.root);
    const categoryInput = page.locator('#nodeCategory');
    await expect(categoryInput).toBeVisible();
    await categoryInput.fill('Outgame, 신규카테고리_즉시반영');
    const putCategoryPromise = page.waitForResponse(
      res => res.url().includes(`/api/nodes/${encodeURIComponent(ids.root)}`) && res.request().method() === 'PUT'
    );
    await page.locator('.details-panel button.primary', { hasText: 'Save' }).click();
    expect((await putCategoryPromise).ok()).toBeTruthy();

    await page.getByRole('button', { name: /Switch Workspace/i }).click();
    const wsOverlay = page.locator('.workspace-selector-overlay');
    await expect(wsOverlay).toBeVisible();
    const newCategoryBtn = wsOverlay.getByRole('button', { name: '신규카테고리_즉시반영' });
    await expect(newCategoryBtn).toBeVisible();
    await newCategoryBtn.click();
    await expect(wsOverlay).toBeHidden();
    await expect(nodeLocator(page, ids.root)).toBeVisible();
  });
});


