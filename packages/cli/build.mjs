/**
 * esbuild bundle for @ds-contracts/cli.
 *
 * Two bundles, one lazy seam:
 *   dist/cli.js       every verb except computed capture — the engine (core
 *                     barrel + schema + extraction + diagnose + generator
 *                     shells), prettier/standalone and zod BUNDLED IN. Only
 *                     figma-to-react needs installed dependencies (below).
 *   dist/computed.js  the browser-dependent computed-capture runner —
 *                     playwright-core stays EXTERNAL (optionalDependency);
 *                     cli.js dynamic-imports './computed.js' only when
 *                     `extract --computed` runs and degrades with a NAMED
 *                     message when playwright-core / a Chromium is absent.
 *
 * './computed.js' is marked external in the cli bundle so the dynamic import
 * survives bundling as a genuinely lazy boundary.
 *
 * `figma-to-react` bundles the playground's import engine too, behind a
 * dynamic import. Its data module (playground/src/engine/data.ts) uses Vite's
 * import.meta.glob and ?raw imports; vite-glob-plugin.mjs resolves them here,
 * at build time, in Vite's order and under Vite's keys, and fails the build by
 * name on any form it does not reproduce. That verb packages with esbuild,
 * typescript and @types/react, which are this package's pinned dependencies
 * (resolved at run time, never bundled), and checks with playwright-core,
 * which stays external and optional.
 */
import { build } from 'esbuild';
import { chmodSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { viteGlobPlugin } from './vite-glob-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));
// The React range the consumer check installs, baked in: an installed CLI has
// no repository node_modules to read it from (scripts/design-consumer-check.ts
// consumerReactRange reads the same file in a checkout).
const repoReact = JSON.parse(readFileSync(path.join(here, '..', '..', 'node_modules', 'react', 'package.json'), 'utf8'));

// @ds-contracts/core is bundled IN from its in-repo SOURCE (never dist, never
// the workspace link) — the same bytes the published tarball is built from,
// with no build-order dependency and no stale-dist hazard. Plugin emitters
// resolve the bare specifier from their own node_modules; the CLI registers
// the Emitter objects they export, so registry identity never crosses.
// @ds-contracts/schema rides the same rule: core's analysis modules import it
// by bare specifier (value imports — walkAnatomy, TOKEN_CHANNELS, …), and the
// alias keeps that ONE Zod document in the bundle rather than a second copy
// from packages/schema/dist.
const CORE_ALIAS = {
  '@ds-contracts/core': path.join(here, '..', 'core', 'src', 'index.ts'),
  '@ds-contracts/schema': path.join(here, '..', 'schema', 'src', 'index.ts'),
};

const shared = {
  bundle: true,
  alias: CORE_ALIAS,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
  // The repo root package.json declares sideEffects: ["**/*.css"] for the
  // component-library build; without this, esbuild would tree-shake the
  // side-effect import of the computed runner out of dist/computed.js.
  ignoreAnnotations: true,
  define: {
    __DS_CONTRACTS_CLI_VERSION__: JSON.stringify(pkg.version),
    __DS_CONTRACTS_REACT_RANGE__: JSON.stringify('^' + repoReact.version),
  },
  plugins: [viteGlobPlugin()],
  // CJS-interop shims for ESM output: bundled CJS (typescript, pngjs) touches
  // require/__filename/__dirname, which ES module scope does not define.
  banner: {
    js: [
      `import { createRequire as __cliCreateRequire } from 'node:module';`,
      `import { fileURLToPath as __cliFileURLToPath } from 'node:url';`,
      `import { dirname as __cliDirnameOf } from 'node:path';`,
      `const require = __cliCreateRequire(import.meta.url);`,
      `const __filename = __cliFileURLToPath(import.meta.url);`,
      `const __dirname = __cliDirnameOf(__filename);`,
    ].join('\n'),
  },
};

await build({
  ...shared,
  entryPoints: [path.join(here, 'src', 'cli.ts')],
  outfile: path.join(here, 'dist', 'cli.js'),
  external: ['playwright-core', './computed.js'],
  banner: {
    js: `#!/usr/bin/env node\n${shared.banner.js}`,
  },
});

await build({
  ...shared,
  entryPoints: [path.join(here, 'src', 'computed-entry.ts')],
  outfile: path.join(here, 'dist', 'computed.js'),
  external: ['playwright-core'],
});

chmodSync(path.join(here, 'dist', 'cli.js'), 0o755);
console.log('✔ @ds-contracts/cli built → dist/cli.js (+ lazy dist/computed.js)');
