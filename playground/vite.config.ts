import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPluginZip } from '../scripts/build-plugin-zip.mjs';

const playgroundRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(playgroundRoot, '..');

/** Package the Sync Runner dev plugin into public/ so the Figma tab can
 *  serve it as a download. Runs for dev AND build; refuses (fails the
 *  build) when the dump script embedded in the plugin UI has drifted from
 *  extract/figma/dump.plugin.js — see scripts/build-plugin-zip.mjs. */
const pluginZip: PluginOption = {
  name: 'ds-contracts-plugin-zip',
  async buildStart() {
    await buildPluginZip();
  },
};

export default defineConfig({
  root: playgroundRoot,
  plugins: [react(), pluginZip],
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
