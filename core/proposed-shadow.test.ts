import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeFromDump, type MinimalChildContract } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { tokenInventoryFromJson } from './index.js';
import { emitReact } from './emit-react.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema, type Part } from '../scripts/contract-schema.js';
import type { DumpEffect, DumpSet } from '../extract/figma/types.js';

const empty = { primitives: {}, semantic: {}, light: {}, brandDefault: {} };
const corpus = tokenCorpusFromJson(empty);
const inner = (patch: Partial<DumpEffect> = {}): DumpEffect => ({ type: 'INNER_SHADOW', color: { hex: '000932', alpha: 0.12 }, offset: { x: 0, y: 0 }, radius: 0, spread: 1, ...patch });
const drop = (): DumpEffect => ({ ...inner(), type: 'DROP_SHADOW', offset: { x: 2, y: -1 }, radius: 3 });
function specimen(stacks: DumpEffect[][], part = false, state = false): DumpSet {
  const values = stacks.map((_, i) => state ? ['Default', 'Hover'][i] : `V${i}`);
  return { setName: 'Surface', type: 'COMPONENT_SET',
    propertyDefinitions: { [state ? 'State' : 'Tone']: { type: 'VARIANT', defaultValue: values[0], variantOptions: values } },
    variants: stacks.map((effects, i) => ({ name: `${state ? 'State' : 'Tone'}=${values[i]}`, variantProperties: { [state ? 'State' : 'Tone']: values[i] }, type: 'COMPONENT', bbox: { width: 40, height: 24 },
      fill: { hex: 'ffffff' }, effects: part ? [] : effects,
      children: part ? [{ name: 'surface', type: 'FRAME', fixedSize: { width: 40, height: 24 }, fill: { hex: 'ffffff' }, effects, children: [] }] : [] })) };
}
const propose = (set: DumpSet, extra: Record<string, unknown> = {}) => proposeFromDump(set, {
  corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true, stampsObservable: true, ...extra,
});
const rootOf = (result: ReturnType<typeof propose>) => ContractSchema.parse(result.contract).anatomy.root;
const valueOf = (result: ReturnType<typeof propose>, ref: string | undefined) => {
  assert.ok(ref, 'shadow token reference required');
  return tokenCorpusFromJson({ ...empty, primitives: result.mintedTokens!.tree }).resolveLiteral(ref.slice(1, -1));
};

test('captured inner and mixed shadows reach React and Figma with layer order and numeric values intact', () => {
  for (const onPart of [false, true]) {
    const result = propose(specimen([[inner(), drop()]], onPart));
    const contract = ContractSchema.parse(result.contract), root = contract.anatomy.root;
    const part = onPart ? root.parts!.surface : root;
    const value = valueOf(result, part.tokens?.['box-shadow']);
    assert.equal(value, 'inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12), 2px -1px 3px 1px rgba(0, 9, 50, 0.12)');
    const tokens = result.mintedTokens!.tree;
    const output = emitReact(contract, { tokens: tokenInventoryFromJson([tokens]), icons: new Map(), contracts: new Map([[contract.id, contract]]) });
    assert.match(output.css, /box-shadow: var\(--imported-surface-/);
    const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
    const compiled = engine.compileComponentData(contract, new Map([[contract.id, contract]]));
    const spec = onPart ? compiled.variants[0].spec.children!.find(n => n.name === 'surface')! : compiled.variants[0].spec;
    assert.deepEqual(spec.effectStack, [
      { inner: true, x: 0, y: 0, radius: 0, spread: 1, color: { r: 0, g: 9 / 255, b: 50 / 255, a: 0.12 } },
      { x: 2, y: -1, radius: 3, spread: 1, color: { r: 0, g: 9 / 255, b: 50 / 255, a: 0.12 } },
    ]);
  }
});

test('inner geometry and alpha are not quantized; exponent values use equivalent decimal CSS', () => {
  const result = propose(specimen([[inner({ offset: { x: 0.123456789, y: -0.0000001 }, radius: 1.23456789, spread: -0.123456789, color: { hex: '123456', alpha: 0.123456789 } })]]));
  assert.equal(valueOf(result, rootOf(result).tokens?.['box-shadow']), 'inset 0.123456789px -0.0000001px 1.23456789px -0.123456789px rgba(18, 52, 86, 0.123456789)');
});

test('inner root and part hover stacks survive state projection without inventing a state prop', () => {
  for (const onPart of [false, true]) {
    for (const rest of [[], [drop()]]) {
      const result = propose(specimen([rest, [inner(), drop()]], onPart, true), { projectionMode: 'exact' });
      const root = rootOf(result), part: Part = onPart ? root.parts!.surface : root;
      if (!rest.length) assert.equal(part.tokens?.['box-shadow'], undefined);
      assert.match(String(valueOf(result, part.states?.hover?.['box-shadow'])), /^inset .*rgba\(0, 9, 50, 0.12\), 2px/);
      assert.ok(!ContractSchema.parse(result.contract).props.some(p => p.name === 'state'));
    }
  }
});

test('blur, invalid inner values and partial presence are named without a partial shadow stack', () => {
  for (const effects of [[inner(), { type: 'LAYER_BLUR', radius: 2 }],
    [inner({ radius: -1 })], [inner({ radius: NaN })], [inner({ offset: undefined })],
    [inner({ color: { hex: 'xyzxyz' } })], [inner({ color: { hex: '000000', alpha: 2 } })]]) {
    const result = propose(specimen([effects]));
    assert.equal(rootOf(result).tokens?.['box-shadow'], undefined);
    assert.ok(result.notes.some(n => n.includes('channel NAMED, not proposed')));
  }
  const partial = propose(specimen([[inner()], []]));
  assert.equal(rootOf(partial).tokens?.['box-shadow'], undefined);
  assert.ok(partial.notes.some(n => n.includes('present in every variant')));
  for (const onPart of [false, true]) {
    const unsupported = propose(specimen([[], [inner(), { type: 'BACKGROUND_BLUR', radius: 2 }]], onPart, true));
    const root = rootOf(unsupported), part = onPart ? root.parts!.surface : root;
    assert.equal(part.states?.hover?.['box-shadow'], undefined);
    assert.ok(unsupported.notes.some(n => n.includes('effects') && n.includes('NAMED')));
  }
});

test('authored recovery distinguishes inner from outer and accepts only exact or float32 inner values', () => {
  const set = { ...specimen([[inner()]]), contractId: 'ds.surface' };
  const authored: MinimalChildContract = { id: 'ds.surface', props: [], anatomy: { root: { tokens: { 'box-shadow': '{shadow.surface}' } } } };
  for (const [css, recovered] of [
    ['inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12)', true],
    [`inset 0px 0px 0px 1px rgba(0, 9, 50, ${Math.fround(0.12)})`, true],
    ['0px 0px 0px 1px rgba(0, 9, 50, 0.12)', false],
    ['inset 0px 0px 0px 1px rgba(0, 9, 50, 0.121)', false],
    ['inset 0px 0px 0px 1px rgba(0, 10, 50, 0.12)', false],
    ['inset 0px 0px 0px 1.001px rgba(0, 9, 50, 0.12)', false],
  ] as const) {
    const result = propose(set, { corpus: tokenCorpusFromJson({ ...empty, primitives: { shadow: { surface: { $type: 'shadow', $value: css } } } }),
      contractIdByName: new Map([['Surface', 'ds.surface']]), contractsById: new Map([['ds.surface', authored]]) });
    assert.equal(rootOf(result).tokens?.['box-shadow'] === '{shadow.surface}', recovered, css);
  }
  const outer = { ...set, variants: [{ ...set.variants[0], effects: [{ ...inner(), type: 'DROP_SHADOW' }] }] };
  const recoveredOuter = propose(outer, { corpus: tokenCorpusFromJson({ ...empty, primitives: { shadow: { surface: { $type: 'shadow', $value: 'inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12)' } } } }),
    contractIdByName: new Map([['Surface', 'ds.surface']]), contractsById: new Map([['ds.surface', authored]]) });
  assert.notEqual(rootOf(recoveredOuter).tokens?.['box-shadow'], '{shadow.surface}', 'an outer capture must not recover an inset token');
});

test('authored mixed-stack recovery does not ignore layer order', () => {
  const set = { ...specimen([[inner(), drop()]]), contractId: 'ds.surface' };
  const authored: MinimalChildContract = { id: 'ds.surface', props: [], anatomy: { root: { tokens: { 'box-shadow': '{shadow.surface}' } } } };
  const css = ['inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12)', '2px -1px 3px 1px rgba(0, 9, 50, 0.12)'];
  for (const reverse of [false, true]) {
    const result = propose(set, { corpus: tokenCorpusFromJson({ ...empty, primitives: { shadow: { surface: { $type: 'shadow', $value: (reverse ? [...css].reverse() : css).join(', ') } } } }),
      contractIdByName: new Map([['Surface', 'ds.surface']]), contractsById: new Map([['ds.surface', authored]]) });
    assert.equal(rootOf(result).tokens?.['box-shadow'] === '{shadow.surface}', !reverse);
  }
});

test('effect binding metadata alone does not invent a visual hover override', () => {
  for (const onPart of [false, true]) {
    const effect = drop();
    const result = propose(specimen([[effect], [{ ...effect, bound: { radius: 'shadow/radius' } }]], onPart, true));
    const root = rootOf(result), part = onPart ? root.parts!.surface : root;
    assert.equal(part.states?.hover?.['box-shadow'], undefined);
  }
});
