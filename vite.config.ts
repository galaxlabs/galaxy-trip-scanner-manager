
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env vars regardless of the `VITE_` prefix.
  // Fix: Access cwd() from process by casting to any to bypass TypeScript type definitions that may be missing Node.js specifics in certain environments.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
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
