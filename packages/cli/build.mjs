/**
 * esbuild bundle for @ds-contracts/cli.
 *
 * Two bundles, one lazy seam:
 *   dist/cli.js       every verb except computed capture — the engine (core
 *                     barrel + schema + extraction + diagnose + generator
 *                     shells), prettier/standalone and zod BUNDLED IN, so an
 *                     installed CLI has zero required runtime dependencies.
 *   dist/computed.js  the browser-dependent computed-capture runner —
 *                     playwright-core stays EXTERNAL (optionalDependency);
 *                     cli.js dynamic-imports './computed.js' only when
 *                     `extract --computed` runs and degrades with a NAMED
 *                     message when playwright-core / a Chromium is absent.
 *
 * './computed.js' is marked external in the cli bundle so the dynamic import
 * survives bundling as a genuinely lazy boundary.
 */
import { build } from 'esbuild';
import { chmodSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));

const shared = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
  // The repo root package.json declares sideEffects: ["**/*.css"] for the
  // component-library build; without this, esbuild would tree-shake the
  // side-effect import of the computed runner out of dist/computed.js.
  ignoreAnnotations: true,
  define: { __DS_CONTRACTS_CLI_VERSION__: JSON.stringify(pkg.version) },
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
