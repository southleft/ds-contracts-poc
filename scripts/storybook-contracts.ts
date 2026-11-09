/**
 * React to Figma, the code side (GOAL.md Step 2): writes `ds-contracts.react.json` from the Storybook reader's
 * `stories.json`, then, for each in-grammar component, a contract and the Figma scripts that write it.
 *
 * Route (2026-11-08, from a probe of five Agriculture components): every case renders on the story's own page,
 * through the reader's own `SHOW` in its pinned browser. Storybook's decorators (A0 wraps every story in its theme
 * provider), its React and its CSS are then the ones the reader's references were drawn with. The computed engine
 * reads the DOM and computed styles, and the Figma engine prepares the scripts. The source-reference engine was not
 * used: it mounts each component outside Storybook (decorators lost), under its own React 19.x observer (A0 runs
 * 18.3), and needs a witness per case, which is regression only (owner, 2026-10-31).
 *
 * `stories.json` supplies only the matrix: story ids, arguments and variant values. The reader's reference images and
 * measured content are never read. A component outside the grammar, or whose matrix is refused, is refused by name.
 *
 *   npx tsx scripts/storybook-contracts.ts --stories <stories.json> --out <dir> [--storybook <url>] [--titles "a|b"]
 *     [--file-key <key>]   with a file key, the variables and component scripts for that file only
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { mintTokens } from '../core/mint-tokens.js';
import { promoteAnatomy } from '../extract/computed/anatomy.js';
import { captureJs, captureUaControls, CONTROL_TAGS, type ComponentConfig, type PropSpace, type SweepResult } from '../extract/computed/capture.js';
import { alignSweep, applyMintToContract, boundCheck, detectFolds, enrichLayout, prepareMint, styledChannels } from '../extract/computed/fuse.js';
import { comboKey, normalizeNode, type Capture, type EnumAxisSpec } from '../extract/computed/lib.js';
import { ContractSchema, textByCombinationIssues, type Contract, type Part } from './contract-schema.js';
import { NO_MOTION } from './design-consumer-check.js';
import { MARK_SUBJECT, PAGE, pinnedBrowser, SHOW, type StoryComponent } from './storybook-reader.js';

export interface StoryCase { id: string; story: { id: string; args: Record<string, unknown> }; variant: Record<string, string> }
export interface DeclaredComponent { subject: string; name: string; axes: string[]; cases: StoryCase[] }
export interface StoryDeclaration {
  version: 2; source: 'storybook'; storybook: string; react: string | null;
  components: DeclaredComponent[]; refused: { subject: string; reason: string }[];
}
interface ReaderOutput { storybook: string; environment?: { react?: string }; components: StoryComponent[] }

/** Classes that name an element. Emotion's generated `css-<hash>` names hash the styles (a random blob URL in one gives
 * a new name every run), so they never identify a part; every other class does, as before. */
const IDENTITY_CLASSES = '^(?!css-[0-9a-z]+(-|$))';
const IMAGES_SETTLED = `Promise.race([Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => {
  i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))).then(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(() => r(true))))), new Promise((r) => setTimeout(() => r(false), 20000))])`;
const pascal = (t: string) => t.split('/').at(-1)!.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ?? '').toUpperCase()).replace(/^./, (c) => c.toUpperCase());
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `ds-contracts.react.json`: one case per variant the matrix rule counts, in the reader's order. */
export function declare(stories: ReaderOutput, storybook = stories.storybook): StoryDeclaration {
  const components: DeclaredComponent[] = [], refused: StoryDeclaration['refused'] = [];
  for (const c of stories.components) {
    if (c.grammar.grammar !== 'in') { refused.push({ subject: c.title, reason: `grammar-out:${c.grammar.reasons.join(',')}` }); continue; }
    if (c.matrix.status !== 'ok') { refused.push({ subject: c.title, reason: `story-matrix-refused:${c.matrix.reason}` }); continue; }
    if (!c.references.length) { refused.push({ subject: c.title, reason: 'no-variant' }); continue; }
    const seen = new Map<string, number>();
    const cases = c.references.map((r) => { const n = seen.get(r.storyId) ?? 0; seen.set(r.storyId, n + 1);
      return { id: `${r.storyId}.${n}`, story: { id: r.storyId, args: r.args }, variant: r.variant }; });
    components.push({ subject: c.title, name: pascal(c.title), axes: [...c.matrix.axes], cases });
  }
  return { version: 2, source: 'storybook', storybook, react: stories.environment?.react ?? null, components, refused };
}

/** The seed contract: props and axes only, from the matrix; the anatomy is promoted from the observed DOM. The
 * matrix's option names are the Figma option names (an unset argument shows `(default)`). Enum values must also name
 * minted tokens, so each takes a token-safe slug and the prop's VARIANT binding maps it back. */
export function seed(c: DeclaredComponent) {
  const values = (a: string) => [...new Set(c.cases.map((k) => k.variant[a]!))];
  const slugs = new Map(c.axes.map((a) => { const used = new Set<string>();
    return [a, new Map(values(a).map((v) => { const s0 = v.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'value';
      let s = s0; for (let k = 2; used.has(s); k++) s = `${s0}-${k}`; used.add(s); return [v, s] as const; }))] as const; }));
  const slug = (a: string, v: string) => slugs.get(a)!.get(v)!, first = c.cases[0]!.variant;
  const contract = ContractSchema.parse({ id: `storybook.${kebab(c.name)}`, name: c.name, version: '0.1.0', status: 'draft',
    description: `From Storybook: ${c.subject}`, semantics: { element: 'div' }, states: [], anatomy: { root: {} },
    props: c.axes.map((a) => ({ name: a, type: { enum: values(a).map((v) => slug(a, v)) }, default: slug(a, first[a]!),
      bindings: { figma: { kind: 'VARIANT', property: a, values: Object.fromEntries(values(a).map((v) => [slug(a, v), v])) }, code: { prop: a } } })),
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'storybook', export: c.name } } } }) as Contract;
  const tuple = (k: StoryCase) => Object.fromEntries(c.axes.map((a) => [a, slug(a, k.variant[a]!)]));
  const position = (t: Record<string, string>) => c.axes.map((a) => values(a).map((v) => slug(a, v)).indexOf(t[a]!));
  const drawn = c.cases.map(tuple).sort((x, y) => { const p = position(x), q = position(y), i = p.findIndex((v, k) => v !== q[k]); return i < 0 ? 0 : p[i]! - q[i]!; });
  const axes: EnumAxisSpec[] = c.axes.map((a) => ({ prop: a, values: values(a).map((v) => slug(a, v)) }));
  const combos = c.cases.map((k) => ({ key: comboKey(axes, [], tuple(k), {}), axisValues: tuple(k), stateFlags: {} }));
  const space: PropSpace = { contract, axes, presence: new Map(), stateProps: [],
    enumeration: { policy: 'full-cartesian', cartesianSize: axes.reduce((n, a) => n * a.values.length, 1), combos, receipts: [] },
    baseComboKey: combos[0]!.key, baseAxisValues: combos[0]!.axisValues, heldFixed: [] };
  return { contract, drawn, combos, space };
}

/** Each variant's own text (GOAL.md Step 2: a full default plus per-variant differences). A nested part whose literal
 * text differs between variants carries the text each variant drew (`textByCombination`, over the variant axes). A table
 * the schema refuses (a root part, a domain that does not match where the part is drawn) leaves the first variant's
 * text and is named. */
export function carryVariantText(contract: Contract, axes: readonly string[], combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>,
  textAt: (comboKey: string, part: string) => string | null): string[] {
  const refused: string[] = [];
  const visit = (parts: Record<string, Part> | undefined) => { for (const [name, part] of Object.entries(parts ?? {})) {
    if (axes.length && typeof part.text === 'string') {
      const drawn = combos.flatMap((k) => { const text = textAt(k.key, name); return text === null ? [] : [{ v: k.axisValues, text }]; });
      if (new Set(drawn.map((r) => r.text)).size > 1) {
        // Axes that tell the texts apart (a table names at most 8), added most decisive first, kept in axis order.
        const clash = (props: string[]) => { const seen = new Map<string, string>(); let n = 0;
          for (const r of drawn) { const k = JSON.stringify(props.map((a) => r.v[a])); if (seen.has(k) && seen.get(k) !== r.text) n++; seen.set(k, r.text); } return n; };
        const props: string[] = [];
        while (clash(props) && props.length < axes.length) props.push(axes.filter((a) => !props.includes(a)).sort((a, b) => clash([...props, a]) - clash([...props, b]))[0]!);
        props.sort((a, b) => axes.indexOf(a) - axes.indexOf(b));
        const rows = [...new Map(drawn.map((r) => { const values = props.map((a) => r.v[a]!); return [JSON.stringify(values), { values, text: r.text }]; })).values()];
        part.textByCombination = { props, rows };
        const issues = textByCombinationIssues(contract, part, true);
        if (issues.length) { delete part.textByCombination; refused.push(`per-variant-text-unqualified: ${name}: ${issues.join(',')}`); }
      }
    }
    visit(part.parts as Record<string, Part> | undefined);
  } };
  visit(contract.anatomy.root.parts as Record<string, Part> | undefined);
  return refused;
}

async function main() {
  const flag = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const out = flag('--out'), storiesPath = flag('--stories'), fileKey = flag('--file-key'), titles = flag('--titles')?.split('|');
  if (!out || !storiesPath) throw Error('usage: storybook-contracts.ts --stories <stories.json> --out <dir> [--storybook <url>] [--titles "a|b"] [--file-key <key>]');
  const all = declare(JSON.parse(readFileSync(storiesPath, 'utf8')) as ReaderOutput, flag('--storybook'));
  mkdirSync(path.join(out, 'contracts'), { recursive: true });
  writeFileSync(path.join(out, 'ds-contracts.react.json'), JSON.stringify(all, null, 2) + '\n');
  const chosen = all.components.filter((c) => !titles || titles.includes(c.subject));
  const shown = new URL(all.storybook.endsWith('/') ? all.storybook : all.storybook + '/');
  if (['localhost', '127.0.0.1'].includes(shown.hostname)) shown.hostname = 'host.docker.internal';
  const report: Record<string, unknown>[] = [];
  const { browser, stop } = await pinnedBrowser();
  try {
    const { clock, randomSeed, ...context } = PAGE;
    const page = await (await browser.newContext(context)).newPage();
    await page.clock.setFixedTime(new Date(clock));
    await page.addInitScript(`{ let s = ${randomSeed} >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`);
    const ready = () => page.waitForFunction(() => (window as any).__STORYBOOK_PREVIEW__?.storyStoreValue, null, { timeout: 60_000 });
    const listAll = `(() => { const l = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = l; return l; })()`;
    // A dev-mode Storybook can reload its preview once after load: a render is retried once when that happens.
    const show = async (id: string, args: unknown) => { try { await page.evaluate(`${SHOW}(${JSON.stringify([id, args])})`); }
      catch (e) { if (!/Execution context was destroyed|storyStoreValue/.test(String(e))) throw e;
        await page.waitForLoadState('load'); await ready(); await page.addStyleTag({ content: NO_MOTION }); await page.evaluate(listAll);
        await page.evaluate(`${SHOW}(${JSON.stringify([id, args])})`); } };
    if (chosen.length) {
      await page.goto(new URL(`iframe.html?id=${encodeURIComponent(chosen[0]!.cases[0]!.story.id)}&viewMode=story`, shown).href, { waitUntil: 'load', timeout: 60_000 });
      await ready(); await page.waitForLoadState('networkidle');
    }
    const allProps = chosen.length ? await page.evaluate(listAll) as string[] : [];
    await page.addStyleTag({ content: NO_MOTION });
    for (const c of chosen) {
      const row: Record<string, unknown> = { subject: c.subject, refusals: [] as string[] }, refusals = row.refusals as string[];
      report.push(row);
      try {
        const { contract: seeded, drawn, combos, space } = seed(c);
        const comp = { name: c.name, importName: c.name, contract: '(storybook)', sampleText: '', axes: c.axes } as ComponentConfig;
        const captures: Capture[] = [];
        for (const [i, k] of c.cases.entries()) {
          await show(k.story.id, k.story.args);
          // Read once every image has loaded or failed, as the reader's references were drawn; one still loading is named.
          if (!await page.evaluate(IMAGES_SETTLED)) { refusals.push(`image-not-settled:${k.id}`); continue; }
          if (!await page.evaluate(MARK_SUBJECT)) { refusals.push(`not-one-element:${k.id}`); continue; }
          const raw = await page.evaluate(captureJs('[data-ds-reader-cell]', IDENTITY_CLASSES)); // captureJs reads the stage's first rendered child
          if (!raw) { refusals.push(`capture-empty:${k.id}`); continue; }
          captures.push({ combo: `${c.name}:${combos[i]!.key}`, interaction: 'default', root: normalizeNode(raw as any) });
        }
        row.captured = `${captures.length} of ${c.cases.length}`;
        if (captures.length !== c.cases.length) continue;
        // The in-page control elements and the browser's own baseline, as the computed sweep records them.
        await page.evaluate(`(() => { for (const t of ${JSON.stringify(CONTROL_TAGS)}) { const stage = document.createElement('div'), e = document.createElement(t);
          stage.setAttribute('data-combo', '__control-' + t); e.textContent = 'x'; stage.appendChild(e); document.body.appendChild(stage); } })()`);
        const controls = Object.fromEntries(await Promise.all(CONTROL_TAGS.map(async (t) => [t, normalizeNode(await page.evaluate(captureJs(`[data-combo="__control-${t}"]`)) as any)])));
        await page.evaluate(`document.querySelectorAll('[data-combo^="__control-"]').forEach((e) => e.remove())`);
        const stage = { width: PAGE.viewport.width, height: PAGE.viewport.height, padding: 0 };
        const uaControls = await captureUaControls(page.context(), { stage, colorScheme: 'light', channels: allProps, classAllow: IDENTITY_CLASSES });
        const sweep = { captures, controls, uaControls, uaBaselineBrowser: browser.version(), allProps, stylesheetSkips: [], browserVersion: browser.version(),
          fontChecks: {}, quarantined: [], pinnedAnimations: [], shadowHostTrails: {}, textFillFolds: {}, closedShadowSuspects: {} } as unknown as SweepResult;
        const aligned = alignSweep(sweep, comp, space, '');
        const promotion = promoteAnatomy(space, comp, aligned.union, kebab(c.name));
        row.parts = [...promotion.partIndex.keys()];
        refusals.push(...promotion.refusals.map((x: unknown) => typeof x === 'string' ? x : JSON.stringify(x)));
        const receipts: string[] = [], styles = (m: Record<string, { style: Record<string, string> }>) => Object.fromEntries(Object.entries(m).map(([t, n]) => [t, n.style]));
        const styled = styledChannels(aligned, space, styles(controls), allProps, receipts, { viewport: PAGE.viewport, stage, portaled: false }, styles(uaControls));
        const folds = detectFolds(aligned, styled, receipts);
        await boundCheck(aligned, comp, space, async () => '', promotion.contract);
        const layout = enrichLayout(aligned, space, styled, promotion.contract);
        const svgConsumed = new Set([...promotion.consumed].map((i: number) => aligned.partNames[i]));
        const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumed, new Set(promotion.partIndex.keys()), promotion.gridMintRefusals);
        const mintBase = mintTokens(c.name, prep.baseObs, prep.axes, { nestedPairs: true }), mintStates = mintTokens(c.name, prep.stateObs, prep.axes, { nestedPairs: true });
        const { enriched, enrichmentNotes } = applyMintToContract(promotion.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
          prep.declared, prep.declaredStates, prep.setPlaneLiterals, { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas }, prep.stateCodeOnly);
        row.notes = [...receipts, ...enrichmentNotes].length;
        // A component with no options has no variant to list: it is written as one main component (GOAL.md, 2026-11-08).
        if (c.axes.length) (enriched as Contract).bindings.figma.drawnVariants = drawn;
        const textOf = (n: { nodes: Array<{ t: string; v?: string }> }) => n.nodes.filter((x) => x.t === 'text').map((x) => x.v ?? '').join('').trim();
        refusals.push(...carryVariantText(enriched as Contract, c.axes, combos, (key, part) => {
          const i = promotion.partIndex.get(part), el = i === undefined ? null : aligned.getAligned(`${key}__default`)[i];
          return el ? textOf(el.node as never) : null; }));
        const contract = ContractSchema.parse(enriched) as Contract, file = kebab(c.name);
        writeFileSync(path.join(out, 'contracts', `${file}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
        const engine = createFigmaEngine({ tokens: { primitives: structuredClone(mintBase.tree), semantic: {}, light: {}, dark: {}, brands: { default: {} } } as any, icons: promotion.assets });
        const data = engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { setName: string; isSet: boolean; variants?: unknown[] };
        Object.assign(row, { contract: contract.id, setName: data.setName, isSet: data.isSet, variants: data.variants?.length ?? null });
        if (fileKey) { // each script refuses any other file
          mkdirSync(path.join(out, 'figma'), { recursive: true });
          writeFileSync(path.join(out, 'figma', `${file}.1-variables.js`), engine.buildTokensScript(fileKey));
          writeFileSync(path.join(out, 'figma', `${file}.2-component.js`), engine.buildComponentScript(contract, new Map([[contract.id, contract]]), fileKey));
        }
      } catch (e) { const m = String(e instanceof Error ? e.message : e); refusals.push('error: ' + (m.startsWith('[') ? m.replace(/\s+/g, ' ').slice(0, 600) : m.split('\n')[0])); }
      console.log(JSON.stringify(row));
    }
  } finally { await browser.close(); stop(); }
  writeFileSync(path.join(out, 'storybook-contracts.json'), JSON.stringify({ storybook: all.storybook, react: all.react, refused: all.refused, components: report }, null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
