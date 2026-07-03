import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboardRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(dashboardRoot, '..');

export default defineConfig({
  root: dashboardRoot,
  plugins: [react()],
  server: {
    port: 5180,
    fs: {
      // The dashboard imports artifacts from outside its own root
      // (../src, ../catalog, ../contracts, ../parity, ../evals, ../tokens).
      allow: [repoRoot],
    },
  },
  build: {
    outDir: 'dist',
  },
});
