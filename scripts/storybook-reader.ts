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
 * instance as the reference image (the library's own render, never the
 * engine's), plus every platform font Chromium drew its text with, for the
 * React to Figma font preflight. Every page is rendered in one pinned
 * environment (PINNED, run through Docker) and the receipt records it, so the
 * references reproduce on any machine. Deterministic for one Storybook build;
 * no model call.
 *
 * Run: npx tsx scripts/storybook-reader.ts --storybook <https://…/storybook/> --out <dir>
 * Needs a running Docker; the pinned image is pulled on first use. An arm64
 * machine emulates amd64: the image's native arm64 build draws a few pixels one
 * level apart (2 of A0's 431 references), so the architecture is pinned too.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { classifyStoryArgs, type GrammarVerdict, type StoryArgType } from '../extract/figma/grammar.js';
import { rendersOneInstance, storyVariantMatrix, type RenderedNode, type VariantRender } from '../extract/figma/variant-matrix.js';
import type { CDPSession } from 'playwright-core';
import type { FontFace } from './font-preflight.js';

export interface LoadedStory { id: string; title: string; name: string; argTypes: Record<string, StoryArgType>; args: Record<string, unknown>;
  /** The rendered story shows more than one instance of its component, or content beside it. */
  ownRender: boolean;
  /** The reader could not render the story (an instrument fault, named apart). */
  renderFailed: boolean }
/** One expected variant's reference: the story and arguments it renders from, then its PNG and box, or why it has none. */
export interface VariantReference extends VariantRender { png?: string; sha256?: string; box?: Box; faces?: FontFace[];
  problem?: 'reference-render-failed' | 'reference-not-one-instance' }
type Box = { x: number; y: number; width: number; height: number };
export interface StoryComponent {
  title: string; stories: number; storyId: string; grammar: GrammarVerdict;
  /** The variant matrix rule, stories as variants (GOAL.md signed entry of 2026-11-01). */
  matrix: { status: 'ok'; axes: string[]; variants: number } | { status: 'refused'; reason: string };
  /** Named, never counted: own-render stories, repeats of an earlier story's state, stories the reader could not render. */
  ownRender: string[]; repeats: string[]; renderFailed: string[];
  /** In the matrix's variant order; every face the references' text renders with, for the font preflight. */
  references: VariantReference[]; faces: FontFace[];
}

export function readStories(stories: readonly LoadedStory[]): StoryComponent[] {
  const byTitle = new Map<string, LoadedStory[]>();
  for (const s of stories) (byTitle.get(s.title) ?? byTitle.set(s.title, []).get(s.title)!).push(s);
  return [...byTitle].map(([title, list]) => {
    const first = list[0]!;
    const argTypes = Object.fromEntries(Object.entries(first.argTypes).sort(([a], [b]) => a.localeCompare(b)));
    const m = storyVariantMatrix(list.map((s) => ({ id: s.id, args: s.args ?? {}, argTypes: s.argTypes, ownRender: s.ownRender, renderFailed: s.renderFailed })));
    return { title, stories: list.length, storyId: first.id, grammar: classifyStoryArgs(argTypes),
      matrix: m.status === 'ok' ? { status: 'ok' as const, axes: m.matrix.axes.map((a) => a.name), variants: m.matrix.variants.length } : { status: 'refused' as const, reason: m.reason },
      ownRender: m.ownRender, repeats: m.repeats, renderFailed: m.renderFailed, references: m.renders.map((r) => ({ ...r })), faces: [] };
  }).sort((a, b) => a.title.localeCompare(b.title));
}

// Render one story through Storybook's own channel (`args` over its listed options), compact React's tree
// (instances of the story's component by type; DOM elements and text), and for a single instance return
// its box, outward to whole pixels; its text elements are marked with their weight and style for the font
// lookup. A string, not a function: the TypeScript loader would wrap named helpers in code the page lacks.
const SHOW = `(async ([id, args]) => {
  const store = window.__STORYBOOK_PREVIEW__.storyStoreValue, channel = window.__STORYBOOK_ADDONS_CHANNEL__;
  const wait = (event, emit) => new Promise((resolve) => {
    const handlers = [[event, (p) => { if ((p?.storyId ?? p) === id) done('rendered'); }], ['storyUnchanged', (p) => { if (p === id) done('rendered'); }],
      ['storyErrored', () => done('failed')], ['storyThrewException', () => done('failed')]];
    const done = (r) => { for (const [e, f] of handlers) channel.off(e, f); resolve(r); };
    for (const [e, f] of handlers) channel.on(e, f);
    setTimeout(() => done('failed'), 20000);
    emit();
  });
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

/** The one environment the reader renders in (owner condition, 2026-11-01): Playwright's image for this
 *  checkout's playwright-core, by digest, on CI's architecture. A library that ships no fonts leaves the
 *  face to the platform, so the platform is pinned; the face it picks is the font input the preflight holds. */
export const PINNED = { image: 'mcr.microsoft.com/playwright:v1.61.1-noble@sha256:cf0daee9b994042e011bc29f20cdff1a9f682a039b43fcd738f7d8a9d3bcd9d6', platform: 'linux/amd64' };
export interface RenderEnvironment { image: string; platform: string; os: string; chromium: string; fonts: string[] }

/** Start the pinned image with a browser server from this checkout's own playwright-core, mounted read-only. */
async function pinnedBrowser() {
  const core = path.dirname(createRequire(import.meta.url).resolve('playwright-core/package.json'));
  const version = (JSON.parse(readFileSync(path.join(core, 'package.json'), 'utf8')) as { version: string }).version;
  if (!PINNED.image.includes(`:v${version}-`)) throw Error(`storybook-reader: playwright-core ${version} is not the pinned image's; re-pin both together`);
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
  const id = docker('run', '-d', '--rm', '--init', '--ipc=host', '--platform', PINNED.platform, '-p', '127.0.0.1::3000', '-v', `${core}:/playwright-core:ro`,
    PINNED.image, 'node', '/playwright-core/cli.js', 'run-server', '--port', '3000', '--host', '0.0.0.0');
  const stop = () => { docker('stop', id); };
  try {
    const port = docker('port', id, '3000').split('\n')[0]!.split(':').pop();
    const { chromium } = await import('playwright-core');
    for (let tries = 0; ; tries++) {
      try {
        const browser = await chromium.connect(`ws://127.0.0.1:${port}/`);
        const environment: RenderEnvironment = { ...PINNED, os: docker('exec', id, 'sh', '-c', '. /etc/os-release && echo "$PRETTY_NAME"'), chromium: browser.version(),
          fonts: [...new Set(docker('exec', id, 'fc-list', '--format', '%{family[0]} | %{style[0]} | %{fontversion}\\n').split('\n'))].sort() };
        return { browser, environment, stop };
      } catch (e) { if (tries >= 60) throw e; await new Promise((r) => setTimeout(r, 1000)); }
    }
  } catch (e) { stop(); throw e; }
}

/** Every story in the Storybook's index, loaded through its preview API in the pinned Chromium, and its components with references. */
async function loadStorybook(storybook: string, shotsDir?: string): Promise<{ environment: RenderEnvironment; stories: LoadedStory[]; components: StoryComponent[] }> {
  const base = storybook.endsWith('/') ? storybook : storybook + '/';
  const index = await (await fetch(new URL('index.json', base))).json() as { entries: Record<string, { type: string; id: string }> };
  const ids = Object.values(index.entries).filter((e) => e.type === 'story').map((e) => e.id);
  if (!ids.length) throw Error('storybook-reader: index.json lists no stories');
  const { browser, environment, stop } = await pinnedBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(new URL(`iframe.html?id=${encodeURIComponent(ids[0]!)}&viewMode=story`, base).href, { waitUntil: 'load', timeout: 60_000 });
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
    for (const s of stories) { const { tree } = await show(s.id); s.renderFailed = !tree; s.ownRender = !!tree && !rendersOneInstance(tree); }
    // Pass 2, a reference image per expected variant, and the faces its text is drawn with.
    const components = readStories(stories), cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    for (const c of components) {
      const faces = new Map<string, FontFace>();
      for (const [i, ref] of c.references.entries()) {
        const { tree, box } = await show(ref.storyId, ref.args);
        if (!tree || !box || !rendersOneInstance(tree)) { ref.problem = tree ? 'reference-not-one-instance' : 'reference-render-failed'; continue; }
        const png = await page.screenshot({ clip: box, fullPage: true, animations: 'disabled', omitBackground: true });
        ref.png = `${c.storyId}.${i}.png`; ref.box = box; ref.sha256 = createHash('sha256').update(png).digest('hex');
        if (shotsDir) writeFileSync(path.join(shotsDir, ref.png), png);
        ref.faces = await drawnFaces(cdp);
        for (const f of ref.faces) faces.set(JSON.stringify(f), f);
      }
      c.faces = [...faces.values()].sort(byFace);
    }
    return { environment, stories, components };
  } finally { await browser.close(); stop(); }
}

if (process.argv[1] && /storybook-reader\.ts$/.test(process.argv[1])) {
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const storybook = flag('--storybook'), out = flag('--out');
  if (!storybook || !out) { console.error('usage: npx tsx scripts/storybook-reader.ts --storybook <url> --out <dir>'); process.exit(2); }
  mkdirSync(path.join(out, 'references'), { recursive: true });
  loadStorybook(storybook, path.join(out, 'references')).then(({ environment, stories, components }) => {
    writeFileSync(path.join(out, 'stories.json'), JSON.stringify({ version: 1, storybook, environment, stories: stories.length, components }, null, 2) + '\n');
    const inGrammar = components.filter((c) => c.grammar.grammar === 'in').length;
    console.log(`${components.length} component(s), ${stories.length} stories: ${inGrammar} in grammar; ` +
      `${components.filter((c) => c.matrix.status === 'ok' && c.matrix.variants > 1).length} with more than one variant, ` +
      `${components.reduce((n, c) => n + (c.matrix.status === 'ok' ? c.matrix.variants : 0), 0)} variants, ` +
      `${components.filter((c) => c.matrix.status === 'refused').length} refused → ${path.join(out, 'stories.json')}`);
  }).catch((e) => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
