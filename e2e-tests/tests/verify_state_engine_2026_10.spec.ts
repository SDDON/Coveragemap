import { test, expect, Page, APIRequestContext } from '@playwright/test';

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

// 시드 노드의 elementId를 원본 id 속성(Game_Root 등)으로 찾아옵니다.
const getSeedIds = async (request: APIRequestContext): Promise<SeedIds> => {
  const graph = await (await request.get('/api/graph')).json();
  const byKey = (key: string) => {
    const n = graph.nodes.find((x: { properties?: { id?: string } }) => x.properties?.id === key);
    if (!n) throw new Error(`seed node ${key} not found`);
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
    await request.post('/api/dev/reset-seed');
    ids = await getSeedIds(request);
    // 워크스페이스 선택 오버레이(전체 화면 모달)를 건너뛰고 전체 그래프를 바로 로드합니다.
    // (오버레이가 떠 있으면 force 클릭이 노드 대신 오버레이의 별칭 버튼을 눌러 필터가 걸림)
    await page.addInitScript(() => localStorage.setItem('savedShowAll', 'true'));
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await responsePromise;
    await expect(page.locator('.react-flow__node')).toHaveCount(4);
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
    expect([true, 'true']).toContain(saved.properties.is_manual_override);
    expect(saved.properties.override_reason).toBe('build not delivered');
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
    await request.put(`/api/nodes/${encodeURIComponent(ids.settings)}`, { data: { test_status: 'Passed' } });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });

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

    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.child, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.settings, target: globalId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });

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

    // 3. Select parent container (ids.root) -> Edit panel has unified Checklist + Issue Link (no Verification Guide textarea)
    await selectNode(page, ids.root);
    await expect(page.locator('.details-panel label', { hasText: 'Verification Guide (Description)' })).toHaveCount(0);
    const scopedBtn = page.locator('.scoped-audit-btn');
    await expect(scopedBtn).toBeVisible();
    const auditPromise = page.waitForResponse(res => res.url().includes('/api/qa/audit-cross-cutting') && res.url().includes('scope_root_id='));
    await scopedBtn.click();
    const auditRes = await auditPromise;
    expect(auditRes.ok()).toBeTruthy();

    await expect(page.locator('.scoped-audit-banner')).toBeVisible();
    // Parent (ids.root) and i18n child (ids.settings) are .active, while non-i18n sibling (ids.child) is .de-emphasized
    await expect(nodeLocator(page, ids.root)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.settings)).toHaveClass(/\bactive\b/);
    await expect(nodeLocator(page, ids.child)).toHaveClass(/\bde-emphasized\b/);

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
    await expect(nodeLocator(page, ids.root).locator('.collapse-btn')).toBeVisible();

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

    // 3. Clicking the Contains edge (without force: true) selects it in the Inspector so QA can mark status or delete it
    await containsEdge.locator('.react-flow__edge-interaction').click();
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

    // Re-selecting child node and clicking [⏏ 분리] deletes the Contains edge and unparents the child (persisted across /api/graph refresh)
    await selectNode(page, ids.settings);
    await expect(parentBox).toBeVisible();
    const delResponsePromise = page.waitForResponse(
      res => res.url().includes('/api/edges/') && res.request().method() === 'DELETE'
    );
    const refreshAfterDetach = page.waitForResponse(
      res => res.url().includes('/api/graph') && res.status() === 200
    );
    await parentBox.locator('.parent-relation-btn.detach').click();
    await delResponsePromise;
    await refreshAfterDetach;

    await expect(page.locator('.react-flow__edge.edge-contains')).toHaveCount(0);
    await expect(nodeLocator(page, ids.root).locator('.collapse-btn')).toHaveCount(0);
    await expect(nodeLocator(page, ids.settings)).toBeVisible();

    // 6. Pressing Ctrl+Z (Undo) immediately restores the Contains edge and re-parents the child node
    const undoPostPromise = page.waitForResponse(
      res => res.url().includes('/api/edges') && res.request().method() === 'POST'
    );
    const refreshAfterUndo = page.waitForResponse(
      res => res.url().includes('/api/graph') && res.status() === 200
    );
    await page.keyboard.press('Control+z');
    await undoPostPromise;
    await expect(parentBox).toBeVisible();
    await refreshAfterUndo;
    await expect(page.locator('.react-flow__edge.edge-contains')).toHaveCount(1);
    await expect(nodeLocator(page, ids.root).locator('.collapse-btn')).toBeVisible();
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

    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.settings, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.root, target: ids.child, type: 'Contains', test_status: 'Passed', properties: {} },
    });
    await request.post('/api/edges', {
      data: { source: ids.settings, target: globalId, type: 'Depends_On', test_status: 'Untested', properties: {} },
    });

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
    const collapseBtn = parentNode.locator('.collapse-btn');
    await expect(collapseBtn).toBeVisible();
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
});



