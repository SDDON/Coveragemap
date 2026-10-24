import { defineConfig } from '@playwright/test';
import path from 'path';

const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || '8190';
const FRONTEND_PORT = process.env.FRONTEND_PORT || '5173';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15000,
  },
  webServer: [
    {
      command: `uv run uvicorn main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: path.resolve(__dirname, '../backend'),
      url: `http://127.0.0.1:${BACKEND_PORT}/api/graph`,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        ENABLE_DEV_ENDPOINTS: '1',
        PORT: BACKEND_PORT,
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      cwd: path.resolve(__dirname, '../frontend'),
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        BACKEND_PORT: BACKEND_PORT,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
