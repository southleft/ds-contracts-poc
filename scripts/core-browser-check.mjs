/**
 * Browser-importability receipt for the pure core — `npm run core:browser-check`.
 *
 * Two gates:
 *   1. BUNDLE: esbuild bundles core/browser-check/entry.ts (which imports the
 *      whole barrel) with platform=browser. Any node:* import anywhere in the
 *      core module graph is an unresolvable specifier → hard failure.
 *   2. RUN: the same bundle (iife) executes in a bare VM sandbox with NO node
 *      globals (no process, no require, no Buffer) and must actually emit —
 *      it runs emitReact + emitHtml + emitReactInline + emitFigmaScript over
 *      the real Badge contract with the real tokens.
 *
 * Prints the bundle sizes (raw + minified) so the playground cost is a
 * number, not a vibe.
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const ENTRY = path.join(ROOT, 'core', 'browser-check', 'entry.ts');
const out = mkdtempSync(path.join(tmpdir(), 'core-browser-check-'));

const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

try {
  // Gate 1 — browser-platform bundle (esm, unminified + minified for the numbers).
  const esm = await build({
    entryPoints: [ENTRY], bundle: true, platform: 'browser', format: 'esm',
    outfile: path.join(out, 'core.esm.js'), logLevel: 'silent', metafile: true,
  });
  const min = await build({
    entryPoints: [ENTRY], bundle: true, platform: 'browser', format: 'esm', minify: true,
    outfile: path.join(out, 'core.esm.min.js'), logLevel: 'silent',
  });
  if (esm.errors.length || min.errors.length) throw new Error('esbuild reported errors');
  const rawSize = readFileSync(path.join(out, 'core.esm.js')).length;
  const minSize = readFileSync(path.join(out, 'core.esm.min.js')).length;

  // Gate 2 — execute with zero node globals: bundle an iife probe that runs
  // the real emitters over the real Badge contract + tokens.
  const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
  const brands = Object.fromEntries(
    readdirSync(path.join(ROOT, 'tokens', 'modes'))
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), read(`tokens/modes/${f}`)]),
  );
  const data = JSON.stringify({
    contract: read('contracts/badge.contract.json'),
    tokens: {
      primitives: read('tokens/primitives.tokens.json'),
      semantic: read('tokens/semantic.tokens.json'),
      light: read('tokens/modes/semantic.light.tokens.json'),
      dark: read('tokens/modes/semantic.dark.tokens.json'),
      brands,
    },
  });
  const probe = await build({
    stdin: {
      contents: `
        import { ContractSchema, emitters } from ${JSON.stringify(path.join(ROOT, 'core', 'index.ts'))};
        const { contract: raw, tokens } = INPUT;
        const contract = ContractSchema.parse(raw);
        const ctx = { tokens, icons: new Map(), contracts: new Map([[contract.id, contract]]) };
        const out = {};
        for (const e of emitters) out[e.name] = e.emit(contract, ctx).map((f) => f.contents.length);
        RESULT.value = out;
      `,
      resolveDir: ROOT, loader: 'ts', sourcefile: 'probe.ts',
    },
    bundle: true, platform: 'browser', format: 'iife', write: false, logLevel: 'silent',
  });
  const sandbox = { INPUT: JSON.parse(data), RESULT: { value: null }, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(probe.outputFiles[0].text, sandbox, { timeout: 60_000 });
  const result = sandbox.RESULT.value;
  const names = ['react', 'html', 'react-inline', 'figma-script'];
  for (const n of names) {
    if (!result?.[n] || result[n].some((len) => len === 0)) {
      throw new Error(`emitter "${n}" produced no output in the node-global-free sandbox`);
    }
  }

  console.log(`✔ core barrel bundles for platform=browser: ${fmt(rawSize)} raw, ${fmt(minSize)} minified`);
  console.log(`✔ all 4 emitters ran in a VM with no node globals (Badge): ${names.map((n) => `${n}=${result[n].join('+')}B`).join(', ')}`);
} catch (err) {
  console.error(`✖ core:browser-check failed — the core is not browser-importable:\n${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
