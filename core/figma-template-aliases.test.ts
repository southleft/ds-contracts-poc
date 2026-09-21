import assert from 'node:assert/strict';
import test from 'node:test';
import type { DumpSet } from '../extract/figma/types.js';
import { projectRootTextTemplateAliases } from './figma-template-aliases.js';
import { capturedTokensFromDump } from './captured-tokens.js';
import { tokenCorpusFromJson } from './token-corpus.js';

function fixture(): DumpSet {
  const fields = { fontSizeVar: 'font-size', lineHeightVar: 'line-height', fontWeightVar: 'font-weight', fillVar: 'fill' };
  return { setName: 'Template aliases', rootSlot: { version: 1, property: 'Children', textTemplate: 1 },
    variants: ['small', 'large'].map(size => {
      const consumers: Record<string, any> = {}, text: Record<string, any> = {};
      for (const [field, suffix] of Object.entries(fields)) {
        const value = field === 'fillVar' ? { r: Math.fround(25 / 255), g: 0, b: 0, a: 1 } :
          field === 'fontWeightVar' ? 400 : size === 'small' ? 12 : 20;
        const sourceName = `${suffix}/${size}`, sourceId = 'source-' + sourceName;
        const common = { collectionId: 'collection', modeId: size, modeName: size, resolvedType: field === 'fillVar' ? 'COLOR' : 'FLOAT', value };
        const first = { ...common, id: sourceId, name: sourceName, selectedValue: value };
        const name = `dsc-native-template/${'a'.repeat(64)}/${suffix}`;
        consumers['carrier-' + suffix] = { ...common, name, selectedValue: { type: 'VARIABLE_ALIAS', id: sourceId }, aliasChain: [first] };
        text[field] = name;
      }
      return { name: 'Size=' + size, type: 'COMPONENT', children: [{ name: 'Children', type: 'SLOT', children: [
        { name: 'Content text template', type: 'TEXT', text, fill: { var: text.fillVar }, variableConsumers: consumers },
      ] }] };
    }) } as DumpSet;
}
const consumers = (set: DumpSet, variant = 0) => set.variants[variant].children![0].children![0].variableConsumers! as Record<string, any>;
const first = (set: DumpSet, variant = 0) => consumers(set, variant)['carrier-font-size'];

test('compiler carrier inversion preserves source names, nested aliases and immutable input', () => {
  const set = fixture(), direct = first(set), hop = direct.aliasChain[0];
  hop.selectedValue = { type: 'VARIABLE_ALIAS', id: 'primitive-size-small' };
  direct.aliasChain.push({ ...hop, id: 'primitive-size-small', name: 'primitive/size/small', selectedValue: 12 });
  const before = structuredClone(set), projected = projectRootTextTemplateAliases(set)!;
  assert.equal(projected.tokens.length, 9);
  assert.equal(projected.tokens.find(t => t.name === 'font-size/small')?.reference, '{primitive.size.small}');
  assert.equal(projected.set.variants[0].children![0].children![0].text!.fontSizeVar, 'font-size/small');
  assert.equal(projected.tokens.find(t => t.name === 'font-weight/small')?.type, 'number');
  assert.equal(projected.tokens.find(t => t.name === 'fill/small')?.value, '#190000');
  assert.deepEqual(set, before);
  const dump = { template: set, _variables: Object.fromEntries(Object.values(consumers(set)).map(c => [c.name, {
    type: c.resolvedType, value: c.resolvedType === 'COLOR' ? '#190000' : c.value,
  }])) };
  const layer = capturedTokensFromDump(dump)!;
  assert.deepEqual(layer.skipped, []);
  assert.equal(layer.count, 9);
  const corpus = tokenCorpusFromJson({ primitives: layer.tree, semantic: {}, light: {}, brandDefault: {} });
  assert.equal(corpus.resolveLiteral('font-size.small'), '12px');
  assert.equal((layer.tree['font-size'] as any).small.$value, '{primitive.size.small}');
});

test('selected compiler aliases refuse malformed edges, modes, values and identities', () => {
  const mutations: Array<(set: DumpSet) => void> = [
    s => { delete first(s).aliasChain; },
    s => { first(s).aliasChain = []; },
    s => { first(s).aliasChain[0].id = 'wrong'; },
    s => { first(s).selectedValue.extra = true; },
    s => { first(s).aliasChain[0].selectedValue = { type: 'VARIABLE_ALIAS', id: 'missing' }; },
    s => { first(s).aliasChain[0].selectedValue = 99; },
    s => { first(s).aliasChain[0].value = 99; },
    s => { first(s).aliasChain[0].modeId = 'missing'; },
    s => { first(s).aliasChain[0].collectionId = 'other'; },
    s => { first(s).aliasChain[0].resolvedType = 'STRING'; },
    s => { first(s).value = Infinity; },
    s => { first(s).aliasChain[0].aliasChain = []; },
    s => { first(s).aliasChain[0].modeName = 'conflicting'; },
    s => { first(s).collectionId = 1; },
    s => { first(s, 1).name = `dsc-native-template/${'b'.repeat(64)}/font-size`; },
    s => { consumers(s, 1)['carrier-renamed'] = first(s, 1); delete consumers(s, 1)['carrier-font-size']; },
    s => { first(s, 1).aliasChain[0].name = 'font-size/small'; },
    s => { first(s).aliasChain[0].name = 'bad path'; },
    s => { first(s).aliasChain[0].name = 'constructor/prototype'; },
    s => { first(s).aliasChain[0].name = 'toString/custom'; },
    s => { first(s).aliasChain[0].name = 'dsc-native-template/invented'; },
    s => { first(s).aliasChain[0].name = 'fill'; },
    s => { consumers(s)['carrier-fill'].value.r = 0.123; },
    s => { first(s).extra = true; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const set = fixture(); mutate(set);
    assert.throws(() => projectRootTextTemplateAliases(set), /FIGMA_SLOT_TEXT_TEMPLATE_READBACK_UNQUALIFIED/, String(index));
  }
});

test('source definitions cannot vary or change units even when selected chains individually resolve', () => {
  for (const kind of ['value', 'edge', 'units']) {
    const set = fixture(), small = first(set), large = first(set, 1);
    if (kind === 'units') {
      const weight = consumers(set)['carrier-font-weight'];
      weight.value = small.value;
      weight.selectedValue = structuredClone(small.selectedValue);
      weight.aliasChain = structuredClone(small.aliasChain);
    } else {
      large.selectedValue = structuredClone(small.selectedValue);
      large.aliasChain[0].id = small.aliasChain[0].id;
      large.aliasChain[0].name = small.aliasChain[0].name;
      if (kind === 'edge') {
        large.value = 12; large.aliasChain[0].value = 12;
        large.aliasChain[0].selectedValue = { type: 'VARIABLE_ALIAS', id: 'new-target' };
        large.aliasChain.push({ ...large.aliasChain[0], id: 'new-target', name: 'primitive/new', selectedValue: 12 });
      }
    }
    assert.throws(() => projectRootTextTemplateAliases(set), /original source token changes/, kind);
  }
});

test('cycles and overlong chains refuse; admitted chains resolve within the shared token corpus bound', () => {
  const set = fixture(), direct = first(set), original = direct.aliasChain[0];
  direct.aliasChain = Array.from({ length: 10 }, (_, i) => ({ ...original, id: `source-${i}`, name: `source/${i}`,
    selectedValue: i === 9 ? 12 : { type: 'VARIABLE_ALIAS', id: `source-${i + 1}` } }));
  direct.selectedValue.id = 'source-0';
  assert.equal(projectRootTextTemplateAliases(set)!.tokens.find(t => t.name === 'source/0')?.reference, '{source.1}');
  const layer = capturedTokensFromDump({ template: set, _variables: { unrelated: { type: 'FLOAT', value: 1 } } })!;
  assert.equal(tokenCorpusFromJson({ primitives: layer.tree, semantic: {}, light: {}, brandDefault: {} }).resolveLiteral('source.0'), '12px');
  const cyclic = structuredClone(set); first(cyclic).aliasChain[9].selectedValue = { type: 'VARIABLE_ALIAS', id: 'source-0' };
  assert.throws(() => projectRootTextTemplateAliases(cyclic), /incomplete or contradictory/);
  direct.aliasChain.push({ ...original });
  assert.throws(() => projectRootTextTemplateAliases(set), /token corpus limit/);
});

test('captured layer refuses equal-valued different source identities across sets', () => {
  const set = fixture(), other = fixture();
  const c = first(other); c.aliasChain[0].id = 'other-source'; c.selectedValue.id = 'other-source';
  const layer = capturedTokensFromDump({ first: set, second: other, _variables: { unrelated: { type: 'FLOAT', value: 1 } } })!;
  assert.equal(layer.entries.some(e => e.path === 'font-size.small'), false);
  assert.ok(layer.skipped.some(e => e.name === 'font-size/small' && e.reason.includes('conflicting')));
  const outside = { ...fixture(), rootSlot: undefined };
  const source = structuredClone(first(set).aliasChain[0]);
  outside.variants[0].children![0].children![0].variableConsumers = { 'unrelated-native-id': source };
  const direct = capturedTokensFromDump({ template: set, outside, _variables: { unrelated: { type: 'FLOAT', value: 1 } } })!;
  assert.ok(direct.skipped.some(e => e.name === 'font-size/small' && e.reason.includes('conflicting')));
});
