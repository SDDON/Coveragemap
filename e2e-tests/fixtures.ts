import { test as base, expect, APIRequestContext } from '@playwright/test';

const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || '8190';
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

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
    const request = await playwright.request.newContext({
      baseURL: BACKEND_URL,
      timeout: 30000,
    });
    await use(request);
    await request.dispose();
  },

  backendRequest: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({
      baseURL: BACKEND_URL,
      timeout: 30000,
    });
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
