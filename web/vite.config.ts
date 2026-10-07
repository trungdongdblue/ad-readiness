import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const at = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: at('.'),
  plugins: [react()],
  // Domain types and the pure score engine are shared with the API, so the UI never re-implements them.
  resolve: { alias: { '@domain': at('../src/domain'), '@engine': at('../src/engine') } },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
