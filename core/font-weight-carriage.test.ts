import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractSchema, literalValueOk, type Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';

function fixture(): Contract {
  return ContractSchema.parse({
    id: 'probe.weight', name: 'Weight', version: '0.1.0', status: 'draft', description: 'Conditional local label weight regression',
    props: [{ name: 'selected', type: 'boolean', default: false,
      bindings: { code: { prop: 'selected' }, figma: { kind: 'VARIANT', property: 'Selected' } } }],
    states: [], semantics: { element: 'div' },
    anatomy: { root: { layout: { display: 'flex' },
      parts: { label: { text: 'Label', literalsByCombination: [{ props: ['selected'], rows: [
        { values: ['false'], literals: { 'font-weight': '500' } },
        { values: ['true'], literals: { 'font-weight': '600' } },
      ] }] } } } },
    bindings: { code: { anchors: { importPath: './Weight', export: 'Weight' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const engine = () => createFigmaEngine({ tokens: {
  primitives: { weight: { regular: { $type: 'number', $value: '400' } } },
  semantic: {}, light: {}, dark: {}, brands: { default: {} },
}, icons: new Map() });
function compile(c: Contract) {
  const data = engine().compileComponentData(c, new Map([[c.id, c]]));
  const labels: Array<{ variant: string; style?: string; weight?: string }> = [];
  const visit = (node: any, variant: string) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && node.name === 'label') labels.push({ variant, style: node.fontStyle, weight: node.fontWeightVar });
    for (const [key, value] of Object.entries(node)) {
      if (key === 'codeOnlyFacts') continue;
      if (Array.isArray(value)) value.forEach(v => visit(v, variant));
      else if (value && typeof value === 'object') visit(value, variant);
    }
  };
  for (const v of data.variants) visit(v.spec, v.name);
  assert.equal(labels.length, 2);
  assert.equal(labels.length, 2, 'both observed boolean variants must carry a label');
  return { data, labels };
}
test('weight literals require unitless in-range decimal values', () => {
  for (const value of ['1', '400', '500', '600', '510', '510.25', '1000']) assert.equal(literalValueOk('font-weight', value), true, value);
  for (const value of ['0', '0.5', '1001', '500px', '500%', 'NaN', '-500', 'bold']) assert.equal(literalValueOk('font-weight', value), false, value);
});
test('native conditional labels preserve exact Medium and Semi Bold faces', () => {
  const { data, labels } = compile(fixture());
  for (const label of labels) assert.equal(label.style, /Selected=True/i.test(label.variant) ? 'Semi Bold' : 'Medium');
  assert.equal(data.codeOnlyFacts?.some(f => f.channel === 'font-weight') ?? false, false);
});
test('child literal supersedes inherited weight binding; own binding keeps precedence with a named conflict', () => {
  const inherited = fixture(); inherited.anatomy.root.tokens = { 'font-weight': '{weight.regular}' };
  for (const label of compile(inherited).labels) {
    assert.equal(label.style, /Selected=True/i.test(label.variant) ? 'Semi Bold' : 'Medium');
    assert.equal(label.weight, undefined);
  }
  const own = fixture(); own.anatomy.root.parts!.label.tokens = { 'font-weight': '{weight.regular}' };
  const { data, labels } = compile(own);
  for (const label of labels) { assert.equal(label.style, 'Regular'); assert.equal(label.weight, 'weight/regular'); }
  assert.equal(data.codeOnlyFacts?.filter(f => f.channel === 'font-weight').reduce((n, f) => n + f.variants.count, 0), 2);
});
test('valid CSS weight without an exact native face is refused by name without rounding', () => {
  const c = fixture(); c.anatomy.root.parts!.label.literalsByCombination![0].rows[0].literals['font-weight'] = '510';
  const { data } = compile(c);
  const refusal = data.codeOnlyFacts?.find(f => f.channel === 'font-weight' && f.value === '510');
  assert.match(refusal?.reason ?? '', /no exact native face/);
  assert.equal(refusal?.variants.count, 1);
});
