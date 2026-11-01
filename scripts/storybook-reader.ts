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
 * Deterministic for one Storybook build; no model call.
 *
 * Run: npx tsx scripts/storybook-reader.ts --storybook <https://…/storybook/> --out <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyStoryArgs, type GrammarVerdict, type StoryArgType } from '../extract/figma/grammar.js';
import { rendersOneInstance, storyVariantMatrix, type RenderedNode } from '../extract/figma/variant-matrix.js';

export interface LoadedStory { id: string; title: string; name: string; argTypes: Record<string, StoryArgType>; args: Record<string, unknown>;
  /** The rendered story shows more than one instance of its component, or content beside it. */
  ownRender: boolean;
  /** The reader could not render the story (an instrument fault, named apart). */
  renderFailed: boolean }
export interface StoryComponent {
  title: string; stories: number; storyId: string; grammar: GrammarVerdict;
  /** The variant matrix rule, stories as variants (GOAL.md signed entry of 2026-11-01). */
  matrix: { status: 'ok'; axes: string[]; variants: number } | { status: 'refused'; reason: string };
  /** Named, never counted: own-render stories, repeats of an earlier story's state, stories the reader could not render. */
  ownRender: string[]; repeats: string[]; renderFailed: string[];
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
      ownRender: m.ownRender, repeats: m.repeats, renderFailed: m.renderFailed };
  }).sort((a, b) => a.title.localeCompare(b.title));
}

/** Every story in the Storybook's index, loaded through its preview API in Chromium. */
async function loadStorybook(storybook: string): Promise<LoadedStory[]> {
  const base = storybook.endsWith('/') ? storybook : storybook + '/';
  const index = await (await fetch(new URL('index.json', base))).json() as { entries: Record<string, { type: string; id: string }> };
  const ids = Object.values(index.entries).filter((e) => e.type === 'story').map((e) => e.id);
  if (!ids.length) throw Error('storybook-reader: index.json lists no stories');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(new URL(`iframe.html?id=${encodeURIComponent(ids[0]!)}&viewMode=story`, base).href, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => (window as any).__STORYBOOK_PREVIEW__?.storyStoreValue, null, { timeout: 60_000 });
    // A string, not a function: the TypeScript loader would wrap named helpers in code the page lacks.
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
    // Own render from the rendered page: render each story through Storybook's own channel and
    // compact React's tree (instances of the story's component by type; DOM elements and text).
    const trees = await page.evaluate(`(async (storyIds) => {
      const store = window.__STORYBOOK_PREVIEW__.storyStoreValue, channel = window.__STORYBOOK_ADDONS_CHANNEL__;
      const root = document.getElementById('storybook-root'), out = {};
      for (const id of storyIds) {
        const outcome = await new Promise((resolve) => {
          const finish = (r) => { channel.off('storyRendered', ok); channel.off('storyErrored', bad); channel.off('storyThrewException', bad); resolve(r); };
          const ok = (sid) => { if (sid === id) finish('rendered'); }, bad = () => finish('failed');
          channel.on('storyRendered', ok); channel.on('storyErrored', bad); channel.on('storyThrewException', bad);
          setTimeout(() => finish('failed'), 20000);
          channel.emit('setCurrentStory', { storyId: id, viewMode: 'story' });
        });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const component = (await store.loadCSFFileByStoryId(id)).meta.component;
        const same = (t) => !!t && !!component && (t === component || t.type === component || t.render === component || t === component.type || t === component.render);
        const build = (f) => { const nodes = []; for (let c = f; c; c = c.sibling) { const kids = build(c.child);
          if (same(c.type) || same(c.elementType)) nodes.push({ i: true });
          else if (typeof c.type === 'string' || c.tag === 6) nodes.push(kids.length ? { h: true, c: kids } : { h: true });
          else nodes.push(...kids); } return nodes; };
        const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
        const live = key ? (root[key].stateNode?.current ?? root[key]) : null;
        out[id] = outcome === 'rendered' && live ? { c: build(live.child) } : null;
      }
      return out;
    })(${JSON.stringify(ids)})`) as Record<string, RenderedNode | null>;
    for (const s of stories) { s.renderFailed = !trees[s.id]; s.ownRender = !s.renderFailed && !rendersOneInstance(trees[s.id]!); }
    return stories;
  } finally { await browser.close(); }
}

if (process.argv[1] && /storybook-reader\.ts$/.test(process.argv[1])) {
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const storybook = flag('--storybook'), out = flag('--out');
  if (!storybook || !out) { console.error('usage: npx tsx scripts/storybook-reader.ts --storybook <url> --out <dir>'); process.exit(2); }
  loadStorybook(storybook).then((stories) => {
    const components = readStories(stories);
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'stories.json'), JSON.stringify({ version: 1, storybook, stories: stories.length, components }, null, 2) + '\n');
    const inGrammar = components.filter((c) => c.grammar.grammar === 'in').length;
    console.log(`${components.length} component(s), ${stories.length} stories: ${inGrammar} in grammar; ` +
      `${components.filter((c) => c.matrix.status === 'ok' && c.matrix.variants > 1).length} with more than one variant, ` +
      `${components.reduce((n, c) => n + (c.matrix.status === 'ok' ? c.matrix.variants : 0), 0)} variants, ` +
      `${components.filter((c) => c.matrix.status === 'refused').length} refused → ${path.join(out, 'stories.json')}`);
  }).catch((e) => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
