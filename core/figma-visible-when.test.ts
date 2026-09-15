import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractSchema, type Contract, type Prop } from '../scripts/contract-schema.js';
import { validateContract } from '../packages/core/src/validate.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';

const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const engine = createFigmaEngine({ tokens, icons: new Map() });
const plugin = createPluginEngine({ tokens, contracts: [], icons: {} });
const REFUSAL = /FC-VISIBLE-WHEN-TRUTHY-NONBOOLEAN/;

function seed(prop: Prop, atRoot = false): Contract {
  return ContractSchema.parse({
    id: 'check.figma-visible-when', name: 'FigmaVisibleWhen', version: '0.1.0',
    status: 'draft', archetype: 'none', description: 'Visibility projection conformance only',
    props: [prop], states: [], semantics: { element: 'div' },
    anatomy: { root: {
      layout: { display: 'flex' },
      ...(atRoot ? { visibleWhen: { prop: prop.name } } : {}),
      parts: { gated: { text: 'Conditional', ...(atRoot ? {} : { visibleWhen: { prop: prop.name } }) } },
    } },
    bindings: {
      code: { anchors: { importPath: 'check/figma-visible-when', export: 'FigmaVisibleWhen' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
}

const textProp = (value?: string): Prop => ({
  name: 'href', type: 'text', ...(value === undefined ? {} : { default: value }),
  bindings: { code: { prop: 'href' }, figma: { kind: 'TEXT', property: 'Href' } },
});
const compile = (c: Contract) => engine.compileComponentData(c, new Map([[c.id, c]]));

for (const value of [undefined, '', '/destination']) {
  for (const atRoot of [false, true]) {
    test(`text truthiness ${JSON.stringify(value) ?? 'omitted'} on ${atRoot ? 'root' : 'nested part'} refuses before producing a Figma program`, () => {
      const c = seed(textProp(value), atRoot);
      const errors: string[] = [];
      validateContract(c, new Map([[c.id, c]]), errors, new Map());
      assert.deepEqual(errors, [], 'this is an unsupported canvas projection, not invalid code-side truthiness');
      assert.throws(() => compile(c), REFUSAL);
      assert.throws(() => engine.buildComponentScript(c, new Map([[c.id, c]])), REFUSAL);
      const plan = plugin.planGenerate([c], { withTokens: false });
      assert.equal(plan.ok, false, 'the actual plugin planner must not expose executable steps');
      if (plan.ok) assert.fail('unsupported visibility unexpectedly produced a plan');
      assert.match(JSON.stringify(plan.issues), REFUSAL);
      assert.equal('steps' in plan, false);
    });
  }
}

test('number and enum truthiness are not silently coerced to a boolean canvas condition', () => {
  const props: Prop[] = [
    { name: 'count', type: 'number', default: 0, bindings: { code: { prop: 'count' }, figma: { kind: 'TEXT', property: 'Count' } } },
    { name: 'mode', type: { enum: ['off', 'on'] }, default: 'off', bindings: { code: { prop: 'mode' }, figma: { kind: 'VARIANT', property: 'Mode' } } },
  ];
  for (const prop of props) assert.throws(() => compile(seed(prop)), REFUSAL);
});

test('BOOLEAN visibility still carries its native property and declared default', () => {
  for (const value of [undefined, false, true]) {
    const c = seed({
      name: 'enabled', type: 'boolean', ...(value === undefined ? {} : { default: value }),
      bindings: { code: { prop: 'isEnabled' }, figma: { kind: 'BOOLEAN', property: 'Enabled' } },
    });
    const data = compile(c);
    const gated = data.variants[0].spec.children?.find(p => p.name === 'gated');
    assert.ok(gated);
    assert.equal(gated.visibleProp, 'Enabled');
    assert.equal(gated.visibleDefault, value === true);
    assert.equal(plugin.planGenerate([c], { withTokens: false }).ok, true);
  }
});

test('VARIANT booleans and explicit enum equality still filter their actual cells', () => {
  const bool = seed({
    name: 'enabled', type: 'boolean', default: false,
    bindings: { code: { prop: 'isEnabled' }, figma: { kind: 'VARIANT', property: 'Enabled' } },
  });
  const booleanCells = compile(bool).variants.map(v => [v.name, v.spec.children?.some(p => p.name === 'gated') ?? false]);
  assert.deepEqual(booleanCells, [['Enabled=false', false], ['Enabled=true', true]]);

  const choice = seed({
    name: 'mode', type: { enum: ['off', 'on'] }, default: 'off',
    bindings: { code: { prop: 'mode' }, figma: { kind: 'VARIANT', property: 'Mode', values: { off: 'Off', on: 'On' } } },
  });
  for (const equals of ['on', ['on']]) {
    choice.anatomy.root.parts!.gated.visibleWhen = { prop: 'mode', equals };
    const enumCells = compile(choice).variants.map(v => [v.name, v.spec.children?.some(p => p.name === 'gated') ?? false]);
    assert.deepEqual(enumCells, [['Mode=Off', false], ['Mode=On', true]]);
    assert.equal(plugin.planGenerate([choice], { withTokens: false }).ok, true);
  }
});
