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
});
