
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

function readLocalSiteGoogleApiKey() {
  const siteConfigPath = '/home/dg/dg-b/sites/tms.galaxylabs.online/site_config.json';
  if (!existsSync(siteConfigPath)) return '';

  try {
    const siteConfig = JSON.parse(readFileSync(siteConfigPath, 'utf8'));
    return siteConfig.google_api_key || '';
  } catch {
    return '';
  }
}

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env vars regardless of the `VITE_` prefix.
  // Fix: Access cwd() from process by casting to any to bypass TypeScript type definitions that may be missing Node.js specifics in certain environments.
  const env = loadEnv(mode, (process as any).cwd(), '');
  process.env.FRAPPE_BASE_URL = process.env.FRAPPE_BASE_URL || env.FRAPPE_BASE_URL;
  process.env.FRAPPE_API_KEY = process.env.FRAPPE_API_KEY || env.FRAPPE_API_KEY;
  process.env.FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET || env.FRAPPE_API_SECRET;
  process.env.GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ||
    env.GEMINI_API_KEY ||
    env.GOOGLE_API_KEY ||
    env.API_KEY ||
    readLocalSiteGoogleApiKey();
  process.env.GEMINI_PROVIDER = process.env.GEMINI_PROVIDER || env.GEMINI_PROVIDER || 'api_key';

  const localApiPlugin = {
    name: 'local-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const apiRoute = req.url?.startsWith('/api/frappe')
          ? 'frappe'
          : req.url?.startsWith('/api/gemini')
            ? 'gemini'
            : '';

        if (!apiRoute) return next();

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
              console.error(`[api/${apiRoute}]`, req.method, req.url, res.statusCode, String(payload).slice(0, 500));
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

        const { default: handler } = apiRoute === 'frappe'
          ? await import('./api/frappe.js')
          : await import('./api/gemini.js');
        await handler(apiReq, apiRes);
      });
    },
  };
  
  return {
    plugins: [localApiPlugin, react()],
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
