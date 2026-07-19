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

await build({
  bundle: true,
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
