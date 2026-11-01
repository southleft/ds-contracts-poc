/**
 * THE STORYBOOK READER, part 1 (docs/GOAL.md Step 2). React to Figma reads a
 * library from its own Storybook, never from a hand-written declaration: the
 * owner chose (2026-10-31) to judge it only by GOAL.md's checks against the
 * library's own render. This part reads every story's arguments in pinned
 * Chromium through Storybook's own preview API, groups stories by component
 * title, and holds each component's first story (index order) against the
 * grammar classifier and the variant matrix rule. It also lists the arguments
 * whose values differ across a component's stories, because some libraries
 * express variants as stories rather than as enumerated options.
 * Deterministic for one Storybook build; no model call.
 *
 * Run: npx tsx scripts/storybook-reader.ts --storybook <https://…/storybook/> --out <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyStoryArgs, type GrammarVerdict, type StoryArgType } from '../extract/figma/grammar.js';
import { variantMatrix } from '../extract/figma/variant-matrix.js';

export interface LoadedStory { id: string; title: string; name: string; argTypes: Record<string, StoryArgType>; args: Record<string, unknown> }
export interface StoryComponent {
  title: string; stories: number; storyId: string; grammar: GrammarVerdict;
  matrix: { status: 'ok'; axes: string[]; variants: number } | { status: 'refused'; reason: string };
  /** Arguments that take more than one plain value across this component's stories. */
  variesAcrossStories: string[];
}

export function readStories(stories: readonly LoadedStory[]): StoryComponent[] {
  const byTitle = new Map<string, LoadedStory[]>();
  for (const s of stories) (byTitle.get(s.title) ?? byTitle.set(s.title, []).get(s.title)!).push(s);
  return [...byTitle].map(([title, list]) => {
    const first = list[0]!;
    const argTypes = Object.fromEntries(Object.entries(first.argTypes).sort(([a], [b]) => a.localeCompare(b)));
    const m = variantMatrix(argTypes);
    const values = new Map<string, Set<string>>();
    for (const s of list) for (const [k, v] of Object.entries(s.args ?? {}))
      if (['string', 'boolean', 'number'].includes(typeof v)) (values.get(k) ?? values.set(k, new Set()).get(k)!).add(String(v));
    return { title, stories: list.length, storyId: first.id, grammar: classifyStoryArgs(argTypes),
      matrix: m.status === 'ok' ? { status: 'ok' as const, axes: m.matrix.axes.map((a) => a.name), variants: m.matrix.variants.length } : { status: 'refused' as const, reason: m.reason },
      variesAcrossStories: [...values].filter(([, v]) => v.size > 1).map(([k]) => k).sort() };
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
      const plain = (v) => { try { return JSON.parse(JSON.stringify(v ?? null)); } catch { return null; } };
      const out = [];
      for (const id of storyIds) {
        const s = await store.loadStory({ storyId: id });
        out.push({ id, title: s.title, name: s.name, args: plain(s.initialArgs) ?? {},
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
      `${components.filter((c) => c.matrix.status === 'ok' && c.matrix.variants > 1).length} with an enumerated variant axis; ` +
      `${components.filter((c) => c.variesAcrossStories.length).length} vary arguments across stories → ${path.join(out, 'stories.json')}`);
  }).catch((e) => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
