/**
 * DEPTH-CAPTURE SPIKE — de-risking advanced-component capture on real Polaris.
 * See DEPTH-BUILD.md in this directory for the validated architecture this
 * proves. This file is a STANDALONE spike (mirrors extract/computed-spike/
 * run.ts's stage recipe); it imports NOTHING from extract/computed/** or
 * core/** and edits nothing there.
 *
 *   npx tsx extract/depth-spike/run.ts --harness <dir>
 *
 * harness = npm sandbox OUTSIDE the repo with @shopify/polaris@13.9.5,
 * react@18, react-dom@18, esbuild installed (the examples/polaris/scripts/
 * verify.ts + computed-spike pattern). Network-free at run time; needs the
 * repo's pinned Chromium (playwright-core cache or system Chrome —
 * visual-parity/render.ts discovery convention, copied so the spike has zero
 * repo-module imports for browser discovery).
 *
 * The three mechanics this spike PROVES (ADVANCED-PROBE.md N1–N7):
 *   M1  WHOLE-DOCUMENT, PORTAL-AWARE CAPTURE (N1, N7). Mount with the
 *       open/active prop driven; capture what the component ADDS to the whole
 *       document (post-mount DOM minus a pre-mount baseline minus harness
 *       chrome) — so portaled content in document.body is captured wherever
 *       React sends it. One clean mount per component (no overlay stacking).
 *   M2  ROOT-DESCENDING, MULTI-ROOT ANATOMY (N3). Normalize THROUGH
 *       transparent wrappers (display:contents passthroughs, single-child
 *       structural divs with no own box, Fragments) to the component's REAL
 *       root(s); support multi-root (a Fragment renders several top nodes).
 *   M3  SAMPLE-DATA COMPOSITION → repeat + component-ref (N2, N5, N6). The
 *       mount recipe gains a sample-data channel (representative items + a
 *       renderItem that renders ResourceItem); the anatomy reader detects the
 *       repeated ResourceItem subtree as a REPEAT part and recognizes
 *       ResourceItem as a composed child → a component-ref to its own
 *       contract. Emits the EXISTING schema vocabulary (repeat={itemsProp,
 *       sample}, component={id}).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';

// ---------------------------------------------------------------------------
// Args + environment
// ---------------------------------------------------------------------------
const harnessArg = process.argv.indexOf('--harness');
const HARNESS = harnessArg > -1 ? path.resolve(process.argv[harnessArg + 1]) : null;
if (!HARNESS || !existsSync(path.join(HARNESS, 'node_modules', '@shopify', 'polaris'))) {
  console.error('need --harness <dir> with @shopify/polaris@13.9.5, react@18, react-dom@18, esbuild installed');
  process.exit(1);
}
const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const OUT = path.join(HERE, 'receipts');

const STAGE = { width: 320, height: 96, padding: 16 }; // mirrors capture.ts's stage
const VIEWPORT = { width: 900, height: 1000 }; // large enough for an open overlay

/** The four advanced components (ADVANCED-PROBE.md), each driven to its
 *  content-bearing state. modal/popover exercise M1 (portal); resourcelist
 *  exercises M3 (sample-data repeat); indextable exercises M2's Fragment
 *  multi-root + is the M4 forward-to-base characterization subject. */
const SPEC_KEYS = ['modal', 'popover', 'resourcelist', 'indextable'] as const;
type SpecKey = (typeof SPEC_KEYS)[number];

// ---------------------------------------------------------------------------
// Chromium discovery (visual-parity/render.ts convention, copied)
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
// Captured node model (a lighter cousin of computed/lib.ts's CapturedNode —
// the spike carries a focused style subset, enough to prove real DOM + drive
// the transparent-wrapper test; productionization reuses the full read).
// ---------------------------------------------------------------------------
interface DepthNode {
  tag: string;
  classes: string[];
  role: string | null;
  ariaModal: string | null;
  /** direct text runs of THIS element, trimmed. */
  text: string;
  style: Record<string, string>;
  children: DepthNode[];
}

interface CapturedRoot {
  /** 'in-stage' = React rendered it inside the mount stage; 'portaled' =
   *  React sent it elsewhere in document.body (a portal escape). */
  location: 'in-stage' | 'portaled';
  /** outerHTML byte length (the portal-DOM-bytes receipt). */
  bytes: number;
  node: DepthNode;
}

interface CaptureResult {
  preBytes: number;
  postBytes: number;
  /** what the CURRENT floor reader (capture.ts: stage.firstElementChild) sees. */
  currentReader: { present: boolean; sig: string; descendantEls: number };
  roots: CapturedRoot[];
}

// ---------------------------------------------------------------------------
// Phase 1: harness page — two-phase mount (baseline → spec) so the diff is
// exactly the component's DOM contribution, wherever React puts it.
// ---------------------------------------------------------------------------
function buildHarnessPage(): string {
  const stageJs = `{ display:'flex', alignItems:'flex-start', width:${STAGE.width}, height:${STAGE.height}, padding:${STAGE.padding}, boxSizing:'border-box', background:'#fff', overflow:'hidden' }`;
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  AppProvider, Modal, Popover, ActionList, ResourceList, ResourceItem,
  IndexTable, Text, Avatar, Button,
} from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

// M3 sample-data channel: representative records + a renderItem. THREE items
// clears the proposer's ≥3-adjacent repeat-run threshold (repeatRunAt).
const RL_ITEMS = [
  { id: '1', name: 'Ada Grace', url: '#' },
  { id: '2', name: 'Grace Hopper', url: '#' },
  { id: '3', name: 'Edith Clarke', url: '#' },
];

const SPECS = {
  // M1: open-driven, fully portaled overlay with real header/body/footer/close.
  modal: () => (
    <Modal open title="Order details" onClose={() => {}}
      primaryAction={{ content: 'Save', onAction: () => {} }}
      secondaryActions={[{ content: 'Cancel', onAction: () => {} }]}>
      <Modal.Section><Text as="p">Body copy inside a sectioned modal.</Text></Modal.Section>
    </Modal>
  ),
  // M1: active-driven overlay pane portaled away from the activator.
  popover: () => (
    <Popover active activator={<Button>More actions</Button>} onClose={() => {}}>
      <ActionList items={[{ content: 'Import' }, { content: 'Export' }]} />
    </Popover>
  ),
  // M3: sample-data → repeated ResourceItem subtree (component-ref template).
  resourcelist: () => (
    <ResourceList resourceName={{ singular: 'customer', plural: 'customers' }}
      items={RL_ITEMS}
      renderItem={(it) => (
        <ResourceItem id={it.id} url={it.url} media={<Avatar customer size="md" name={it.name} />} accessibilityLabel={\`View \${it.name}\`}>
          <Text as="h3" fontWeight="bold">{it.name}</Text>
        </ResourceItem>
      )} />
  ),
  // M2: the public export is a Fragment (multi-root) wrapping IndexProvider →
  // IndexTableBase (the N4 forward-to-base subject; rendered live here).
  indextable: () => (
    <IndexTable resourceName={{ singular: 'order', plural: 'orders' }}
      itemCount={2} selectedItemsCount={1} onSelectionChange={() => {}}
      headings={[{ title: 'Order' }, { title: 'Total' }]}>
      <IndexTable.Row id="1" position={0} selected>
        <IndexTable.Cell><Text as="span">#1001</Text></IndexTable.Cell>
        <IndexTable.Cell>$99</IndexTable.Cell>
      </IndexTable.Row>
      <IndexTable.Row id="2" position={1}>
        <IndexTable.Cell><Text as="span">#1002</Text></IndexTable.Cell>
        <IndexTable.Cell>$120</IndexTable.Cell>
      </IndexTable.Row>
    </IndexTable>
  ),
};

const stageStyle = ${stageJs};
let current = null;
let root = null;
function render() {
  root.render(
    <AppProvider i18n={en}>
      <div id="depth-stage" style={stageStyle}>{current ? SPECS[current]() : null}</div>
    </AppProvider>
  );
}
window.__setSpec = (k) => { current = k; render(); };
root = createRoot(document.getElementById('root'));
window.__setSpec(null);
`;
  const pageDir = path.join(HARNESS!, 'depth-spike-page');
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, 'entry.jsx'), entry);
  execFileSync(
    path.join(HARNESS!, 'node_modules', '.bin', 'esbuild'),
    [
      'depth-spike-page/entry.jsx',
      '--bundle',
      '--outfile=depth-spike-page/bundle.js',
      '--jsx=automatic',
      '--loader:.json=json',
      '--loader:.svg=dataurl',
      '--loader:.png=dataurl',
      '--log-level=error',
    ],
    { cwd: HARNESS! },
  );
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="bundle.css">
<style>html { color-scheme: light; } body { margin: 0; background: #ddd; }</style>
</head><body><div id="root"></div>
<script>document.addEventListener('click', (e) => e.preventDefault(), true);</script>
<script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, 'index.html');
}

// ---------------------------------------------------------------------------
// M1 IN-PAGE CAPTURE — the whole-document, portal-aware read.
// baseline = the element set present with the stage EMPTY (AppProvider chrome
// + stage div). After mounting the spec, every element NOT in the baseline
// whose parent IS in the baseline is a NEW ROOT the component added — captured
// wherever React put it (in-stage OR portaled to document.body).
// ---------------------------------------------------------------------------
const STYLE_PROPS = [
  'display', 'position', 'background-color', 'border-top-width', 'border-bottom-width',
  'box-shadow', 'color', 'z-index', 'opacity', 'width', 'height', 'padding-top',
];
const markBaselineJs = `(() => {
  window.__depthBaseline = new Set(document.querySelectorAll('*'));
  window.__preBytes = document.body.innerHTML.length;
  return window.__depthBaseline.size;
})()`;

const captureJs = `(() => {
  const baseline = window.__depthBaseline;
  const stage = document.getElementById('depth-stage');
  const STYLE_PROPS = ${JSON.stringify(STYLE_PROPS)};
  const readEl = (el) => {
    const cs = getComputedStyle(el);
    const style = {};
    for (const p of STYLE_PROPS) style[p] = cs.getPropertyValue(p);
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    return {
      tag: el.tagName.toLowerCase(),
      classes: [...el.classList],
      role: el.getAttribute('role'),
      ariaModal: el.getAttribute('aria-modal'),
      text,
      style,
      children: [...el.children].map(readEl),
    };
  };
  const all = [...document.querySelectorAll('*')];
  const newRoots = all.filter((el) => !baseline.has(el) && (!el.parentElement || baseline.has(el.parentElement)));
  // what capture.ts's reader (stage.firstElementChild) sees today:
  const cur = stage && stage.firstElementChild;
  const currentReader = cur
    ? { present: true, sig: cur.tagName.toLowerCase() + '|' + [...cur.classList].filter((c) => !c.includes('--')).map((c) => c.replace(/^Polaris-/, '')).join('.'), descendantEls: cur.querySelectorAll('*').length }
    : { present: false, sig: '', descendantEls: 0 };
  return {
    preBytes: window.__preBytes,
    postBytes: document.body.innerHTML.length,
    currentReader,
    roots: newRoots.map((el) => ({
      location: stage && stage.contains(el) ? 'in-stage' : 'portaled',
      bytes: el.outerHTML.length,
      node: readEl(el),
    })),
  };
})()`;

async function captureSpec(page: Page, key: SpecKey): Promise<CaptureResult> {
  await page.evaluate(`window.__setSpec(null)`);
  await page.waitForTimeout(150);
  await page.evaluate(markBaselineJs);
  await page.evaluate(`window.__setSpec(${JSON.stringify(key)})`);
  // settle: portal + measure passes
  await page.waitForTimeout(700);
  const res = (await page.evaluate(captureJs)) as CaptureResult;
  await page.evaluate(`window.__setSpec(null)`); // clean state — no overlay stacking
  await page.waitForTimeout(120);
  return res;
}

// ---------------------------------------------------------------------------
// M2 ROOT-DESCENDING, MULTI-ROOT ANATOMY (pure — the productionizable core).
// ---------------------------------------------------------------------------
const PREFIX = 'Polaris-';
export const stemsOf = (classes: string[]): string[] =>
  classes.filter((c) => !c.includes('--')).map((c) => (c.startsWith(PREFIX) ? c.slice(PREFIX.length) : c)).sort();
export const sigOf = (n: DepthNode): string => `${n.tag}|${stemsOf(n.classes).join('.')}`;

/** A node draws NO box of its own: transparent background, no border, no
 *  shadow. (Geometry/padding are ignored — a box-less positioning div still
 *  reserves space but carries no anatomy.) */
export function isBoxless(n: DepthNode): boolean {
  const s = n.style;
  const bgTransparent = !s['background-color'] || s['background-color'] === 'rgba(0, 0, 0, 0)' || s['background-color'] === 'transparent';
  const noBorder = (s['border-top-width'] === '0px' || !s['border-top-width']) && (s['border-bottom-width'] === '0px' || !s['border-bottom-width']);
  const noShadow = !s['box-shadow'] || s['box-shadow'] === 'none';
  return bgTransparent && noBorder && noShadow;
}
const isThemeContainer = (n: DepthNode): boolean => n.classes.some((c) => /theme/i.test(c));

/** A node is a TRANSPARENT PASSTHROUGH iff it contributes no anatomy of its
 *  own: display:contents (box-less), OR a single-element-child wrapper with no
 *  own text, no ARIA role, and no own box. Descending through these reaches
 *  the component's REAL root — the fix for N3 (Provider/wrapper/Fragment roots
 *  carrying zero anatomy). */
export function isTransparentPassthrough(n: DepthNode): boolean {
  if (n.style.display === 'contents') return true;
  if (n.children.length !== 1 || n.text.length > 0 || n.role) return false;
  return isBoxless(n);
}

/** Normalize a node THROUGH transparent wrappers to its real root(s), WITHOUT
 *  recursing into kept nodes' descendants (their raw children are preserved so
 *  repeat detection sees stable sibling signatures). Unwraps, in order:
 *    · display:contents (Fragment / passthrough)  → its children (multi-root);
 *    · box-less theme/anon container with children → its children (multi-root:
 *      the Modal portal renders {dialog, backdrop} under one ThemeProvider
 *      div; a Fragment/theme container with several children is several real
 *      roots — real, not an error);
 *    · single-child box-less passthrough           → its child.
 *  A node with its own box, ARIA role, text, or a real class-stem is KEPT with
 *  its raw children intact (the dialog, the list, the activator, the overlay). */
export function realRootsOf(n: DepthNode): DepthNode[] {
  if (n.style.display === 'contents') return n.children.flatMap(realRootsOf);
  if (n.text.length > 0 || n.role) return [n];
  const boxless = isBoxless(n);
  if (boxless && n.children.length >= 1 && (stemsOf(n.classes).length === 0 || isThemeContainer(n))) {
    return n.children.flatMap(realRootsOf); // anon/theme wrapper → unwrap (multi-root)
  }
  if (boxless && n.children.length === 1) return realRootsOf(n.children[0]); // single-child passthrough
  return [n];
}

/** Descend a captured new-root to its real root(s) (M2). */
export function descendToRealRoots(n: DepthNode): DepthNode[] {
  return realRootsOf(n);
}

// ---------------------------------------------------------------------------
// M3 REPEAT + COMPONENT-REF detection over the anatomy tree.
// ---------------------------------------------------------------------------
/** Known Polaris component class stems → the contract id a captured instance
 *  would link to (session-linking by componentSetKey in production; by stem
 *  here — the spike proves the SHAPE, not the key index). */
const COMPONENT_REF_BY_STEM: Record<string, string> = {
  ResourceItem: 'ds.resource-item',
  Avatar: 'ds.avatar',
};
const componentRefFor = (n: DepthNode): string | undefined => {
  // match the BEM BLOCK (the component name before '__element'): a captured
  // <li class="Polaris-ResourceItem__ListItem"> links to the ResourceItem
  // contract (session-linking by componentSetKey in production; by stem here).
  for (const c of stemsOf(n.classes)) {
    const block = c.split('__')[0];
    if (COMPONENT_REF_BY_STEM[block]) return COMPONENT_REF_BY_STEM[block];
  }
  return undefined;
};

interface AnatomyPart {
  name: string;
  sig: string;
  role: string | null;
  text: string;
  /** set on a collapsed repeat part. */
  repeat?: { count: number; sig: string; componentRef?: string };
  parts: AnatomyPart[];
}

const ROLE_RULES: Array<[RegExp, string]> = [
  [/Modal-CloseButton/, 'closeButton'],
  [/Modal-Header/, 'header'],
  [/Modal-Footer/, 'footer'],
  [/Modal-Body/, 'body'],
  [/Modal-Section/, 'section'],
  [/Modal-Dialog/, 'dialog'],
  [/Backdrop/, 'backdrop'],
  [/Popover-Pane/, 'pane'],
  [/Popover-Wrapper|Popover-PopoverOverlay|Popover-Content/, 'overlay'],
  [/ActionList/, 'actionList'],
  [/ResourceList-ResourceListWrapper|ResourceList$/, 'listWrapper'],
  [/IndexTable-Table|IndexTable$/, 'table'],
];
function namePartNode(n: DepthNode): string {
  if (n.role === 'dialog' || n.ariaModal === 'true') return 'dialog';
  for (const [re, name] of ROLE_RULES) if (n.classes.some((c) => re.test(c))) return name;
  if (/^h[1-6]$/.test(n.tag)) return 'title';
  if (n.tag === 'ul' || n.tag === 'ol') return 'list';
  if (n.tag === 'button') return 'button';
  if (n.tag === 'svg') return 'icon';
  if (n.tag === 'thead') return 'head';
  if (n.tag === 'tbody') return 'rows';
  if (n.text.length > 0) return 'label';
  const stem = stemsOf(n.classes).find((s) => !/^[a-z]/.test(s)) ?? stemsOf(n.classes)[0];
  return stem ? stem.replace(/^[A-Za-z]+-/, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase() || n.tag : n.tag;
}

/** Build the anatomy tree, collapsing repeated homogeneous sibling runs
 *  (≥3 same-signature element children) into a single repeat part. */
export function buildAnatomy(root: DepthNode): AnatomyPart {
  const seen = new Map<string, number>();
  const uniqueName = (base: string): string => {
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n > 0 ? `${base}-${n + 1}` : base;
  };
  const build = (n: DepthNode): AnatomyPart => {
    const part: AnatomyPart = { name: uniqueName(namePartNode(n)), sig: sigOf(n), role: n.role, text: n.text, parts: [] };
    // Repeat detection runs on the RAW children by RAW signature — the
    // wrapper class (li.ResourceItem__ListItem) is identical across siblings
    // even when a divider border-top makes later items non-box-less, so the
    // run stays homogeneous. Passthrough collapse is applied ONLY to
    // non-repeated singletons (the repeat wrapper IS the component boundary).
    const bySig = new Map<string, DepthNode[]>();
    for (const c of n.children) (bySig.get(sigOf(c)) ?? bySig.set(sigOf(c), []).get(sigOf(c))!).push(c);
    const consumed = new Set<DepthNode>();
    for (const c of n.children) {
      if (consumed.has(c)) continue;
      const group = bySig.get(sigOf(c))!;
      // ≥3 adjacent homogeneous siblings = a repeat run (the design-side
      // proposer's repeatRunAt threshold, mirrored on capture; ≥3 avoids
      // collapsing an action-button PAIR into a false repeat).
      if (group.length >= 3) {
        for (const g of group) consumed.add(g);
        const template = build(group[0]);
        template.repeat = { count: group.length, sig: sigOf(group[0]), componentRef: componentRefFor(group[0]) };
        part.parts.push(template);
      } else {
        // singleton: collapse transparent wrappers, then build each real node.
        for (const real of realRootsOf(c)) part.parts.push(build(real));
      }
    }
    return part;
  };
  return build(root);
}

export function partCount(p: AnatomyPart): number {
  return 1 + p.parts.reduce((n, c) => n + partCount(c), 0);
}
export function treeDepth(p: AnatomyPart): number {
  return p.parts.length === 0 ? 1 : 1 + Math.max(...p.parts.map(treeDepth));
}
function findRepeat(p: AnatomyPart): AnatomyPart | null {
  if (p.repeat) return p;
  for (const c of p.parts) {
    const r = findRepeat(c);
    if (r) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  console.log('phase 1 — building harness page (esbuild over @shopify/polaris)…');
  const pageHtml = buildHarnessPage();

  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));
  await page.goto(`file://${pageHtml}`, { waitUntil: 'networkidle' });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(300);
  console.log(`  browser ${browser.version()}`);

  const summary: Record<string, unknown> = {
    generatedBy: 'extract/depth-spike/run.ts',
    browser: browser.version(),
    stage: STAGE,
    specs: {},
  };
  const specSummaries = summary.specs as Record<string, unknown>;

  for (const key of SPEC_KEYS) {
    console.log(`\n=== ${key} ===`);
    const cap = await captureSpec(page, key);
    writeFileSync(path.join(OUT, `capture.${key}.json`), JSON.stringify(cap, null, 2));

    // M1 numbers
    const portaled = cap.roots.filter((r) => r.location === 'portaled');
    const inStage = cap.roots.filter((r) => r.location === 'in-stage');
    const portalBytes = portaled.reduce((n, r) => n + r.bytes, 0);
    console.log(`  M1 portal-aware capture: ${cap.roots.length} new root(s) — ${inStage.length} in-stage, ${portaled.length} portaled; portal DOM = ${portalBytes} bytes`);
    console.log(`     current floor reader (stage.firstElementChild): present=${cap.currentReader.present} sig="${cap.currentReader.sig}" descendantEls=${cap.currentReader.descendantEls}`);

    // M2 numbers — descend every new root to its real root(s), build anatomy
    const realRoots = cap.roots.flatMap((r) => descendToRealRoots(r.node));
    const anatomies = realRoots.map(buildAnatomy);
    const totalParts = anatomies.reduce((n, a) => n + partCount(a), 0);
    const maxDepth = anatomies.length ? Math.max(...anatomies.map(treeDepth)) : 0;
    console.log(`  M2 root-descending anatomy: ${realRoots.length} real root(s) after wrapper normalization; ${totalParts} parts, max depth ${maxDepth}`);
    console.log(`     real-root signatures: ${realRoots.map(sigOf).join('  |  ')}`);

    // M3 numbers — repeat detection
    const repeat = anatomies.map(findRepeat).find((r) => r) ?? null;
    if (repeat && repeat.repeat) {
      console.log(`  M3 repeat: detected ${repeat.repeat.count}× "${repeat.repeat.sig}"${repeat.repeat.componentRef ? ` → component-ref ${repeat.repeat.componentRef}` : ''}`);
    } else {
      console.log(`  M3 repeat: none detected`);
    }

    writeFileSync(path.join(OUT, `anatomy.${key}.json`), JSON.stringify(anatomies, null, 2));

    specSummaries[key] = {
      m1: {
        newRoots: cap.roots.length,
        inStage: inStage.length,
        portaled: portaled.length,
        portalBytes,
        currentReader: cap.currentReader,
      },
      m2: {
        realRoots: realRoots.length,
        realRootSignatures: realRoots.map(sigOf),
        parts: totalParts,
        maxDepth,
      },
      m3: repeat && repeat.repeat
        ? { count: repeat.repeat.count, sig: repeat.repeat.sig, componentRef: repeat.repeat.componentRef ?? null }
        : null,
    };
  }

  summary.consoleErrors = [...new Set(consoleErrors)].slice(0, 20);
  writeFileSync(path.join(OUT, 'numbers.json'), JSON.stringify(summary, null, 2));
  console.log(`\nreceipts written to ${OUT}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
