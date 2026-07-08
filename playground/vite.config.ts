import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const playgroundRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(playgroundRoot, '..');

export default defineConfig({
  root: playgroundRoot,
  plugins: [react()],
  server: {
    port: 5181,
    fs: {
      // The playground imports the engine and its data from outside its own
      // root (../core, ../contracts, ../tokens, ../assets, ../src/styles,
      // ../extract) — same convention as the dashboard.
      allow: [repoRoot],
    },
  },
  build: {
    outDir: 'dist',
    // The lazy code-import chunk carries the TypeScript compiler (~5 MB, by
    // design — see playground/PLAN.md "Risks"). Don't warn about what is
    // deliberate and lazy-loaded.
    chunkSizeWarningLimit: 6000,
  },
});
