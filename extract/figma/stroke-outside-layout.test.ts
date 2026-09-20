// Whether a stroke takes LAYOUT SPACE is CARRIED by both Figma readers (dump
// v1.35) and round-trips through the contract. Found by the design-led
// clean-consumer check on a designer's 72-variant Badge: a Figma stroke on an
// auto-layout frame takes no layout space (`strokesIncludedInLayout` false, the
// default for a drawn frame) while the CSS `border` it lowered to does, so all
// 24 outline variants rendered 4px wider and the 16px-high small one 20px high.
// Neither reader captured the field, so the proposer could not lower it.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump } from './rest/map.js';
import { proposeFromDump } from '../../core/propose-figma.js';
import { createFigmaEngine } from '../../core/emit-figma-script.js';
import { generateCss } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import type { DumpNode, DumpSet } from './types.js';

type BadgeSpec = { included?: boolean; strokes?: boolean; layoutMode?: string; weight?: number };
const SOLID = (r: number, g: number, b: number) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
/** The designer's Badge, as REST reports it: REST OMITS `strokesIncludedInLayout` when it is false. */
const restVariant = (id: string, name: string, spec: BadgeSpec) => ({ id, name, type: 'COMPONENT', layoutMode: spec.layoutMode ?? 'HORIZONTAL',
  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12,
  absoluteBoundingBox: { x: 0, y: 0, width: 61, height: 16 }, strokeAlign: 'INSIDE', fills: SOLID(1, 1, 1),
  ...(spec.strokes === false ? {} : { strokes: SOLID(0.05, 0.38, 0.73), strokeWeight: spec.weight ?? 2 }),
  ...(spec.included === true ? { strokesIncludedInLayout: true } : {}), children: [] });
const restSet = (specs: BadgeSpec[]) => ({ id: '1:1', name: 'Badge', type: 'COMPONENT_SET',
  children: specs.map((spec, i) => restVariant(`1:${i + 2}`, `Style=${'ABC'[i]}`, spec)) });
const mapped = (specs: BadgeSpec[]) => {
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet(specs) } } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Badge;
  return { set, provenance: (result.dump as unknown as { _provenance: { dumpVersion: string } })._provenance };
};
const primitives = { paint: { ring: { $type: 'color', $value: '#0e61ba' }, ground: { $type: 'color', $value: '#ffffff' } }, stroke: { thick: { $type: 'dimension', $value: '2px' } } };
const corpus = tokenCorpusFromJson({ primitives, semantic: {}, light: {}, brandDefault: {} });
const propose = (set: DumpSet, mintUnbound = true) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound });
const rootOf = (result: { contract: unknown }) => (result.contract as { anatomy: { root: Record<string, unknown> } }).anatomy.root;
const without = (set: DumpSet): DumpSet => { const copy = structuredClone(set); for (const v of copy.variants) delete (v as DumpNode).strokesIncludedInLayout; return copy; };

test('the REST reader writes the fact on every stroked auto-layout frame — false included, because REST omits its default — and nowhere else', () => {
  const { set, provenance } = mapped([{}, { included: true }, { strokes: false }]);
  assert.equal(provenance.dumpVersion, '1.39');
  assert.deepEqual(set.variants.map((v) => (v as DumpNode).strokesIncludedInLayout), [false, true, undefined], 'a strokeless frame draws nothing the fact could move');
  // A free frame's stroke never insets the child coordinate origin.
  assert.equal((mapped([{ layoutMode: 'NONE' }]).set.variants[0] as DumpNode).strokesIncludedInLayout, false);
  // The new field is the ONLY thing that moved on the node.
  const { strokesIncludedInLayout: _f, ...rest } = mapped([{}]).set.variants[0] as DumpNode;
  const { strokesIncludedInLayout: _t, ...same } = mapped([{ included: true }]).set.variants[0] as DumpNode;
  assert.deepEqual(rest, same);
});

test('the plugin reader carries the same field from node.strokesIncludedInLayout, and writes nothing where the canvas reports nothing', async () => {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(`
    const make = (name, included, auto) => { const c = figma.createComponent(); c.name = name; if (auto) c.layoutMode = 'HORIZONTAL';
      c.strokes = [{ type: 'SOLID', color: { r: 0.05, g: 0.38, b: 0.73 } }]; c.strokeWeight = 2;
      if (included !== undefined) c.strokesIncludedInLayout = included; return c; };
    const set = figma.combineAsVariants([make('Style=A', false, true), make('Style=B', true, true), make('Style=C', undefined, true), make('Style=D', false, false)], figma.currentPage);
    set.name = 'RingedBadge';`);
  assert.ok(root.findOne((n: { name: string }) => n.name === 'RingedBadge'));
  const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['RingedBadge'])};`);
  const dumps = await run(source) as Record<string, DumpSet> & { _provenance: { dumpVersion: string } };
  assert.equal(dumps._provenance.dumpVersion, '1.39');
  const variants = Array.from(dumps.RingedBadge.variants, (v) => JSON.parse(JSON.stringify(v)) as DumpNode);
  assert.deepEqual(variants.map((v) => v.strokesIncludedInLayout), [false, true, undefined, false], 'unreported auto-layout stays unknown; a free frame has no stroke inset');
});

test('reader → proposer: a stroke outside layout proposes strokesIncludedInLayout: false and keeps every number the designer drew', () => {
  const result = propose(mapped([{}, {}]).set);
  const root = rootOf(result);
  assert.equal(root.strokesIncludedInLayout, false);
  const tokens = root.tokens as Record<string, string>;
  assert.match(tokens['border-width'], /^\{.+\}$/, 'the stroke still rides the border channels');
  assert.match(tokens['border-color'], /^\{.+\}$/);
  assert.ok(tokens['padding-block'] && tokens['padding-inline'], 'padding is carried as drawn, never as "padding minus border"');
  assert.ok(result.notes.some((n) => /takes NO layout space in every stroked variant .* carried as strokesIncludedInLayout: false/.test(n)));
  ContractSchema.parse(result.contract);

  // …and the generated CSS draws it without taking space.
  const inventory = new Set(Array.from(JSON.stringify(result.contract).matchAll(/\{([a-z0-9.-]+)\}/gi), (m) => m[1]));
  const errors: string[] = [];
  const css = generateCss(result.contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  assert.match(css, /box-shadow: inset 0 0 0 var\(--_stroke-width\) var\(--_stroke-color\);/);
  assert.doesNotMatch(css, /border-(width|style|color)\s*:/);
});

test('in layout, or not captured, proposes exactly what it did before — a generated set and an older dump keep their bytes', () => {
  const included = propose(mapped([{ included: true }, { included: true }]).set);
  const legacy = propose(without(mapped([{}, {}]).set));
  assert.equal('strokesIncludedInLayout' in rootOf(included), false, 'true is what an absent flag already means');
  assert.equal('strokesIncludedInLayout' in rootOf(legacy), false, 'absent is not captured, never false');
  assert.deepEqual(included.contract, legacy.contract);
  assert.deepEqual(included.notes, legacy.notes);
  // A strokeless variant has no evidence and does not vote.
  assert.equal(rootOf(propose(mapped([{}, { strokes: false }]).set)).strokesIncludedInLayout, false);
});

test('mixed evidence is NAMED, never guessed; a flag with no surviving stroke channel is withdrawn by name', () => {
  const mixed = propose(mapped([{}, { included: true }]).set);
  assert.equal('strokesIncludedInLayout' in rootOf(mixed), false);
  assert.ok(mixed.notes.some((n) => /takes layout space in 1 of 2 stroked variants and none in the other 1 .* REFUSED BY NAME/.test(n)));
  // No mint: the unbound stroke is named and not carried, so the flag has nothing to qualify.
  const bare = propose(mapped([{}, {}]).set, false);
  assert.equal('strokesIncludedInLayout' in rootOf(bare), false);
  assert.ok(bare.notes.some((n) => /no stroke channel survived on this part .* WITHDRAWN/.test(n)));
  ContractSchema.parse(bare.contract);
});

// --- the return leg -------------------------------------------------------
const tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const engine = createFigmaEngine({ tokens, icons: new Map() });
const seed = (flag: boolean): Contract => ContractSchema.parse({
  id: 'check.stroke-layout', name: 'StrokeLayout', version: '0.1.0', status: 'draft', description: 'Stroke outside layout round-trip proof',
  props: [{ name: 'tone', type: { enum: ['a', 'b'] }, default: 'a', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { a: 'A', b: 'B' } } } }],
  states: [], semantics: { element: 'div' },
  anatomy: { root: { layout: { display: 'flex' }, ...(flag ? { strokesIncludedInLayout: false } : {}), text: 'Badge',
    tokens: { 'background-color': '{paint.ground}', 'border-color': '{paint.ring}', 'border-width': '{stroke.thick}' } } },
  bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'check/stroke-layout', export: 'StrokeLayout' } } },
});
async function roundTrip(c: Contract) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(engine.buildTokensScript(null));
  const script = engine.buildComponentScript(c, new Map([[c.id, c]]));
  await run(script);
  type Node = { name: string; type: string; getSharedPluginData(ns: string, key: string): string };
  const node = root.findOne((n: Node) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as Node;
  assert.ok(node, 'the writer actually created a set');
  const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([node.name])};`);
  const set = JSON.parse(JSON.stringify((await run(source) as Record<string, unknown>)[node.name])) as DumpSet;
  return { script, node, set };
}
const exact = (set: DumpSet) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: false });

test('contract → writer → REAL plugin reader → proposer: the flag sets strokesIncludedInLayout = false on the frame and proposes back', async () => {
  const c = seed(true);
  const live = await roundTrip(c);
  // The mock canvas does not model the field, so it exists on a frame only where the writer set it.
  assert.deepEqual((live.node as unknown as { children: Array<{ strokesIncludedInLayout?: boolean }> }).children.map((v) => v.strokesIncludedInLayout), [false, false]);
  assert.deepEqual(live.set.variants.map((v) => (v as DumpNode).strokesIncludedInLayout), [false, false]);
  const back = ContractSchema.parse(exact(live.set).contract);
  assert.equal(back.anatomy.root.strokesIncludedInLayout, false);
  assert.deepEqual(back.anatomy.root.tokens, c.anatomy.root.tokens, 'the stroke channels return as they left');
  // A second trip is a fixed point: same compiled specs, same script.
  const again = engine.buildComponentScript(back, new Map([[back.id, back]]));
  assert.ok(again.includes('if (spec.strokesIncludedInLayout === false) node.strokesIncludedInLayout = false;') && /"strokesIncludedInLayout": false/.test(again), 'the proposed-back contract compiles the fact again');
});

test('NAMED DIVERGENCE (docs/23 §D.39), pinned so it cannot become silent: a contract that drops the flag cannot take it off a set it already wrote', async () => {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(engine.buildTokensScript(null));
  const flagged = seed(true), dropped = seed(false);
  await run(engine.buildComponentScript(flagged, new Map([[flagged.id, flagged]])));
  await run(engine.buildComponentScript(dropped, new Map([[dropped.id, dropped]]))); // amend: the variant nodes are reused
  type Node = { type: string; getSharedPluginData(ns: string, key: string): string };
  const set = root.findOne((n: Node) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === flagged.id) as unknown as { children: Array<{ strokesIncludedInLayout?: boolean }> };
  // The unflagged script never names the field (byte-identical for every existing contract), so false stays…
  assert.deepEqual(set.children.map((v) => v.strokesIncludedInLayout), [false, false]);
  // …while ONE script mixing flagged and unflagged parts does write both ways.
  const script = engine.buildComponentScript(flagged, new Map([[flagged.id, flagged]]));
  assert.ok(script.includes("else if (node.layoutMode !== 'GRID') node.strokesIncludedInLayout = true;"), 'an unflagged GRID frame is left alone; a flex one is put back');
});

test('a contract without the flag emits the script it always did — the runtime never names the field — and proposes back without it', async () => {
  const c = seed(false);
  const live = await roundTrip(c);
  assert.doesNotMatch(live.script, /strokesIncludedInLayout/, 'the golden discipline: existing generated sets stay byte-identical');
  assert.equal('strokesIncludedInLayout' in ContractSchema.parse(exact(live.set).contract).anatomy.root, false);
});
