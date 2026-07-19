/**
 * COMPUTED-STYLE CAPTURE FLOOR — working spike (Polaris Button end-to-end).
 * See DESIGN.md in this directory for the full design this proves.
 *
 *   npx tsx extract/computed-spike/run.ts --harness <dir>
 *
 * harness = npm sandbox OUTSIDE the repo containing @shopify/polaris@13.9.5,
 * react@18, react-dom@18, esbuild (the examples/polaris/scripts/verify.ts
 * pattern). Network-free at run time; needs a local Chromium (playwright-core
 * cache or system Chrome — render.ts discovery convention).
 *
 * Pipeline (one run, four phases):
 *   1. CAPTURE  mount the REAL Polaris Button per prop combo (full cartesian:
 *      variant×tone×size×disabled = 120), drive real browser states
 *      (hover / focus-visible / active) the visual-parity way, read
 *      getComputedStyle for EVERY longhand the browser enumerates (no
 *      whitelist) on every element incl. ::before/::after, screenshot each
 *      combo×state. Double-run byte-identity asserts determinism.
 *   2. FUSE     static semantic layer (the committed polaris.button contract's
 *      carried bindings, browser-probed to canonical values) labels computed
 *      values BOUND (or names a binding-contradiction); unlabeled styled
 *      channels feed core/mint-tokens.ts unchanged (uniform / per-axis /
 *      per-pair / refused-by-name); everything else lands in the extension
 *      block. Output: enriched contract (schema-valid, ContractSchema.parse)
 *      + extension block + delta ledger.
 *   3. REPLAY   rebuild every capture as a static DOM with the captured
 *      computed truth applied verbatim (every longhand inline; pseudo-elements
 *      via generated rules) — the vocabulary-independent completeness check.
 *   4. COMPARE  pixel-diff replay vs original per combo×state (threshold 0
 *      AND the AA point 0.1 — both quoted, never widened) + computed re-read
 *      equality on the replay. Numbers land in numbers.json / REPORT.md.
 *
 * NO ENGINE EDITS: this file only IMPORTS core/scripts modules read-only.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {
  mintTokens,
  type MintAxis,
  type MintObservation,
} from '../../core/mint-tokens.js';
import {
  ContractSchema,
  resolveTokens,
  resolveLiterals,
  type Contract,
  type Part,
} from '../../scripts/contract-schema.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
const RECEIPTS = path.join(HERE, 'receipts');
const harnessArg = process.argv.indexOf('--harness');
const HARNESS = harnessArg > -1 ? path.resolve(process.argv[harnessArg + 1]) : null;
if (!HARNESS || !existsSync(path.join(HARNESS, 'node_modules', '@shopify', 'polaris'))) {
  console.error('need --harness <dir> with @shopify/polaris, react@18, react-dom@18, esbuild installed');
  process.exit(1);
}

const SAMPLE_TEXT = 'Save changes';
const STAGE = { width: 320, height: 96, padding: 16 }; // fixed stage → comparable geometry
// SUB-md viewport (Polaris md = 48rem = 768px) — the verify.ts convention: the
// contracts carry base values; @media overrides are named refusals. A first
// spike run at 800px proved the floor CATCHES the md-up overrides as
// binding-contradiction receipts (120 rows: min-height/min-width + slim/micro
// label typography) — S7 evidence, quoted in REPORT.md.
const VIEWPORT = { width: 600, height: 800 };
const DPR = 2;
/** Channels the replay cannot apply/serialize faithfully via inline styles —
 *  named, excluded from BOTH replay application and the re-read equality
 *  metric (never silently): app-region is unsettable outside app contexts;
 *  text-decoration is a SHORTHAND Chromium enumerates whose re-serialization
 *  reorders (its longhands text-decoration-line/-color/-style/-thickness are
 *  captured, applied, and compared individually). */
const REPLAY_APPLY_EXCLUDE = new Set(['app-region', 'text-decoration']);

// ---------------------------------------------------------------------------
// Prop space — from the committed contract (static extraction supplies the
// prop space; the capture tool never re-derives the API). Full cartesian:
// 5 × 3 × 4 × 2 = 120 ≤ 512 → policy: full cartesian (DESIGN.md §1.4).
// ---------------------------------------------------------------------------
const VARIANTS = ['plain', 'primary', 'secondary', 'tertiary', 'monochromePlain'] as const;
const TONES = ['none', 'critical', 'success'] as const; // 'none' = unset (defaultless enum)
const SIZES = ['micro', 'slim', 'medium', 'large'] as const;
const INTERACTIONS = ['default', 'hover', 'focus-visible', 'active'] as const;
type Interaction = (typeof INTERACTIONS)[number];

interface Combo {
  key: string;
  variant: string;
  tone: string;
  size: string;
  disabled: boolean;
}
const COMBOS: Combo[] = [];
for (const variant of VARIANTS)
  for (const tone of TONES)
    for (const size of SIZES)
      for (const disabled of [false, true])
        COMBOS.push({ key: `${variant}.${tone}.${size}.${disabled ? 'disabled' : 'enabled'}`, variant, tone, size, disabled });
const BASE_COMBO_KEY = 'secondary.none.medium.enabled'; // all contract defaults

// ---------------------------------------------------------------------------
// Chromium discovery (extract/figma/visual-parity/render.ts convention,
// copied so the spike has zero imports from the visual-parity module graph)
// ---------------------------------------------------------------------------
function chromiumExecutable(): string {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const caches = [
    path.join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    process.env.XDG_CACHE_HOME
      ? path.join(process.env.XDG_CACHE_HOME, 'ms-playwright')
      : path.join(homedir(), '.cache', 'ms-playwright'),
  ];
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    const revs = readdirSync(cache)
      .map((d) => /^chromium-(\d+)$/.exec(d))
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    for (const m of revs) {
      for (const rel of [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
        'chrome-linux64/chrome',
      ]) {
        const p = path.join(cache, m[0], rel);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const sys of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]) {
    if (existsSync(sys)) return sys;
  }
  throw new Error('No Chromium found — set PLAYWRIGHT_CHROMIUM_PATH');
}

// ---------------------------------------------------------------------------
// Phase 1a: harness page (real @shopify/polaris Button, one stage per combo)
// ---------------------------------------------------------------------------
function buildHarnessPage(): string {
  const specs = COMBOS.map((c) => ({
    key: c.key,
    props: {
      variant: c.variant,
      size: c.size,
      ...(c.tone !== 'none' ? { tone: c.tone } : {}),
      ...(c.disabled ? { disabled: true } : {}),
    },
  }));
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, Button } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

const SPECS = ${JSON.stringify(specs)};
// display:flex + align-items:flex-start: the component is a flex item, so its
// position never depends on the stage's own line-box strut (inherited font
// metrics) — the replay stage carries no inherited context, and a flow stage
// would shift the button by the strut delta (observed: 14px on the first
// spike run). Identical stage rule on both sides (§4 mount-context receipt).
const stage = { display: 'flex', alignItems: 'flex-start', width: ${STAGE.width}, height: ${STAGE.height}, padding: ${STAGE.padding}, boxSizing: 'border-box', background: '#fff', overflow: 'hidden' };

function App() {
  return (
    <AppProvider i18n={en}>
      {SPECS.map((s) => (
        <React.Fragment key={s.key}>
          <button data-sentinel={s.key} style={{ width: 8, height: 8, padding: 0, border: 0, margin: 2, background: '#eee' }} aria-label="sentinel" />
          <div data-combo={s.key} style={stage}>
            <Button {...s.props}>${SAMPLE_TEXT}</Button>
          </div>
        </React.Fragment>
      ))}
      <div data-combo="__control-button" style={stage}><button>${SAMPLE_TEXT}</button></div>
      <div data-combo="__control-span" style={stage}><span>${SAMPLE_TEXT}</span></div>
    </AppProvider>
  );
}
createRoot(document.getElementById('root')).render(<App />);
`;
  const pageDir = path.join(HARNESS!, 'computed-spike-page');
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, 'entry.jsx'), entry);
  execFileSync(
    path.join(HARNESS!, 'node_modules', '.bin', 'esbuild'),
    ['computed-spike-page/entry.jsx', '--bundle', '--outfile=computed-spike-page/bundle.js', '--jsx=automatic', '--loader:.json=json', '--loader:.svg=dataurl', '--loader:.png=dataurl', '--log-level=error'],
    { cwd: HARNESS! },
  );
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="bundle.css">
<style>html { color-scheme: light; } body { margin: 0; background: #ddd; }</style>
</head><body><div id="root"></div><script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, 'index.html');
}

// ---------------------------------------------------------------------------
// Capture data model + normalization
// ---------------------------------------------------------------------------
type StyleMap = Record<string, string>;
interface CapturedNode {
  tag: string;
  classes: string[];
  /** child NODES in document order: text runs and elements interleaved. */
  nodes: Array<{ t: 'text'; v: string } | { t: 'el'; el: CapturedNode }>;
  style: StyleMap;
  pseudo: Partial<Record<'::before' | '::after', StyleMap>>;
}
interface Capture {
  combo: string;
  interaction: Interaction;
  focusVisibleMatched?: boolean;
  root: CapturedNode;
}

/** Canonical rgba: Chromium serializes opaque colors rgb(r, g, b) — normalize
 *  every embedded occurrence to rgba(r, g, b, 1). Deterministic, lossless. */
const normalizeValue = (v: string): string =>
  v.replace(/\brgb\((\d+), (\d+), (\d+)\)/g, 'rgba($1, $2, $3, 1)').replace(/"/g, '"');

function normalizeNode(n: CapturedNode): CapturedNode {
  const norm = (s: StyleMap): StyleMap => {
    const out: StyleMap = {};
    for (const k of Object.keys(s).sort()) out[k] = normalizeValue(s[k]);
    return out;
  };
  return {
    tag: n.tag,
    classes: n.classes,
    nodes: n.nodes.map((c) => (c.t === 'text' ? c : { t: 'el' as const, el: normalizeNode(c.el) })),
    style: norm(n.style),
    pseudo: Object.fromEntries(Object.entries(n.pseudo).map(([k, v]) => [k, norm(v as StyleMap)])) as CapturedNode['pseudo'],
  };
}

/** In-page capture (STRING evaluate — the tsx __name serialization trap,
 *  see render.ts). Reads EVERY enumerated longhand + ::before/::after. */
const captureJs = (selector: string) => `(() => {
  const stage = document.querySelector(${JSON.stringify(selector)});
  if (!stage || !stage.firstElementChild) return null;
  const props = window.__ALL_PROPS;
  const read = (cs) => { const o = {}; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
  const readEl = (el) => {
    const out = {
      tag: el.tagName.toLowerCase(),
      classes: [...el.classList],
      nodes: [],
      style: read(getComputedStyle(el)),
      pseudo: {},
    };
    for (const pe of ['::before', '::after']) {
      const pcs = getComputedStyle(el, pe);
      const content = pcs.getPropertyValue('content');
      if (content !== 'none' && content !== 'normal') out.pseudo[pe] = read(pcs);
    }
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.textContent.length > 0) out.nodes.push({ t: 'text', v: child.textContent });
      else if (child.nodeType === 1) out.nodes.push({ t: 'el', el: readEl(child) });
    }
    return out;
  };
  return readEl(stage.firstElementChild);
})()`;

// ---------------------------------------------------------------------------
// Phase 1b: the sweep
// ---------------------------------------------------------------------------
interface SweepResult {
  captures: Capture[];
  controls: Record<string, CapturedNode>;
  allProps: string[];
  browserVersion: string;
  fontChecks: Record<string, boolean>;
}

async function sweep(page: Page, withScreenshots: boolean): Promise<SweepResult> {
  const allProps = (await page.evaluate(
    `(() => { const l = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = l; return l; })()`,
  )) as string[];

  const fontChecks = (await page.evaluate(
    `(() => { const f = {}; for (const fam of ['-apple-system', 'Segoe UI', 'Inter']) f[fam] = document.fonts.check('16px "' + fam + '"'); return f; })()`,
  )) as Record<string, boolean>;

  const captures: Capture[] = [];
  const shotDir = path.join(OUT, 'orig');
  if (withScreenshots) mkdirSync(shotDir, { recursive: true });

  for (const combo of COMBOS) {
    const stageSel = `[data-combo="${combo.key}"]`;
    const rootLoc = page.locator(`${stageSel} > *`).first();
    for (const interaction of INTERACTIONS) {
      // neutralize residual pointer + focus state (render.ts discipline)
      await page.mouse.move(0, 0);
      await page.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
      await page.locator(stageSel).scrollIntoViewIfNeeded();

      let focusVisibleMatched: boolean | undefined;
      if (interaction === 'hover') {
        await rootLoc.hover({ force: true }); // force: pointer moves even when pointer-events blocks actionability (disabled combos — :hover honestly not matching IS the capture)
      } else if (interaction === 'focus-visible') {
        await page.evaluate(`document.querySelector('[data-sentinel="${combo.key}"]').focus()`);
        await page.keyboard.press('Tab'); // keyboard modality → :focus-visible heuristic
        focusVisibleMatched = (await page.evaluate(
          `(() => { const el = document.querySelector('${stageSel} > *'); return !!el && el.matches(':focus-visible'); })()`,
        )) as boolean;
      } else if (interaction === 'active') {
        await rootLoc.hover({ force: true });
        await page.mouse.down();
      }

      // steady-state poll: transitions stay ENABLED (freezing them would
      // alter captured transition-* channels — a capture-side lie); instead
      // wait until paint-relevant channels stop moving (bounded 600ms).
      const probe = `(() => { const el = document.querySelector('${stageSel} > *'); if (!el) return ''; const cs = getComputedStyle(el); return [cs.backgroundColor, cs.color, cs.boxShadow, cs.transform].join('|'); })()`;
      let prev = await page.evaluate(probe);
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(60);
        const cur = await page.evaluate(probe);
        if (cur === prev) break;
        prev = cur;
      }

      const raw = (await page.evaluate(captureJs(stageSel))) as CapturedNode | null;
      if (!raw) throw new Error(`capture failed: ${combo.key} ${interaction}`);
      captures.push({ combo: combo.key, interaction, ...(focusVisibleMatched !== undefined ? { focusVisibleMatched } : {}), root: normalizeNode(raw) });

      if (withScreenshots) {
        const png = await page.locator(stageSel).screenshot({ timeout: 10_000 });
        writeFileSync(path.join(shotDir, `${combo.key}__${interaction}.png`), png);
      }
      if (interaction === 'active') await page.mouse.up();
    }
  }

  const controls: Record<string, CapturedNode> = {};
  for (const key of ['__control-button', '__control-span']) {
    const raw = (await page.evaluate(captureJs(`[data-combo="${key}"]`))) as CapturedNode | null;
    if (!raw) throw new Error(`control capture failed: ${key}`);
    controls[key] = normalizeNode(raw);
  }

  return { captures, controls, allProps, browserVersion: page.context().browser()!.version(), fontChecks };
}

// ---------------------------------------------------------------------------
// Part alignment: rendered tree → stable part identity across the sweep
// ---------------------------------------------------------------------------
/** Class stems: drop modifier classes (contain '--'), strip the library
 *  prefix. Signature = tag + stems (presence/absence discipline, §4). */
const stems = (classes: string[]): string[] =>
  classes.filter((c) => !c.includes('--')).map((c) => c.replace(/^Polaris-/, '')).sort();
const signature = (n: CapturedNode): string => `${n.tag}|${stems(n.classes).join('.')}`;

interface FlatEl {
  /** DFS path of child-element indices from the root ('' = root). */
  path: string;
  sig: string;
  partName: string;
  node: CapturedNode;
}
function flatten(root: CapturedNode): FlatEl[] {
  const out: FlatEl[] = [];
  const visit = (n: CapturedNode, p: string) => {
    out.push({ path: p, sig: signature(n), partName: '', node: n });
    let i = 0;
    for (const c of n.nodes) if (c.t === 'el') visit(c.el, p === '' ? String(i++) : `${p}.${i++}`);
  };
  visit(root, '');
  return out;
}
/** Part naming (§4 role classification): root; direct text holder → label;
 *  svg → icon; else dominant class stem, fallback part-<path>. */
function namePart(el: FlatEl): string {
  if (el.path === '') return 'root';
  if (el.node.tag === 'svg') return 'icon';
  const hasText = el.node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
  if (hasText) return 'label';
  const stem = stems(el.node.classes)[0];
  return stem ? stem.replace(/^Button__?/, '').toLowerCase() || 'root' : `part-${el.path}`;
}

// ---------------------------------------------------------------------------
// Fusion helpers
// ---------------------------------------------------------------------------
/** Geometry channels: captured, but environment-dependent (font metrics) —
 *  excluded from fusion, NAMED in the ledger (§3.3). */
const GEOMETRY_CHANNELS = new Set(['width', 'height', 'inline-size', 'block-size', 'perspective-origin', 'transform-origin', 'webkit-logical-width', 'webkit-logical-height']);
/** Logical-property aliases of physical longhands (under the PINNED writing
 *  mode: horizontal-tb + ltr, recorded in provenance). Chromium enumerates
 *  both spellings; fusing both would double-count every margin/padding/
 *  border/inset channel. Captured and replayed — folded OUT of fusion by
 *  name; the physical spelling is the fusion channel. */
const LOGICAL_ALIASES = new Set([
  'min-inline-size', 'min-block-size', 'max-inline-size', 'max-block-size',
  'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end',
  'margin-block-start', 'margin-block-end', 'margin-inline-start', 'margin-inline-end',
  'padding-block-start', 'padding-block-end', 'padding-inline-start', 'padding-inline-end',
  'border-block-start-width', 'border-block-end-width', 'border-inline-start-width', 'border-inline-end-width',
  'border-block-start-style', 'border-block-end-style', 'border-inline-start-style', 'border-inline-end-style',
  'border-block-start-color', 'border-block-end-color', 'border-inline-start-color', 'border-inline-end-color',
  'border-start-start-radius', 'border-start-end-radius', 'border-end-start-radius', 'border-end-end-radius',
  'overflow-block', 'overflow-inline', 'overscroll-behavior-block', 'overscroll-behavior-inline',
  'contain-intrinsic-block-size', 'contain-intrinsic-inline-size',
]);
const isFusable = (prop: string) =>
  !prop.startsWith('-webkit-') && !GEOMETRY_CHANNELS.has(prop) && !LOGICAL_ALIASES.has(prop);

const rgbaRe = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/;
const pxRe = /^(-?\d+(?:\.\d+)?)px$/;
const numRe = /^\d*\.?\d+$/;
type Kindled = { kind: MintObservation['kind']; value: string | number } | null;
function kindOf(prop: string, value: string): Kindled {
  const m = rgbaRe.exec(value);
  if (m) {
    const hex = (x: number) => x.toString(16).padStart(2, '0');
    const a = Number(m[4]);
    const base = `${hex(+m[1])}${hex(+m[2])}${hex(+m[3])}`;
    return { kind: 'color', value: a >= 1 ? base : `${base}${hex(Math.round(a * 255))}` };
  }
  if (prop === 'box-shadow' && value !== 'none') return { kind: 'shadow', value };
  const px = pxRe.exec(value);
  if (px) return { kind: 'px', value: Number(px[1]) };
  if (numRe.test(value)) return { kind: 'number', value: Number(value) };
  return null;
}

/** verify.ts channel map: contract channel → computed longhand(s) to check. */
const CHANNEL_TO_COMPUTED: Record<string, string[]> = {
  background: ['background-color'],
  'background-color': ['background-color'],
  color: ['color'],
  fill: ['fill'],
  'border-radius': ['border-top-left-radius'],
  'border-color': ['border-bottom-color'],
  'border-width': ['border-bottom-width'],
  'padding-block': ['padding-top', 'padding-bottom'],
  'padding-inline': ['padding-left', 'padding-right'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'line-height': ['line-height'],
  'letter-spacing': ['letter-spacing'],
  gap: ['column-gap'],
  'min-height': ['min-height'],
  'min-width': ['min-width'],
  'box-shadow': ['box-shadow'],
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(RECEIPTS, { recursive: true });

  console.log('phase 1 — building harness page (esbuild over @shopify/polaris)…');
  const pageHtml = buildHarnessPage();

  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR, colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(`file://${pageHtml}`);
  await page.waitForSelector('[data-combo]', { timeout: 15_000 });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(400);

  console.log(`phase 1 — capture sweep: ${COMBOS.length} combos × ${INTERACTIONS.length} interactions…`);
  const run1 = await sweep(page, true);
  console.log(`  captured ${run1.captures.length} captures, ${run1.allProps.length} channels enumerated, browser ${run1.browserVersion}`);

  console.log('phase 1 — determinism: second full sweep (no screenshots)…');
  const run2 = await sweep(page, false);
  const canon = (r: SweepResult) => JSON.stringify({ captures: r.captures, controls: r.controls });
  const deterministic = canon(run1) === canon(run2);
  console.log(`  double-run byte-identity: ${deterministic ? 'IDENTICAL' : 'DIFFERS'}`);
  let determinismDetail = 'byte-identical across two full sweeps in one session';
  if (!deterministic) {
    // name the unstable channels instead of hiding them
    const unstable = new Set<string>();
    for (let i = 0; i < run1.captures.length; i++) {
      const a = flatten(run1.captures[i].root);
      const b = flatten(run2.captures[i].root);
      for (let j = 0; j < Math.min(a.length, b.length); j++) {
        for (const p of Object.keys(a[j].node.style)) {
          if (a[j].node.style[p] !== b[j].node.style[p]) unstable.add(p);
        }
      }
    }
    determinismDetail = `UNSTABLE channels across double-run: ${[...unstable].sort().join(', ') || '(structural)'}`;
    console.log(`  ${determinismDetail}`);
  }

  // ------------------------------------------------------------------
  // Part alignment across the whole sweep
  // ------------------------------------------------------------------
  const byKey = new Map(run1.captures.map((c) => [`${c.combo}__${c.interaction}`, c]));
  const base = byKey.get(`${BASE_COMBO_KEY}__default`)!;
  const baseFlat = flatten(base.root);
  baseFlat.forEach((el) => (el.partName = namePart(el)));
  // dedupe part names
  const seen = new Map<string, number>();
  for (const el of baseFlat) {
    const n = seen.get(el.partName) ?? 0;
    seen.set(el.partName, n + 1);
    if (n > 0) el.partName = `${el.partName}-${n + 1}`;
  }
  const partNames = baseFlat.map((e) => e.partName);
  console.log(`  anatomy from rendered tree: ${baseFlat.map((e) => `${e.partName}(${e.sig})`).join(' → ')}`);

  /** Align a capture's elements to the base parts by DFS path + signature.
   *  Structure drift (extra/missing/mismatched elements) is receipted. */
  const structureReceipts: string[] = [];
  function aligned(c: Capture): (FlatEl | null)[] {
    const flat = flatten(c.root);
    const byPath = new Map(flat.map((e) => [e.path, e]));
    return baseFlat.map((b) => {
      const el = byPath.get(b.path);
      if (!el) {
        structureReceipts.push(`part-missing: ${c.combo} ${c.interaction} ${b.partName}`);
        return null;
      }
      if (el.sig !== b.sig) structureReceipts.push(`signature-drift: ${c.combo} ${c.interaction} ${b.partName}: ${b.sig} → ${el.sig}`);
      return el;
    });
  }
  const alignedCache = new Map<string, (FlatEl | null)[]>();
  const getAligned = (key: string) => {
    let a = alignedCache.get(key);
    if (!a) alignedCache.set(key, (a = aligned(byKey.get(key)!)));
    return a;
  };

  // ------------------------------------------------------------------
  // Styled-channel determination: differs from the control probe at base,
  // OR varies anywhere in the sweep (default interaction, enabled combos).
  // ------------------------------------------------------------------
  const controlFor = (tag: string): StyleMap =>
    tag === 'button' ? run1.controls['__control-button'].style : run1.controls['__control-span'].style;

  const styledChannels: Map<string, Set<string>> = new Map(); // partName → channels
  for (let pi = 0; pi < baseFlat.length; pi++) {
    const set = new Set<string>();
    const ctrl = controlFor(baseFlat[pi].node.tag);
    for (const p of run1.allProps) {
      if (!isFusable(p)) continue;
      if (baseFlat[pi].node.style[p] !== ctrl[p]) set.add(p);
    }
    for (const combo of COMBOS) {
      if (combo.disabled) continue;
      const el = getAligned(`${combo.key}__default`)[pi];
      if (!el) continue;
      for (const p of run1.allProps) {
        if (!isFusable(p)) continue;
        if (el.node.style[p] !== baseFlat[pi].node.style[p]) set.add(p);
      }
    }
    styledChannels.set(partNames[pi], set);
  }

  // ------------------------------------------------------------------
  // Phase 2a — BOUND: probe the committed contract's carried bindings to
  // browser-canonical values, then confirm/contradict against the capture.
  // ------------------------------------------------------------------
  console.log('phase 2 — fusion…');
  const contract = ContractSchema.parse(
    JSON.parse(readFileSync(path.join(REPO, 'examples', 'polaris', 'contracts', 'button.contract.json'), 'utf8')),
  ) as Contract;

  const refToVar = (ref: string) => `--${ref.slice(1, -1).split('.').join('-')}`;
  /** Browser-probe: element with `prop: var(--token)` → canonical computed
   *  value (no unit math in Node — the browser is the only normalizer). */
  const probeCache = new Map<string, string>();
  async function probeTokenValue(ref: string, computedProp: string): Promise<string> {
    const key = `${ref}|${computedProp}`;
    const hit = probeCache.get(key);
    if (hit !== undefined) return hit;
    const js = `(() => {
      const el = document.createElement('div');
      el.style.position = 'absolute'; el.style.visibility = 'hidden';
      el.style.setProperty(${JSON.stringify(cssPropertyForProbe(computedProp))}, 'var(${refToVar(ref)})');
      document.body.appendChild(el);
      const v = getComputedStyle(el).getPropertyValue(${JSON.stringify(computedProp)});
      el.remove();
      return v;
    })()`;
    const v = normalizeValue((await page.evaluate(js)) as string);
    probeCache.set(key, v);
    return v;
  }
  /** Longhand read back may differ from the settable property (padding-top
   *  is settable directly; border-top-left-radius too) — identity here. */
  const cssPropertyForProbe = (computedProp: string) => computedProp;

  interface BoundRow {
    combo: string;
    part: string;
    channel: string;
    ref: string;
    computedProp: string;
    expected: string;
    observed: string;
    verdict: 'confirmed' | 'contradiction' | 'part-missing';
  }
  const boundRows: BoundRow[] = [];
  const partByName: Record<string, Part | undefined> = {
    root: contract.anatomy.root,
    label: contract.anatomy.root?.parts?.label,
  };
  for (const combo of COMBOS) {
    if (combo.disabled) continue; // disabled handled as a state below
    const subst: Record<string, string> = { variant: combo.variant, size: combo.size, textAlign: 'center' };
    if (combo.tone !== 'none') subst.tone = combo.tone;
    const alignedEls = getAligned(`${combo.key}__default`);
    for (let pi = 0; pi < baseFlat.length; pi++) {
      const cPart = partByName[partNames[pi]];
      if (!cPart) continue;
      const carried = resolveTokens(cPart, subst);
      const el = alignedEls[pi];
      for (const [channel, ref] of Object.entries(carried)) {
        const computedProps = CHANNEL_TO_COMPUTED[channel];
        if (!computedProps) continue;
        for (const cp of computedProps) {
          if (!el) {
            boundRows.push({ combo: combo.key, part: partNames[pi], channel, ref, computedProp: cp, expected: '', observed: '', verdict: 'part-missing' });
            continue;
          }
          const expected = await probeTokenValue(ref, cp);
          const observed = el.node.style[cp];
          boundRows.push({ combo: combo.key, part: partNames[pi], channel, ref, computedProp: cp, expected, observed, verdict: expected === observed ? 'confirmed' : 'contradiction' });
        }
      }
    }
  }
  const boundConfirmed = boundRows.filter((r) => r.verdict === 'confirmed').length;
  const boundContradicted = boundRows.filter((r) => r.verdict !== 'confirmed') as Array<BoundRow & { cause?: string }>;
  // Named-cause triage (the verify.ts discipline: a mismatch without a named
  // cause is a defect; these three classes are the spike's central findings)
  for (const r of boundContradicted) {
    const [variant, tone] = r.combo.split('.');
    if (r.part === 'root' && tone !== 'none' && ['color', 'background-color', 'box-shadow'].includes(r.channel)) {
      r.cause = 'tone×variant multi-axis condition (.tone*:is(.variant*)) — refused by name in the static promotion; the computed floor observes the resolved value and the mint pass carries it per-axis-pair';
    } else if (r.part === 'label' && ['plain', 'monochromePlain'].includes(variant) && ['font-size', 'line-height'].includes(r.channel)) {
      r.cause = `composition-owned typography: the ${variant} variant renders its label through the Text primitive at bodyMd (13px/20px); the carried binding is the bodySm default — child-component props conditioned on the parent variant, invisible to single-file static promotion`;
    } else if (r.part === 'label' && variant === 'primary' && r.channel === 'font-weight') {
      r.cause = 'composition-owned typography: the primary variant label renders Text fontWeight 650 (semibold); the carried binding is font-weight-medium (550) — same composition-owned class';
    }
  }
  const untriaged = boundContradicted.filter((r) => !r.cause);
  console.log(`  bound: ${boundConfirmed}/${boundRows.length} carried-binding cells confirmed by computed truth`);

  /** Channels the contract carries for a part (any combo/state) — these are
   *  BOUND territory; the mint pass never re-mints them. */
  const carriedChannels = (partName: string): Set<string> => {
    const p = partByName[partName];
    const out = new Set<string>();
    if (!p) return out;
    const addAll = (rec?: Record<string, string>) => { for (const ch of Object.keys(rec ?? {})) for (const cp of CHANNEL_TO_COMPUTED[ch] ?? []) out.add(cp); };
    addAll(p.tokens);
    for (const e of Array.isArray(p.tokensByProp) ? p.tokensByProp : p.tokensByProp ? [p.tokensByProp] : []) for (const m of Object.values(e.map)) addAll(m);
    addAll(p.literals);
    for (const e of p.literalsByProp ?? []) for (const m of Object.values(e.map)) addAll(m);
    for (const m of Object.values(p.states ?? {})) addAll(m);
    addAll(resolveLiterals(p, {}));
    return out;
  };

  // ------------------------------------------------------------------
  // Phase 2b — MINT: unlabeled styled channels through core/mint-tokens.ts
  // ------------------------------------------------------------------
  const axes: MintAxis[] = [
    { propName: 'variant', values: [...VARIANTS] },
    { propName: 'tone', values: [...TONES] },
    { propName: 'size', values: [...SIZES] },
  ];
  const observations: MintObservation[] = [];
  const codeOnly: Array<{ part: string; channel: string; reason: string; sample: string; distinctValues: number }> = [];

  for (let pi = 0; pi < baseFlat.length; pi++) {
    const partName = partNames[pi];
    const carried = carriedChannels(partName);
    for (const channel of [...styledChannels.get(partName)!].sort()) {
      if (carried.has(channel)) continue;
      const occurrences: MintObservation['occurrences'] = [];
      const values = new Set<string>();
      let unk: string | null = null;
      for (const combo of COMBOS) {
        if (combo.disabled) continue;
        const el = getAligned(`${combo.key}__default`)[pi];
        if (!el) continue;
        const v = el.node.style[channel];
        values.add(v);
        const k = kindOf(channel, v);
        if (!k) { unk = v; break; }
        occurrences.push({
          variant: combo.key,
          axisValues: { variant: combo.variant, tone: combo.tone, size: combo.size },
          value: k.value,
        });
      }
      if (unk !== null) {
        codeOnly.push({ part: partName, channel, reason: 'value shape outside mintable kinds (color/px/number/shadow) — no schema channel today', sample: unk, distinctValues: values.size });
        continue;
      }
      observations.push({ nodePath: `Button:${partName}`, part: partName === 'root' ? '' : partName, cssProperty: channel, kind: kindOf(channel, [...values][0])!.kind, occurrences });
    }
  }
  const mintBase = mintTokens('button', observations, axes);

  // ------------------------------------------------------------------
  // Phase 2c — STATE deltas (hover / focus-visible / active on enabled
  // combos; disabled as a prop-state) → mint per state
  // ------------------------------------------------------------------
  interface StateDelta { state: string; part: string; channel: string; occurrences: MintObservation['occurrences']; kinds: Set<string>; samples: Set<string> }
  const stateObs: MintObservation[] = [];
  const stateCodeOnly: Array<{ state: string; part: string; channel: string; sample: string; reason: string }> = [];
  const inertOnDisabled: string[] = [];
  const stateDeltaChannels = new Map<string, StateDelta>();

  const pushStateValue = (state: string, part: string, pi: number, channel: string, combo: Combo, v: string) => {
    const key = `${state}|${part}|${channel}`;
    let d = stateDeltaChannels.get(key);
    if (!d) stateDeltaChannels.set(key, (d = { state, part, channel, occurrences: [], kinds: new Set(), samples: new Set() }));
    const k = kindOf(channel, v);
    d.samples.add(v);
    if (k) {
      d.kinds.add(k.kind);
      d.occurrences.push({ variant: combo.key, axisValues: { variant: combo.variant, tone: combo.tone, size: combo.size }, value: k.value });
    } else d.kinds.add('unmintable');
  };

  for (const combo of COMBOS) {
    const defaults = getAligned(`${combo.key}__default`);
    for (const interaction of ['hover', 'focus-visible', 'active'] as const) {
      const els = getAligned(`${combo.key}__${interaction}`);
      for (let pi = 0; pi < baseFlat.length; pi++) {
        const a = defaults[pi]; const b = els[pi];
        if (!a || !b) continue;
        for (const p of run1.allProps) {
          if (!isFusable(p)) continue;
          if (a.node.style[p] === b.node.style[p]) continue;
          if (combo.disabled) { inertOnDisabled.push(`interaction-on-disabled-changed: ${combo.key} ${interaction} ${partNames[pi]}.${p}`); continue; }
          pushStateValue(interaction, partNames[pi], pi, p, combo, b.node.style[p]);
        }
      }
    }
  }
  // disabled = prop-state: diff each disabled combo against its enabled twin
  for (const combo of COMBOS) {
    if (!combo.disabled) continue;
    const twinKey = combo.key.replace('.disabled', '.enabled');
    const a = getAligned(`${twinKey}__default`);
    const b = getAligned(`${combo.key}__default`);
    for (let pi = 0; pi < baseFlat.length; pi++) {
      if (!a[pi] || !b[pi]) continue;
      for (const p of run1.allProps) {
        if (!isFusable(p)) continue;
        if (a[pi]!.node.style[p] === b[pi]!.node.style[p]) continue;
        const twin = COMBOS.find((c) => c.key === twinKey)!;
        pushStateValue('disabled', partNames[pi], pi, p, twin, b[pi]!.node.style[p]);
      }
    }
  }

  // full-coverage state deltas → mint; partial/unmintable → extension
  const EXPECTED_ENABLED = COMBOS.filter((c) => !c.disabled).length;
  for (const d of stateDeltaChannels.values()) {
    if (d.kinds.has('unmintable') || d.kinds.size !== 1) {
      stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: [...d.samples][0], reason: d.kinds.has('unmintable') ? 'value shape outside mintable kinds' : 'mixed value kinds across combos' });
      continue;
    }
    if (d.occurrences.length < EXPECTED_ENABLED) {
      // delta exists on SOME combos only → pad the rest with the default
      // value so correlation can still decide (a partial delta is itself a
      // per-axis fact: e.g. hover bg changes only for enabled non-plain).
      const have = new Set(d.occurrences.map((o) => o.variant));
      let padded = true;
      for (const combo of COMBOS) {
        if (combo.disabled || have.has(combo.key)) continue;
        const pi = partNames.indexOf(d.part);
        const el = getAligned(`${combo.key}__default`)[pi];
        const v = el?.node.style[d.channel];
        const k = v !== undefined ? kindOf(d.channel, v) : null;
        if (!k || k.kind !== [...d.kinds][0]) { padded = false; break; }
        d.occurrences.push({ variant: combo.key, axisValues: { variant: combo.variant, tone: combo.tone, size: combo.size }, value: k.value });
      }
      if (!padded) {
        stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: [...d.samples][0], reason: 'default-state values not kind-compatible for padding — cannot correlate' });
        continue;
      }
    }
    stateObs.push({
      nodePath: `Button:${d.part}:${d.state}`,
      part: d.part === 'root' ? '' : d.part,
      cssProperty: `${d.channel}-state-${d.state}`,
      kind: [...d.kinds][0] as MintObservation['kind'],
      occurrences: d.occurrences,
    });
  }
  const mintStates = mintTokens('button', stateObs, axes);

  // ------------------------------------------------------------------
  // Phase 2d — pseudo-element parts (S5 evidence) → extension
  // ------------------------------------------------------------------
  const pseudoFindings: Array<{ combo: string; interaction: string; part: string; pseudo: string; deltaVsDefault: StyleMap }> = [];
  for (const c of run1.captures) {
    const flatC = flatten(c.root);
    const flatD = flatten(byKey.get(`${c.combo}__default`)!.root);
    for (let i = 0; i < flatC.length; i++) {
      for (const pe of ['::before', '::after'] as const) {
        const now = flatC[i]?.node.pseudo[pe];
        if (!now) continue;
        const before = flatD[i]?.node.pseudo[pe];
        const delta: StyleMap = {};
        for (const [k, v] of Object.entries(now)) {
          if (!before || before[k] !== v) delta[k] = v;
        }
        if (c.interaction === 'default' || Object.keys(delta).length > 0) {
          pseudoFindings.push({ combo: c.combo, interaction: c.interaction, part: partNames[i] ?? `el@${flatC[i].path}`, pseudo: pe, deltaVsDefault: c.interaction === 'default' ? { content: now.content } : delta });
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Phase 2e — enriched contract (schema-valid) + extension block
  // ------------------------------------------------------------------
  const enriched = structuredClone(contract) as Contract & Record<string, unknown>;
  enriched.description = `${contract.description} COMPUTED-ENRICHED (extract/computed-spike): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium ${run1.browserVersion}; overflow channels in button.enriched.extension.json.`;

  const extension: Record<string, unknown> = {
    _marker: 'NON-SCHEMA EXTENSION BLOCK — computed-capture overflow. Nothing here is contract vocabulary; every entry names why it does not fit (DESIGN.md §5.4).',
    generatedBy: 'extract/computed-spike/run.ts',
    browser: run1.browserVersion,
  };

  const ensurePart = (name: string): Part | null => (name === 'root' ? enriched.anatomy.root : name === 'label' ? enriched.anatomy.root?.parts?.label ?? null : null);
  const enrichmentNotes: string[] = [];
  const perAxisAdditions: Record<string, Array<{ prop: string; map: Record<string, Record<string, string>> }>> = {};
  const overflowBindings: Array<Record<string, unknown>> = [];

  const applyMint = (result: typeof mintBase, obsList: MintObservation[], isState: boolean) => {
    result.bindings.forEach((b, i) => {
      const obs = obsList[i];
      const partName = obs.part === '' ? 'root' : obs.part;
      const stateMatch = isState ? /^(.*)-state-([a-z-]+)$/.exec(obs.cssProperty) : null;
      const channel = stateMatch ? stateMatch[1] : obs.cssProperty;
      const state = stateMatch?.[2];
      if (b.ref === null) {
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), refusal: b.reason });
        return;
      }
      const target = ensurePart(partName);
      if (!target) {
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), ref: b.ref, refusal: 'computed-only part not present in the committed anatomy — adding parts is a curation decision, not a spike decision' });
        return;
      }
      if (state) {
        if (!['hover', 'active', 'focus-visible', 'disabled'].includes(state)) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state outside the schema state vocabulary' });
          return;
        }
        if (partName !== 'root') {
          // v13 Part.states: color-kind channels only
          if (!['color', 'background-color', 'border-color'].includes(channel)) {
            overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'v13 Part.states carries color-kind channels only on non-root parts' });
            return;
          }
        }
        target.states ??= {};
        target.states[state] ??= {};
        if (!(channel in target.states[state])) target.states[state][channel] = b.ref;
        if (!(contract.states as string[]).includes(state) && !(enriched.states as string[]).includes(state)) (enriched.states as string[]).push(state as never);
        return;
      }
      const substAxis = /\{(\w+)\}/.exec(b.ref)?.[1];
      if (!substAxis) {
        target.tokens ??= {};
        if (!(channel in target.tokens)) target.tokens[channel] = b.ref;
        return;
      }
      // per-axis mint → v14 tokensByProp entry with per-value refs.
      // tone's 'none' value = defaultless-unset: its leaf value becomes the
      // BASE token; critical/success ride the map (DESIGN.md S2).
      const groupBase = b.ref.slice(1, -1).replace(`.{${substAxis}}`, '');
      const axis = axes.find((a) => a.propName === substAxis)!;
      const map: Record<string, Record<string, string>> = {};
      for (const v of axis.values) {
        if (substAxis === 'tone' && v === 'none') continue;
        (map[v] ??= {})[channel] = `{${groupBase}.${v}}`;
      }
      if (substAxis === 'tone') {
        target.tokens ??= {};
        if (!(channel in target.tokens)) target.tokens[channel] = `{${groupBase}.none}`;
      }
      (perAxisAdditions[partName] ??= []).push({ prop: substAxis, map });
    });
  };
  applyMint(mintBase, observations, false);
  applyMint(mintStates, stateObs, true);

  // merge per-axis additions as v14 multi-entry tokensByProp (append AFTER
  // existing entries — computed enrichment must not shadow reviewed bindings)
  for (const [partName, additions] of Object.entries(perAxisAdditions)) {
    const target = ensurePart(partName);
    if (!target) continue;
    const existing = Array.isArray(target.tokensByProp) ? target.tokensByProp : target.tokensByProp ? [target.tokensByProp] : [];
    // fold same-prop additions together channel-wise
    const byProp = new Map<string, Record<string, Record<string, string>>>();
    for (const add of additions) {
      const m = byProp.get(add.prop) ?? {};
      for (const [val, channels] of Object.entries(add.map)) Object.assign((m[val] ??= {}), channels);
      byProp.set(add.prop, m);
    }
    for (const [prop, map] of byProp) {
      // v14 refusal rule: two entries may not share BOTH prop and channel —
      // strip channels already mapped under the same prop by a reviewed entry
      for (const e of existing) {
        if (e.prop !== prop) continue;
        const reviewedChannels = new Set(Object.values(e.map).flatMap((m) => Object.keys(m)));
        for (const val of Object.keys(map)) {
          for (const ch of Object.keys(map[val])) {
            if (reviewedChannels.has(ch)) { delete map[val][ch]; enrichmentNotes.push(`tokensByProp conflict avoided: ${partName}.${ch} on prop ${prop} already reviewed — computed value not re-added`); }
          }
          if (Object.keys(map[val]).length === 0) delete map[val];
        }
      }
      if (Object.keys(map).length > 0) existing.push({ prop, map });
    }
    target.tokensByProp = existing as never;
  }

  extension.mintedTokens = { ...mintBase.tree, _states: undefined };
  // one tree with both passes' leaves
  const mergedTree = structuredClone(mintBase.tree) as Record<string, unknown>;
  const mergeInto = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === 'object' && !('$value' in (v as object))) mergeInto((dst[k] ??= {}) as Record<string, unknown>, v as Record<string, unknown>);
      else if (!(k in dst)) dst[k] = v;
    }
  };
  mergeInto(mergedTree, mintStates.tree as Record<string, unknown>);
  extension.mintedTokens = mergedTree;
  extension.codeOnlyChannels = codeOnly;
  extension.stateOverflow = stateCodeOnly;
  extension.overflowBindings = overflowBindings;
  extension.pseudoParts = {
    _reason: 'S5 (DESIGN.md §5.4): pseudo-element decor (the Polaris focus ring rides .Button:focus-visible::after) has no anatomy spelling — captured, receipted, not carried',
    findings: pseudoFindings.slice(0, 12),
    totalFindings: pseudoFindings.length,
  };
  extension.bindingContradictions = boundContradicted;
  extension.geometryChannels = { _reason: 'environment-dependent (font metrics / layout-derived) — captured, excluded from fusion by name (DESIGN.md §3.3)', channels: [...GEOMETRY_CHANNELS].sort() };
  extension.interactionOnDisabled = [...new Set(inertOnDisabled)].slice(0, 20);
  extension.structureReceipts = [...new Set(structureReceipts)];
  extension.enrichmentNotes = enrichmentNotes;

  let schemaValid = true;
  let schemaError = '';
  try {
    ContractSchema.parse(enriched);
  } catch (e) {
    schemaValid = false;
    schemaError = e instanceof Error ? e.message.slice(0, 2000) : String(e);
  }

  // ------------------------------------------------------------------
  // Phase 3 — REPLAY: rebuild every capture from captured truth alone
  // ------------------------------------------------------------------
  console.log('phase 3 — replay page (captured truth applied verbatim)…');
  interface ReplaySpec { key: string; root: CapturedNode }
  const replaySpecs: ReplaySpec[] = run1.captures.map((c) => ({ key: `${c.combo}__${c.interaction}`, root: c.root }));
  const replayHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>
html { color-scheme: light; } body { margin: 0; background: #ddd; }
.stage { display: flex; align-items: flex-start; width: ${STAGE.width}px; height: ${STAGE.height}px; padding: ${STAGE.padding}px; box-sizing: border-box; background: #fff; overflow: hidden; }
</style>
<style id="pseudo"></style>
</head><body>
<script>
const DATA = ${JSON.stringify(replaySpecs)};
const pseudoRules = [];
let uid = 0;
function build(node) {
  const el = document.createElement(node.tag);
  const cls = 'u' + (uid++);
  el.className = cls;
  const EXCLUDE = ${JSON.stringify([...REPLAY_APPLY_EXCLUDE])};
  for (const [p, v] of Object.entries(node.style)) { if (!EXCLUDE.includes(p)) el.style.setProperty(p, v); }
  for (const [pe, style] of Object.entries(node.pseudo)) {
    pseudoRules.push('.' + cls + pe + ' { ' + Object.entries(style).map(([p, v]) => p + ': ' + v.replaceAll(';', '\\\\3b') + ' !important;').join(' ') + ' }');
  }
  for (const child of node.nodes) {
    if (child.t === 'text') el.appendChild(document.createTextNode(child.v));
    else el.appendChild(build(child.el));
  }
  return el;
}
for (const spec of DATA) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.dataset.replay = spec.key;
  stage.appendChild(build(spec.root));
  document.body.appendChild(stage);
}
document.getElementById('pseudo').textContent = pseudoRules.join('\\n');
window.__READY = true;
</script>
</body></html>`;
  const replayPath = path.join(OUT, 'replay.html');
  writeFileSync(replayPath, replayHtml);
  const replayPage = await context.newPage();
  await replayPage.goto(`file://${replayPath}`);
  await replayPage.waitForFunction('window.__READY === true');
  await replayPage.evaluate('document.fonts.ready');
  await replayPage.waitForTimeout(200);

  // computed re-read equality on the replay (vocabulary-independent check)
  const reread = (await replayPage.evaluate(`(() => {
    const DATA = ${JSON.stringify(replaySpecs.map((s) => ({ key: s.key })))};
    const results = [];
    for (const spec of DATA) {
      const stage = document.querySelector('[data-replay="' + spec.key + '"]');
      results.push({ key: spec.key, root: stage.firstElementChild ? readEl(stage.firstElementChild) : null });
    }
    function readEl(el) {
      const cs = getComputedStyle(el);
      const style = {};
      for (const p of ${JSON.stringify(run1.allProps)}) style[p] = cs.getPropertyValue(p);
      return { style, children: [...el.children].map(readEl) };
    }
    return results;
  })()`)) as Array<{ key: string; root: { style: StyleMap; children: unknown[] } | null }>;

  let rereadCompared = 0;
  let rereadMatched = 0;
  const rereadMismatchByProp = new Map<string, number>();
  {
    const flatStyles = (n: { style: StyleMap; children: unknown[] }): StyleMap[] => [n.style, ...(n.children as Array<{ style: StyleMap; children: unknown[] }>).flatMap(flatStyles)];
    for (let i = 0; i < replaySpecs.length; i++) {
      const want = flatten(replaySpecs[i].root).map((e) => e.node.style);
      const got = reread[i].root ? flatStyles(reread[i].root!) : [];
      for (let j = 0; j < Math.min(want.length, got.length); j++) {
        for (const p of run1.allProps) {
          if (REPLAY_APPLY_EXCLUDE.has(p)) continue; // named exclusions (see const doc)
          rereadCompared++;
          if (normalizeValue(got[j][p]) === want[j][p]) rereadMatched++;
          else rereadMismatchByProp.set(p, (rereadMismatchByProp.get(p) ?? 0) + 1);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Phase 4 — pixel like-for-like per combo × state (both operating points)
  // ------------------------------------------------------------------
  console.log('phase 4 — pixel comparison (480 pairs, threshold 0 AND 0.1)…');
  mkdirSync(path.join(OUT, 'replay-shots'), { recursive: true });
  interface PixelRow { key: string; width: number; height: number; diffExact: number; diffAA: number; pctExact: number; pctAA: number; note?: string }
  const pixelRows: PixelRow[] = [];
  for (const spec of replaySpecs) {
    const loc = replayPage.locator(`[data-replay="${spec.key}"]`);
    await loc.scrollIntoViewIfNeeded();
    const shot = await loc.screenshot({ timeout: 10_000 });
    writeFileSync(path.join(OUT, 'replay-shots', `${spec.key}.png`), shot);
    const a = PNG.sync.read(readFileSync(path.join(OUT, 'orig', `${spec.key}.png`)));
    const b = PNG.sync.read(shot);
    if (a.width !== b.width || a.height !== b.height) {
      pixelRows.push({ key: spec.key, width: a.width, height: a.height, diffExact: -1, diffAA: -1, pctExact: 100, pctAA: 100, note: `size mismatch ours ${b.width}x${b.height} vs orig ${a.width}x${a.height}` });
      continue;
    }
    const total = a.width * a.height;
    const diffExact = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0, includeAA: true });
    const diffPng = new PNG({ width: a.width, height: a.height });
    const diffAA = pixelmatch(a.data, b.data, diffPng.data, a.width, a.height, { threshold: 0.1 });
    pixelRows.push({ key: spec.key, width: a.width, height: a.height, diffExact, diffAA, pctExact: (100 * diffExact) / total, pctAA: (100 * diffAA) / total });
  }
  const worst = [...pixelRows].sort((x, y) => y.pctAA - x.pctAA || y.pctExact - x.pctExact).slice(0, 8);
  // receipts: base + one hover + one focus ring pair + the worst pair
  for (const key of [`${BASE_COMBO_KEY}__default`, `primary.none.medium.enabled__hover`, `primary.none.medium.enabled__focus-visible`, worst[0]?.key].filter(Boolean) as string[]) {
    const a = PNG.sync.read(readFileSync(path.join(OUT, 'orig', `${key}.png`)));
    const b = PNG.sync.read(readFileSync(path.join(OUT, 'replay-shots', `${key}.png`)));
    const gap = 12;
    const outPng = new PNG({ width: a.width + b.width + gap, height: Math.max(a.height, b.height) });
    outPng.data.fill(220);
    PNG.bitblt(a, outPng, 0, 0, a.width, a.height, 0, 0);
    PNG.bitblt(b, outPng, 0, 0, b.width, b.height, a.width + gap, 0);
    writeFileSync(path.join(RECEIPTS, `pair--${key}.png`), PNG.sync.write(outPng));
  }

  await browser.close();

  // ------------------------------------------------------------------
  // Committed artifacts
  // ------------------------------------------------------------------
  console.log('writing artifacts…');
  // (a) captured truth — base full, everything else delta over aligned base
  const deltaOf = (el: FlatEl | null, basEl: FlatEl): StyleMap | null => {
    if (!el) return null;
    const d: StyleMap = {};
    for (const p of run1.allProps) if (el.node.style[p] !== basEl.node.style[p]) d[p] = el.node.style[p];
    return d;
  };
  const capturedTruth = {
    _provenance: {
      generatedBy: 'extract/computed-spike/run.ts',
      library: '@shopify/polaris@13.9.5 (npm release of the showcase-pinned SHA lineage — see examples/polaris/extraction/VERSION-PARITY.md)',
      browser: `Chromium ${run1.browserVersion} (playwright-core, headless)`,
      viewport: VIEWPORT,
      deviceScaleFactor: DPR,
      colorScheme: 'light',
      stage: STAGE,
      sampleText: SAMPLE_TEXT,
      channelsEnumerated: run1.allProps.length,
      channels: run1.allProps,
      fontChecks: run1.fontChecks,
      determinism: determinismDetail,
      steadyState: 'transitions left ENABLED (freezing would alter captured transition-* channels); paint channels polled to stability, bounded 600ms',
      interactionDrivers: {
        hover: 'playwright locator.hover({force:true}) — pointer to element center',
        'focus-visible': 'sentinel.focus() + keyboard Tab (keyboard modality; matched state recorded per capture)',
        active: 'hover + mouse.down (held during capture) — honestly hover+active, what a user sees mid-press',
        disabled: 'prop-driven (rides the prop sweep)',
      },
      enumerationPolicy: `full cartesian (${COMBOS.length} = 5 variants × 3 tones incl. unset × 4 sizes × 2 disabled ≤ 512 — DESIGN.md §1.4)`,
    },
    anatomy: baseFlat.map((e) => ({ part: e.partName, path: e.path, signature: e.sig, tag: e.node.tag, classes: e.node.classes })),
    base: { key: `${BASE_COMBO_KEY}__default`, root: base.root },
    controls: run1.controls,
    captures: run1.captures
      .filter((c) => !(c.combo === BASE_COMBO_KEY && c.interaction === 'default'))
      .map((c) => {
        const els = getAligned(`${c.combo}__${c.interaction}`);
        return {
          key: `${c.combo}__${c.interaction}`,
          ...(c.focusVisibleMatched !== undefined ? { focusVisibleMatched: c.focusVisibleMatched } : {}),
          elements: baseFlat.map((b, i) => ({ part: b.partName, delta: deltaOf(els[i], b) })),
          pseudo: Object.fromEntries(
            flatten(c.root).flatMap((e, i) => Object.entries(e.node.pseudo).map(([pe, st]) => [`${partNames[i] ?? e.path}${pe}`, st])),
          ),
        };
      }),
  };
  writeFileSync(path.join(HERE, 'captured-truth.button.json'), JSON.stringify(capturedTruth) + '\n');
  writeFileSync(path.join(HERE, 'button.enriched.contract.json'), JSON.stringify(enriched, null, 2) + '\n');
  writeFileSync(path.join(HERE, 'button.enriched.extension.json'), JSON.stringify(extension, null, 2) + '\n');

  // ledger + numbers
  const mintKinds = { uniform: 0, perAxis: 0, perPair: 0, refused: 0 };
  const countBindings = (r: typeof mintBase) => {
    for (const b of r.bindings) {
      if (b.ref === null) mintKinds.refused++;
      else if (/\{\w+\}\.\{\w+\}/.test(b.ref)) mintKinds.perPair++;
      else if (/\{\w+\}/.test(b.ref.slice(1, -1))) mintKinds.perAxis++;
      else mintKinds.uniform++;
    }
  };
  countBindings(mintBase);
  countBindings(mintStates);

  const agg = (rows: PixelRow[], f: (r: PixelRow) => number) => ({
    mean: rows.reduce((n, r) => n + f(r), 0) / rows.length,
    max: Math.max(...rows.map(f)),
    perfect: rows.filter((r) => f(r) === 0).length,
  });
  const pxExact = agg(pixelRows, (r) => r.pctExact);
  const pxAA = agg(pixelRows, (r) => r.pctAA);

  const numbers = {
    browser: run1.browserVersion,
    captures: run1.captures.length,
    combos: COMBOS.length,
    interactions: INTERACTIONS.length,
    channelsEnumerated: run1.allProps.length,
    elementsPerCapture: baseFlat.length,
    determinism: determinismDetail,
    styledChannels: Object.fromEntries([...styledChannels].map(([k, v]) => [k, v.size])),
    bound: {
      cellsChecked: boundRows.length,
      confirmed: boundConfirmed,
      contradictions: boundContradicted.length,
      contradictionRows: boundContradicted,
    },
    minted: {
      leaves: mintBase.count + mintStates.count,
      baseBindings: mintBase.bindings.length,
      stateBindings: mintStates.bindings.length,
      byShape: mintKinds,
    },
    codeOnly: { base: codeOnly.length, state: stateCodeOnly.length, overflowBindings: overflowBindings.length },
    pseudoElementFindings: pseudoFindings.length,
    enrichedContractSchemaValid: schemaValid,
    ...(schemaValid ? {} : { schemaError }),
    replayComputedEquality: {
      cellsCompared: rereadCompared,
      cellsMatched: rereadMatched,
      pct: (100 * rereadMatched) / rereadCompared,
      namedExclusions: [...REPLAY_APPLY_EXCLUDE],
      topMismatchedChannels: [...rereadMismatchByProp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    },
    pixel: {
      pairs: pixelRows.length,
      exact: pxExact,
      aa: pxAA,
      worst: worst.map((r) => ({ key: r.key, pctExact: r.pctExact, pctAA: r.pctAA, ...(r.note ? { note: r.note } : {}) })),
    },
    focusVisibleDriverMatched: run1.captures.filter((c) => c.interaction === 'focus-visible' && c.focusVisibleMatched).length,
    focusVisibleDriverTotal: run1.captures.filter((c) => c.interaction === 'focus-visible').length,
    runtimeSeconds: Math.round((Date.now() - t0) / 1000),
  };
  writeFileSync(path.join(HERE, 'numbers.json'), JSON.stringify(numbers, null, 2) + '\n');
  writeFileSync(path.join(HERE, 'pixel-rows.json'), JSON.stringify(pixelRows, null, 2) + '\n');

  const fmt = (n: number) => n.toFixed(3);
  const ledger: string[] = [
    '# Delta ledger — computed floor × static layer (Polaris Button)',
    '',
    `Generated by run.ts against @shopify/polaris@13.9.5 in Chromium ${run1.browserVersion}. Regenerate: \`npx tsx extract/computed-spike/run.ts --harness <dir>\`.`,
    '',
    `- captures: **${numbers.captures}** (${COMBOS.length} combos × ${INTERACTIONS.length} interactions), channels enumerated per element: **${numbers.channelsEnumerated}** (the browser's full longhand set — no whitelist)`,
    `- determinism: ${determinismDetail}`,
    `- rendered anatomy: ${baseFlat.map((e) => `**${e.partName}** \`${e.sig}\``).join(' → ')}`,
    '',
    '## Bound (static layer confirmed by computed truth)',
    '',
    `${boundConfirmed}/${boundRows.length} carried-binding cells string-equal to the browser-probed token value (no tolerance).`,
    ...(boundContradicted.length
      ? [
          '',
          `### Binding contradictions (${boundContradicted.length} — the defect class this floor adds; ${untriaged.length} untriaged)`,
          '',
          ...boundContradicted.map(
            (r) =>
              `- \`${r.combo}\` ${r.part}.${r.channel} (${r.computedProp}) ${r.ref}: expected \`${r.expected}\` observed \`${r.observed}\`` +
              (r.cause ? `\n  - NAMED CAUSE: ${r.cause}` : '\n  - **UNTRIAGED** — a defect until triaged'),
          ),
        ]
      : ['', 'Zero contradictions.']),
    '',
    '## Minted (no name recoverable — core/mint-tokens.ts, unchanged)',
    '',
    `- leaves: **${numbers.minted.leaves}** · bindings: ${numbers.minted.baseBindings} base + ${numbers.minted.stateBindings} state`,
    `- shape: ${mintKinds.uniform} uniform · ${mintKinds.perAxis} per-axis · ${mintKinds.perPair} per-axis-pair · ${mintKinds.refused} refused (uncorrelated — nothing minted, named)`,
    '',
    '## Code-only / overflow (named, in button.enriched.extension.json)',
    '',
    `- base channels outside mintable kinds: **${codeOnly.length}**`,
    ...codeOnly.map((c) => `  - ${c.part}.${c.channel} — ${c.reason} (sample: \`${c.sample.slice(0, 90)}\`, ${c.distinctValues} distinct value(s))`),
    `- state channels outside mintable kinds: **${stateCodeOnly.length}**`,
    ...stateCodeOnly.map((c) => `  - [${c.state}] ${c.part}.${c.channel} — ${c.reason} (sample: \`${c.sample.slice(0, 90)}\`)`),
    `- refused/overflow bindings: **${overflowBindings.length}**`,
    ...overflowBindings.slice(0, 40).map((b) => `  - ${JSON.stringify(b)}`),
    '',
    '## Named exclusions',
    '',
    `- geometry channels (environment-dependent, captured but not fused): ${[...GEOMETRY_CHANNELS].sort().join(', ')}`,
    `- \`-webkit-*\` alias longhands: captured, not fused (alias of unprefixed channels)`,
    `- logical-property aliases (${LOGICAL_ALIASES.size}, e.g. border-block-end-width ≡ border-bottom-width under the pinned horizontal-tb/ltr writing mode): captured and replayed, folded out of fusion by name — fusing both spellings would double-count every box channel`,
    `- pseudo-element findings (S5 — no anatomy spelling): **${pseudoFindings.length}** (see extension block)`,
    `- interactions on disabled combos that changed styles: ${new Set(inertOnDisabled).size ? [...new Set(inertOnDisabled)].slice(0, 5).join('; ') : 'none — disabled is inert, verified'}`,
    '',
  ];
  writeFileSync(path.join(HERE, 'LEDGER.md'), ledger.join('\n') + '\n');

  const report: string[] = [
    '# Computed-capture spike — Polaris Button, measured',
    '',
    `One run of \`run.ts\` (${numbers.runtimeSeconds}s): real \`@shopify/polaris@13.9.5\` Button mounted in headless Chromium ${run1.browserVersion}, **${numbers.combos} prop combos** (full variant×tone×size×disabled cartesian) × **${numbers.interactions} interaction states** (default / hover / focus-visible / active, driven the visual-parity way) = **${numbers.captures} captures**; every capture reads **${numbers.channelsEnumerated} computed longhands** (the browser's own enumeration — no whitelist) on **${numbers.elementsPerCapture} elements** plus \`::before\`/\`::after\`.`,
    '',
    '## The numbers (verbatim from numbers.json)',
    '',
    `| metric | value |`,
    `|---|---|`,
    `| determinism (double full sweep) | ${determinismDetail} |`,
    `| focus-visible driver matched \`:focus-visible\` | ${numbers.focusVisibleDriverMatched}/${numbers.focusVisibleDriverTotal} captures |`,
    `| styled channels (vs in-page control probe) | ${Object.entries(numbers.styledChannels).map(([k, v]) => `${k}: ${v}`).join(' · ')} |`,
    `| **bound** — carried-binding cells confirmed | **${boundConfirmed}/${boundRows.length}** (exact string equality, browser-probed token values, no tolerance) |`,
    `| **binding contradictions** | ${boundContradicted.length} — every one with a committed NAMED CAUSE (${untriaged.length} untriaged) — LEDGER.md |`,
    `| **minted** leaves / bindings | ${numbers.minted.leaves} leaves · ${numbers.minted.baseBindings} base + ${numbers.minted.stateBindings} state bindings (${mintKinds.uniform} uniform · ${mintKinds.perAxis} per-axis · ${mintKinds.perPair} per-pair · ${mintKinds.refused} refused) |`,
    `| **code-only** (extension block) | ${codeOnly.length} base + ${stateCodeOnly.length} state channels; ${overflowBindings.length} overflow bindings |`,
    `| pseudo-element findings (focus ring class) | ${pseudoFindings.length} |`,
    `| enriched contract schema-valid | ${schemaValid ? 'YES (ContractSchema.parse)' : `NO — ${schemaError.slice(0, 200)}`} |`,
    `| replay computed equality | ${rereadMatched}/${rereadCompared} cells (${fmt(numbers.replayComputedEquality.pct)}%) |`,
    `| pixel, exact (threshold 0, AA counted) | mean ${fmt(pxExact.mean)}% differing · max ${fmt(pxExact.max)}% · ${pxExact.perfect}/${pixelRows.length} pairs pixel-perfect |`,
    `| pixel, AA point (threshold 0.1, AA excluded) | mean ${fmt(pxAA.mean)}% differing · max ${fmt(pxAA.max)}% · ${pxAA.perfect}/${pixelRows.length} pairs at zero |`,
    '',
    '### Worst pixel rows (named, no tolerance widening)',
    '',
    ...worst.map((r) => `- \`${r.key}\`: exact ${fmt(r.pctExact)}% · AA ${fmt(r.pctAA)}%${r.note ? ` — ${r.note}` : ''}`),
    '',
    '### Top replay-mismatched channels (computed re-read)',
    '',
    ...(numbers.replayComputedEquality.topMismatchedChannels.length
      ? numbers.replayComputedEquality.topMismatchedChannels.map(([p, n]) => `- \`${p}\`: ${n} cells`)
      : ['- none']),
    '',
    `Named re-read exclusions (never silent): ${[...REPLAY_APPLY_EXCLUDE].map((p) => `\`${p}\``).join(', ')} — app-region is unsettable outside app contexts; text-decoration is a shorthand Chromium enumerates whose re-serialization reorders (its longhands are captured, applied, and compared individually).`,
    '',
    '## Findings the sweep surfaced (obstacles are findings)',
    '',
    `- **@media caught as contradictions (S7 evidence)**: a first run at an 800px-wide viewport (past Polaris's 48rem md breakpoint) turned every size binding into a named binding-contradiction receipt — 120 rows: min-height/min-width on all sizes (e.g. micro expected 28px [p.height-700, the base value the contract carries], observed 24px [p.height-600, the md-up override]) plus slim/micro label typography. The committed run pins the sub-md viewport the contracts carry (the verify.ts convention); the receipts prove conditional styling cannot silently pass the floor.`,
    `- **tone × variant multi-axis conditions**: the static promotion REFUSED tone styling by name (\`.toneCritical:is(.variantPrimary)\` — one value conditioned on two axes). The floor observes the resolved per-combo truth: tone contradictions against the variant-only bindings are named, and the mint pass carries the same values as per-axis-pair leaves (${mintKinds.perPair} pair bindings) — the 333-refusal ceiling turns into carried, receipted values.`,
    `- **composition-owned typography receipted precisely**: the showcase named "labels render through the Text primitive" as an honest gap; the floor now MEASURES it — the plain variant's label is bodyMd (13px/20px) not the carried bodySm (12px/16px), and the primary label is fontWeight 650 not the carried 550. Variant-conditioned child-component props, invisible to single-file static promotion, caught as ${boundContradicted.filter((r) => r.part === 'label').length} named contradiction rows.`,
    `- **fusion precedence held**: contradiction rows do NOT auto-override the reviewed static bindings — they are the review queue (the static layer owns names; the floor owns truth). The auto-resolution policy is build-plan work, not a spike decision.`,
    `- **no pseudo-elements on this Button** (${pseudoFindings.length} findings): Polaris 13.9.5 draws the focus ring with \`outline\` on the root, not the \`::after\` pattern — the ::before/::after capture path ran on every element and found content everywhere 'none'. S5 (pseudo decor parts) stays designed-but-unproven on this component.`,
    `- **focus-visible driver**: matched \`:focus-visible\` on ${numbers.focusVisibleDriverMatched}/${numbers.focusVisibleDriverTotal} captures — exactly the ${COMBOS.filter((c) => !c.disabled).length} enabled combos; disabled buttons are not focusable (Tab lands elsewhere; delta zero) — the inertness receipt.`,
    `- **mount-context strut**: the first run's replay drifted 14px vertically because the component's line-box position depended on the stage's inherited font metrics — fixed by a flex mount stage on BOTH sides; inherited context is part of the mount recipe, receipted in provenance (DESIGN.md §1.1/§4).`,
    '',
    'Artifacts: `captured-truth.button.json` (capture + provenance), `button.enriched.contract.json` (+ `.extension.json`), `LEDGER.md`, `numbers.json`, `pixel-rows.json`, sample pairs in `receipts/` (left = original Polaris render, right = replay from captured truth).',
    '',
  ];
  writeFileSync(path.join(HERE, 'REPORT.md'), report.join('\n') + '\n');

  console.log(`\ndone in ${numbers.runtimeSeconds}s`);
  console.log(`  bound ${boundConfirmed}/${boundRows.length} · minted ${numbers.minted.leaves} leaves · code-only ${codeOnly.length + stateCodeOnly.length}`);
  console.log(`  replay computed equality ${fmt(numbers.replayComputedEquality.pct)}% · pixel AA mean ${fmt(pxAA.mean)}% max ${fmt(pxAA.max)}%`);
  console.log(`  schema-valid enriched contract: ${schemaValid}`);
}

await main();
