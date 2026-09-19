// How a TEXT BOX SIZES ITSELF is CARRIED by both Figma readers (dump v1.36) and
// the auto-width value round-trips through the contract. Found by the design-led
// clean-consumer check on a designer's 72-variant Badge: 26 of the 48 × 16 px
// small variants missed the 5 % limit at 4.4–7.3 % with every content size
// equal. A Figma text box that sizes itself to its text (`textAutoResize:
// WIDTH_AND_HEIGHT`) is a WHOLE number of pixels wide — the advance rounded up
// (`Label`, Inter Semi Bold 14: 32) — while the browser lays the same run out at
// its fractional advance (31.40625), so the hug root rendered 47.40625 px against
// Figma's 48. Neither reader captured the field, so the proposer could not lower it.
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

type LabelSpec = { resize?: string; sizing?: string; name?: string };
const SOLID = (r: number, g: number, b: number) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
/** The designer's Badge, as REST reports it: a hug root around one auto-width `Label`. */
const restLabel = (id: string, spec: LabelSpec) => ({ id, name: spec.name ?? 'Label', type: 'TEXT', characters: 'Label',
  absoluteBoundingBox: { x: 8, y: 0, width: 32, height: 16 }, fills: SOLID(0.99, 1, 1),
  ...(spec.sizing !== undefined ? { layoutSizingHorizontal: spec.sizing, layoutSizingVertical: 'HUG' } : {}),
  style: { fontFamily: 'Inter', fontPostScriptName: 'Inter-SemiBold', fontWeight: 600, fontSize: 14, lineHeightPx: 16, lineHeightUnit: 'PIXELS', textAlignHorizontal: 'LEFT', textAlignVertical: 'TOP',
    ...(spec.resize !== undefined ? { textAutoResize: spec.resize } : {}) } });
const restVariant = (id: string, name: string, spec: LabelSpec) => ({ id, name, type: 'COMPONENT', layoutMode: 'HORIZONTAL',
  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', paddingTop: 0, paddingBottom: 0, paddingLeft: 8, paddingRight: 8,
  absoluteBoundingBox: { x: 0, y: 0, width: 48, height: 16 }, fills: SOLID(0.05, 0.38, 0.73), children: [restLabel(`${id}:t`, spec)] });
const restSet = (specs: LabelSpec[]) => ({ id: '1:1', name: 'Badge', type: 'COMPONENT_SET',
  children: specs.map((spec, i) => restVariant(`1:${i + 2}`, `Tone=${'ABC'[i]}`, spec)) });
const mapped = (specs: LabelSpec[]) => {
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet(specs) } } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Badge;
  return { set, provenance: (result.dump as unknown as { _provenance: { dumpVersion: string } })._provenance };
};
const labelOf = (v: DumpNode) => v.children![0];
const primitives = { paint: { ground: { $type: 'color', $value: '#0e61ba' }, ink: { $type: 'color', $value: '#fcfeff' } } };
const corpus = tokenCorpusFromJson({ primitives, semantic: {}, light: {}, brandDefault: {} });
const propose = (set: DumpSet) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
type Anatomy = { root: Record<string, unknown> & { parts?: Record<string, Record<string, unknown>> } };
const partOf = (result: { contract: unknown }, name = 'Label') => (result.contract as { anatomy: Anatomy }).anatomy.root.parts![name];
const without = (set: DumpSet): DumpSet => { const copy = structuredClone(set); for (const v of copy.variants) delete labelOf(v as DumpNode).text!.textAutoResize; return copy; };
const AUTO = { resize: 'WIDTH_AND_HEIGHT', sizing: 'HUG' };

test('the REST reader carries textAutoResize on every text node — an ABSENT response key is NONE, REST\'s default (review M4) — and never copies an unknown spelling', () => {
  // A fixed box is built BY OMISSION, as REST is believed to report it: NONE is the field's default.
  const { set, provenance } = mapped([AUTO, { resize: 'HEIGHT', sizing: 'FILL' }, { sizing: 'FIXED' }]);
  assert.equal(provenance.dumpVersion, '1.38');
  assert.deepEqual(set.variants.map((v) => labelOf(v as DumpNode).text!.textAutoResize), ['WIDTH_AND_HEIGHT', 'HEIGHT', 'NONE']);
  assert.equal(labelOf(mapped([{ resize: 'NONE', sizing: 'FIXED' }]).set.variants[0] as DumpNode).text!.textAutoResize, 'NONE', 'an explicit NONE reads the same');
  assert.equal(labelOf(mapped([{ resize: 'TRUNCATE' }]).set.variants[0] as DumpNode).text!.textAutoResize, 'TRUNCATE', 'the deprecated value is captured too, so nothing is guessed at');
  assert.equal('textAutoResize' in labelOf(mapped([{ resize: 'SOMETHING_NEW' }]).set.variants[0] as DumpNode).text!, false, 'an unknown spelling is not copied (and is not read as NONE)');
  // The new field is the ONLY thing that moved on the node.
  const { textAutoResize: _a, ...rest } = labelOf(mapped([AUTO]).set.variants[0] as DumpNode).text!;
  const { textAutoResize: _b, ...same } = labelOf(mapped([{ resize: 'HEIGHT', sizing: 'HUG' }]).set.variants[0] as DumpNode).text!;
  assert.deepEqual(rest, same);
});

test('the plugin reader carries the same field from node.textAutoResize, and writes nothing where the canvas reports nothing', async () => {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(`
    const make = (name, resize) => { const c = figma.createComponent(); c.name = name; c.layoutMode = 'HORIZONTAL';
      const t = figma.createText(); t.name = 'Caption'; t.characters = 'Label'; t.fontSize = 14; t.fontName = { family: 'Inter', style: 'Semi Bold' };
      if (resize !== undefined) t.textAutoResize = resize; c.appendChild(t); return c; };
    const set = figma.combineAsVariants([make('Tone=A', 'WIDTH_AND_HEIGHT'), make('Tone=B', 'HEIGHT'), make('Tone=C', undefined)], figma.currentPage);
    set.name = 'WholePixelBadge';`);
  assert.ok(root.findOne((n: { name: string }) => n.name === 'WholePixelBadge'));
  const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['WholePixelBadge'])};`);
  const dumps = await run(source) as Record<string, DumpSet> & { _provenance: { dumpVersion: string } };
  assert.equal(dumps._provenance.dumpVersion, '1.38');
  const variants = Array.from(dumps.WholePixelBadge.variants, (v) => JSON.parse(JSON.stringify(v)) as DumpNode);
  assert.deepEqual(variants.map((v) => labelOf(v).text!.textAutoResize), ['WIDTH_AND_HEIGHT', 'HEIGHT', undefined], 'unreported: not captured, never auto-width');
});

test('reader → proposer: an auto-width text box proposes textAutoResize: WIDTH_AND_HEIGHT on the text part, with every other channel as it was', () => {
  const result = propose(mapped([AUTO, AUTO]).set);
  const label = partOf(result);
  assert.equal(label.textAutoResize, 'WIDTH_AND_HEIGHT');
  assert.ok(result.notes.some((n) => /Label: the text box sizes itself to its text in every variant .* carried as textAutoResize: WIDTH_AND_HEIGHT/.test(n)));
  const plain = propose(without(mapped([AUTO, AUTO]).set));
  const { textAutoResize: _f, ...restOfLabel } = label;
  assert.deepEqual(restOfLabel, partOf(plain), 'the flag is the only thing that moved on the part');
  ContractSchema.parse(result.contract);

  // …and the generated CSS gives the element the whole-pixel box, as a bare declaration a browser without calc-size() drops.
  const inventory = new Set(Array.from(JSON.stringify(result.contract).matchAll(/\{([a-z0-9.-]+)\}/gi), (m) => m[1]));
  const errors: string[] = [];
  const css = generateCss(result.contract as never, inventory, errors);
  assert.deepEqual(errors, []);
  assert.match(css, /\n\.Label \{[^}]*\n  inline-size: calc-size\(fit-content, round\(up, size, 1px\)\);\n  max-inline-size: 100%;/, 'no tracking on this label: nothing to shed before rounding');
  assert.doesNotMatch(generateCss(plain.contract as never, inventory, []), /calc-size|inline-size/, 'not captured: the bytes it always emitted');
});

test('not captured, or not auto-width, proposes exactly what it did before — an older dump keeps its bytes, a fixed or filled box keeps its vocabulary', () => {
  const legacy = propose(without(mapped([AUTO, AUTO]).set));
  assert.equal('textAutoResize' in partOf(legacy), false, 'absent is not captured, never auto-width');
  assert.equal(legacy.notes.some((n) => /textAutoResize/.test(n)), false, 'and nothing is said about it');
  const fixed = propose(mapped([{ sizing: 'FIXED' }, { sizing: 'FIXED' }]).set);
  assert.equal('textAutoResize' in partOf(fixed), false, 'a fixed box is not sized by its text');
  assert.equal(fixed.notes.some((n) => /textAutoResize/.test(n)), false);
  const filled = propose(mapped([{ resize: 'HEIGHT', sizing: 'FILL' }, { resize: 'HEIGHT', sizing: 'FILL' }]).set);
  assert.equal('textAutoResize' in partOf(filled), false, 'a filled box is carried by the fill vocabulary');
  const truncate = propose(mapped([{ resize: 'TRUNCATE', sizing: 'FIXED' }, { resize: 'TRUNCATE', sizing: 'FIXED' }]).set);
  assert.equal('textAutoResize' in partOf(truncate), false, 'the deprecated truncating box never carries the fact');
  // Same structure, same notes: the fixed-box dump and the legacy dump differ only in what they say about the label.
  assert.deepEqual(fixed.contract, legacy.contract);
});

test('mixed evidence and a contradicting dump are NAMED, never guessed', () => {
  const mixed = propose(mapped([AUTO, { resize: 'HEIGHT', sizing: 'HUG' }]).set);
  assert.equal('textAutoResize' in partOf(mixed), false);
  assert.ok(mixed.notes.some((n) => /sizes itself to its text .* in 1 of 2 variants and is HEIGHT in the rest .* REFUSED BY NAME/.test(n)));
  // WIDTH_AND_HEIGHT beside FILL cannot both be true of one box: the dump is named, the fill it carries stays.
  const contradiction = propose(mapped([{ resize: 'WIDTH_AND_HEIGHT', sizing: 'FILL' }, { resize: 'WIDTH_AND_HEIGHT', sizing: 'FILL' }]).set);
  assert.equal('textAutoResize' in partOf(contradiction), false);
  assert.ok(contradiction.notes.some((n) => /WIDTH_AND_HEIGHT is captured beside layoutSizingHorizontal FILL in 2 of 2 variants .* REFUSED BY NAME/.test(n)));
  ContractSchema.parse(contradiction.contract);
  // Review M4: a variant whose text reports NOTHING beside auto-width ones is the mixed case, never agreement —
  // on the REST route the omitted default reads NONE; on a dump with a hole it is "not captured".
  const omitted = propose(mapped([AUTO, { sizing: 'FIXED' }]).set);
  assert.equal('textAutoResize' in partOf(omitted), false);
  assert.ok(omitted.notes.some((n) => /in 1 of 2 variants and is NONE in the rest .* REFUSED BY NAME/.test(n)));
  const hole = mapped([AUTO, AUTO]).set; delete labelOf(hole.variants[1] as DumpNode).text!.textAutoResize;
  const holed = propose(hole);
  assert.equal('textAutoResize' in partOf(holed), false);
  assert.ok(holed.notes.some((n) => /in 1 of 2 variants and is not captured in the rest .* REFUSED BY NAME/.test(n)));
});

test('a sole root text node named "label" is hoisted into anatomy.root.text — the fact is NAMED there, not carried onto the root', () => {
  const hoisted = propose(mapped([{ ...AUTO, name: 'label' }, { ...AUTO, name: 'label' }]).set);
  const root = (hoisted.contract as { anatomy: Anatomy }).anatomy.root;
  assert.equal(root.text, 'Label');
  assert.equal('textAutoResize' in root, false, "a root's box is padding plus content");
  assert.ok(hoisted.notes.some((n) => /hoisted into anatomy\.root\.text, and the whole-pixel text-box fact qualifies a text PART's own element .* NAMED, not carried/.test(n)));
  ContractSchema.parse(hoisted.contract);
});

// --- the return leg -------------------------------------------------------
const tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const engine = createFigmaEngine({ tokens, icons: new Map() });
const seed = (flag: boolean): Contract => ContractSchema.parse({
  id: 'check.text-box', name: 'TextBox', version: '0.1.0', status: 'draft', description: 'Whole-pixel text box round-trip proof',
  props: [{ name: 'tone', type: { enum: ['a', 'b'] }, default: 'a', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { a: 'A', b: 'B' } } } }],
  states: [], semantics: { element: 'div' },
  anatomy: { root: { layout: { display: 'flex' }, tokens: { 'background-color': '{paint.ground}' },
    parts: { caption: { text: 'Label', ...(flag ? { textAutoResize: 'WIDTH_AND_HEIGHT' } : {}), tokens: { color: '{paint.ink}' }, literals: { 'font-size': '14px' } } } } },
  bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'check/text-box', export: 'TextBox' } } },
});
async function roundTrip(c: Contract) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(engine.buildTokensScript(null));
  const script = engine.buildComponentScript(c, new Map([[c.id, c]]));
  await run(script);
  type Node = { name: string; type: string; children?: Node[]; textAutoResize?: string; getSharedPluginData(ns: string, key: string): string };
  const node = root.findOne((n: Node) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as Node;
  assert.ok(node, 'the writer actually created a set');
  const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([node.name])};`);
  const set = JSON.parse(JSON.stringify((await run(source) as Record<string, unknown>)[node.name])) as DumpSet;
  const texts = node.children!.map((v) => v.children!.find((k) => k.type === 'TEXT')!);
  return { script, node, set, texts };
}
const exact = (set: DumpSet) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: false });

test('contract → writer → REAL plugin reader → proposer: the flag sets textAutoResize = WIDTH_AND_HEIGHT on the text node and proposes back — a fixed point', async () => {
  const c = seed(true);
  const live = await roundTrip(c);
  // The mock canvas does not model the field, so it exists on a text node only where the writer set it.
  assert.deepEqual(live.texts.map((t) => t.textAutoResize), ['WIDTH_AND_HEIGHT', 'WIDTH_AND_HEIGHT']);
  assert.deepEqual(live.set.variants.map((v) => v.children!.find((k) => k.type === 'TEXT')!.text!.textAutoResize), ['WIDTH_AND_HEIGHT', 'WIDTH_AND_HEIGHT']);
  const back = ContractSchema.parse(exact(live.set).contract);
  const caption = back.anatomy.root.parts!.caption;
  assert.equal(caption.textAutoResize, 'WIDTH_AND_HEIGHT');
  assert.equal(caption.text, 'Label', 'the text returns as it left');
  // A second trip compiles the fact again: same spec, same runtime line.
  const again = engine.buildComponentScript(back, new Map([[back.id, back]]));
  assert.ok(again.includes("if (spec.textAutoResize === 'WIDTH_AND_HEIGHT') node.textAutoResize = 'WIDTH_AND_HEIGHT';") && /"textAutoResize": "WIDTH_AND_HEIGHT"/.test(again), 'the proposed-back contract compiles the fact again');
});

test('a contract without the flag emits the script it always did — the runtime never names the field — and, on a canvas that reports nothing, proposes back without it', async () => {
  const c = seed(false);
  const live = await roundTrip(c);
  assert.doesNotMatch(live.script, /textAutoResize/, 'the golden discipline: existing generated sets stay byte-identical');
  assert.deepEqual(live.texts.map((t) => t.textAutoResize), [undefined, undefined]);
  assert.equal('textAutoResize' in ContractSchema.parse(exact(live.set).contract).anatomy.root.parts!.caption, false);
});

test('NAMED (docs/23 §D.42), pinned so it cannot become silent: on a real canvas createText is born WIDTH_AND_HEIGHT, so a flagless text part reads the fact back and proposes it', () => {
  // The REST route is how a real canvas is read; a generated set's label reports exactly what a designer's does.
  const reread = propose(mapped([AUTO, AUTO]).set);
  assert.equal(partOf(reread).textAutoResize, 'WIDTH_AND_HEIGHT', 'Figma has no fractional text box: the re-read tells the truth about the canvas, and the flag is additive');
});
