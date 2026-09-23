import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import type { DumpSet } from './types.js';
import { mapRestToDump, REST_DUMP_VERSION, type RestBoundVariables } from './rest/map.js';

const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
  .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, 'const TARGET_SETS = ["ConsumerProbe"];');

function fixture() {
  const { figma: mockFigma } = createFigmaMock({ consumerVariableModes: true });
  const figma: any = mockFigma;
  const collection = figma.variables.createVariableCollection('Typography');
  const small = collection.modes[0].modeId;
  collection.renameMode(small, 'Small');
  const large = collection.addMode('Large');
  const size = figma.variables.createVariable('font-size', collection, 'FLOAT');
  const line = figma.variables.createVariable('line-height', collection, 'FLOAT');
  size.setValueForMode(small, 12); size.setValueForMode(large, 20);
  line.setValueForMode(small, 18); line.setValueForMode(large, 28);
  const texts: any[] = [];
  const mains = [small, large].map((mode, index) => {
    const main = figma.createComponent();
    main.name = `Size=${index ? 'Large' : 'Small'}`;
    main.setExplicitVariableModeForCollection(collection, mode);
    const slot = main.createSlot(); slot.name = 'Children';
    const text = figma.createText(); text.name = 'Template';
    text.characters = ''; text.visible = false;
    text.fontSize = index ? 20 : 12;
    text.lineHeight = { unit: 'PIXELS', value: index ? 28 : 18 };
    // Native TextNode exposes uniform bound text fields as one-element arrays.
    text.boundVariables.fontSize = [{ type: 'VARIABLE_ALIAS', id: size.id }];
    text.boundVariables.lineHeight = [{ type: 'VARIABLE_ALIAS', id: line.id }];
    slot.appendChild(text); texts.push(text);
    return main;
  });
  const set = figma.combineAsVariants(mains, figma.currentPage); set.name = 'ConsumerProbe';
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const capture = async () => JSON.parse(JSON.stringify(await vm.runInContext(`(async () => {${source}\n})()`, context))) as {
    ConsumerProbe: DumpSet;
    _degradations: Array<{ code: string; message: string }>;
    _variables: Record<string, unknown>;
    _provenance: { dumpVersion: string };
  };
  const labels = (dump: Awaited<ReturnType<typeof capture>>) => dump.ConsumerProbe.variants.map(v => v.children![0].children![0]);
  return { figma, collection, small, large, size, line, texts, mains, capture, labels };
}

test('hidden text captures its actual line-height binding and inherited consuming modes', async () => {
  const f = fixture();
  const before = f.texts.map(t => JSON.stringify({ characters: t.characters, visible: t.visible, bound: t.boundVariables, modes: t.explicitVariableModes }));
  const dump = await f.capture(), labels = f.labels(dump);
  assert.equal(dump._provenance.dumpVersion, '1.46');
  assert.ok(!dump._degradations.some(d => d.code === 'variable-consumer-unresolved'));
  assert.deepEqual(labels.map(n => n.text!.lineHeightVar), ['line-height', 'line-height']);
  assert.deepEqual(labels.map(n => n.variableConsumers![f.line.id]), [f.small, f.large].map((modeId, i) => ({
    name: 'line-height', collectionId: f.collection.id, modeId, modeName: i ? 'Large' : 'Small',
    resolvedType: 'FLOAT', value: i ? 28 : 18, selectedValue: i ? 28 : 18,
  })));
  assert.deepEqual(labels.map(n => n.variableConsumers![f.size.id].value), [12, 20]);
  assert.deepEqual(f.texts.map(t => t.explicitVariableModes), [{}, {}], 'selection is inherited, not invented on the text');
  assert.deepEqual(f.texts.map(t => JSON.stringify({ characters: t.characters, visible: t.visible, bound: t.boundVariables, modes: t.explicitVariableModes })), before);
  assert.ok(Object.hasOwn(dump._variables, 'line-height'));
});

test('native line-height identity overrides a conflicting stamp; mixed and unreadable bindings never use it', async () => {
  for (const kind of ['conflict', 'mixed', 'missing', 'malformed', 'empty', 'unbound'] as const) {
    const f = fixture();
    for (const t of f.texts) {
      t.setSharedPluginData('ds_contracts', 'lineHeightVar', 'legacy-line');
      if (kind === 'mixed') t.boundVariables.lineHeight.push({ type: 'VARIABLE_ALIAS', id: f.size.id });
      if (kind === 'missing') t.boundVariables.lineHeight[0].id = 'missing-variable';
      if (kind === 'malformed') t.boundVariables.lineHeight[0].type = 'NOT_AN_ALIAS';
      if (kind === 'empty') t.boundVariables.lineHeight = [];
      if (kind === 'unbound') delete t.boundVariables.lineHeight;
    }
    const dump = await f.capture();
    assert.deepEqual(f.labels(dump).map(n => n.text!.lineHeightVar),
      Array(2).fill(kind === 'conflict' ? 'line-height' : kind === 'unbound' || kind === 'empty' ? 'legacy-line' : undefined), kind);
    if (kind === 'conflict') assert.ok(dump._degradations.some(d => d.code === 'text-binding-conflict'));
    if (kind === 'mixed' || kind === 'missing' || kind === 'malformed') assert.ok(dump._degradations.some(d => d.code === 'text-channel-unsupported'));
  }
});

test('missing consuming-mode evidence is named and never replaced by the collection first mode', async () => {
  const f = fixture();
  for (const text of f.texts) Object.defineProperty(text, 'resolvedVariableModes', { get: () => ({}) });
  const dump = await f.capture();
  assert.ok(dump._degradations.some(d => d.code === 'variable-consumer-unresolved'));
  assert.ok(f.labels(dump).every(n => n.variableConsumers === undefined));
  assert.deepEqual(f.labels(dump).map(n => n.text!.lineHeightVar), ['line-height', 'line-height'], 'identity remains observed even when mode is unavailable');
});

test('alias chains capture every selected inherited mode without inventing additional node bindings', async () => {
  const f = fixture();
  const other = f.figma.variables.createVariableCollection('Alias target');
  const first = other.modes[0].modeId, second = other.addMode('Other');
  const target = f.figma.variables.createVariable('target-line', other, 'FLOAT');
  target.setValueForMode(first, 19); target.setValueForMode(second, 31);
  for (const mode of [f.small, f.large]) f.line.setValueForMode(mode, { type: 'VARIABLE_ALIAS', id: target.id });
  f.mains[1].setExplicitVariableModeForCollection(other, second);
  const terminal = f.figma.variables.createVariable('terminal-line', other, 'FLOAT');
  terminal.setValueForMode(first, 19); terminal.setValueForMode(second, 31);
  target.setValueForMode(first, { type: 'VARIABLE_ALIAS', id: terminal.id });
  const before = JSON.stringify([f.line.valuesByMode, target.valuesByMode, terminal.valuesByMode,
    f.texts.map(n => [n.boundVariables, n.explicitVariableModes])]);
  const dump = await f.capture(), labels = f.labels(dump);
  const rows = labels.map(n => n.variableConsumers![f.line.id]);
  assert.deepEqual(rows.map(r => r.value), [19, 31]);
  assert.deepEqual(rows.map(r => r.aliasChain?.map(hop => [hop.id, hop.name, hop.collectionId, hop.modeId, hop.modeName, hop.value, hop.selectedValue])), [
    [[target.id, 'target-line', other.id, first, other.modes[0].name, 19, { type: 'VARIABLE_ALIAS', id: terminal.id }],
      [terminal.id, 'terminal-line', other.id, first, other.modes[0].name, 19, 19]],
    [[target.id, 'target-line', other.id, second, 'Other', 31, 31]],
  ]);
  assert.ok(labels.every(n => Object.keys(n.variableConsumers!).length === 2));
  assert.ok(!Object.hasOwn(dump._variables, 'target-line') && !Object.hasOwn(dump._variables, 'terminal-line'));
  assert.ok(!dump._degradations.some(d => d.code === 'variable-consumer-alias-unresolved'));
  assert.equal(JSON.stringify([f.line.valuesByMode, target.valuesByMode, terminal.valuesByMode,
    f.texts.map(n => [n.boundVariables, n.explicitVariableModes])]), before);
  assert.deepEqual(rows.map(r => r.selectedValue), Array(2).fill({ type: 'VARIABLE_ALIAS', id: target.id }));
});

test('alias capture keeps native color precision and accepts the bounded 16-edge path', async () => {
  const f = fixture();
  const other = f.figma.variables.createVariableCollection('Alias color target');
  const mode = other.modes[0].modeId;
  const color = { r: Math.fround(0.7), g: Math.fround(0.1), b: Math.fround(0.15), a: 1 };
  const ink = f.figma.variables.createVariable('ink', f.collection, 'COLOR');
  // The general mock stops resolution at ten hops. Isolate the capture's
  // sixteen-edge boundary without changing that older mock behavior.
  ink.resolveForConsumer = () => ({ resolvedType: 'COLOR', value: color });
  let previous = ink;
  const ids: string[] = [];
  for (let i = 0; i < 16; i++) {
    const next = f.figma.variables.createVariable(`ink-target-${i}`, other, 'COLOR');
    next.setValueForMode(mode, color); ids.push(next.id);
    next.resolveForConsumer = () => ({ resolvedType: 'COLOR', value: color });
    for (const selected of i === 0 ? [f.small, f.large] : [mode])
      previous.setValueForMode(selected, { type: 'VARIABLE_ALIAS', id: next.id });
    previous = next;
  }
  for (const t of f.texts) t.fills = [f.figma.variables.setBoundVariableForPaint({ type: 'SOLID', color }, 'color', ink)];
  const dump = await f.capture();
  for (const node of f.labels(dump)) {
    const record = node.variableConsumers![ink.id];
    assert.deepEqual(record.value, color);
    assert.deepEqual(record.aliasChain!.map(hop => hop.id), ids);
    assert.deepEqual(record.aliasChain![15].selectedValue, color);
    assert.equal(Object.keys(node.variableConsumers!).length, 3);
  }
  assert.ok(!dump._degradations.some(d => d.code === 'variable-consumer-alias-unresolved'));
});

test('unverifiable alias paths retain the direct observed record and omit the entire chain', async () => {
  for (const kind of ['missing-mode', 'missing-target', 'unknown-mode', 'cycle', 'depth', 'disagreement', 'wrong-type',
    'non-finite', 'terminal-disagreement', 'malformed'] as const) {
    const f = fixture();
    const other = f.figma.variables.createVariableCollection('Alias target');
    const mode = other.modes[0].modeId;
    const target = f.figma.variables.createVariable('target', other, 'FLOAT');
    target.setValueForMode(mode, 19);
    for (const selected of [f.small, f.large]) f.line.setValueForMode(selected, { type: 'VARIABLE_ALIAS', id: target.id });
    // Isolate path validation from the platform resolver's own failure modes.
    // An observed direct value alone is insufficient to corroborate its path.
    f.line.resolveForConsumer = () => ({ resolvedType: 'FLOAT', value: 19 });
    target.resolveForConsumer = () => ({ resolvedType: 'FLOAT', value: 19 });
    if (kind === 'missing-mode' || kind === 'unknown-mode') for (const [i, text] of f.texts.entries())
      Object.defineProperty(text, 'resolvedVariableModes', { value: {
        [f.collection.id]: i ? f.large : f.small, ...(kind === 'unknown-mode' ? { [other.id]: 'not-a-mode' } : {}),
      } });
    if (kind === 'missing-target') for (const selected of [f.small, f.large])
      f.line.setValueForMode(selected, { type: 'VARIABLE_ALIAS', id: 'missing-target' });
    if (kind === 'cycle') target.setValueForMode(mode, { type: 'VARIABLE_ALIAS', id: f.line.id });
    if (kind === 'depth') {
      let previous = target;
      for (let i = 0; i < 16; i++) {
        const next = f.figma.variables.createVariable(`deep-${i}`, other, 'FLOAT');
        next.setValueForMode(mode, 19); next.resolveForConsumer = () => ({ resolvedType: 'FLOAT', value: 19 });
        previous.setValueForMode(mode, { type: 'VARIABLE_ALIAS', id: next.id }); previous = next;
      }
    }
    if (kind === 'disagreement') target.resolveForConsumer = () => ({ resolvedType: 'FLOAT', value: 20 });
    if (kind === 'wrong-type') target.resolveForConsumer = () => ({ resolvedType: 'STRING', value: '19' });
    if (kind === 'non-finite') target.resolveForConsumer = () => ({ resolvedType: 'FLOAT', value: Infinity });
    if (kind === 'terminal-disagreement') target.setValueForMode(mode, 20);
    if (kind === 'malformed') for (const selected of [f.small, f.large])
      f.line.setValueForMode(selected, { type: 'VARIABLE_ALIAS', id: target.id, extra: true });
    const dump = await f.capture(), labels = f.labels(dump);
    assert.ok(dump._degradations.some(d => d.code === 'variable-consumer-alias-unresolved'), kind);
    for (const label of labels) {
      assert.equal(label.variableConsumers![f.line.id].value, 19, kind);
      assert.equal(label.variableConsumers![f.line.id].aliasChain, undefined, kind);
      assert.equal(Object.keys(label.variableConsumers!).length, 2, kind);
    }
  }
});

test('consumer evidence preserves native precision and names unreadable, unknown or non-finite resolutions', async () => {
  for (const kind of ['precision', 'getter', 'unknown-mode', 'non-finite'] as const) {
    const f = fixture();
    if (kind === 'precision') {
      f.line.setValueForMode(f.small, Math.fround(18.123456));
      f.line.setValueForMode(f.large, Math.fround(28.123456));
    } else if (kind === 'getter') {
      for (const t of f.texts) Object.defineProperty(t, 'resolvedVariableModes', { get() { throw Error('mode-read-refused'); } });
    } else if (kind === 'unknown-mode') {
      for (const t of f.texts) Object.defineProperty(t, 'resolvedVariableModes', { value: { [f.collection.id]: 'not-a-mode' } });
    } else f.line.resolveForConsumer = () => ({ resolvedType: 'FLOAT', value: NaN });
    const dump = await f.capture(), labels = f.labels(dump);
    if (kind === 'precision') {
      assert.deepEqual(labels.map(n => n.variableConsumers![f.line.id].value), [Math.fround(18.123456), Math.fround(28.123456)]);
    } else {
      assert.ok(dump._degradations.some(d => d.code === 'variable-consumer-unresolved'), kind);
      assert.ok(labels.every(n => n.variableConsumers?.[f.line.id] === undefined), kind);
    }
  }
});

test('REST native line-height bindings agree with plugin precedence without inventing consuming modes', () => {
  const alias = { type: 'VARIABLE_ALIAS' as const, id: 'line' };
  for (const kind of ['native', 'conflict', 'mixed', 'missing', 'malformed', 'empty', 'unbound'] as const) {
    const lineHeight = kind === 'unbound' ? undefined : kind === 'empty' ? []
      : kind === 'missing' ? [{ ...alias, id: 'missing' }]
      : kind === 'malformed' ? [{ id: alias.id }]
      : kind === 'mixed' ? [alias, { ...alias, id: 'other' }] : [alias];
    const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: {
      id: '1:1', type: 'COMPONENT', name: 'RestProbe', children: [{
        id: '1:2', type: 'TEXT', name: 'Template', characters: '', visible: false,
        style: { fontSize: 12, fontFamily: 'Inter', lineHeightUnit: 'PIXELS', lineHeightPx: 18 },
        boundVariables: { lineHeight } as RestBoundVariables,
        sharedPluginData: { ds_contracts: { lineHeightVar: kind === 'native' ? '' : 'legacy-line' } },
      }],
    } } } }, { variables: { meta: {
      variables: { line: { id: 'line', name: 'line-height', resolvedType: 'FLOAT', variableCollectionId: 'typography', valuesByMode: { small: 18, large: 28 } } },
      variableCollections: { typography: { id: 'typography', defaultModeId: 'small', modes: [{ modeId: 'small', name: 'Small' }, { modeId: 'large', name: 'Large' }] } },
    } } });
    const label = (result.dump.RestProbe as DumpSet).variants[0].children![0];
    assert.equal(REST_DUMP_VERSION, '1.42');
    assert.equal(label.text!.lineHeightVar, ['native', 'conflict'].includes(kind) ? 'line-height'
      : ['empty', 'unbound'].includes(kind) ? 'legacy-line' : undefined, kind);
    assert.equal(label.variableConsumers, undefined, 'REST does not identify inherited consuming modes');
    assert.equal(label.text!.lineHeight, 18, 'observed pixel value remains');
    if (kind === 'conflict') assert.ok(result.report.degradations.some(d => d.code === 'text-binding-conflict'));
    if (['mixed', 'missing', 'malformed'].includes(kind)) assert.ok(result.report.degradations.some(d => d.code === 'text-channel-unsupported'), kind);
  }
});


test('native weight capture retains numeric weight, mode and variable identity with guarded stamp fallback', async () => {
  for (const kind of ['native', 'conflict', 'mixed', 'missing', 'malformed', 'empty', 'unbound', 'non-numeric'] as const) {
    const f = fixture();
    const weight = f.figma.variables.createVariable('font-weight', f.collection, 'FLOAT');
    weight.setValueForMode(f.small, 400); weight.setValueForMode(f.large, 700);
    for (const [index, text] of f.texts.entries()) {
      text.fontWeight = kind === 'non-numeric' ? Symbol('mixed') : index ? 700 : 400;
      text.boundVariables.fontWeight = [{ type: 'VARIABLE_ALIAS', id: weight.id }];
      text.setSharedPluginData('ds_contracts', 'fontWeightVar', kind === 'native' ? '' : 'legacy-weight');
      if (kind === 'mixed') text.boundVariables.fontWeight.push({ type: 'VARIABLE_ALIAS', id: f.size.id });
      if (kind === 'missing') text.boundVariables.fontWeight[0].id = 'missing';
      if (kind === 'malformed') text.boundVariables.fontWeight[0].type = 'NOT_AN_ALIAS';
      if (kind === 'empty') text.boundVariables.fontWeight = [];
      if (kind === 'unbound') delete text.boundVariables.fontWeight;
    }
    const dump = await f.capture(), rows = f.labels(dump);
    const captured = ['native', 'conflict', 'non-numeric'].includes(kind);
    assert.deepEqual(rows.map(n => n.text!.fontWeightVar), Array(2).fill(captured ? 'font-weight' :
      ['empty', 'unbound'].includes(kind) ? 'legacy-weight' : undefined), kind);
    assert.deepEqual(rows.map(n => n.text!.fontWeight), captured && kind !== 'non-numeric' ? [400, 700] : [undefined, undefined], kind);
    if (captured) {
      assert.ok(Object.hasOwn(dump._variables, 'font-weight'));
      assert.deepEqual(rows.map(n => n.variableConsumers![weight.id].value), [400, 700]);
      assert.deepEqual(rows.map(n => n.variableConsumers![weight.id].modeId), [f.small, f.large]);
    }
    if (kind === 'conflict') assert.ok(dump._degradations.some(d => d.code === 'text-binding-conflict'));
    if (['mixed', 'missing', 'malformed', 'non-numeric'].includes(kind))
      assert.ok(dump._degradations.some(d => d.code === 'text-channel-unsupported'), kind);
  }
});

test('REST weight capture uses native binding precedence and preserves weight without inventing modes', () => {
  const alias = { type: 'VARIABLE_ALIAS' as const, id: 'weight' };
  for (const kind of ['native', 'conflict', 'mixed', 'missing', 'malformed', 'empty', 'unbound', 'non-numeric'] as const) {
    const fontWeight = kind === 'unbound' ? undefined : kind === 'empty' ? []
      : kind === 'missing' ? [{ ...alias, id: 'missing' }]
      : kind === 'malformed' ? [{ id: alias.id }]
      : kind === 'mixed' ? [alias, { ...alias, id: 'other' }] : [alias];
    const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: {
      id: '1:1', type: 'COMPONENT', name: 'WeightProbe', children: [{
        id: '1:2', type: 'TEXT', name: 'Template', characters: '', visible: false,
        style: { fontSize: 12, fontFamily: 'Inter', ...(kind !== 'non-numeric' ? { fontWeight: 700 } : {}) },
        boundVariables: { fontWeight } as RestBoundVariables,
        sharedPluginData: { ds_contracts: { fontWeightVar: kind === 'native' ? '' : 'legacy-weight' } },
      }],
    } } } }, { variables: { meta: {
      variables: { weight: { id: 'weight', name: 'font-weight', resolvedType: 'FLOAT', variableCollectionId: 'typography', valuesByMode: { first: 700 } } },
      variableCollections: { typography: { id: 'typography', defaultModeId: 'first', modes: [{ modeId: 'first', name: 'First' }] } },
    } } });
    const label = (result.dump.WeightProbe as DumpSet).variants[0].children![0];
    const captured = ['native', 'conflict', 'non-numeric'].includes(kind);
    assert.equal(label.text!.fontWeightVar, captured ? 'font-weight' : ['empty', 'unbound'].includes(kind) ? 'legacy-weight' : undefined, kind);
    assert.equal(label.text!.fontWeight, captured && kind !== 'non-numeric' ? 700 : undefined, kind);
    assert.equal(label.variableConsumers, undefined);
    if (kind === 'conflict') assert.ok(result.report.degradations.some(d => d.code === 'text-binding-conflict'));
    if (['mixed', 'missing', 'malformed', 'non-numeric'].includes(kind))
      assert.ok(result.report.degradations.some(d => d.code === 'text-channel-unsupported'), kind);
  }
});
