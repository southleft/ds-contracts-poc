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
 *                 A designer's INTERACTION-STATE axis (docs/23 §D.41) is not a
 *                 prop: its values are read by the same closed table the
 *                 proposer projects by (core/interaction-state-axis.ts) and a
 *                 state cell is mounted the way a user reaches that state — a
 *                 real pointer hover, a held mouse button, real keyboard-
 *                 modality focus, or the `disabled` prop — before it is
 *                 screenshotted. Nothing is forced that a user could not do: a
 *                 state that cannot be reached, or that changes nothing the
 *                 contract says it changes, is a NAMED problem.
 *   4. behave   — replace the TEXT-bound prop at runtime and assert the DOM
 *                 text changes in every text-bearing cell; switch every
 *                 variant-bearing cell to another variant and assert its
 *                 rendered subtree paint, text or relative geometry changes. A prop the component accepts
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
 * --keep-built-consumer retains the isolated production build in out/review-site
 * for visible browser inspection; it does not change the comparison or score.
 */
import { packageReactLibrary } from './package-react-library.js';
import { sourceEquivalentTransitions } from './design-consumer-variants.js';
import { alignRecordedFrames, enclosingFrame, figmaFramesFromSnapshots, imageSha256, FIGMA_REST_FULL_BOUNDS, type ConsumerFrame, type FigmaFrame } from './design-consumer-framing.js';
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
import { readStateAxes, type InteractionState } from '../core/interaction-state-axis.js';
import { contractDependencyEdges } from './contract-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_LIMIT_PERCENT = 5; // the existing antialias-tolerant limit (docs/CURRENT.md)
const SIZE_SLACK_PX = 2; // antialias slack on trimmed content bounds, never a fidelity allowance
/** Figma exports node alpha, excluding the editor page. Match that substrate
 *  without changing the component or the page retained for visible review. */
export const NODE_SCREENSHOT_OPTIONS = {
  omitBackground: true,
  style: 'html, body { background: transparent !important; }',
};
/** What an OVER-LIMIT row's second number says. It names, it never excuses: the
 *  verdict stays `withinLimit: false` and the check stays red. `text-only` = with
 *  the render's text boxes painted out on both sides the rest is within the same
 *  limit, so what is wrong is inside the glyph boxes (rasteriser, metrics, or the
 *  text itself). `beyond-text` = something outside the glyphs is wrong too.
 *  `text-covers-canvas` = the mask left nothing to measure; no claim is made. */
export type ResidualClass = 'text-only' | 'beyond-text' | 'text-covers-canvas' | 'no-text';
/** Rewrite the operator's work directory to `.` in a proposer report — WHOLE path
 *  occurrences only: each spelling (the absolute directory, and its relative form,
 *  longest first — the absolute directory is itself a substring of the relative one)
 *  is replaced only where a path STARTS (line start, whitespace, a bracket, a quote,
 *  a list comma or `=`) and only when `/` follows. A bare substring ("out" inside
 *  "layout") is never touched. */
export function rewriteWorkPaths(text: string, absoluteDir: string, relativeDir: string): string {
  const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const spelling of [relativeDir, absoluteDir].filter((x) => x && x !== '.').sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(`(^|[\\s(\\[\`'",=])${escape(spelling)}/`, 'gm'), '$1./');
  }
  return text;
}

export function residualClass(maskedPct: number | null, maskCoveragePct: number): ResidualClass {
  if (maskedPct === null) return 'text-covers-canvas';
  if (!(maskCoveragePct > 0)) return 'no-text';
  return maskedPct <= IMAGE_LIMIT_PERCENT ? 'text-only' : 'beyond-text';
}

type Args = { dump: string; contract: string; generated: string; component: string; out: string; token?: string; keepBuiltConsumer?: boolean };
function parseArgs(argv: string[]): Args {
  const read = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const required = (flag: string) => { const v = read(flag); if (!v) throw new Error(`design:consumer:check — ${flag} is required`); return v; };
  return { dump: required('--dump'), contract: required('--contract'), generated: required('--generated'), component: required('--component'),
    out: required('--out'), keepBuiltConsumer: argv.includes('--keep-built-consumer'), token: read('--token') ?? (process.env.FIGMA_TOKEN || undefined) };
}

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const run = (cmd: string, args: string[], cwd: string) => {
  try { return execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'FIGMA_TOKEN')), npm_config_update_notifier: 'false' } }); }
  catch (error: any) { throw new Error(`${path.basename(cmd)} ${args.slice(0, 2).join(' ')} failed: ${String(error.stdout ?? '').trim().split('\n').slice(0, 3).join(' | ')} ${String(error.stderr ?? '').trim().split('\n').slice(0, 3).join(' | ')}`); }
};

/** How a state cell is reached before its screenshot. `none` = the rest state
 *  (and `disabled`, which is a prop, not an interaction). */
export type Interaction = 'none' | Exclude<InteractionState, 'default' | 'disabled'>;
interface Case { key: string; nodeId: string; figmaName: string; props: Record<string, unknown>; hasText: boolean; textProp?: string;
  interaction: Interaction; /** the contract state this cell draws, when it draws one */ state?: Exclude<InteractionState, 'default'> }

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

/** A VARIANT axis may back a BOOLEAN prop (`rounded=false`). Its mapping keys
 *  are strings; passing "false" to a boolean prop is truthy and mounts the
 *  wrong variant, so the key is typed by the prop it feeds. */
export function variantPropValue(prop: { type?: unknown }, key: string): unknown {
  return prop.type === 'boolean' && (key === 'true' || key === 'false') ? key === 'true' : key;
}
const variantValues = (prop: any): unknown[] =>
  prop.type === 'boolean' ? Object.keys(prop.bindings?.figma?.values ?? {}).map(key => variantPropValue(prop, key)) : prop.type?.enum ?? [];

/** The dump set this run mounts: the key or set name `--component` names, else
 *  the set whose `nodeId` is the contract's own Figma anchor — so a set whose
 *  name has a space (`Checkbox Group` → generated `CheckboxGroup`) needs no
 *  alias key, and a closure dump holding several sets is never guessed from.
 *  When the contract carries an anchor node id and the set found by key or
 *  name has a DIFFERENT node id, it refuses by name (review M2: a closure dump
 *  holds `Checkbox` beside `Checkbox Group`, and `--component Checkbox` with
 *  the group's contract must not mount the child's variants). */
export function findDumpSet(dump: any, contract: any, component: string): any {
  const isSet = (v: any) => v && typeof v === 'object' && Array.isArray(v.variants);
  const anchor = contract?.bindings?.figma?.anchors?.nodeId;
  const byName = isSet(dump[component]) ? dump[component] : Object.values(dump).find((v: any) => isSet(v) && v.setName === component);
  if (byName) {
    if (typeof anchor === 'string' && typeof byName.nodeId === 'string' && byName.nodeId !== anchor) {
      throw new Error(`design:consumer:check — dump-set-anchor-mismatch:${component}: the dump set "${byName.setName ?? component}" is node ${byName.nodeId} but the contract is anchored to ${anchor}; refusing to mount one set's variants against another's contract`);
    }
    return byName;
  }
  return typeof anchor === 'string' ? Object.values(dump).find((v: any) => isSet(v) && v.nodeId === anchor) : undefined;
}

/** Every contract id the mounted contract depends on, transitively through
 *  the contracts beside it, by the generator's own edges
 *  (`contractDependencyEdges`: component refs, slot `accepts`, slot
 *  `defaultContent`), with the generated folder each resolves to (`null` = no
 *  contract in the folder claims the id). */
export function contractGraph(root: any, siblings: any[]): Array<{ id: string; name: string | null; stub: boolean }> {
  const byId = new Map(siblings.filter(c => typeof c?.id === 'string').map(c => [c.id, c]));
  const refs = (c: any): string[] => { try { return contractDependencyEdges(c).map(e => e.id); } catch { return []; } };
  const seen = new Map<string, { id: string; name: string | null; stub: boolean }>();
  const queue = refs(root);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || id === root?.id) continue;
    const c = byId.get(id);
    seen.set(id, { id, name: typeof c?.name === 'string' ? c.name : null, stub: c?.__stub === true });
    if (c) queue.push(...refs(c));
  }
  return [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Interactive content nested inside interactive content (HTML's content
 *  model forbids it: a <button> inside a <button> is invalid, and the inner
 *  control is a spurious tab stop / swallowed click). Runs in the page; one
 *  entry per cell and parent>child pair. Review H1 (docs/23 §D.43): the real
 *  Tab Panel rendered as a <button> around Button's <button>. */
/** HTML's rule: an `a` or `button` (and a widget role that stands in for one)
 *  may contain no interactive content and no element with a `tabindex`. A
 *  `label` around its own control, `details`/`summary` are NOT flagged. */
export const INTERACTIVE_OUTER = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="radio"]';
export const INTERACTIVE_INNER = 'a[href], button, input:not([type="hidden"]), select, textarea, iframe, embed, [tabindex], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], [contenteditable=""], [contenteditable="true"]';
export const nestedInteractiveScript = `(() => {
  const OUTER = ${JSON.stringify(INTERACTIVE_OUTER)}, INNER = ${JSON.stringify(INTERACTIVE_INNER)};
  const spell = (el) => el.tagName.toLowerCase() + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '');
  const out = [];
  for (const cell of document.querySelectorAll('[data-cell]')) {
    const pairs = new Set();
    for (const el of cell.querySelectorAll(INNER)) {
      const outer = el.parentElement && el.parentElement.closest(OUTER);
      if (outer && cell.contains(outer)) pairs.add(spell(outer) + '>' + spell(el));
    }
    for (const p of [...pairs].sort()) out.push(cell.getAttribute('data-cell') + ':' + p);
  }
  return out;
})()`;

export function deriveCases(dump: any, contract: any, component: string): Case[] {
  const set = findDumpSet(dump, contract, component);
  if (!set || !Array.isArray(set.variants)) throw new Error(`design:consumer:check — dump has no component set "${component}" (by key, set name or the contract's anchor node id)`);
  const variantProps = (contract.props as any[]).filter(p => p.bindings?.figma?.kind === 'VARIANT');
  const textProp = (contract.props as any[]).find(p => p.bindings?.figma?.kind === 'TEXT' && p.type === 'text');
  const samples = arraySamples(contract);
  // The set's variant axes the contract does NOT bind as VARIANT props, read
  // by the proposer's own closed table: at most one may be the interaction-
  // state axis (two refuse there, and are unmapped here).
  const segmentsOf = (name: unknown) => String(name).split(',').map((s: string) => s.trim()).flatMap((segment: string) => { const eq = segment.indexOf('='); return eq <= 0 ? [] : [[segment.slice(0, eq), segment.slice(eq + 1)] as const]; });
  const unbound = new Map<string, string[]>();
  for (const variant of set.variants) for (const [property, value] of segmentsOf(variant.name)) {
    if (variantProps.some(p => p.bindings.figma.property === property)) continue;
    const values = unbound.get(property) ?? []; if (!values.includes(value)) values.push(value); unbound.set(property, values);
  }
  const reading = readStateAxes([...unbound].map(([property, values]) => ({ property, values })));
  const stateAxis = reading.kind === 'projected' ? reading.projection : null;
  const disabledProp = (contract.props as any[]).find(p => p.name === 'disabled' && p.type === 'boolean');
  const cases: Case[] = set.variants.map((variant: any) => {
    const props: Record<string, unknown> = { ...samples };
    let interaction: Interaction = 'none', state: Case['state'];
    for (const [property, value] of segmentsOf(variant.name)) {
      const prop = variantProps.find(p => p.bindings.figma.property === property);
      if (!prop && stateAxis?.property === property) {
        const projected = stateAxis.values.find(v => v.value === value)!.state;
        if (projected === 'default') continue;
        state = projected;
        if (projected === 'disabled') { if (disabledProp) props[disabledProp.name] = true; else unmapped.add(`${property}=${value} (state axis: the contract has no \`disabled\` boolean)`); }
        else interaction = projected;
        continue;
      }
      if (!prop) { unmapped.add(`${property} (no VARIANT prop${reading.kind === 'refused' ? `; ${reading.reason}` : ''})`); continue; }
      // An explicitly declared omission plane mounts without the prop. The
      // canvas label is not a public enum value or an implicit boolean false.
      if (prop.bindings.figma.unsetValue === value) continue;
      const entry = Object.entries(prop.bindings.figma.values ?? {}).find(([, figmaValue]) => figmaValue === value);
      if (entry) props[prop.name] = variantPropValue(prop, entry[0]); else unmapped.add(`${property}=${value}`);
    }
    const key = [...Object.entries(props).filter(([k]) => !(k in samples)).map(([k, v]) => `${k}-${v}`), ...(interaction === 'none' ? [] : [`state-${interaction}`])].join('_') || 'default';
    return { key, nodeId: variant.nodeId ?? '', figmaName: variant.name, props, hasText: !!textProp, textProp: textProp?.name, interaction, ...(state ? { state } : {}) };
  });
  const keys = cases.map(c => c.key);
  for (const key of keys) if (keys.filter(k => k === key).length > 1) unmapped.add(`duplicate case key ${key}`);
  return cases;
}
// ---------------------------------------------------------------------------
// INTERACTION STATES (docs/23 §D.41) — reached the way a user reaches them.
// ---------------------------------------------------------------------------
/** What a cell PAINTS, as one string: taken at rest and again in the state, so
 *  a state the contract declares but the generated CSS never reaches is caught
 *  by name, not by pixels. Every channel a state plane may carry rides it —
 *  all four borders, the radii, text decoration, transform, weight, filter and
 *  the box itself (review, PR 131 M4: the first cut read one border and no
 *  decoration, so an underline-on-hover link read `state-inert`).
 *  Serialized as text: tsx would otherwise inject its __name helper into the page. */
export const paintOf = new Function('el', `
  const K = ['backgroundColor', 'backgroundImage', 'color', 'opacity', 'boxShadow', 'filter', 'transform', 'visibility', 'cursor',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
    'outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'textDecorationLine', 'textDecorationColor', 'textDecorationStyle',
    'fontFamily', 'fontSize', 'lineHeight', 'fontWeight', 'fontStyle', 'letterSpacing', 'fill', 'stroke', 'strokeWidth', 'maskImage', 'maskSize', 'maskPosition', 'maskRepeat', 'clipPath'];
  return [el, ...el.querySelectorAll('*')].map(n => { const s = getComputedStyle(n), r = n.getBoundingClientRect(); return K.map(k => s[k]).join('|') + '|' + Math.round(r.width * 100) / 100 + 'x' + Math.round(r.height * 100) / 100; }).join('/');
`) as (el: Element) => string;
/** Observe actual variant effects across the rendered subtree. Class names
 * alone prove nothing; relative positions catch a rearrangement whose root
 * dimensions stay fixed. Text also matters when glyph advances are equal. */
export const variantPaintOf = new Function('el', `
  const paint = ${paintOf.toString()};
  const root = el.getBoundingClientRect();
  const boxes = [el, ...el.querySelectorAll('*')].map(node => {
    const r = node.getBoundingClientRect();
    return [node.tagName, r.x - root.x, r.y - root.y, r.width, r.height];
  });
  return JSON.stringify([paint(el), el.innerText ?? el.textContent, boxes]);
`) as (el: Element) => string;
/** Keyboard-modality focus on the component's own focus target: the root when
 *  it is focusable, else its first focusable descendant. Returns whether
 *  :focus-visible really matches — nothing is forced. */
const focusVisibly = new Function('el', `
  const root = el.firstElementChild; if (!root) return false;
  const focusable = n => n.tabIndex >= 0 && !n.disabled;
  const target = focusable(root) ? root : [...root.querySelectorAll('*')].find(focusable);
  if (!target) return false;
  target.focus();
  return target.matches(':focus-visible');
`) as (el: Element) => boolean;
/** Whether the cell's root REALLY matches the pseudo-class the pointer was
 *  meant to produce. A box is not reach: a root under an overlay, or with
 *  pointer-events:none, has a box and never matches :hover — that is
 *  `state-unreachable`, not `state-inert` (review, PR 131 M4). */
const matchesPseudo = new Function('el', 'pseudo', `const root = el.firstElementChild; return !!root && root.matches(pseudo);`) as (el: Element, pseudo: string) => boolean;
export const REACHED_BY = { hover: 'pointer hover', active: 'pointer down', 'focus-visible': 'keyboard-modality focus', none: 'nothing' } as const;
type PageLike = import('playwright-core').Page; type LocatorLike = import('playwright-core').Locator;

/** Put ONE cell into its state. `cell` is the `[data-cell]` wrapper; its first
 *  element child is the component root. Returns the rest-state paint (read
 *  before anything moved) and whether the state was really reached. */
export async function enterState(page: PageLike, cell: LocatorLike, interaction: Interaction): Promise<{ restPaint: string | null; reached: boolean }> {
  if (interaction === 'none') return { restPaint: null, reached: true };
  const restPaint = await cell.evaluate(paintOf);
  const root = cell.locator(':scope > *').first();
  if (interaction === 'focus-visible') { await page.keyboard.press('Tab'); return { restPaint, reached: await cell.evaluate(focusVisibly) }; }
  // A real pointer, as extract/figma/visual-parity/render.ts does it.
  await root.scrollIntoViewIfNeeded();
  const box = await root.boundingBox();
  if (!box) return { restPaint, reached: false };
  await page.mouse.move(box.x + (box.width > 0 ? box.width / 2 : 2), box.y + (box.height > 0 ? box.height / 2 : 2));
  if (interaction === 'active') await page.mouse.down();
  return { restPaint, reached: await cell.evaluate(matchesPseudo, interaction === 'hover' ? ':hover' : ':active') };
}

/** Leave no residue for the next cell — and synthesise NO CLICK: the pointer is
 *  parked off every component BEFORE the button is released, so mouseup lands
 *  on the page, never on the component (the first cut released over the root:
 *  a real click on every pressed cell, a navigation on an \`a[href]\`). */
export async function leaveState(page: PageLike, interaction: Interaction): Promise<void> {
  if (interaction === 'none') return;
  await page.mouse.move(0, 0);
  if (interaction === 'active') await page.mouse.up();
  await page.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
}

/** The three NAMED state problems for one exercised cell (the pixels judge the rest). */
export function stateProblems(c: { key: string; interaction: Interaction; state?: string }, declaredStates: readonly string[], reached: boolean, paintChanged: boolean): string[] {
  const out: string[] = [];
  if (c.state && !declaredStates.includes(c.state)) out.push(`state-not-carried:${c.state}`);
  if (c.interaction !== 'none' && !reached) out.push(`state-unreachable:${c.interaction}:${c.key}`);
  if (c.interaction !== 'none' && reached && !paintChanged && declaredStates.includes(c.interaction)) out.push(`state-inert:${c.interaction}:${c.key}`);
  return out;
}

/** Figma axes or values the contract does not map; reported, never skipped. */
const unmapped = new Set<string>();


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
      return <div data-cell={cell.key} key={cell.key} style={{ display: 'block', width: 'fit-content', margin: 8, padding: 4, minWidth: 1, minHeight: 1 }}><${component} {...props} /></div>;
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
  const frames: Record<string,FigmaFrame> = {};
  if (!token) return { status: 'figma-images-unavailable' as const, reason: 'no token', files: {} as Record<string, string>, frames, framingRefusal: 'no token' };
  const boundsUrl = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${ids.join(',')}&depth=1`;
  const readBounds = async (phase: string) => {
    const response = await fetch(boundsUrl, { headers: { 'X-Figma-Token': token } });
    if (!response.ok) throw new Error(`figma-bounds-unavailable:${phase}:HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(path.join(out, `figma-bounds-${phase}.json`), bytes, {flag:'wx'});
    return JSON.parse(bytes.toString('utf8'));
  };
  const before = await readBounds('before');
  const url = `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${ids.join(',')}&format=png&scale=1&contents_only=true&use_absolute_bounds=true`;
  const response = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!response.ok) return { status: 'figma-images-unavailable' as const, reason: `HTTP ${response.status}`, files: {} as Record<string, string>, frames, framingRefusal: 'figma-export-unavailable' };
  const body = await response.json() as { images: Record<string, string | null> };
  const files: Record<string, string> = {}, images: Record<string,Buffer> = {};
  for (const id of ids) {
    const imageUrl = body.images?.[id];
    if (!imageUrl) continue;
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`figma-image-download-failed:${id}:HTTP ${imageResponse.status}`);
    const png = Buffer.from(await imageResponse.arrayBuffer());
    const file = path.join(out, `figma-${id.replace(/[^a-z0-9]/gi, '_')}.png`); writeFileSync(file, png); files[id] = file; images[id] = png;
  }
  const after = await readBounds('after');
  const verified = figmaFramesFromSnapshots(before, after, images, FIGMA_REST_FULL_BOUNDS);
  return { status: 'figma-images-collected' as const, reason: null, files, frames: verified.frames, framingRefusal: verified.refused,
    frameEvidence: { before: 'figma-bounds-before.json', after: 'figma-bounds-after.json', version: before.version, export: { format:'png', scale:1, contentsOnly:true, useAbsoluteBounds:true }, raster: FIGMA_REST_FULL_BOUNDS,
      beforeSha256: imageSha256(readFileSync(path.join(out,'figma-bounds-before.json'))), afterSha256: imageSha256(readFileSync(path.join(out,'figma-bounds-after.json'))) } };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dump = JSON.parse(readFileSync(args.dump, 'utf8')), contract = JSON.parse(readFileSync(args.contract, 'utf8'));
  const cases = deriveCases(dump, contract, args.component);
  const problems: string[] = [...[...unmapped].map(entry => `variant-mapping-missing:${entry}`)];
  const textRects: Record<string, Array<{ x: number; y: number; width: number; height: number }>> = {};
  const consumerFrames: Record<string, ConsumerFrame> = {};
  const fileKey: string | undefined = dump._provenance?.fileKey ?? contract.bindings?.figma?.anchors?.fileKey ?? undefined;
  mkdirSync(args.out, { recursive: true });
  const inputs = path.join(args.out, 'inputs'); mkdirSync(inputs, { recursive: true });
  cpSync(args.dump, path.join(inputs, 'rest-dump.json')); cpSync(args.contract, path.join(inputs, path.basename(args.contract)));
  // Low (review): every contract beside it — the followed children and stubs —
  // and the minted tree ride the committed inputs, so the run reproduces from them. The
  // proposer's report (figma-proposals.md) rides too: it is where every semantics decision
  // is said in words (an inferred or WITHHELD element, docs/23 §D.44), which a contract
  // cannot carry.
  for (const f of readdirSync(path.dirname(args.contract))) if (/\.contract(\.proposed)?\.json$|^minted\.dtcg\.json$|^captured\.dtcg\.json$/.test(f) && f !== path.basename(args.contract)) cpSync(path.join(path.dirname(args.contract), f), path.join(inputs, f));
  // The report names the operator's work directory; rewritten to `.` (the report sits beside
  // the contracts it names) so no machine path reaches committed evidence.
  const report = path.join(path.dirname(args.contract), 'figma-proposals.md');
  if (existsSync(report)) {
    const dir = path.resolve(path.dirname(args.contract));
    const text = rewriteWorkPaths(readFileSync(report, 'utf8'), dir, path.relative(process.cwd(), dir));
    writeFileSync(path.join(inputs, 'figma-proposals.md'), text);
  } cpSync(args.generated, path.join(inputs, 'generated'), { recursive: true });
  const work = mkdtempSync(path.join(tmpdir(), 'ds-contracts-consumer-'));
  const receipt: any = { version: 1, kind: 'design-led-clean-consumer-check', acceptedContract: null, qualification: 'unqualified',
    component: args.component, fileKey: fileKey ?? null, capture: { background: 'transparent', comparisonBackgrounds: ['white', 'black'], framing: 'recorded-layout-origins-common-alpha-union-v2', deviceScaleFactor: 1, nativeRaster: FIGMA_REST_FULL_BOUNDS }, generatedSha256: {}, cases: [], behavior: {}, images: {}, problems, limitations: [
      'one component set is mounted and scored; the child components it composes are packaged and render inside it (inputs.contractGraph names each, and whether it is a real contract or a stub), but are not mounted or scored on their own; instance swaps are not exercised',
      'declared behavior beyond text props, variant props and the interaction states a designer drew as a state axis (hover, pressed, keyboard focus, disabled — docs/23 §D.41) is not exercised',
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
  // docs/23 §D.43 — the REST import's dependency closure, when one ran, and the
  // contract graph the mounted component needs: every referenced component is
  // packaged (the whole generated folder ships), and a reference no generated
  // folder holds is a named problem, never a silent blank.
  const closure = dump._provenance?.closure;
  if (closure) receipt.inputs.closure = { requested: closure.requested.map((r: any) => r.name), followed: closure.pulled.map((p: any) => p.name),
    notFollowed: closure.unresolved.map((u: any) => `${u.reason}:${u.name ?? u.targetId}`) };
  const contractDir = path.dirname(args.contract);
  const siblings = readdirSync(contractDir).filter(f => /\.contract(\.proposed)?\.json$/.test(f)).map(f => {
    try { const c = JSON.parse(readFileSync(path.join(contractDir, f), 'utf8')); return { ...c, __stub: /\.stub\.contract/.test(f) }; } catch { return null; }
  }).filter(Boolean);
  receipt.inputs.contractGraph = contractGraph(contract, siblings).map(ref => ({ ...ref, packaged: ref.name !== null && receipt.inputs.componentFolders.includes(ref.name) }));
  for (const ref of receipt.inputs.contractGraph) if (!ref.packaged) problems.push(`dependency-not-packaged:${ref.id}`);
  try {
    const lib = await packageReactLibrary(args.generated, args.component, work);
    receipt.package = { name: lib.name, tarballSha256: lib.tarballSha256, distFiles: readdirSync(lib.dist, { recursive: true }).map(String).sort() };
    const reactVersion = '^' + JSON.parse(readFileSync(path.join(ROOT, 'node_modules', 'react', 'package.json'), 'utf8')).version;
    const consumer = writeConsumer(work, lib, args.component, cases, reactVersion);
    run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], consumer);
    // The consumer must not resolve anything from this repository.
    const lockfile = readFileSync(path.join(consumer, 'package-lock.json'), 'utf8');
    const installedDir = path.join(consumer, 'node_modules', ...lib.name.split('/'));
    const installed = JSON.parse(readFileSync(path.join(installedDir, 'package.json'), 'utf8'));
    const installedFiles: string[] = readdirSync(path.join(installedDir, 'dist'), { recursive: true }).map(String).filter(f => !statSync(path.join(installedDir, 'dist', f)).isDirectory());
    const repoPathInInstalled = installedFiles.filter(f => readFileSync(path.join(installedDir, 'dist', f), 'utf8').includes(ROOT));
    receipt.consumer = { react: installed.peerDependencies?.react ?? null, installedVersion: installed.version, lockfileSha256: sha256(lockfile),
      repoPathInLockfile: lockfile.includes(ROOT), repoPathInInstalledFiles: repoPathInInstalled };
    if (receipt.consumer.repoPathInLockfile) throw new Error('consumer lockfile references the repository');
    if (repoPathInInstalled.length) throw new Error(`installed files reference the repository: ${repoPathInInstalled.join(', ')}`);
    run(path.join(consumer, 'node_modules', '.bin', 'vite'), ['build', '--logLevel', 'error'], consumer);
    const built = path.join(consumer, 'dist', 'index.html');
    if (!existsSync(built)) throw new Error('vite build produced no index.html');
    if (args.keepBuiltConsumer) {
      const review = path.join(args.out, 'review-site');
      if (existsSync(review)) throw new Error('consumer review-site already exists; use a new evidence directory');
      cpSync(path.join(consumer, 'dist'), review, { recursive: true, errorOnExist: true, force: false });
      receipt.consumer.reviewSite = 'review-site';
    }
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
      // THE INSTRUMENT, not the product: cells used to flow inline, so a root 47.4 px
      // wide pushed every later root onto a fractional x and 33 of 72 CBDS Badge
      // shots came out one pixel wider with a shifted antialiased edge — while
      // Figma exports every node from its own integer origin. Each cell is now its
      // own block (same shrink-to-fit width), and a fractional HEIGHT above is
      // absorbed in the wrapper's margin so every root starts on a whole pixel.
      const misaligned = await page.evaluate(`(() => {
        const off = [];
        for (const cell of document.querySelectorAll('[data-cell]')) {
          const root = cell.firstElementChild; if (!root) continue;
          const top = root.getBoundingClientRect().top, frac = top - Math.floor(top);
          if (frac > 0) cell.style.marginTop = (8 + 1 - frac) + 'px';
          const r = root.getBoundingClientRect();
          if (Math.abs(r.top - Math.round(r.top)) > 0.001 || Math.abs(r.left - Math.round(r.left)) > 0.001) off.push(cell.getAttribute('data-cell'));
        }
        return off;
      })()`) as string[];
      // A root its own CSS places off the pixel grid (a fractional margin or transform) is named, never hidden.
      for (const key of misaligned) problems.push(`root-origin-off-pixel-grid:${key}`);
      // Interactive content inside interactive content is invalid HTML a clean
      // consumer would ship (docs/23 §D.43, review H1) — a named problem.
      const nested = await page.evaluate(nestedInteractiveScript) as string[];
      receipt.consumer.interactiveNesting = nested;
      for (const entry of nested) problems.push(`interactive-content-nested:${entry}`);
      if (cells.length !== cases.length) problems.push(`mounted ${cells.length} cells for ${cases.length} cases`);
      const textDefault = String((contract.props as any[]).find(p => p.name === cases[0]?.textProp)?.default ?? '');
      const declaredStates: string[] = Array.isArray(contract.states) ? contract.states : [];
      const paints: Record<string, string> = {};
      const notCarried = new Set<string>();
      receipt.behavior.states = [];
      for (const c of cases) {
        const cell = page.locator(`[data-cell="${c.key}"]`);
        const root = cell.locator(':scope > *').first();
        const entered = await enterState(page, cell, c.interaction);
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
        // Match the Figma node export's transparent substrate. The scorer
        // applies its shared background after trimming both alpha bounds.
        await root.scrollIntoViewIfNeeded();
        const boundsOf = (el: Element) => {const b=el.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height};};
        const beforeCapture = await root.evaluate(boundsOf);
        const shot = path.join(args.out, `consumer-${c.key}.png`); await root.screenshot({ ...NODE_SCREENSHOT_OPTIONS, path: shot, timeout: 10000 });
        const afterCapture = await root.evaluate(boundsOf);
        if(JSON.stringify(beforeCapture)!==JSON.stringify(afterCapture)) problems.push(`consumer-bounds-changed-during-capture:${c.key}`);
        else consumerFrames[c.key]={layout:afterCapture,capture:enclosingFrame(afterCapture),deviceScaleFactor:1,pngSha256:imageSha256(readFileSync(shot))};
        // Where this render draws text, in the screenshot's own pixels (the root's
        // layout box). The same walk extract/figma/visual-parity/render.ts makes.
        // Serialized as text for the same reason as the font probe above.
        textRects[c.key] = await root.evaluate(new Function('el', `
          const origin = el.getBoundingClientRect(), rects = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent || !n.textContent.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(n);
            for (const r of range.getClientRects()) if (r.width && r.height) rects.push({ x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height });
          }
          return rects;
        `) as (el: Element) => unknown) as Array<{ x: number; y: number; width: number; height: number }>;
        paints[c.key] = await cell.evaluate(paintOf);
        if (c.interaction !== 'none') {
          const changed = paints[c.key] !== entered.restPaint;
          receipt.behavior.states.push({ key: c.key, state: c.state, reachedBy: REACHED_BY[c.interaction], reached: entered.reached, paintChanged: changed });
          await leaveState(page, c.interaction);
        }
        // state-not-carried is one line per STATE (the contract declares no such state — its cells render the rest state and the pixels judge).
        for (const p of stateProblems(c, declaredStates, entered.reached, paints[c.key] !== entered.restPaint)) p.startsWith('state-not-carried:') ? notCarried.add(`${p} (the contract declares no "${c.state}" state — its cells render the rest state and the pixels judge)`) : problems.push(p);
        receipt.cases.push({ key: c.key, figmaName: c.figmaName, nodeId: c.nodeId, props: c.props, ...(c.state ? { state: c.state, interaction: c.interaction } : {}), rendered: { text, ...style, font }, screenshot: path.basename(shot), frame: consumerFrames[c.key] ?? null });
      }
      // `disabled` is a prop, not an interaction: its cell is compared with the
      // rest cell that has the same other props.
      for (const c of cases.filter(x => x.state === 'disabled')) {
        const { disabled: _omit, ...others } = c.props as Record<string, unknown>;
        const sorted = (o: Record<string, unknown>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
        const rest = cases.find(x => !x.state && sorted(x.props) === sorted(others));
        if (!rest) continue;
        const changed = paints[c.key] !== paints[rest.key];
        receipt.behavior.states.push({ key: c.key, state: 'disabled', reachedBy: 'the disabled prop', reached: true, paintChanged: changed, comparedWith: rest.key });
        if (!changed && declaredStates.includes('disabled')) problems.push(`state-inert:disabled:${c.key}`);
      }
      problems.push(...notCarried);
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
        const declaresSlot = (function find(node: any): boolean {
          if (!node || typeof node !== 'object') return false;
          if (node.slot && typeof node.slot === 'object' && typeof node.slot.name === 'string') return true;
          return Object.values(node).some(find);
        })(contract.anatomy);
        const marker = 'Consumer child content';
        await page.evaluate(([m]) => (window as any).__consumer.setVariantOverride({ children: m }), [marker] as const);
        const cellTexts = await Promise.all(cases.map(async c => page.locator(`[data-cell="${c.key}"]`).innerText()));
        const shown = cellTexts.length > 0 && cellTexts.every(t => t.includes(marker));
        await page.evaluate(() => (window as any).__consumer.setVariantOverride(null));
        // The installed declaration is the API a TypeScript consumer sees.
        const declaration = readFileSync(path.join(consumer, 'node_modules', ...lib.name.split('/'), 'dist', args.component, `${args.component}.d.ts`), 'utf8');
        const propsInterface = declaration.slice(declaration.indexOf(`interface ${args.component}Props`));
        const refusedByType = /Omit<[^>]*>,\s*(?:'[^']*'\s*\|\s*)*'children'/.test(propsInterface.split('{')[0]);
        receipt.behavior.children = { contractDeclaresSlot: declaresSlot, renderedAtRuntime: shown, refusedByType };
        if (declaresSlot && !shown) problems.push('children-slot-discarded');
        if (!declaresSlot && !shown && !refusedByType) problems.push('children-accepted-but-discarded');
      }
      // Observe every differing variant value. An unchanged render needs exact
      // source equivalence, adjudicated after authenticated Figma export below.
      const variantProps = (contract.props as any[]).filter(p => p.bindings?.figma?.kind === 'VARIANT' && variantValues(p).length > 1);
      receipt.behavior.variants = [];
      for (const prop of variantProps) {
        const values = variantValues(prop);
        const styleOf = async (key: string) => page.locator(`[data-cell="${key}"] > *`).first().evaluate(variantPaintOf);
        const baseline = Object.fromEntries(await Promise.all(cases.map(async c => [c.key, await styleOf(c.key)])));
        const target = values.find(v => cases.some(c => c.props[prop.name] !== v)) ?? values[0];
        await page.evaluate(([name, value]) => (window as any).__consumer.setVariantOverride({ [name]: value }), [prop.name, target] as const);
        const switched = Object.fromEntries(await Promise.all(cases.map(async c => [c.key, await styleOf(c.key)])));
        await page.evaluate(() => (window as any).__consumer.setVariantOverride(null));
        const shouldChange = cases.filter(c => c.props[prop.name] !== undefined && c.props[prop.name] !== target);
        const didChange = shouldChange.filter(c => baseline[c.key] !== switched[c.key]);
        const inert = new RegExp(`axis-inert \\(ledgered, not a throw\\): ${prop.bindings.code?.prop ?? prop.name}\\b`).test(readFileSync(path.join(args.generated, args.component, `${args.component}.tsx`), 'utf8'));
        receipt.behavior.variants.push({ prop: prop.name, switchedTo: target, cellsSwitched: shouldChange.map(c => c.key), cellsExpectedToChange: shouldChange.map(c => c.key), cellsChanged: didChange.map(c => c.key), axisInertLedgered: inert });
        if (!shouldChange.length) { problems.push(`variant-axis-unexercised:${prop.name}`); continue; }
      }
      if (errors.length) problems.push(...errors.map(e => 'consumer-runtime-error: ' + e.slice(0, 200)));
    } finally { await browser.close(); server.close(); }
    // Compare with Figma's own renders.
    const setNodeId: string | undefined = (findDumpSet(dump, contract, args.component) ?? {}).nodeId;
    const unresolved = fileKey && args.token && setNodeId && cases.some(c => !c.nodeId) ? await resolveVariantNodeIds(fileKey, setNodeId, args.token, cases) : (cases.some(c => !c.nodeId) ? 'variant node ids unavailable' : null);
    const figma = unresolved ? { status: 'figma-images-unavailable' as const, reason: unresolved, files: {}, frames: {} as Record<string,FigmaFrame>, framingRefusal: unresolved }
      : fileKey ? await fetchFigmaImages(fileKey, cases.map(c => c.nodeId), args.token, args.out) : { status: 'figma-images-unavailable' as const, reason: 'no fileKey in dump', files: {}, frames: {} as Record<string,FigmaFrame>, framingRefusal: 'no fileKey in dump' };
    for (const row of receipt.cases) row.nodeId = cases.find(c => c.key === row.key)?.nodeId ?? null;
    const sourceImages: Record<string, Buffer> = Object.fromEntries(Object.entries(figma.files).map(([id, file]) => [id, readFileSync(file)]));
    for (const row of receipt.behavior.variants ?? []) {
      const unchanged = row.cellsSwitched.filter((key: string) => !row.cellsChanged.includes(key));
      const equivalent = sourceEquivalentTransitions(cases, row.prop, row.switchedTo, unchanged, sourceImages, figma.frames);
      row.sourceEquivalentTransitions = equivalent;
      const keys = new Set(equivalent.map(e => e.from));
      row.cellsExpectedToChange = row.cellsSwitched.filter((key: string) => !keys.has(key));
      row.cellsUnchangedWithoutEquivalentSource = unchanged.filter((key: string) => !keys.has(key));
      if (row.cellsUnchangedWithoutEquivalentSource.length)
        problems.push(row.axisInertLedgered ? `variant-axis-inert-ledgered:${row.prop}` : `variant-prop-discarded:${row.prop}`);
    }
    receipt.images = { status: figma.status, reason: figma.reason, frameEvidence: 'frameEvidence' in figma ? figma.frameEvidence : null, scorer: 'Recorded layout origins, integer translation only, common nonzero-alpha union crop. Both unmasked white and black scores must meet the unchanged 5% limit (pixelmatch threshold 0.1). Historical independent alpha-trim scores and text masks remain diagnostic; they do not determine this verdict.', limitPercent: IMAGE_LIMIT_PERCENT, cases: [] as any[] };
    if (figma.status === 'figma-images-collected') for (const c of cases) {
      const file = figma.files[c.nodeId];
      if (!file) { receipt.images.cases.push({ key: c.key, status: 'figma-image-missing' }); problems.push(`figma-image-missing:${c.key}`); continue; }
      const ours = readPng(path.join(args.out, `consumer-${c.key}.png`)), theirs = readPng(file);
      const aligned = alignPair(ours, theirs), diff = diffPair(aligned, textRects[c.key] ?? []);
      writeTriptych(path.join(args.out, `triptych-${c.key}.png`), aligned, diff.diff);
      const blackAligned = alignPair(ours, theirs, 0), blackDiff = diffPair(blackAligned, []);
      writeTriptych(path.join(args.out, `triptych-black-${c.key}.png`), blackAligned, blackDiff.diff);
      const percent = diff.unmaskedPct;
      const blackPercent = blackDiff.unmaskedPct;
      if (!Number.isFinite(percent) || !Number.isFinite(blackPercent)) { problems.push(`image-score-unavailable:${c.key}`); receipt.images.cases.push({ key: c.key, status: 'image-score-unavailable' }); continue; }
      // Share of non-white, non-transparent pixels on each side: a mostly
      // white surface can score under the limit while drawing far less ink.
      const ink = (png: import('pngjs').PNG) => { let n = 0; for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 3] > 8 && (png.data[i] < 247 || png.data[i + 1] < 247 || png.data[i + 2] < 247)) n++; return Math.round(10000 * n / (png.width * png.height)) / 100; };
      // A SECOND number, never the verdict: the same diff with this render's text
      // boxes painted out on both sides. It answers one question about a row that
      // is over the limit — is anything wrong OUTSIDE the glyphs? `null` = the
      // mask covers the whole canvas, so the number would be vacuous.
      const residual = percent > IMAGE_LIMIT_PERCENT ? residualClass(diff.maskedPct, diff.maskCoveragePct) : undefined;
      const ourBytes=readFileSync(path.join(args.out,`consumer-${c.key}.png`)),figmaBytes=readFileSync(file);
      const onWhite=alignRecordedFrames(ourBytes,figmaBytes,consumerFrames[c.key],figma.frames[c.nodeId],255);
      const onBlack=alignRecordedFrames(ourBytes,figmaBytes,consumerFrames[c.key],figma.frames[c.nodeId],0);
      let layoutAligned: any;
      if (figma.framingRefusal || 'refused' in onWhite || 'refused' in onBlack) {
        const reason=figma.framingRefusal || ('refused' in onWhite ? onWhite.refused : 'refused' in onBlack ? onBlack.refused : 'unknown');
        layoutAligned={status:'refused',reason,withinLimit:false}; problems.push(`image-framing-unqualified:${c.key}:${reason}`);
      } else {
        const white=diffPair(onWhite.aligned,[]),black=diffPair(onBlack.aligned,[]);
        layoutAligned={status:'measured',whiteMismatchPercent:white.unmaskedPct,blackMismatchPercent:black.unmaskedPct,
          withinLimit:white.unmaskedPct<=IMAGE_LIMIT_PERCENT&&black.unmaskedPct<=IMAGE_LIMIT_PERCENT,placement:onWhite.placement,
          pixelsCompared:onWhite.aligned.width*onWhite.aligned.height};
        writeTriptych(path.join(args.out,`triptych-layout-white-${c.key}.png`),onWhite.aligned,white.diff);
        writeTriptych(path.join(args.out,`triptych-layout-black-${c.key}.png`),onBlack.aligned,black.diff);
        if (white.unmaskedPct>IMAGE_LIMIT_PERCENT) problems.push(`layout-image-difference-above-limit:${c.key}:${white.unmaskedPct.toFixed(2)}%`);
        if (black.unmaskedPct>IMAGE_LIMIT_PERCENT) problems.push(`layout-image-difference-on-black-above-limit:${c.key}:${black.unmaskedPct.toFixed(2)}%`);
      }
      receipt.images.cases.push({ key: c.key, figmaImage: path.basename(file), mismatchPercent: percent, blackMismatchPercent: blackPercent, historicalWithinLimit: percent <= IMAGE_LIMIT_PERCENT && blackPercent <= IMAGE_LIMIT_PERCENT,
        layoutAligned, figmaFrame:figma.frames[c.nodeId]??null, withinLimit:layoutAligned.withinLimit,
        textMaskedPercent: diff.maskedPct, textMaskCoveragePercent: diff.maskCoveragePct, ...(residual ? { residual } : {}), inkCoveragePercent: { consumer: ink(ours), figma: ink(theirs) },
        contentSize: { consumer: aligned.aContent, figma: aligned.bContent }, screenshotSize: { consumer: { width: ours.width, height: ours.height }, figma: { width: theirs.width, height: theirs.height } } });
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
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
