
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env vars regardless of the `VITE_` prefix.
  // Fix: Access cwd() from process by casting to any to bypass TypeScript type definitions that may be missing Node.js specifics in certain environments.
  const env = loadEnv(mode, (process as any).cwd(), '');
  process.env.FRAPPE_BASE_URL = process.env.FRAPPE_BASE_URL || env.FRAPPE_BASE_URL;
  process.env.FRAPPE_API_KEY = process.env.FRAPPE_API_KEY || env.FRAPPE_API_KEY;
  process.env.FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET || env.FRAPPE_API_SECRET;

  const localFrappeApiPlugin = {
    name: 'local-frappe-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/frappe')) return next();

        const url = new URL(req.url, 'http://localhost');
        const query = Object.fromEntries(url.searchParams.entries());
        let rawBody = '';

        if (!['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())) {
          for await (const chunk of req) rawBody += chunk;
        }

        let body: any = rawBody;
        if (rawBody && String(req.headers['content-type'] || '').includes('application/json')) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        }

        const apiReq = {
          method: req.method,
          query,
          headers: req.headers,
          body,
        };

        const apiRes = {
          setHeader: (key: string, value: string) => res.setHeader(key, value),
          status: (code: number) => {
            res.statusCode = code;
            return apiRes;
          },
          send: (payload: unknown) => {
            if (res.statusCode >= 400) {
              console.error('[api/frappe]', req.method, req.url, res.statusCode, String(payload).slice(0, 500));
            }
            res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
            return apiRes;
          },
          json: (payload: unknown) => {
            res.setHeader('Content-Type', 'application/json');
            return apiRes.send(JSON.stringify(payload));
          },
          end: () => res.end(),
        };

        const { default: handler } = await import('./api/frappe.js');
        await handler(apiReq, apiRes);
      });
    },
  };
  
  return {
    plugins: [localFrappeApiPlugin, react()],
    define: {
      // This globally replaces process.env references with actual values during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.FRAPPE_API_KEY': JSON.stringify(env.FRAPPE_API_KEY),
      'process.env.FRAPPE_API_SECRET': JSON.stringify(env.FRAPPE_API_SECRET),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    server: {
      port: 3000,
    },
    build: {
      outDir: 'dist',
    }
  };
});
