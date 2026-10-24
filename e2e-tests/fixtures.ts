import { test as base, expect, APIRequestContext } from '@playwright/test';

const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || '8190';
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

function attachResetSeedGuard(ctx: APIRequestContext): APIRequestContext {
  const originalPost = ctx.post.bind(ctx);
  ctx.post = (async (url: string, options?: Parameters<APIRequestContext['post']>[1]) => {
    const res = await originalPost(url, options);
    if (url.includes('/api/dev/reset-seed') && res.status() === 403) {
      throw new Error(
        `[E2E 안전 가드] ${BACKEND_URL}에서 실행 중인 백엔드 서버에 ENABLE_DEV_ENDPOINTS=1이 비활성화되어 있어 ` +
        `/api/dev/reset-seed가 403 Forbidden을 반환했습니다. 라이브 Neo4j 데이터 보호를 위해 테스트를 중단합니다. ` +
        `현재 떠 있는 백엔드 서버(run_backend.bat 등)를 먼저 종료한 뒤 테스트를 다시 실행해 주세요.`
      );
    }
    return res;
  }) as APIRequestContext['post'];
  return ctx;
}

/**
 * Custom Playwright test fixture extending standard test runner.
 *
 * Direct Backend Routing:
 * Overrides Playwright's built-in `request` fixture so that all test runner API calls
 * (such as POST /api/dev/reset-seed, GET /api/graph, POST /api/nodes, POST /api/edges)
 * connect directly to Uvicorn (FastAPI) at 127.0.0.1:8190 instead of proxying through
 * the Vite dev server at 127.0.0.1:5173.
 *
 * This completely eliminates Vite dev server proxy socket exhaustion, ECONNRESET,
 * and ECONNREFUSED issues during batch E2E execution.
 */
export const test = base.extend<{
  backendRequest: APIRequestContext;
}>({
  request: async ({ playwright }, use) => {
    const request = attachResetSeedGuard(await playwright.request.newContext({
      baseURL: BACKEND_URL,
      timeout: 30000,
    }));
    await use(request);
    await request.dispose();
  },

  backendRequest: async ({ playwright }, use) => {
    const request = attachResetSeedGuard(await playwright.request.newContext({
      baseURL: BACKEND_URL,
      timeout: 30000,
    }));
    await use(request);
    await request.dispose();
  },

  page: async ({ page }, use) => {
    await use(page);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  },
});

export * from '@playwright/test';
export { expect };
