import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal typing for process when @types/node is not installed in frontend devDependencies
declare const process: {
  env: Record<string, string | undefined>
  cwd: () => string
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.BACKEND_PORT || env.PORT || process.env.BACKEND_PORT || process.env.PORT || '8190'
  const backendHost = env.BACKEND_HOST || process.env.BACKEND_HOST || '127.0.0.1'
  const frontendPort = Number(env.FRONTEND_PORT || env.PORT || process.env.FRONTEND_PORT || '5173')
  const frontendHost = env.FRONTEND_HOST || process.env.FRONTEND_HOST || '127.0.0.1'

  return {
    plugins: [react()],
    server: {
      host: frontendHost,
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
          timeout: 60000,
          proxyTimeout: 60000,
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              try {
                const httpRes = res as {
                  writeHead?: (statusCode: number, headers?: Record<string, string>) => void;
                  headersSent?: boolean;
                  writableEnded?: boolean;
                  destroyed?: boolean;
                  end?: (chunk?: string) => void;
                } | undefined;
                if (httpRes && !httpRes.headersSent && !httpRes.writableEnded && !httpRes.destroyed && typeof httpRes.writeHead === 'function') {
                  httpRes.writeHead(502, { 'Content-Type': 'application/json' });
                  httpRes.end?.(JSON.stringify({ error: 'Proxy error', detail: err.message }));
                }
              } catch {
                // Suppress write errors on already-aborted sockets to protect Vite lifecycle
              }
            });
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.on('error', () => {
                // Silently catch outgoing backend socket drops
              });
            });
          }
        }
      }
    }
  }
})
