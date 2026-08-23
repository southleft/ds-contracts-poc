/**
 * esbuild bundle for @ds-contracts/emitter-web-components.
 *
 * One bundle: dist/index.js — the Emitter default export with the engine
 * pieces it leans on (schema helpers, emit-react's validateContract) and
 * zod BUNDLED IN, so an installed plugin has zero runtime dependencies and
 * `ds-contracts generate --emitter @ds-contracts/emitter-web-components`
 * resolves with nothing else on disk.
 *
 * Types: dist/index.d.ts is copied from types/index.d.ts — a hand-authored
 * STRUCTURAL surface (Emitter/EmittedFile/EmitterCtx shapes spelled out, no
 * cross-package type imports), so consumers typecheck against the same
 * shapes core/emitter.ts declares without this package depending on the
 * repo's paths at install time.
 */
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
// @ds-contracts/core is bundled IN from its in-repo SOURCE (never dist, never
// the workspace link) — the same bytes the published tarball is built from,
// with no build-order dependency and no stale-dist hazard. Plugin emitters
// resolve the bare specifier from their own node_modules; the CLI registers
// the Emitter objects they export, so registry identity never crosses.
const CORE_ALIAS = { '@ds-contracts/core': path.join(here, '..', 'core', 'src', 'index.ts') };

await build({
  bundle: true,
  alias: CORE_ALIAS,
  platform: 'neutral',
  mainFields: ['module', 'main'],
  format: 'esm',
  target: 'es2022',
  logLevel: 'warning',
  entryPoints: [path.join(here, 'src', 'index.ts')],
  outfile: path.join(here, 'dist', 'index.js'),
});

mkdirSync(path.join(here, 'dist'), { recursive: true });
copyFileSync(path.join(here, 'types', 'index.d.ts'), path.join(here, 'dist', 'index.d.ts'));
console.log('✔ @ds-contracts/emitter-web-components built → dist/index.js (+ dist/index.d.ts)');
