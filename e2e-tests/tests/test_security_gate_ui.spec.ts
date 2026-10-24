import { test, expect } from '../fixtures';

test.describe('F9: Dev Endpoint & Security Gates Verification', () => {

  test('Dev endpoint POST /api/dev/reset-seed succeeds when ENABLE_DEV_ENDPOINTS=1 is active', async ({ request }) => {
    // In E2E environment, ENABLE_DEV_ENDPOINTS is enabled (1)
    const res = await request.post('/api/dev/reset-seed');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');

    // Verify seed graph state is restored with exactly 4 nodes (TC1, Game_Root, Game_Child, Game_Settings)
    const graphRes = await request.get('/api/graph');
    expect(graphRes.ok()).toBeTruthy();
    const graph = await graphRes.json();
    expect(graph.nodes.length).toBe(4);
    const nodeNames = graph.nodes.map((n: any) => n.name);
    expect(nodeNames).toContain('Game Testing Root');
    expect(nodeNames).toContain('Game Testing Child');
    expect(nodeNames).toContain('Game Settings');
  });

  test('Preset endpoints strictly reject path traversal sequences (..) and invalid characters with HTTP 400', async ({ request }) => {
    // 1. Path traversal sequence in GET /api/presets/{preset_id}
    const traversalGet = await request.get('/api/presets/preset..escape');
    expect(traversalGet.status()).toBe(400);
    const getBody = await traversalGet.json();
    expect(getBody.detail).toMatch(/경로 순회|Path Traversal/);

    // 2. Path traversal sequence in POST /api/presets/{preset_id}/load
    const traversalLoad = await request.post('/api/presets/preset..escape/load');
    expect(traversalLoad.status()).toBe(400);
    const loadBody = await traversalLoad.json();
    expect(loadBody.detail).toMatch(/경로 순회|Path Traversal/);

    // 3. Invalid characters (semicolon, space) rejected with HTTP 400
    const invalidCharRes = await request.get('/api/presets/invalid;id');
    expect(invalidCharRes.status()).toBe(400);
    const invalidBody = await invalidCharRes.json();
    expect(invalidBody.detail).toMatch(/규격이 올바르지 않습니다/);

    // 4. Safe formatting but non-existent preset returns 404, not 400 or 500
    const notFound = await request.get('/api/presets/non_existent_preset_99999_valid_name');
    expect(notFound.status()).toBe(404);
  });

  test('UI Preset Manager modal opens safely, renders available presets, and closes cleanly', async ({ page, request }) => {
    await request.post('/api/dev/reset-seed');
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });

    const graphLoaded = page.waitForResponse(res => res.url().includes('/api/graph') && res.status() === 200);
    await page.goto('/');
    await graphLoaded;

    // Open Presets modal from top toolbar
    const presetsBtn = page.getByRole('button', { name: /Presets/i });
    await expect(presetsBtn).toBeVisible();
    await presetsBtn.click();

    // Verify modal appears with header
    await expect(page.locator('text=샘플 프리셋 관리자')).toBeVisible();

    // Close modal via "닫기" (Close) button in footer
    const closeBtn = page.getByRole('button', { name: '닫기' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Verify modal is dismissed
    await expect(page.locator('text=샘플 프리셋 관리자')).not.toBeVisible();
  });
});
