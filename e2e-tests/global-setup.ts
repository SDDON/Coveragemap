import { request } from '@playwright/test';

const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || '8190';
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

/**
 * Playwright E2E 전역 사전 점검 (Global Preflight Setup)
 *
 * 포트 8190에 일반 모드로 실행 중인 백엔드 서버(run_backend.bat 등, ENABLE_DEV_ENDPOINTS 미설정)가
 * 이미 떠 있을 때 Playwright의 reuseExistingServer가 이를 재사용하면,
 * POST /api/dev/reset-seed가 403 Forbidden으로 거부된 상태에서 후속 테스트들이
 * 사용자의 라이브 Neo4j 데이터를 직접 수정/오염시킬 수 있습니다.
 *
 * 이를 원천 차단하기 위해 테스트 시작 전 /api/dev/reset-seed 응답을 사전 확인하고,
 * 403 Forbidden이면 안내 메시지와 함께 즉시 실행을 중단합니다.
 */
export default async function globalSetup() {
  const context = await request.newContext({
    baseURL: BACKEND_URL,
    timeout: 15000,
  });

  try {
    const res = await context.post('/api/dev/reset-seed');
    if (res.status() === 403) {
      throw new Error(
        `\n================================================================================\n` +
        `❌ [E2E 안전 가드] 현재 ${BACKEND_URL} 포트에 일반 모드로 실행 중인 백엔드 서버가 감지되었습니다.\n` +
        `   해당 서버는 ENABLE_DEV_ENDPOINTS=1 설정이 꺼져 있어 시드 초기화(/api/dev/reset-seed)가 거부(403)됩니다.\n` +
        `   라이브 Neo4j 데이터베이스 오염을 방지하기 위해 E2E 테스트를 즉시 중단합니다.\n\n` +
        `👉 해결 방법:\n` +
        `   현재 실행 중인 백엔드 서버(run_backend.bat 또는 uvicorn 터미널)를 먼저 종료하신 뒤,\n` +
        `   다시 'npm test'를 실행해 주세요 (Playwright가 테스트 전용 백엔드를 자동으로 기동합니다).\n` +
        `================================================================================\n`
      );
    }
  } finally {
    await context.dispose();
  }
}
