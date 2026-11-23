import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createFigmaMock } from './plugin-engine-mock-figma.mjs';

/** Every property the Plugin API types as `… | PluginAPI['mixed']` (@figma/plugin-typings). Read as figma.mixed (a Symbol),
 *  any of them in arithmetic, a relational comparison, a template or string concatenation, a spread of an iterable, a method
 *  call or a setter throws, and the whole set is lost: #510's overhang read `strokeWeight > 0` did in a25 (fixed in #519). */
const MIXED = ['fills', 'fillStyleId', 'strokeWeight', 'strokeCap', 'strokeJoin', 'cornerRadius', 'fontSize', 'fontName', 'fontWeight', 'textCase',
  'textDecoration', 'textDecorationStyle', 'textDecorationOffset', 'textDecorationThickness', 'textDecorationColor', 'textDecorationSkipInk',
  'letterSpacing', 'lineHeight', 'leadingTrim', 'textStyleId', 'hyperlink', 'paragraphSpacing', 'paragraphIndent', 'listSpacing', 'textWrapStyle'];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), sync = path.join(root, 'figma-sync');

/** Runs every committed figma-sync script (the repo's own design system, regenerated with the writer and golden-guarded) in
 *  order, in one mock file; poisoned, every node any factory, clone or instance makes reads each MIXED property it has back
 *  as figma.mixed. Returns each script's outcome and how many such reads the scripts made. */
async function runSync(poisoned: boolean) {
  const { figma } = createFigmaMock(), fg = figma as any, reads: Record<string, number> = {};
  // A read counts when a script made it; the mock's own reads (its clone copies, its layout) do not.
  const count = (p: string) => { if ((new Error().stack ?? '').split('\n')[3]?.includes('/figma-sync/')) reads[p] = (reads[p] ?? 0) + 1; };
  const poison = (n: any) => {
    if (!n || n.__mixedReads) return;
    Object.defineProperty(n, '__mixedReads', { value: true });
    for (const p of MIXED) if (p in n) Object.defineProperty(n, p, { configurable: true, get: () => { count(p); return fg.mixed; }, set: () => {} });
    for (const c of n.children ?? []) poison(c);
    for (const m of ['clone', 'createInstance']) if (typeof n[m] === 'function') { const own = n[m].bind(n); n[m] = (...a: unknown[]) => { const r = own(...a); poison(r); return r; }; }
  };
  if (poisoned) for (const k of Object.keys(fg).filter((k) => /^(create[A-Z]|combineAsVariants)/.test(k) && typeof fg[k] === 'function')) {
    const make = fg[k].bind(fg); fg[k] = (...a: unknown[]) => { const n = make(...a); poison(n); return n; };
  }
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } }), outcomes: string[] = [];
  for (const f of readdirSync(sync).filter((f) => /^\d+-.*\.js$/.test(f)).sort()) {
    const script = readFileSync(path.join(sync, f), 'utf8'), key = /EXPECTED_FILE_KEY\s*=\s*['"]([^'"]*)['"]/.exec(script);
    if (key) fg.fileKey = key[1];
    try { await vm.runInContext(`(async()=>{${script}\n})()`, context, { filename: path.join(sync, f) }); outcomes.push(`${f}: ok`); }
    catch (e) { outcomes.push(`${f}: ${e instanceof TypeError ? 'TypeError' : 'Error'}: ${String((e as Error).message).slice(0, 120)}`); }
  }
  return { outcomes, reads };
}

test('the writer run time never crashes on figma.mixed: every figma-sync script ends as it ends when no read is mixed', async () => {
  const plain = await runSync(false), mixed = await runSync(true);
  assert.ok(plain.outcomes.length > 40 && plain.outcomes.every((o) => o.endsWith(': ok')), plain.outcomes.filter((o) => !o.endsWith(': ok')).join('\n'));
  // The scripts do read these back from the nodes they draw (the default writer paths), so each read met figma.mixed.
  for (const p of ['fills', 'cornerRadius', 'strokeWeight', 'fontSize', 'fontName']) assert.ok((mixed.reads[p] ?? 0) > 0, `no script reads ${p}`);
  assert.deepEqual(mixed.outcomes, plain.outcomes);
});
