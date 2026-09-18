/**
 * DESIGN-LED CLEAN CONSUMER CHECK — `npm run design:consumer:check -- …`
 *
 * Proves, for one designer-authored Figma component set that has already been
 * read (REST dump), proposed (contract) and generated (React), that the
 * generated output works as an INSTALLED LIBRARY in a consumer that has no
 * path back to this repository:
 *
 *   1. package  — copy the generated component sources into a temp package,
 *                 transpile TSX → ESM JS with esbuild (no bundling; CSS Modules
 *                 and tokens.css ship as files), emit .d.ts with tsc, write a
 *                 package.json with `exports`, `npm pack` → tarball.
 *   2. consume  — mkdtemp a Vite app whose only dependencies are react,
 *                 react-dom, vite and the tarball (file:). `npm install`,
 *                 `vite build`. Nothing resolves into this repo.
 *   3. mount    — open the built app in Chromium (file://). One cell per Figma
 *                 variant, props derived from the contract's VARIANT mappings.
 *   4. behave   — replace the TEXT-bound prop at runtime and assert the DOM
 *                 text changes in every text-bearing cell; switch every
 *                 variant-bearing cell to another variant and assert its
 *                 computed root style changes. A prop the component accepts
 *                 but discards fails here.
 *   5. compare  — fetch Figma's own PNG of each variant node (REST
 *                 /v1/images, read-only) and score it against the consumer's
 *                 screenshot with the repository's existing pixel scorer.
 *                 The 5% antialias-tolerant limit is the existing one; it is
 *                 not tuned here.
 *   6. receipt  — write receipt.json + images into --out. Every problem is
 *                 named; the receipt never reports more than was measured.
 *
 * Inputs: --dump <rest-dump.json> --contract <proposed contract> --generated
 * <dir from `ds-contracts generate`> --component <Name> --out <dir>
 * [--token <figma token>] (else FIGMA_TOKEN; without a token the image
 * comparison is recorded as `figma-images-unavailable`, never as a pass).
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { alignPair, diffPair, readPng, writeTriptych } from '../extract/figma/visual-parity/img.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_LIMIT_PERCENT = 5; // the existing antialias-tolerant limit (docs/CURRENT.md)
const SIZE_SLACK_PX = 2; // antialias slack on trimmed content bounds, never a fidelity allowance

type Args = { dump: string; contract: string; generated: string; component: string; out: string; token?: string };
function parseArgs(argv: string[]): Args {
  const read = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const required = (flag: string) => { const v = read(flag); if (!v) throw new Error(`design:consumer:check — ${flag} is required`); return v; };
  return { dump: required('--dump'), contract: required('--contract'), generated: required('--generated'), component: required('--component'),
    out: required('--out'), token: read('--token') ?? (process.env.FIGMA_TOKEN || undefined) };
}

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const run = (cmd: string, args: string[], cwd: string) => {
  try { return execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: { ...process.env, npm_config_update_notifier: 'false' } }); }
  catch (error: any) { throw new Error(`${path.basename(cmd)} ${args.slice(0, 2).join(' ')} failed: ${String(error.stdout ?? '').trim().split('\n').slice(0, 3).join(' | ')} ${String(error.stderr ?? '').trim().split('\n').slice(0, 3).join(' | ')}`); }
};

interface Case { key: string; nodeId: string; figmaName: string; props: Record<string, unknown>; hasText: boolean; textProp?: string }

/** Array props (`arrayOf`) take the design's own repeat sample from the
 * contract anatomy; the consumer supplies no content of its own. */
function arraySamples(contract: any): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.repeat?.itemsProp && Array.isArray(node.repeat.sample)) out[node.repeat.itemsProp] = node.repeat.sample;
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
  };
  walk(contract.anatomy);
  return out;
}

function deriveCases(dump: any, contract: any, component: string): Case[] {
  const set = dump[component] ?? Object.values(dump).find((v: any) => v && typeof v === 'object' && v.setName === component);
  if (!set || !Array.isArray(set.variants)) throw new Error(`design:consumer:check — dump has no component set "${component}"`);
  const variantProps = (contract.props as any[]).filter(p => p.bindings?.figma?.kind === 'VARIANT');
  const textProp = (contract.props as any[]).find(p => p.bindings?.figma?.kind === 'TEXT' && p.type === 'text');
  const samples = arraySamples(contract);
  return set.variants.map((variant: any) => {
    const props: Record<string, unknown> = { ...samples };
    for (const segment of String(variant.name).split(',').map((s: string) => s.trim())) {
      const eq = segment.indexOf('='); if (eq <= 0) continue;
      const property = segment.slice(0, eq), value = segment.slice(eq + 1);
      const prop = variantProps.find(p => p.bindings.figma.property === property);
      if (!prop) continue;
      const entry = Object.entries(prop.bindings.figma.values ?? {}).find(([, figmaValue]) => figmaValue === value);
      if (entry) props[prop.name] = entry[0];
    }
    const key = Object.entries(props).filter(([k]) => !(k in samples)).map(([k, v]) => `${k}-${v}`).join('_') || 'default';
    return { key, nodeId: variant.nodeId ?? '', figmaName: variant.name, props, hasText: !!textProp, textProp: textProp?.name };
  });
}

function packageLibrary(generatedDir: string, component: string, work: string) {
  const pkgDir = path.join(work, 'library'), src = path.join(pkgDir, 'src'), dist = path.join(pkgDir, 'dist');
  mkdirSync(src, { recursive: true }); mkdirSync(dist, { recursive: true });
  // Copy generated sources except stories (a Storybook consumer is a different check).
  const copy = (from: string, to: string) => {
    for (const entry of readdirSync(from)) {
      const source = path.join(from, entry), target = path.join(to, entry);
      if (statSync(source).isDirectory()) { mkdirSync(target, { recursive: true }); copy(source, target); }
      else if (!/\.stories\.[tj]sx?$/.test(entry)) cpSync(source, target);
    }
  };
  copy(generatedDir, src);
  if (!existsSync(path.join(src, 'index.ts')) || !existsSync(path.join(src, component))) throw new Error('design:consumer:check — generated dir lacks index.ts or the component folder');
  // Transpile TS/TSX → ESM JS, file by file (no bundling), and copy CSS as files.
  const sources: string[] = [];
  const walk = (dir: string) => { for (const entry of readdirSync(dir)) { const p = path.join(dir, entry); statSync(p).isDirectory() ? walk(p) : sources.push(p); } };
  walk(src);
  const tsSources = sources.filter(f => /\.tsx?$/.test(f));
  run(path.join(ROOT, 'node_modules', '.bin', 'esbuild'), [...tsSources, '--format=esm', '--jsx=automatic', '--target=es2022', `--outbase=${src}`, `--outdir=${dist}`], ROOT);
  for (const f of sources.filter(f => f.endsWith('.css'))) { const rel = path.relative(src, f); mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true }); cpSync(f, path.join(dist, rel)); }
  // Declarations, so a TypeScript consumer sees the contract-derived props.
  writeFileSync(path.join(pkgDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { declaration: true, emitDeclarationOnly: true, jsx: 'react-jsx', module: 'ESNext', moduleResolution: 'Bundler',
    target: 'ES2022', strict: true, skipLibCheck: true, outDir: 'dist', rootDir: 'src', types: [],
    // Declaration emission needs React's types. This packaging step is the
    // repository's tool; only the consumer below must stay free of repo paths.
    paths: { react: [path.join(ROOT, 'node_modules', '@types', 'react', 'index.d.ts')], 'react/jsx-runtime': [path.join(ROOT, 'node_modules', '@types', 'react', 'jsx-runtime.d.ts')] } }, include: ['src'] }, null, 2));
  writeFileSync(path.join(src, 'css-modules.d.ts'), "declare module '*.module.css' { const classes: { readonly [key: string]: string }; export default classes; }\ndeclare module '*.css';\n");
  run(path.join(ROOT, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], pkgDir);
  const name = `@ds-contracts-generated/${component.toLowerCase()}`;
  writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name, version: '0.0.0-generated', private: false, type: 'module', license: 'UNLICENSED',
    description: `Generated from the ${component} contract by ds-contracts; not hand-edited.`,
    files: ['dist'], main: './dist/index.js', types: './dist/index.d.ts',
    exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './tokens.css': './dist/tokens.css', './package.json': './package.json' },
    // The barrel imports tokens.css on purpose; a consumer bundler must not drop it.
    sideEffects: ['./dist/index.js', '**/*.css'], peerDependencies: { react: '>=18', 'react-dom': '>=18' } }, null, 2));
  const packed = run('npm', ['pack', '--json', '--pack-destination', work], pkgDir);
  const tarball = path.join(work, JSON.parse(packed)[0].filename as string);
  return { name, tarball, tarballSha256: sha256(readFileSync(tarball)), dist };
}

function writeConsumer(work: string, lib: { name: string; tarball: string }, component: string, cases: Case[], reactVersion: string) {
  const consumer = path.join(work, 'consumer'); mkdirSync(consumer, { recursive: true });
  writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'clean-consumer', private: true, type: 'module', version: '0.0.0',
    dependencies: { react: reactVersion, 'react-dom': reactVersion, [lib.name]: `file:${lib.tarball}` }, devDependencies: { vite: '^7' } }, null, 2));
  writeFileSync(path.join(consumer, 'vite.config.js'), "export default { base: './', esbuild: { jsx: 'automatic' }, build: { minify: false } };\n");
  writeFileSync(path.join(consumer, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><style>html{color-scheme:light}body{margin:0;background:#fff}*,*::before,*::after{animation:none!important;transition:none!important}</style></head><body><div id="root"></div><script type="module" src="./main.jsx"></script></body></html>\n');
  writeFileSync(path.join(consumer, 'cases.json'), JSON.stringify(cases.map(c => ({ key: c.key, props: c.props, textProp: c.textProp ?? null }))));
  writeFileSync(path.join(consumer, 'main.jsx'), `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ${component} } from ${JSON.stringify(lib.name)};
import CASES from './cases.json';
function App() {
  const [text, setText] = useState(null);
  const [variantOverride, setVariantOverride] = useState(null);
  window.__consumer = { setText, setVariantOverride };
  return <div>
    {CASES.map(cell => {
      const props = { ...cell.props };
      if (text !== null && cell.textProp) props[cell.textProp] = text;
      if (variantOverride) Object.assign(props, variantOverride);
      return <div data-cell={cell.key} key={cell.key} style={{ display: 'inline-block', margin: 8, padding: 4, minWidth: 1, minHeight: 1, verticalAlign: 'top' }}><${component} {...props} /></div>;
    })}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
`);
  return consumer;
}

/** Dump v1 variants carry no node IDs; resolve them by variant name from the
 * set's children (read-only nodes endpoint). Names are the only join key
 * Figma offers here, so a duplicate name refuses instead of guessing. */
async function resolveVariantNodeIds(fileKey: string, setNodeId: string, token: string, cases: Case[]) {
  const response = await fetch(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${setNodeId}&depth=1`, { headers: { 'X-Figma-Token': token } });
  if (!response.ok) return `HTTP ${response.status}`;
  const body = await response.json() as any;
  const children: Array<{ id: string; name: string; type: string }> = body.nodes?.[setNodeId]?.document?.children ?? [];
  const byName = new Map<string, string[]>();
  for (const child of children) byName.set(child.name, [...(byName.get(child.name) ?? []), child.id]);
  for (const c of cases) {
    const ids = byName.get(c.figmaName) ?? [];
    if (ids.length !== 1) return `variant "${c.figmaName}" resolves to ${ids.length} nodes`;
    c.nodeId = ids[0];
  }
  return null;
}

async function fetchFigmaImages(fileKey: string, ids: string[], token: string | undefined, out: string) {
  if (!token) return { status: 'figma-images-unavailable' as const, reason: 'no token', files: {} as Record<string, string> };
  const url = `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${ids.join(',')}&format=png&scale=1`;
  const response = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!response.ok) return { status: 'figma-images-unavailable' as const, reason: `HTTP ${response.status}`, files: {} as Record<string, string> };
  const body = await response.json() as { images: Record<string, string | null> };
  const files: Record<string, string> = {};
  for (const [id, imageUrl] of Object.entries(body.images ?? {})) {
    if (!imageUrl) continue;
    const png = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
    const file = path.join(out, `figma-${id.replace(/[^a-z0-9]/gi, '_')}.png`); writeFileSync(file, png); files[id] = file;
  }
  return { status: 'figma-images-collected' as const, reason: null, files };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dump = JSON.parse(readFileSync(args.dump, 'utf8')), contract = JSON.parse(readFileSync(args.contract, 'utf8'));
  const cases = deriveCases(dump, contract, args.component);
  const fileKey: string | undefined = dump._provenance?.fileKey ?? contract.bindings?.figma?.anchors?.fileKey ?? undefined;
  mkdirSync(args.out, { recursive: true });
  const inputs = path.join(args.out, 'inputs'); mkdirSync(inputs, { recursive: true });
  cpSync(args.dump, path.join(inputs, 'rest-dump.json')); cpSync(args.contract, path.join(inputs, path.basename(args.contract))); cpSync(args.generated, path.join(inputs, 'generated'), { recursive: true });
  const work = mkdtempSync(path.join(tmpdir(), 'ds-contracts-consumer-'));
  const problems: string[] = [];
  const receipt: any = { version: 1, kind: 'design-led-clean-consumer-check', acceptedContract: null, qualification: 'unqualified',
    component: args.component, fileKey: fileKey ?? null, generatedSha256: {}, cases: [], behavior: {}, images: {}, problems, limitations: [
      'single component set; composition, nested instances and instance swaps are not exercised here',
      'declared behavior beyond text and variant props is not exercised',
      'accessibility is not measured beyond the rendered element',
    ] };
  const walk = (dir: string, base = dir): void => { for (const entry of readdirSync(dir)) { const p = path.join(dir, entry); statSync(p).isDirectory() ? walk(p, base) : (receipt.generatedSha256[path.relative(base, p)] = sha256(readFileSync(p))); } };
  walk(args.generated);
  // What the reader already gave up on, and which dependencies are placeholders.
  const degradations: Array<{ code?: string }> = Array.isArray(dump._degradations) ? dump._degradations : [];
  receipt.inputs = {
    degradations: Object.fromEntries([...new Set(degradations.map(d => d.code ?? 'unknown'))].map(code => [code, degradations.filter(d => (d.code ?? 'unknown') === code).length])),
    stubContracts: readdirSync(path.dirname(args.contract)).filter(f => /\.stub\.contract(\.proposed)?\.json$/.test(f)),
    componentFolders: readdirSync(args.generated).filter(f => statSync(path.join(args.generated, f)).isDirectory()),
  };
  try {
    const lib = packageLibrary(args.generated, args.component, work);
    receipt.package = { name: lib.name, tarballSha256: lib.tarballSha256, distFiles: readdirSync(lib.dist, { recursive: true }).map(String).sort() };
    const reactVersion = '^' + JSON.parse(readFileSync(path.join(ROOT, 'node_modules', 'react', 'package.json'), 'utf8')).version;
    const consumer = writeConsumer(work, lib, args.component, cases, reactVersion);
    run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], consumer);
    // The consumer must not resolve anything from this repository.
    const lockfile = readFileSync(path.join(consumer, 'package-lock.json'), 'utf8');
    if (lockfile.includes(ROOT)) throw new Error('consumer lockfile references the repository');
    const installed = JSON.parse(readFileSync(path.join(consumer, 'node_modules', ...lib.name.split('/'), 'package.json'), 'utf8'));
    receipt.consumer = { react: installed.peerDependencies?.react ?? null, installedVersion: installed.version, lockfileSha256: sha256(lockfile), repoPathInLockfile: false };
    run(path.join(consumer, 'node_modules', '.bin', 'vite'), ['build', '--logLevel', 'error'], consumer);
    const built = path.join(consumer, 'dist', 'index.html');
    if (!existsSync(built)) throw new Error('vite build produced no index.html');
    const builtCss = readdirSync(path.join(consumer, 'dist', 'assets')).filter(f => f.endsWith('.css')).map(f => readFileSync(path.join(consumer, 'dist', 'assets', f), 'utf8')).join('\n');
    writeFileSync(path.join(args.out, 'consumer-built.css'), builtCss);
    const tokenNames = [...readFileSync(path.join(args.generated, 'tokens.css'), 'utf8').matchAll(/^\s*(--[a-z0-9-]+):/gim)].map(m => m[1]);
    receipt.consumer.builtCss = { bytes: builtCss.length, tokenDefinitions: tokenNames.filter(n => builtCss.includes(n + ':')).length, tokenDefinitionsExpected: tokenNames.length };
    if (receipt.consumer.builtCss.tokenDefinitions !== tokenNames.length) problems.push(`tokens-css-not-delivered:${receipt.consumer.builtCss.tokenDefinitions}/${tokenNames.length}`);
    // ES module scripts are refused over file://; serve the built app on loopback.
    const dist = path.join(consumer, 'dist');
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
    const server = createServer((req, res) => {
      const file = path.join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/\/$/, '/index.html'));
      if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; res.end(); return; }
      res.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream'); res.end(readFileSync(file));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
      const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(origin + '/index.html');
      try { await page.waitForSelector('[data-cell]', { timeout: 15000 }); }
      catch { throw new Error('consumer did not mount: ' + (errors[0] ?? 'no page error captured')); }
      const cells = await page.$$('[data-cell]');
      if (cells.length !== cases.length) problems.push(`mounted ${cells.length} cells for ${cases.length} cases`);
      const textDefault = String((contract.props as any[]).find(p => p.name === cases[0]?.textProp)?.default ?? '');
      for (const c of cases) {
        const cell = page.locator(`[data-cell="${c.key}"]`);
        const root = cell.locator(':scope > *').first();
        const style = await root.evaluate(el => { const s = getComputedStyle(el); return { backgroundColor: s.backgroundColor, color: s.color, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, tag: el.tagName.toLowerCase(), role: el.getAttribute('role') }; });
        // Fonts: the family the generated CSS asks for on text, and whether the
        // clean consumer could actually satisfy it. An unavailable family is a
        // named substrate gap; it never excuses the image score.
        // Serialized as text: tsx would otherwise inject its __name helper into the page.
        const font = await cell.evaluate(new Function('el', `
          const texts = [...el.querySelectorAll('*')].filter(n => [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()));
          if (!texts.length) return null;
          const s = getComputedStyle(texts[0]);
          const family = s.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
          const probe = (stack) => { const span = document.createElement('span'); span.textContent = 'mmmmmmmmmmlli0123456789'; span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:64px;font-weight:' + s.fontWeight + ';font-family:' + stack; document.body.appendChild(span); const w = span.getBoundingClientRect().width; span.remove(); return w; };
          const available = ['monospace', 'serif', 'sans-serif'].some(generic => probe('"' + family + '", ' + generic) !== probe(generic));
          return { family: s.fontFamily, weight: s.fontWeight, size: s.fontSize, available };
        `) as (el: Element) => unknown) as { family: string; weight: string; size: string; available: boolean } | null;
        if (font && !font.available) problems.push(`font-unavailable-in-consumer:${c.key}:${font.family.split(',')[0].trim()}`);
        const text = (await cell.innerText()).trim();
        if (!(style.width > 0 && style.height > 0)) problems.push(`zero-size-render:${c.key}`);
        // The root element's layout box on a white page, the same comparison
        // basis the application uses; Figma's export is the node's own bounds.
        const shot = path.join(args.out, `consumer-${c.key}.png`); await root.screenshot({ path: shot, timeout: 10000 });
        receipt.cases.push({ key: c.key, figmaName: c.figmaName, nodeId: c.nodeId, props: c.props, rendered: { text, ...style, font }, screenshot: path.basename(shot) });
      }
      // Behavior: the TEXT-bound prop must change the rendered text wherever the design shows text.
      if (cases[0]?.textProp) {
        const before = Object.fromEntries(await Promise.all(cases.map(async c => [c.key, (await page.locator(`[data-cell="${c.key}"]`).innerText()).trim()])));
        await page.evaluate(() => (window as any).__consumer.setText('Replaced by consumer'));
        const after = Object.fromEntries(await Promise.all(cases.map(async c => [c.key, (await page.locator(`[data-cell="${c.key}"]`).innerText()).trim()])));
        const textBearing = cases.filter(c => before[c.key].includes(textDefault) && textDefault);
        const changed = textBearing.filter(c => after[c.key].includes('Replaced by consumer') && !after[c.key].includes(textDefault));
        receipt.behavior.text = { prop: cases[0].textProp, textBearingCells: textBearing.map(c => c.key), changedCells: changed.map(c => c.key) };
        if (!textBearing.length) problems.push('text-prop-never-rendered');
        else if (changed.length !== textBearing.length) problems.push('text-prop-discarded');
        await page.evaluate(() => (window as any).__consumer.setText(null));
      } else receipt.behavior.text = { prop: null, note: 'contract declares no TEXT-bound prop' };
      // Behavior: array props with text fields must render replaced item text.
      receipt.behavior.arrays = [];
      for (const [prop, sample] of Object.entries(arraySamples(contract))) {
        const textField = sample.length && typeof sample[0] === 'object' ? Object.keys(sample[0] as object).find(k => typeof (sample[0] as any)[k] === 'string') : undefined;
        if (!textField) { receipt.behavior.arrays.push({ prop, note: 'no text field in sample' }); continue; }
        const replaced = sample.map((item, i) => ({ ...(item as object), [textField]: `Replaced item ${i + 1}` }));
        await page.evaluate(([name, value]) => (window as any).__consumer.setVariantOverride({ [name]: value }), [prop, replaced] as const);
        const texts = await Promise.all(cases.map(async c => (await page.locator(`[data-cell="${c.key}"]`).innerText())));
        await page.evaluate(() => (window as any).__consumer.setVariantOverride(null));
        const rendered = cases.filter((c, i) => replaced.every((item: any) => texts[i].includes(item[textField]))).map(c => c.key);
        receipt.behavior.arrays.push({ prop, textField, items: sample.length, cellsRenderingAllItems: rendered });
        if (rendered.length !== cases.length) problems.push(`array-prop-items-not-rendered:${prop}`);
      }
      // Behavior: React children. If the contract declares no slot, the component
      // must not silently accept and discard them; if it declares one, they must render.
      {
        const declaresSlot = JSON.stringify(contract.anatomy ?? {}).includes('"slot"');
        const marker = 'Consumer child content';
        await page.evaluate(([m]) => (window as any).__consumer.setVariantOverride({ children: m }), [marker] as const);
        const shown = (await page.locator('[data-cell]').first().innerText()).includes(marker);
        await page.evaluate(() => (window as any).__consumer.setVariantOverride(null));
        // The installed declaration is the API a TypeScript consumer sees.
        const declaration = readFileSync(path.join(consumer, 'node_modules', ...lib.name.split('/'), 'dist', args.component, `${args.component}.d.ts`), 'utf8');
        const propsInterface = declaration.slice(declaration.indexOf(`interface ${args.component}Props`));
        const refusedByType = /Omit<[^>]*>,\s*(?:'[^']*'\s*\|\s*)*'children'/.test(propsInterface.split('{')[0]);
        receipt.behavior.children = { contractDeclaresSlot: declaresSlot, renderedAtRuntime: shown, refusedByType };
        if (declaresSlot && !shown) problems.push('children-slot-discarded');
        if (!declaresSlot && !shown && !refusedByType) problems.push('children-accepted-but-discarded');
      }
      // Behavior: switching an enum prop must change the computed root style of every cell whose variant differs.
      const variantProps = (contract.props as any[]).filter(p => p.bindings?.figma?.kind === 'VARIANT' && p.type?.enum?.length > 1);
      receipt.behavior.variants = [];
      for (const prop of variantProps) {
        const values: string[] = prop.type.enum;
        const styleOf = async (key: string) => page.locator(`[data-cell="${key}"] > *`).first().evaluate(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return JSON.stringify([s.backgroundColor, s.color, s.borderColor, s.borderRadius, r.width, r.height, el.className]); });
        const baseline = Object.fromEntries(await Promise.all(cases.map(async c => [c.key, await styleOf(c.key)])));
        const target = values.find(v => cases.some(c => c.props[prop.name] !== v)) ?? values[0];
        await page.evaluate(([name, value]) => (window as any).__consumer.setVariantOverride({ [name]: value }), [prop.name, target] as const);
        const switched = Object.fromEntries(await Promise.all(cases.map(async c => [c.key, await styleOf(c.key)])));
        await page.evaluate(() => (window as any).__consumer.setVariantOverride(null));
        const shouldChange = cases.filter(c => c.props[prop.name] !== undefined && c.props[prop.name] !== target);
        const didChange = shouldChange.filter(c => baseline[c.key] !== switched[c.key]);
        receipt.behavior.variants.push({ prop: prop.name, switchedTo: target, cellsExpectedToChange: shouldChange.map(c => c.key), cellsChanged: didChange.map(c => c.key) });
        if (didChange.length !== shouldChange.length) {
          // The emitter ledgers an axis whose values drew no style difference on the canvas; name that reader outcome apart from a dropped prop.
          const inert = new RegExp(`axis-inert \\(ledgered, not a throw\\): ${prop.bindings.code?.prop ?? prop.name}\\b`).test(readFileSync(path.join(args.generated, args.component, `${args.component}.tsx`), 'utf8'));
          problems.push(inert ? `variant-axis-inert-ledgered:${prop.name}` : `variant-prop-discarded:${prop.name}`);
        }
      }
      if (errors.length) problems.push(...errors.map(e => 'consumer-runtime-error: ' + e.slice(0, 200)));
    } finally { await browser.close(); server.close(); }
    // Compare with Figma's own renders.
    const setNodeId: string | undefined = (dump[args.component] ?? {}).nodeId;
    const unresolved = fileKey && args.token && setNodeId && cases.some(c => !c.nodeId) ? await resolveVariantNodeIds(fileKey, setNodeId, args.token, cases) : (cases.some(c => !c.nodeId) ? 'variant node ids unavailable' : null);
    const figma = unresolved ? { status: 'figma-images-unavailable' as const, reason: unresolved, files: {} }
      : fileKey ? await fetchFigmaImages(fileKey, cases.map(c => c.nodeId), args.token, args.out) : { status: 'figma-images-unavailable' as const, reason: 'no fileKey in dump', files: {} };
    for (const row of receipt.cases) row.nodeId = cases.find(c => c.key === row.key)?.nodeId ?? null;
    receipt.images = { status: figma.status, reason: figma.reason, scorer: 'extract/figma/visual-parity/img.ts alignPair+diffPair (whitespace-trimmed, pixelmatch threshold 0.1, no text mask)', limitPercent: IMAGE_LIMIT_PERCENT, cases: [] as any[] };
    if (figma.status === 'figma-images-collected') for (const c of cases) {
      const file = figma.files[c.nodeId];
      if (!file) { receipt.images.cases.push({ key: c.key, status: 'figma-image-missing' }); problems.push(`figma-image-missing:${c.key}`); continue; }
      const ours = readPng(path.join(args.out, `consumer-${c.key}.png`)), theirs = readPng(file);
      const aligned = alignPair(ours, theirs), diff = diffPair(aligned, []);
      writeTriptych(path.join(args.out, `triptych-${c.key}.png`), aligned, diff.diff);
      const percent = diff.unmaskedPct;
      if (!Number.isFinite(percent)) { problems.push(`image-score-unavailable:${c.key}`); receipt.images.cases.push({ key: c.key, status: 'image-score-unavailable' }); continue; }
      // Share of non-white, non-transparent pixels on each side: a mostly
      // white surface can score under the limit while drawing far less ink.
      const ink = (png: import('pngjs').PNG) => { let n = 0; for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 3] > 8 && (png.data[i] < 247 || png.data[i + 1] < 247 || png.data[i + 2] < 247)) n++; return Math.round(10000 * n / (png.width * png.height)) / 100; };
      receipt.images.cases.push({ key: c.key, figmaImage: path.basename(file), mismatchPercent: percent, withinLimit: percent <= IMAGE_LIMIT_PERCENT, inkCoveragePercent: { consumer: ink(ours), figma: ink(theirs) },
        contentSize: { consumer: aligned.aContent, figma: aligned.bContent }, screenshotSize: { consumer: { width: ours.width, height: ours.height }, figma: { width: theirs.width, height: theirs.height } } });
      if (percent > IMAGE_LIMIT_PERCENT) problems.push(`image-difference-above-limit:${c.key}:${percent.toFixed(2)}%`);
      // Mostly-white surfaces can score under the pixel limit while the
      // rendered size is wrong; the trimmed content size must agree too.
      const dw = Math.abs(aligned.aContent.width - aligned.bContent.width), dh = Math.abs(aligned.aContent.height - aligned.bContent.height);
      if (dw > SIZE_SLACK_PX || dh > SIZE_SLACK_PX) problems.push(`content-size-mismatch:${c.key}:${aligned.aContent.width}x${aligned.aContent.height} vs ${aligned.bContent.width}x${aligned.bContent.height}`);
    } else problems.push('figma-images-unavailable');
  } catch (error) {
    problems.push('check-failed: ' + (error instanceof Error ? error.message : String(error)).split('\n')[0]);
  } finally { rmSync(work, { recursive: true, force: true }); }
  receipt.outcome = problems.length ? 'refused-or-failed' : 'consumer-mounted-behaved-and-compared';
  writeFileSync(path.join(args.out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${problems.length ? '✘' : '✔'} design:consumer:check ${args.component}: ${receipt.outcome}${problems.length ? '\n  - ' + problems.join('\n  - ') : ''}\n  receipt → ${path.join(args.out, 'receipt.json')}`);
  process.exit(problems.length ? 1 : 0);
}
main();
