/**
 * THE STORYBOOK READER, part 1 (docs/GOAL.md Step 2). React to Figma reads a
 * library from its own Storybook, never from a hand-written declaration: the
 * owner chose (2026-10-31) to judge it only by GOAL.md's checks against the
 * library's own render. This part reads every story's arguments in pinned
 * Chromium through Storybook's own preview API, groups stories by component
 * title, and holds each component's first story (index order) against the
 * grammar classifier, and holds all of its stories against the variant matrix
 * rule, where each story is one variant (owner, 2026-11-01) and a story with
 * its own render is named, not counted.
 * Deterministic for one Storybook build; no model call.
 *
 * Run: npx tsx scripts/storybook-reader.ts --storybook <https://…/storybook/> --out <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyStoryArgs, type GrammarVerdict, type StoryArgType } from '../extract/figma/grammar.js';
import { storyVariantMatrix } from '../extract/figma/variant-matrix.js';

export interface LoadedStory { id: string; title: string; name: string; argTypes: Record<string, StoryArgType>; args: Record<string, unknown>;
  /** The story, or its file's meta, supplies its own render (a grid, a composed example). */
  ownRender: boolean }
export interface StoryComponent {
  title: string; stories: number; storyId: string; grammar: GrammarVerdict;
  /** The variant matrix rule, stories as variants (GOAL.md signed entry of 2026-11-01). */
  matrix: { status: 'ok'; axes: string[]; variants: number } | { status: 'refused'; reason: string };
  /** Stories with their own render: named, never counted as variants. */
  ownRender: string[];
}

export function readStories(stories: readonly LoadedStory[]): StoryComponent[] {
  const byTitle = new Map<string, LoadedStory[]>();
  for (const s of stories) (byTitle.get(s.title) ?? byTitle.set(s.title, []).get(s.title)!).push(s);
  return [...byTitle].map(([title, list]) => {
    const first = list[0]!;
    const argTypes = Object.fromEntries(Object.entries(first.argTypes).sort(([a], [b]) => a.localeCompare(b)));
    const m = storyVariantMatrix(list.map((s) => ({ id: s.id, args: s.args ?? {}, argTypes: s.argTypes, ownRender: s.ownRender })));
    return { title, stories: list.length, storyId: first.id, grammar: classifyStoryArgs(argTypes),
      matrix: m.status === 'ok' ? { status: 'ok' as const, axes: m.matrix.axes.map((a) => a.name), variants: m.matrix.variants.length } : { status: 'refused' as const, reason: m.reason },
      ownRender: m.ownRender };
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
    return await page.evaluate(`(async (storyIds) => {
      const store = window.__STORYBOOK_PREVIEW__.storyStoreValue;
      // Functions (actions, component types inside elements) keep a named marker, so two stories differ when they do.
      const plain = (v) => { try { return JSON.parse(JSON.stringify(v ?? null, (k, x) => typeof x === 'function' ? '[function ' + (x.displayName || x.name || '') + ']' : x)); } catch { return null; } };
      const out = [];
      for (const id of storyIds) {
        const s = await store.loadStory({ storyId: id }), csf = await store.loadCSFFileByStoryId(id);
        const own = typeof s.moduleExport === 'function' || typeof s.moduleExport?.render === 'function' || typeof csf.meta?.render === 'function';
        out.push({ id, title: s.title, name: s.name, args: plain(s.initialArgs) ?? {}, ownRender: own,
          argTypes: Object.fromEntries(Object.entries(s.argTypes).map(([k, a]) => [k, { control: plain(a.control) ?? undefined, options: plain(a.options) ?? undefined, type: plain(a.type) ?? undefined }])) });
      }
      return out;
    })(${JSON.stringify(ids)})`) as LoadedStory[];
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
