/**
 * THE STORYBOOK READER, part 1 (docs/GOAL.md Step 2). React to Figma reads a
 * library from its own Storybook, never from a hand-written declaration: the
 * owner chose (2026-10-31) to judge it only by GOAL.md's checks against the
 * library's own render. This part reads every story's arguments in pinned
 * Chromium through Storybook's own preview API, groups stories by component
 * title, and holds each component's first story (index order) against the
 * grammar classifier, and holds all of its stories against the variant matrix
 * rule, where each story is one variant (owner, 2026-11-01). Own render is
 * decided from the rendered page: each story is rendered through Storybook's
 * own channel and React's tree is held against rendersOneInstance; a story that
 * fails to render is named apart (an instrument fault) and never counted.
 * Part 2b then renders every expected variant (its story, with listed options
 * set through Storybook's own args channel) and keeps a PNG of the single
 * instance, alone (ancestor backgrounds cleared, its painted extent), as the reference image (the library's own render, never the
 * engine's), plus every platform font Chromium drew its text with, for the
 * React to Figma font preflight, and what it draws (text, text runs, graphics), read
 * after the screenshot by the Figma to React check's own collector. Every page is rendered in one pinned
 * environment (PINNED, run through Docker) and the receipt records it, so the
 * references reproduce on any machine. Deterministic for one Storybook build;
 * no model call.
 *
 * Run: npx tsx scripts/storybook-reader.ts --storybook <https://…/storybook/> --out <dir>
 * Needs a running Docker; the pinned image is built on first use. An arm64
 * machine emulates amd64: the image's native arm64 build draws a few pixels one
 * level apart (2 of A0's 431 references), so the architecture is pinned too.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { classifyStoryArgs, type GrammarVerdict, type StoryArgType } from '../extract/figma/grammar.js';
import { rendersOneInstance, storyVariantMatrix, type RenderedNode, type VariantRender } from '../extract/figma/variant-matrix.js';
import type { Browser, CDPSession, JSHandle } from 'playwright-core';
import { PNG } from 'pngjs';
import type { FontFace } from './font-preflight.js';
import { domContentOf, type DomContent } from './design-consumer-content.js';
import type { ConsumerFrame } from './design-consumer-framing-v2.js';
import { captureSubjectWithoutBackdrop } from './design-consumer-observed-capture.js';
import { EMPTY_BOX } from './design-consumer-paint-extent.js';
import { NO_MOTION } from './design-consumer-check.js';

export interface LoadedStory { id: string; title: string; name: string; argTypes: Record<string, StoryArgType>; args: Record<string, unknown>;
  /** The rendered story shows more than one instance of its component, or content beside it. */
  ownRender: boolean;
  /** The reader could not render the story (an instrument fault, named apart). */
  renderFailed: boolean;
  /** The grammar's layout refusals in the story's own render (LAYOUT_FLAGS): the reason and where it sits. */
  layout?: Array<[string, string]> }
/** One expected variant's reference: the story and arguments it renders from, then its PNG and box, or why it has none. */
export interface VariantReference extends VariantRender {
  /** The variant's value on each axis of the matrix rule: what a written Figma variant is paired by. */
  variant: Record<string, string>; png?: string; sha256?: string; box?: Box; faces?: FontFace[];
  problem?: 'reference-render-failed' | 'reference-not-one-instance' | 'reference-empty' | 'reference-capture-unqualified';
  /** Why the instance could not be captured alone (the Figma to React check's own capture refusal, or not one element). */
  captureRefused?: string;
  /** The image's frame, recorded as the Figma to React check records its own side: layout box, capture box, painted extent. */
  frame?: ConsumerFrame;
  /** What the instance draws (its text, text runs and graphics), read by the Figma to React check's own collector. */
  content?: DomContent; contentProblem?: 'reference-content-not-one-container' }
type Box = { x: number; y: number; width: number; height: number };
export interface StoryComponent {
  title: string; stories: number; storyId: string; grammar: GrammarVerdict;
  /** Each layout refusal behind `grammar`: the story, the reason and the element (tag and classes). */
  layout?: Array<{ story: string; reason: string; at: string }>;
  /** The variant matrix rule, stories as variants (GOAL.md signed entry of 2026-11-01). */
  matrix: { status: 'ok'; axes: string[]; variants: number } | { status: 'refused'; reason: string };
  /** Named, never counted: own-render stories, repeats of an earlier story's state, stories the reader could not render,
   *  and (for a declared component) the stories its declaration leaves out, each with its fixed reason. */
  ownRender: string[]; repeats: string[]; renderFailed: string[]; leftOut?: Array<{ story: string; reason: string }>;
  /** Set on a title the profile excludes: its reason. Its verdict and matrix are what it would have been. */
  excludedBy?: string;
  /** In the matrix's variant order; every face the references' text renders with, for the font preflight. */
  references: VariantReference[]; faces: FontFace[];
}

/** A system profile's declaration (grammar decision 4): which stories make a component, its real variant axes, and each
 *  story of its title it leaves out, with a fixed reason (reviewer, 2026-11-10). A story that draws another component is
 *  assigned to that component, never left out; `left-out-variant` (a real option left out, say to fit the cap) is
 *  counted as that component's coverage loss. */
export const LEFT_OUT_REASONS = ['test', 'playground', 'repeat', 'left-out-variant'] as const;
export interface ComponentDeclaration { name: string; stories: string[]; axes: string[]; leftOut?: Array<{ story: string; reason: string }> }
/** A whole title the profile assigns to no component, with a fixed reason (reviewer, 2026-11-10). It stays in the kit's
 *  count, in its own "excluded by profile" column, with what it would have been; nothing hard, failing or out of grammar. */
export const EXCLUDED_REASONS = ['feature-flag-copy', 'deprecated', 'preview', 'non-visual-utility'] as const;
export interface ExcludedTitle { title: string; reason: string }

/** A system profile (GOAL.md, 2026-11-09): a versioned data file, checked against this schema when the reader loads it. */
export const SystemProfile = z.object({
  provenance: z.string().regex(/^AI-drafted .*approved by the reviewer session/), system: z.string(), version: z.string(),
  pins: z.object({ '@carbon/react': z.string().optional(), storybook: z.string(), figma: z.object({ fileKey: z.string(), version: z.string() }) }).passthrough(),
  setup: z.object({ manifest: z.string(), captureConfig: z.string() }),
  tuning: z.object({ why: z.string(), code: z.array(z.string()), figma: z.array(z.object({ id: z.string(), set: z.string() })) }),
  placementLeftOut: z.array(z.object({ component: z.string(), prop: z.string(), values: z.number(), samePixelsClosed: z.boolean(), figmaVariantProperty: z.string(), leftOut: z.boolean() })),
  components: z.array(z.object({ name: z.string(), stories: z.array(z.string()).min(1), axes: z.array(z.string()),
    leftOut: z.array(z.object({ story: z.string(), reason: z.enum(LEFT_OUT_REASONS), adds: z.string().optional() })).optional() })),
  excluded: z.array(z.object({ title: z.string(), reason: z.enum(EXCLUDED_REASONS), copies: z.string().optional(), receipt: z.string().optional() })),
}).strict();
export type SystemProfile = z.infer<typeof SystemProfile>;
export const readProfile = (file: string): SystemProfile => SystemProfile.parse(JSON.parse(readFileSync(file, 'utf8')));

export function readStories(stories: readonly LoadedStory[], declared: readonly ComponentDeclaration[] = [], excluded: readonly ExcludedTitle[] = []): StoryComponent[] {
  const byTitle = new Map<string, LoadedStory[]>(), axesOf = new Map<string, string[]>(), taken = new Set<string>(), off = new Map<string, string>();
  for (const e of excluded) {
    if (!stories.some((s) => s.title === e.title)) fail(`profile-title-unknown:${e.title}`);
    if (!(EXCLUDED_REASONS as readonly string[]).includes(e.reason)) fail(`profile-excluded-reason:${e.reason}:${e.title}`);
    off.set(e.title, e.reason);
  }
  // A declaration may only select stories the Storybook has, each for one component; anything else stops the run, by name.
  const reasons = new Map<string, string>(), leftBy = new Map<string, Array<{ story: string; reason: string }>>();
  for (const d of declared) {
    const list = d.stories.map((id) => stories.find((s) => s.id === id) ?? fail(`profile-story-unknown:${id}`));
    for (const s of list) { if (taken.has(s.id)) fail(`profile-story-twice:${s.id}`); if (off.has(s.title)) fail(`profile-title-excluded-and-declared:${s.title}`); taken.add(s.id); }
    for (const l of d.leftOut ?? []) {
      if (!stories.some((s) => s.id === l.story)) fail(`profile-story-unknown:${l.story}`);
      if (!(LEFT_OUT_REASONS as readonly string[]).includes(l.reason)) fail(`profile-left-out-reason:${l.reason}:${l.story}`);
      reasons.set(l.story, l.reason);
    }
    byTitle.set(d.name, list); axesOf.set(d.name, d.axes); leftBy.set(d.name, d.leftOut ?? []);
  }
  // A title the profile declares is the profile's: each of its stories is assigned, or left out with a fixed reason.
  const owned = new Set(stories.filter((s) => taken.has(s.id)).map((s) => s.title));
  for (const s of stories) if (!taken.has(s.id)) {
    if (!owned.has(s.title)) (byTitle.get(s.title) ?? byTitle.set(s.title, []).get(s.title)!).push(s);
    else if (!reasons.has(s.id)) fail(`profile-story-unaccounted:${s.id}`);
  }
  for (const id of reasons.keys()) if (taken.has(id)) fail(`profile-story-twice:${id}`);
  return [...byTitle].map(([title, list]) => {
    const left = leftBy.get(title) ?? [];
    const first = list[0]!;
    const argTypes = Object.fromEntries(Object.entries(first.argTypes).sort(([a], [b]) => a.localeCompare(b)));
    const m = storyVariantMatrix(list.map((s) => ({ id: s.id, args: s.args ?? {}, argTypes: s.argTypes, ownRender: s.ownRender, renderFailed: s.renderFailed })), axesOf.get(title));
    const layout = list.flatMap((s) => (s.layout ?? []).map(([reason, at]) => ({ story: s.id, reason, at })));
    const args = classifyStoryArgs(argTypes, list), reasons = [...new Set([...args.reasons, ...layout.map((l) => l.reason)])].sort();
    return { title, stories: list.length, storyId: first.id, grammar: { grammar: reasons.length ? 'out' as const : 'in' as const, reasons }, layout,
      matrix: m.status === 'ok' ? { status: 'ok' as const, axes: m.matrix.axes.map((a) => a.name), variants: m.matrix.variants.length } : { status: 'refused' as const, reason: m.reason },
      ownRender: m.ownRender, repeats: m.repeats, renderFailed: m.renderFailed, ...(left.length ? { leftOut: left } : {}), ...(off.has(title) ? { excludedBy: off.get(title)! } : {}),
      references: m.status === 'ok' ? m.renders.map((r, i) => ({ ...r, variant: m.matrix.variants[i]! })) : [], faces: [] };
  }).sort((a, b) => a.title.localeCompare(b.title));
}

const fail = (message: string): never => { throw Error(message); };

/** The instance's own DOM container: the one element whose element children are exactly the instance's top
 *  elements (decorators may wrap it; nothing may sit beside it), or null. The collector reads text inside it and
 *  frames boxes on its first element child, as the Figma to React check does with its cell. */
export const INSTANCE_CONTAINER = `((elements) => { const parent = elements[0]?.parentElement;
  return parent && elements.every((e) => e.parentElement === parent) && parent.children.length === elements.length ? parent : null; })`;

/** Mark the instance's one top element as the capture's subject and its parent as the capture's cell (cleared
 *  first); false when the instance has more than one top element that is not an empty box (a focus guard). */
export const MARK_SUBJECT = `(() => { for (const e of document.querySelectorAll('[data-ds-reader-subject], [data-ds-reader-cell]')) { e.removeAttribute('data-ds-reader-subject'); e.removeAttribute('data-ds-reader-cell'); }
  const tops = (window.__dsReaderTops ?? []).filter((n) => !${EMPTY_BOX}(n)); if (tops.length !== 1 || !tops[0].parentElement) return false;
  tops[0].setAttribute('data-ds-reader-subject', ''); tops[0].parentElement.setAttribute('data-ds-reader-cell', ''); return true; })()`;

/** Grammar decision 2 on the code side (2026-11-09), read from one rendered instance (its top elements): a grid, a
 *  wrapping row, and a drawn element or ::before/::after placed absolutely whose containing block is not laid out
 *  in a row or a column (flex, or block flow, a table cell's included) or lies outside the instance. A hidden, fully transparent, clipped or
 *  one-pixel element, or one that draws nothing (no box paint, text, image or generated content in it), is an ordinary
 *  part and refuses nothing. Each flag names its element by tag and classes. */
export const LAYOUT_FLAGS = `((tops) => {
  const flags = [], inside = (e) => tops.some((t) => t === e || t.contains(e));
  const where = (e, pseudo) => e.tagName.toLowerCase() + [...e.classList].map((c) => '.' + c).join('') + pseudo;
  const seen = (e) => { for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a);
    if (s.visibility === 'hidden' || Number(s.opacity) === 0) return false; if (tops.includes(a)) return true; } return true; };
  const block = (e) => { for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a);
    if (s.position !== 'static' || s.transform !== 'none' || s.filter !== 'none') return a; } return null; };
  const column = (e) => /^(flex|inline-flex|block|flow-root|inline-block|list-item|table-cell)$/.test(getComputedStyle(e).display);
  const paints = (s) => !/^(transparent|rgba\\(0, 0, 0, 0\\))$/.test(s.backgroundColor) || s.backgroundImage !== 'none' || s.boxShadow !== 'none'
    || ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none')
    || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
  const generated = (s) => s.content !== 'none' && s.content !== 'normal' && (paints(s) || !!s.content.replace(/["']/g, '').trim());
  const own = (e) => /^(img|svg|canvas|video|input|textarea|select)$/i.test(e.tagName) || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  // Drawn: the element, or a rendered and visible element inside it, paints a box, text, an image or generated content.
  const drawn = (e) => [e, ...e.querySelectorAll('*')].some((d) => d.getClientRects().length && seen(d)
    && (paints(getComputedStyle(d)) || own(d) || generated(getComputedStyle(d, '::before')) || generated(getComputedStyle(d, '::after'))));
  for (const top of tops) for (const e of [top, ...top.querySelectorAll('*')]) {
    if (!e.getClientRects().length) continue;
    const cs = getComputedStyle(e);
    if (/grid/.test(cs.display)) flags.push(['grid-layout', where(e, '')]);
    if (/flex/.test(cs.display) && cs.flexWrap !== 'nowrap') flags.push(['layout-wrap', where(e, '')]);
    for (const pseudo of ['', '::before', '::after']) {
      const s = pseudo ? getComputedStyle(e, pseudo) : cs;
      if ((pseudo && (s.content === 'none' || s.content === 'normal')) || (s.position !== 'absolute' && s.position !== 'fixed')) continue;
      const r = pseudo ? { width: parseFloat(s.width) || 0, height: parseFloat(s.height) || 0 } : e.getBoundingClientRect();
      if (s.visibility === 'hidden' || Number(s.opacity) === 0 || !seen(e) || r.width * r.height <= 1 || /^rect\\(0/.test(s.clip) || s.clipPath !== 'none'
        || !(pseudo ? generated(s) : drawn(e))) continue;
      const cb = s.position === 'fixed' ? null : block(pseudo ? e : e.parentElement);
      if (!cb || !inside(cb) || !column(cb)) flags.push(['absolute-child', where(e, pseudo)]);
    }
  }
  return [...new Map(flags.map((f) => [f.join(' '), f])).values()];
})`;

// Render one story through Storybook's own channel (`args` over its listed options), compact React's tree
// (instances of the story's component by type; DOM elements and text), and for a single instance return
// its box, outward to whole pixels; its text elements are marked with their weight and style for the font
// lookup. A string, not a function: the TypeScript loader would wrap named helpers in code the page lacks.
// Exported so the React to Figma converter renders each story exactly as the reader does.
export const SHOW = `(async ([id, args]) => {
  const store = window.__STORYBOOK_PREVIEW__.storyStoreValue, channel = window.__STORYBOOK_ADDONS_CHANNEL__;
  const wait = (event, emit) => new Promise((resolve) => {
    const handlers = [[event, (p) => { if ((p?.storyId ?? p) === id) done('rendered'); }], ['storyUnchanged', (p) => { if (p === id) done('rendered'); }],
      ['storyErrored', () => done('failed')], ['storyThrewException', () => done('failed')]];
    const done = (r) => { for (const [e, f] of handlers) channel.off(e, f); resolve(r); };
    for (const [e, f] of handlers) channel.on(e, f);
    setTimeout(() => done('failed'), 20000);
    emit();
  });
  window.__dsReaderContainer = null; window.__dsReaderTops = [];
  let outcome = await wait('storyRendered', () => channel.emit('setCurrentStory', { storyId: id, viewMode: 'story' }));
  if (outcome === 'rendered' && Object.keys(args).length) outcome = await wait('storyArgsUpdated', () => channel.emit('updateStoryArgs', { storyId: id, updatedArgs: args }));
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const component = (await store.loadCSFFileByStoryId(id)).meta.component;
  const same = (t) => !!t && !!component && (t === component || t.type === component || t.render === component || t === component.type || t === component.render);
  let instance = null;
  // The outermost instance is the one framed (checked before its children: the component may nest itself).
  const build = (f) => { const nodes = []; for (let c = f; c; c = c.sibling) { const hit = same(c.type) || same(c.elementType);
    if (hit) instance = instance ?? c;
    const kids = build(c.child);
    if (hit) nodes.push({ i: true });
    else if (typeof c.type === 'string' || c.tag === 6) nodes.push(kids.length ? { h: true, c: kids } : { h: true });
    else nodes.push(...kids); } return nodes; };
  const root = document.getElementById('storybook-root'), key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
  const live = key ? (root[key].stateNode?.current ?? root[key]) : null;
  if (outcome !== 'rendered' || !live) return { tree: null };
  const tree = { c: build(live.child) };
  const elements = [], top = (f) => { for (let c = f; c; c = c.sibling) { if (c.stateNode instanceof Element) elements.push(c.stateNode); else top(c.child); } };
  if (instance) top(instance.child);
  window.__dsReaderContainer = ${INSTANCE_CONTAINER}(elements); window.__dsReaderTops = elements;
  const rects = elements.map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
  if (!rects.length) return { tree };
  for (const old of document.querySelectorAll('[data-ds-reader-text]')) old.removeAttribute('data-ds-reader-text');
  for (const e of elements) for (const t of [e, ...e.querySelectorAll('*')])
    if ([...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { const cs = getComputedStyle(t);
      t.setAttribute('data-ds-reader-text', cs.fontWeight + ' ' + (/italic|oblique/.test(cs.fontStyle) ? 'italic' : 'normal')); }
  const x = Math.floor(Math.min(...rects.map((r) => r.left)) + scrollX), y = Math.floor(Math.min(...rects.map((r) => r.top)) + scrollY);
  return { tree, box: { x, y, width: Math.ceil(Math.max(...rects.map((r) => r.right)) + scrollX) - x, height: Math.ceil(Math.max(...rects.map((r) => r.bottom)) + scrollY) - y } };
})`;

const byFace = (a: FontFace, b: FontFace) => a.family.localeCompare(b.family) || a.weight - b.weight || a.style.localeCompare(b.style);
/** The platform fonts Chromium drew the marked text with (fallbacks included), once each: the faces Figma must also have. */
async function drawnFaces(cdp: CDPSession): Promise<FontFace[]> {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-ds-reader-text]' });
  const faces: FontFace[] = [];
  for (const nodeId of nodeIds) {
    const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
    const [weight, style] = attributes[attributes.indexOf('data-ds-reader-text') + 1]!.split(' ');
    for (const f of (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts)
      faces.push({ family: f.familyName, weight: Number(weight), style: style === 'italic' ? 'italic' : 'normal' });
  }
  return [...new Map(faces.map((f) => [JSON.stringify(f), f])).values()].sort(byFace);
}

/** The platform families Chromium painted each content run with (Figma text has one family and no fallback stack,
 *  so this, not the declared stack, is what React to Figma compares). Each owner the collector marked is read once,
 *  then unmarked. A run is read from the node that draws it: a direct text child; a form field's text in its
 *  user-agent shadow root (its light-DOM text, a textarea's default, is never drawn); generated content as its own
 *  ::before or ::after node, matched by its computed content. A checkbox or radio never draws its value, so the
 *  element's report is that run's paint. Any other run whose node is not reached keeps no `painted`: unread. */
type CdpNode = { nodeType: number; nodeName: string; nodeValue: string; backendNodeId: number; pseudoType?: string;
  attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[]; pseudoElements?: CdpNode[] };
export async function paintRuns(cdp: CDPSession, content: DomContent): Promise<void> {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-ds-run]' });
  const families = async (id: number) => [...new Set((await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id })).fonts.map((f) => f.familyName))].sort();
  const texts = (n: CdpNode): CdpNode[] => [...(n.nodeType === 3 ? [n] : []), ...(n.children ?? []).flatMap(texts), ...(n.shadowRoots ?? []).flatMap(texts)];
  for (const nodeId of nodeIds) {
    const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
    const node = (await cdp.send('DOM.describeNode', { nodeId, depth: -1, pierce: true })).node as unknown as CdpNode;
    const field = node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA';
    const textNodes = field ? (node.shadowRoots ?? []).flatMap(texts) : (node.children ?? []).filter((c) => c.nodeType === 3);
    const pseudo = (node.pseudoElements ?? []).filter((p) => p.pseudoType === 'before' || p.pseudoType === 'after');
    const ids = textNodes.length + pseudo.length
      ? (await cdp.send('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [...textNodes, ...pseudo].map((n) => n.backendNodeId) })).nodeIds : [];
    const drawn = textNodes.map((t, j) => ({ text: t.nodeValue, id: ids[j]! }));
    for (const j of pseudo.keys()) {
      const id = ids[textNodes.length + j]!, value = (await cdp.send('CSS.getComputedStyleForNode', { nodeId: id })).computedStyle.find((c) => c.name === 'content')?.value ?? '';
      if (/^["']/.test(value)) drawn.push({ text: value.slice(1, -1), id });
    }
    const pairs = node.attributes ?? [], at = pairs.findIndex((a, k) => k % 2 === 0 && a === 'type');
    const type = node.nodeName === 'INPUT' && at >= 0 ? pairs[at + 1]!.toLowerCase() : '';
    const used = new Set<number>();
    for (const i of attributes[attributes.indexOf('data-ds-run') + 1]!.split(' ')) {
      const run = content.runs![Number(i)]!, k = drawn.findIndex((d, j) => !used.has(j) && d.text === run.text);
      if (k >= 0) { used.add(k); run.painted = await families(drawn[k]!.id); }
      else if (type === 'checkbox' || type === 'radio') run.painted = await families(nodeId);
    }
    await cdp.send('DOM.removeAttribute', { nodeId, name: 'data-ds-run' });
  }
}

/** The one environment the reader renders in (owner conditions, 2026-11-01): an image built locally from
 *  storybook-reader-image/ (Playwright's image for this checkout's playwright-core, by digest, with the
 *  Croscore faces Figma lists in place of Liberation and the generic families set to them), on CI's
 *  architecture. A library that ships no fonts leaves the face to the platform, so the platform is pinned;
 *  the face it picks is the font input the preflight holds. The image is tagged by the folder's hash and
 *  never pushed. */
export const PINNED = { source: new URL('./storybook-reader-image/', import.meta.url), platform: 'linux/amd64' };
/** Every input a page can read from the machine, pinned (parent session, 2026-11-05): calendars and date
 *  pickers draw today's month, so the clock is fixed at an instant that reproduces the first pinned
 *  references; Math.random is seeded, since a story may draw random content. Timers keep running. */
export const PAGE = { clock: '2026-11-01T12:00:00.000Z', timezoneId: 'UTC', locale: 'en-US', viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference', randomSeed: 1 } as const;
export interface RenderEnvironment { image: string; imageSource: string; imageId: string; platform: string; os: string; chromium: string; fonts: string[];
  page?: typeof PAGE; args?: readonly string[]; textLayout?: { face: string; size: number; fractional: string; fringePixels: number };
  /** The React renderer the Storybook loaded, e.g. "react-dom 18.3.1". */
  react?: string }
/** React versions the reader has been run on (React's tree is read through internals that differ by version):
 *  18.3 on the Agriculture Design System, whose Storybook ships a canary build "18.3.0-canary-…", and 19.2 on
 *  this repository's own Storybook. A prerelease of a tested line counts as that line. */
export const REACT_TESTED = /^(18\.3|19\.\d+)\.\d+(-[0-9A-Za-z.-]+)?$/;

/** Text is set at the font's design advances (parent session, 2026-11-05): headless Chromium's default "full"
 *  hinting also turns off subpixel positioning, so every glyph landed on a whole pixel, up to 15.7 px off the
 *  design over 39 characters. Text is antialiased by coverage alone, as macOS and Figma do: the image's Ubuntu
 *  fontconfig asked for RGB subpixel (LCD) text, a property of a display, which smeared glyphs sideways in
 *  color (fringe 88 levels on Base UI's text). The container launches the browser itself with these args. */
export const PINNED_ARGS = ['--font-render-hinting=none', '--disable-lcd-text'] as const;
const LAUNCH = `require('/playwright-core').chromium.launchServer({ port: 3000, host: '0.0.0.0', wsPath: '/pinned', args: ${JSON.stringify(PINNED_ARGS)} })`;

/** Every run proves it: a probe in Arimo (always in the image), loaded as a web font as the checks load theirs
 *  (fontconfig positions installed faces differently), at 13 px, whose design advances are fractional, must not
 *  land every glyph on a whole pixel, and, drawn gray on opaque white, must have no pixel whose channels
 *  spread over 2 levels (a color fringe), or the run is refused by name. A Playwright or image bump that drops
 *  the args fails here, never silently. */
export async function textLayoutProbe(browser: Browser, arimo: Buffer): Promise<NonNullable<RenderEnvironment['textLayout']>> {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>@font-face{font-family:probe;src:url(data:font/ttf;base64,${arimo.toString('base64')})}</style>`
      + '<span style="font:13px probe;white-space:pre;color:#737373;background:#fff">Hamburgefonstiv 0123456789</span>');
    await page.evaluate('document.fonts.ready');
    const xs = (await page.evaluate(`(() => { const s = document.querySelector('span'), t = s.firstChild, x0 = s.getBoundingClientRect().left, xs = [];
      for (let i = 1; i < t.length; i++) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); xs.push(r.getBoundingClientRect().left - x0); }
      return xs; })()`)) as number[];
    const fractional = xs.filter((x) => Math.abs(x - Math.round(x)) > 0.001).length;
    if (!fractional) throw Error(`pinned-browser-text-on-whole-pixels: every probe glyph landed on a whole pixel (expected args: ${PINNED_ARGS.join(' ')})`);
    const { data } = PNG.sync.read(await page.locator('span').screenshot());
    let fringePixels = 0;
    for (let i = 0; i < data.length; i += 4) if (Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!) > 2) fringePixels++;
    if (fringePixels) throw Error(`pinned-browser-text-color-fringe: ${fringePixels} probe pixel(s) spread over 2 levels across channels (expected args: ${PINNED_ARGS.join(' ')})`);
    return { face: 'Arimo', size: 13, fractional: `${fractional}/${xs.length}`, fringePixels };
  } finally { await page.close(); }
}

/** Start the pinned image with a browser server from this checkout's own playwright-core, mounted read-only. */
export async function pinnedBrowser() {
  const core = path.dirname(createRequire(import.meta.url).resolve('playwright-core/package.json'));
  const version = (JSON.parse(readFileSync(path.join(core, 'package.json'), 'utf8')) as { version: string }).version;
  const source = fileURLToPath(PINNED.source), files = readdirSync(source).sort();
  const dockerfile = readFileSync(path.join(source, 'Dockerfile'), 'utf8'), image = /^FROM (\S+)/m.exec(dockerfile)?.[1] ?? '';
  if (!image.includes(`:v${version}-`)) throw Error(`storybook-reader: playwright-core ${version} is not the pinned image's; re-pin both together`);
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
  const sum = createHash('sha256');
  for (const f of files) sum.update(`${f}\0`).update(readFileSync(path.join(source, f))).update('\0');
  const hash = sum.digest('hex'), tag = `ds-contracts-reader:${hash.slice(0, 16)}`;
  let imageId: string;
  try { imageId = execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', tag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {
    execFileSync('docker', ['build', '--platform', PINNED.platform, '-t', tag, source], { stdio: ['ignore', 'ignore', 'inherit'] });
    imageId = docker('image', 'inspect', '--format', '{{.Id}}', tag);
  }
  const id = docker('run', '-d', '--rm', '--init', '--ipc=host', '--platform', PINNED.platform, '-p', '127.0.0.1::3000', '--add-host=host.docker.internal:host-gateway', '-v', `${core}:/playwright-core:ro`,
    tag, 'node', '-e', LAUNCH);
  const stop = () => { docker('stop', id); };
  try {
    const port = docker('port', id, '3000').split('\n')[0]!.split(':').pop();
    const { chromium } = await import('playwright-core');
    let browser: Browser;
    for (let tries = 0; ; tries++) {
      try { browser = await chromium.connect(`ws://127.0.0.1:${port}/pinned`); break; }
      catch (e) { if (tries >= 60) throw e; await new Promise((r) => setTimeout(r, 1000)); }
    }
    const environment: RenderEnvironment = { image, imageSource: hash, imageId, platform: PINNED.platform,
      os: docker('exec', id, 'sh', '-c', '. /etc/os-release && echo "$PRETTY_NAME"'), chromium: browser.version(),
      fonts: [...new Set(docker('exec', id, 'fc-list', '--format', '%{family[0]} | %{style[0]} | %{fontversion}\\n').split('\n'))].sort(),
      args: PINNED_ARGS, textLayout: await textLayoutProbe(browser, execFileSync('docker', ['exec', id, 'cat', '/usr/share/fonts/truetype/croscore/Arimo[wght].ttf'])) };
    return { browser, environment, stop };
  } catch (e) { stop(); throw e; }
}

/** Every story in the Storybook's index, loaded through its preview API in the pinned Chromium, and its components with references. */
async function loadStorybook(storybook: string, shotsDir?: string, grammarOnly = false, declared: readonly ComponentDeclaration[] = [], excluded: readonly ExcludedTitle[] = []): Promise<{ environment: RenderEnvironment; stories: LoadedStory[]; components: StoryComponent[] }> {
  const base = storybook.endsWith('/') ? storybook : storybook + '/';
  // The browser runs in the pinned container: a Storybook on this machine is reached through Docker's host gateway.
  const shown = new URL(base);
  if (['localhost', '127.0.0.1', '[::1]'].includes(shown.hostname)) shown.hostname = 'host.docker.internal';
  const index = await (await fetch(new URL('index.json', base))).json() as { entries: Record<string, { type: string; id: string }> };
  const ids = Object.values(index.entries).filter((e) => e.type === 'story').map((e) => e.id);
  if (!ids.length) throw Error('storybook-reader: index.json lists no stories');
  const { browser, environment, stop } = await pinnedBrowser();
  try {
    const { clock, randomSeed, ...context } = PAGE;
    const page = await (await browser.newContext(context)).newPage();
    await page.clock.setFixedTime(new Date(clock));
    await page.addInitScript(`{ let s = ${randomSeed} >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`);
    environment.page = PAGE;
    // A do-nothing DevTools hook, so React names its renderer version when it loads; it changes no rendering.
    await page.addInitScript(`window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map(), supportsFiber: true, checkDCE() {},
      inject(r) { this.renderers.set(this.renderers.size + 1, r); return this.renderers.size; }, onScheduleFiberRoot() {}, onCommitFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {} };`);
    await page.goto(new URL(`iframe.html?id=${encodeURIComponent(ids[0]!)}&viewMode=story`, shown).href, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => (window as any).__STORYBOOK_PREVIEW__?.storyStoreValue, null, { timeout: 60_000 });
    const stories = await page.evaluate(`(async (storyIds) => {
      const store = window.__STORYBOOK_PREVIEW__.storyStoreValue;
      // Functions (actions, component types inside elements) keep a named marker, so two stories differ when they do.
      const plain = (v) => { try { return JSON.parse(JSON.stringify(v ?? null, (k, x) => typeof x === 'function' ? '[function ' + (x.displayName || x.name || '') + ']' : x)); } catch { return null; } };
      const out = [];
      for (const id of storyIds) {
        const s = await store.loadStory({ storyId: id });
        out.push({ id, title: s.title, name: s.name, args: plain(s.initialArgs) ?? {}, ownRender: true, renderFailed: false,
          argTypes: Object.fromEntries(Object.entries(s.argTypes).map(([k, a]) => [k, { control: plain(a.control) ?? undefined, options: plain(a.options) ?? undefined, type: plain(a.type) ?? undefined }])) });
      }
      return out;
    })(${JSON.stringify(ids)})`) as LoadedStory[];
    type Shown = { tree: RenderedNode | null; box?: Box };
    const show = (id: string, args: Record<string, unknown> = {}) => page.evaluate(`${SHOW}(${JSON.stringify([id, args])})`) as Promise<Shown>;
    // Pass 1, own render from the rendered page: each story at its own arguments.
    for (const s of stories) { const { tree } = await show(s.id); s.renderFailed = !tree; s.ownRender = !!tree && !rendersOneInstance(tree);
      if (tree && !s.ownRender) s.layout = await page.evaluate(`${LAYOUT_FLAGS}(window.__dsReaderTops)`) as Array<[string, string]>; }
    const renderers = await page.evaluate(`[...new Set([...window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.values()].map((r) => r.rendererPackageName + ' ' + r.version))]`) as string[];
    if (renderers.length !== 1 || !REACT_TESTED.test(renderers[0]!.split(' ')[1] ?? ''))
      throw Error(`storybook-reader: React renderer ${renderers.join(', ') || 'not found'} is outside the tested 18.3 and 19.x range`);
    environment.react = renderers[0];
    // Pass 2, a reference image per expected variant, and the faces its text is drawn with.
    // --grammar-only: the grammar classifier and the matrix rule alone (no reference is rendered or kept).
    if (grammarOnly) return { environment, stories, components: readStories(stories, declared, excluded) };
    const all = readStories(stories, declared, excluded), components = all.filter((c) => !c.excludedBy), cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    // Still throughout pass 2, as the Figma to React page is (its own rule): every reading of a reference (its box
    // and text marks, the capture, its faces and content) sees the same frame, so a running animation cannot make
    // two runs differ. Pass 1 reads only React's tree.
    await page.evaluate(`(() => { const s = document.createElement('style'); s.id = 'ds-reader-still'; s.textContent = ${JSON.stringify(NO_MOTION)}; document.head.appendChild(s); })()`);
    for (const c of components) {
      const faces = new Map<string, FontFace>();
      for (const [i, ref] of c.references.entries()) {
        const { tree, box } = await show(ref.storyId, ref.args);
        // An instance that draws nothing (an empty layout, zero size) has no image to compare; it is named apart.
        const problem = !tree ? 'reference-render-failed' : !rendersOneInstance(tree) ? 'reference-not-one-instance' : !box ? 'reference-empty' : undefined;
        if (problem) { ref.problem = problem; continue; }
        // The instance alone, captured as the Figma to React check captures its own side: ancestor background
        // colors cleared and restored, the image clipped to the paint extent Chromium's layers report. Playwright
        // hides the caret by setting and clearing each input's caret color, which leaves an empty style attribute;
        // one screenshot first lets the capture's before-and-after checks start from that state.
        await page.screenshot({ clip: box, fullPage: true, animations: 'disabled', omitBackground: true });
        const captured = await page.evaluate(MARK_SUBJECT) ? await captureSubjectWithoutBackdrop(page, '[data-ds-reader-subject]', '[data-ds-reader-cell]') : { refused: 'reference-not-one-element' };
        if ('refused' in captured) { ref.problem = 'reference-capture-unqualified'; ref.captureRefused = captured.refused; }
        else {
          ref.png = `${c.storyId}.${i}.png`; ref.box = box; ref.sha256 = createHash('sha256').update(captured.bytes).digest('hex');
          ref.frame = { ...captured.frame, raster: { kind: 'browser-paint-extent-v1', paint: captured.paint } };
          if (shotsDir) writeFileSync(path.join(shotsDir, ref.png), captured.bytes);
        }
        ref.faces = await drawnFaces(cdp);
        // Read after the capture, so the image is never touched.
        const container = (await page.evaluateHandle('window.__dsReaderContainer') as JSHandle<Element | null>).asElement();
        if (container) { ref.content = await container.evaluate(domContentOf, true); await paintRuns(cdp, ref.content); }
        else ref.contentProblem = 'reference-content-not-one-container';
        for (const f of ref.faces) faces.set(JSON.stringify(f), f);
      }
      c.faces = [...faces.values()].sort(byFace);
    }
    return { environment, stories, components: [...components, ...all.filter((c) => c.excludedBy)] };
  } finally { await browser.close(); stop(); }
}

if (process.argv[1] && /storybook-reader\.ts$/.test(process.argv[1])) {
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const storybook = flag('--storybook'), out = flag('--out');
  if (!storybook || !out) { console.error('usage: npx tsx scripts/storybook-reader.ts --storybook <url> --out <dir> [--grammar-only] [--profile <system profile>]'); process.exit(2); }
  const grammarOnly = process.argv.includes('--grammar-only'), profile = flag('--profile');
  // A system profile's decision-4 declarations (its `components`): which stories make each component, and its axes.
  const read = profile ? readProfile(profile) : undefined;
  const declared = read?.components ?? [], excludedTitles = read?.excluded ?? [];
  mkdirSync(path.join(out, grammarOnly ? '' : 'references'), { recursive: true });
  loadStorybook(storybook, grammarOnly ? undefined : path.join(out, 'references'), grammarOnly, declared, excludedTitles).then(({ environment, stories, components: all }) => {
    // Excluded titles never become components, and are reported apart with what they would have been.
    const components = all.filter((c) => !c.excludedBy), excluded = all.filter((c) => c.excludedBy)
      .map(({ title, stories: n, grammar, matrix, excludedBy }) => ({ title, reason: excludedBy!, stories: n, grammar, matrix }));
    // Grammar only: each component's verdict, matrix outcome and layout flags; each story's render outcome. No references.
    if (grammarOnly) writeFileSync(path.join(out, 'grammar.json'), JSON.stringify({ version: 1, storybook, environment,
      stories: stories.map(({ id, title, ownRender, renderFailed }) => ({ id, title, ownRender, renderFailed })),
      components: components.map(({ title, stories: n, grammar, layout, matrix, leftOut, repeats }) => ({ title, stories: n, grammar, layout, matrix, leftOut, repeats,
        leftOutVariants: leftOut?.filter((l) => l.reason === 'left-out-variant').length })), excluded }, null, 2) + '\n');
    else writeFileSync(path.join(out, 'stories.json'), JSON.stringify({ version: 1, storybook, environment, stories: stories.length, components, excluded }, null, 2) + '\n');
    const inGrammar = components.filter((c) => c.grammar.grammar === 'in').length, kit = components.length + excluded.length;
    // Coverage never shrinks the kit: the headline counts excluded titles in the denominator; the other figure does not.
    if (excluded.length) console.log(`coverage ${inGrammar}/${kit} with the ${excluded.length} title(s) excluded by profile counted (headline), ${inGrammar}/${components.length} without`);
    console.log(`${components.length} component(s), ${excluded.length} excluded by profile, ${stories.length} stories: ${inGrammar} in grammar; ` +
      `${components.filter((c) => c.matrix.status === 'ok' && c.matrix.variants > 1).length} with more than one variant, ` +
      `${components.reduce((n, c) => n + (c.matrix.status === 'ok' ? c.matrix.variants : 0), 0)} variants, ` +
      `${components.filter((c) => c.matrix.status === 'refused').length} refused → ${path.join(out, grammarOnly ? 'grammar.json' : 'stories.json')}`);
  }).catch((e) => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
