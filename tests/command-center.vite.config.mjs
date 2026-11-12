import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Manual browser fixture only; application builds never load these substitutions.
export default defineConfig({
  plugins: [react()],
  cacheDir: '.vercel/command-center-preview-cache',
  resolve: { alias: [
    { find: '@/hooks/useUser', replacement: path.resolve('tests/e2e/fixtures/analytics-workspace.session.tsx') },
    { find: '@/services/backofficeService', replacement: path.resolve('tests/e2e/fixtures/command-center.transport.ts') },
    { find: '@', replacement: path.resolve('src') },
  ] },
  optimizeDeps: { entries: ['tests/e2e/fixtures/command-center.html'] },
  server: { host: '127.0.0.1' },
});
