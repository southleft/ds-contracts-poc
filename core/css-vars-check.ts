/**
 * css-vars-check — every `var(--x)` the generated code references is DEFINED
 * in a `tokens.css` emitted beside it, and the golden-path React paints.
 *
 * RED PROOF (2026-08-22, before core/emit-tokens-css.ts existed): the exact
 * docs/BETA.md generate command emitted eight components whose CSS Modules
 * referenced 261 distinct custom properties and NO file in the output
 * directory defined a single one — `tokens.css: MISSING`. The
 * examples/tailwind/tokens/tailwind.vars.css that exists in the repo is the
 * library's OWN Tailwind sheet (118 `--color-*`/`--spacing` names), not the
 * `--imported-*` minted names the components bind, and nothing in the
 * generate path read it anyway.
 *
 * Four cases, one CLI (packages/cli/src/cli.ts through tsx — the same source
 * the published bundle is built from):
 *
 *   1. FLOWBITE, react — the BETA.md command verbatim (+ --stories). Asserts
 *      <out>/tokens.css exists with a `:root` block and NO mode block (two
 *      unnamed flat trees = the default slot only), referenced ⊆ defined
 *      (byte-compare of names), zero dangling aliases, index.ts + every
 *      *.stories.tsx import the sheet, and then RENDERS the emitted Button
 *      through the barrel (esbuild → real Chromium, the journey-engineer
 *      harness pattern): its computed background-color must equal the token
 *      value resolved through tokens.css, not rgba(0, 0, 0, 0).
 *   2. FIRST-PARTY, layered — the repo's own four-file layout plus both brand
 *      trees: `:root` + `[data-theme="dark"]` + `[data-brand="aurora"]`, every
 *      mode name ⊆ the root names (a dark-only token would be undefined in
 *      light), referenced ⊆ defined.
 *   3. FLOWBITE, html and web-components — tokens.css lands beside those
 *      targets too; referenced ⊆ defined for each.
 *   4. REFUSAL — a light tree and a dark tree that type one path differently
 *      ($type color vs dimension) refuse BY NAME and write NOTHING.
 *
 * Counts (referenced / defined / unreferenced) are printed, never asserted
 * as fixed numbers: the Flowbite inventory grows with every re-promotion and
 * an unreferenced token is a fact to report, not a failure.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DARK_MODE_SELECTOR, ROOT_SELECTOR, brandModeSelector, referencedCssVars, undefinedCssVars } from './emit-tokens-css.js';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const CLI = path.join(ROOT, 'packages', 'cli', 'src', 'cli.ts');
const WORK = mkdtempSync(path.join(tmpdir(), 'css-vars-check-'));

const FLOWBITE_TOKENS =
  'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json';
const FLOWBITE_ICONS = 'examples/tailwind/assets/icons';

interface Run {
  status: number;
  out: string;
}
const cli = (args: string[]): Run => {
  const r = spawnSync(TSX, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const walk = (dir: string, prefix = ''): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const abs = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
};

/** tokens.css → selector → (name → value). Blocks are the build-tokens.mjs
 *  shape: `selector {` / `  --name: value;` / `}`. */
function parseTokensCss(css: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  const re = /^([^\s{/][^{\n]*)\{\n([\s\S]*?)^\}/gm;
  for (const m of css.matchAll(re)) {
    const selector = m[1]!.trim();
    const decls = new Map<string, string>();
    for (const line of m[2]!.split('\n')) {
      const d = /^\s*(--[a-zA-Z0-9_-]+):\s*(.*);\s*$/.exec(line);
      if (d) decls.set(d[1]!, d[2]!);
      // One declaration per line is the sheet's invariant (a wrapped value
      // hid `--font-sans` from this very parser on the first run).
      else if (line.trim() !== '') fail(`tokens.css ${selector}: not a declaration line: ${JSON.stringify(line)}`);
    }
    blocks.set(selector, decls);
  }
  return blocks;
}

/** Resolve `var(--a)` chains through the :root declarations to a literal. */
function resolveVar(root: Map<string, string>, name: string, guard = 0): string {
  const v = root.get(name);
  if (v === undefined) throw new Error(`${name} is not defined in tokens.css :root`);
  const ref = /^var\((--[a-zA-Z0-9_-]+)\)$/.exec(v.trim());
  if (!ref) return v.trim();
  if (guard > 10) throw new Error(`${name}: alias chain deeper than 10`);
  return resolveVar(root, ref[1]!, guard + 1);
}

const hexToRgb = (hex: string): string => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

/** Shared assertions for one generated tree: tokens.css exists, referenced
 *  ⊆ defined, every mode name ⊆ root names. Returns the parsed blocks. */
function assertTree(label: string, outDir: string, styleFiles: (rel: string) => boolean) {
  const sheet = path.join(outDir, 'tokens.css');
  if (!existsSync(sheet)) {
    fail(`${label}: tokens.css MISSING from ${outDir} — the emitted code references custom properties nothing defines`);
    return null;
  }
  const blocks = parseTokensCss(readFileSync(sheet, 'utf8'));
  const root = blocks.get(ROOT_SELECTOR);
  if (!root) {
    fail(`${label}: tokens.css has no \`${ROOT_SELECTOR}\` block`);
    return null;
  }
  const referenced = new Set<string>();
  for (const rel of walk(outDir)) {
    if (rel === 'tokens.css' || !styleFiles(rel)) continue;
    for (const name of referencedCssVars(readFileSync(path.join(outDir, rel), 'utf8'))) referenced.add(name);
  }
  const missing = undefinedCssVars(referenced, root.keys());
  if (missing.length > 0) {
    fail(`${label}: ${missing.length} referenced custom propert(ies) are NOT defined in tokens.css :root — ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`);
  }
  // Alias targets inside the sheet must resolve inside the sheet.
  const dangling: string[] = [];
  for (const [selector, decls] of blocks) {
    for (const [name, value] of decls) {
      for (const ref of referencedCssVars(value)) {
        if (!root.has(ref) && !decls.has(ref)) dangling.push(`${selector} ${name} -> ${ref}`);
      }
    }
  }
  if (dangling.length > 0) fail(`${label}: ${dangling.length} alias(es) in tokens.css point at nothing — ${dangling.slice(0, 5).join('; ')}`);
  for (const [selector, decls] of blocks) {
    if (selector === ROOT_SELECTOR) continue;
    const orphans = [...decls.keys()].filter((n) => !root.has(n));
    if (orphans.length > 0) fail(`${label}: ${selector} defines ${orphans.length} name(s) absent from :root (undefined in the default mode) — ${orphans.slice(0, 5).join(', ')}`);
  }
  const unreferenced = [...root.keys()].filter((n) => !referenced.has(n)).length;
  console.log(
    `  ${label}: referenced ${referenced.size} / defined ${root.size} (:root) · unreferenced ${unreferenced} · modes ${[...blocks.keys()].filter((s) => s !== ROOT_SELECTOR).join(', ') || 'none'}`,
  );
  return { blocks, root, referenced };
}

const isCss = (rel: string) => rel.endsWith('.css') || rel.endsWith('.css.ts') || rel.endsWith('.html');

// ---------------------------------------------------------------------------
// 1. Flowbite, react — the BETA.md command verbatim (+ --stories).
// ---------------------------------------------------------------------------
console.log('css-vars-check');
const reactOut = path.join(WORK, 'out-react');
{
  const r = cli([
    'generate', 'examples/tailwind/contracts', '--out', reactOut, '--target', 'react',
    '--tokens', FLOWBITE_TOKENS, '--icons', FLOWBITE_ICONS, '--stories',
  ]);
  if (r.status !== 0) fail(`flowbite react: generate exited ${r.status}:\n${r.out.slice(0, 1200)}`);
  else {
    if (!/tokens\.css/.test(r.out)) fail('flowbite react: generate output never mentions tokens.css (the sheet must be NAMED in the success line)');
    const tree = assertTree('flowbite react', reactOut, isCss);
    if (tree) {
      const modes = [...tree.blocks.keys()].filter((s) => s !== ROOT_SELECTOR);
      if (modes.length !== 0) fail(`flowbite react: two unnamed flat trees must be :root only, got mode block(s) ${modes.join(', ')}`);
      const barrel = readFileSync(path.join(reactOut, 'index.ts'), 'utf8');
      if (!barrel.includes("import './tokens.css';")) fail("flowbite react: index.ts does not import './tokens.css'");
      for (const rel of walk(reactOut).filter((f) => f.endsWith('.stories.tsx'))) {
        if (!readFileSync(path.join(reactOut, rel), 'utf8').includes("import '../tokens.css';")) {
          fail(`flowbite react: ${rel} does not import '../tokens.css' — Storybook would render it unstyled`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 1b. Render the emitted Button through the barrel in real Chromium.
// ---------------------------------------------------------------------------
if (existsSync(path.join(reactOut, 'tokens.css'))) {
  const blocks = parseTokensCss(readFileSync(path.join(reactOut, 'tokens.css'), 'utf8'));
  const root = blocks.get(ROOT_SELECTOR)!;
  const buttonCss = readFileSync(path.join(reactOut, 'Button', 'Button.module.css'), 'utf8');
  const bgVar = /\.color-default\s*\{[^}]*background-color:\s*var\((--[a-zA-Z0-9_-]+)\)/.exec(buttonCss)?.[1];
  if (!bgVar) fail('flowbite react: could not find the default Button background var in Button.module.css');
  else {
    const expected = hexToRgb(resolveVar(root, bgVar));
    const entry = path.join(WORK, 'render-entry.tsx');
    writeFileSync(
      entry,
      [
        "import { createElement } from 'react';",
        "import { createRoot } from 'react-dom/client';",
        `import { Button } from '${reactOut.replace(/\\/g, '/')}/index';`,
        "createRoot(document.getElementById('root')!).render(createElement(Button, { id: 'probe' }, 'Button'));",
        '',
      ].join('\n'),
    );
    const probe = spawnSync(TSX, ['-e', `
      import fs from 'node:fs';
      import path from 'node:path';
      import { build } from 'esbuild';
      import { chromium } from 'playwright-core';
      import { chromiumExecutable } from './extract/figma/visual-parity/render.ts';
      (async () => {
        const work = ${JSON.stringify(WORK)};
        await build({ entryPoints: [path.join(work, 'render-entry.tsx')], bundle: true, outfile: path.join(work, 'bundle', 'entry.js'), format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent', absWorkingDir: process.cwd(), nodePaths: [path.join(process.cwd(), 'node_modules')] });
        // ONLY the bundled CSS — tokens.css must arrive through the barrel import, not be pasted in.
        const doc = '<!doctype html><html><head><meta charset="utf-8"><style>' + fs.readFileSync(path.join(work, 'bundle', 'entry.css'), 'utf8') + '</style></head><body><div id="root"></div><script>' + fs.readFileSync(path.join(work, 'bundle', 'entry.js'), 'utf8') + '</script></body></html>';
        const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
        try {
          const page = await browser.newPage();
          page.on('pageerror', (e) => { console.error('pageerror: ' + String(e)); process.exitCode = 1; });
          await page.setContent(doc, { waitUntil: 'load' });
          await page.waitForSelector('#probe', { timeout: 15000 });
          const r = await page.evaluate("(() => { const el = document.getElementById('probe'); const cs = getComputedStyle(el); return { bg: cs.backgroundColor, color: cs.color, text: el.textContent }; })()");
          console.log('RENDER ' + JSON.stringify(r));
        } finally { await browser.close(); }
      })().catch((e) => { console.error(e); process.exit(1); });
    `], { cwd: ROOT, encoding: 'utf8' });
    const out = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
    const line = out.split('\n').find((l) => l.startsWith('RENDER '));
    if (probe.status !== 0 || !line) fail(`flowbite react: render probe failed:\n${out.slice(0, 1500)}`);
    else {
      const r = JSON.parse(line.slice('RENDER '.length)) as { bg: string; text: string };
      if (r.bg === 'rgba(0, 0, 0, 0)') fail(`flowbite react: Button background-color computed TRANSPARENT — ${bgVar} did not reach the page`);
      else if (r.bg !== expected) fail(`flowbite react: Button background-color computed ${r.bg}, expected ${expected} (${bgVar} resolved through tokens.css)`);
      else console.log(`  flowbite react: rendered Button background-color = ${r.bg} (${bgVar} → ${resolveVar(root, bgVar)}) through the index.ts import`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. First-party, layered — :root + [data-theme="dark"] + [data-brand="aurora"].
// ---------------------------------------------------------------------------
{
  const out = path.join(WORK, 'out-layered');
  const r = cli([
    'generate', 'contracts/badge.contract.json', 'contracts/button.contract.json', '--out', out, '--target', 'react',
    '--tokens',
    'tokens/primitives.tokens.json,tokens/semantic.tokens.json,tokens/modes/semantic.light.tokens.json,tokens/modes/semantic.dark.tokens.json,tokens/modes/brand.default.tokens.json,tokens/modes/brand.aurora.tokens.json',
    '--icons', 'assets/icons',
  ]);
  if (r.status !== 0) fail(`first-party layered: generate exited ${r.status}:\n${r.out.slice(0, 1200)}`);
  else {
    const tree = assertTree('first-party layered', out, isCss);
    if (tree) {
      for (const sel of [DARK_MODE_SELECTOR, brandModeSelector('aurora')]) {
        const block = tree.blocks.get(sel);
        if (!block || block.size === 0) fail(`first-party layered: tokens.css has no \`${sel}\` block — the dark / brand slot never reached code`);
      }
      const dark = tree.blocks.get(DARK_MODE_SELECTOR);
      const light = readFileSync('tokens/modes/semantic.dark.tokens.json', 'utf8');
      const darkLeafCount = (light.match(/"\$value"/g) ?? []).length;
      if (dark && dark.size !== darkLeafCount) fail(`first-party layered: ${DARK_MODE_SELECTOR} carries ${dark.size} names, semantic.dark.tokens.json has ${darkLeafCount} leaves`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Flowbite, html + web-components — the sheet lands beside every target.
// ---------------------------------------------------------------------------
for (const [target, extra] of [
  ['html', []],
  ['web-components', ['--emitter', 'packages/emitter-web-components/src/index.ts']],
] as Array<[string, string[]]>) {
  const out = path.join(WORK, `out-${target}`);
  const r = cli([
    'generate', 'examples/tailwind/contracts', '--out', out, '--target', target,
    '--tokens', FLOWBITE_TOKENS, '--icons', FLOWBITE_ICONS, ...extra,
  ]);
  if (r.status !== 0) fail(`flowbite ${target}: generate exited ${r.status}:\n${r.out.slice(0, 1200)}`);
  else {
    if (!/tokens\.css/.test(r.out)) fail(`flowbite ${target}: generate output never mentions tokens.css`);
    assertTree(`flowbite ${target}`, out, isCss);
  }
}

// ---------------------------------------------------------------------------
// 4. Refusal — light and dark disagree on a token's $type.
// ---------------------------------------------------------------------------
{
  const fixtures = path.join(WORK, 'typed');
  mkdirSync(fixtures, { recursive: true });
  writeFileSync(path.join(fixtures, 'a.json'), JSON.stringify({ probe: { twin: { $type: 'color', $value: '#ffffff' } } }, null, 2));
  writeFileSync(path.join(fixtures, 'b.json'), JSON.stringify({ probe: { twin: { $type: 'dimension', $value: '4px' } } }, null, 2));
  const out = path.join(WORK, 'out-refused');
  const r = cli([
    'generate', 'contracts/badge.contract.json', '--out', out, '--target', 'react',
    '--tokens',
    `tokens/primitives.tokens.json,tokens/semantic.tokens.json,tokens/modes/semantic.light.tokens.json,tokens/modes/semantic.dark.tokens.json,light=${path.join(fixtures, 'a.json')},dark=${path.join(fixtures, 'b.json')}`,
    '--icons', 'assets/icons',
  ]);
  if (r.status === 0) fail('type disagreement: generate must REFUSE when light types probe.twin as color and dark as dimension (it exited 0)');
  else if (!r.out.includes('probe.twin') || !r.out.includes('"color"') || !r.out.includes('"dimension"')) {
    fail(`type disagreement: the refusal must NAME probe.twin and both $types:\n${r.out.slice(0, 800)}`);
  }
  if (existsSync(out) && walk(out).length > 0) fail(`type disagreement: refused run left ${walk(out).length} file(s) in ${out} — the destination must stay untouched`);
  else console.log('  type disagreement: refused by name (probe.twin color vs dimension), nothing written');
}

rmSync(WORK, { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`✘ css-vars-check: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✔ css-vars-check: every referenced custom property is defined in the emitted tokens.css (react, html, web-components); modes land as [data-theme="dark"] / [data-brand]; the golden-path Button paints');
