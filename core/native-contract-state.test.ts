import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';

test('static draft text retains native ownership, font and paint tokens through independent readback', async () => {
  const f = await nativeComparisonFixture(), c = structuredClone(f.content);
  c.anatomy.root.literals = { height: '36px' };
  const createComponent = f.figma.createComponent.bind(f.figma);
  f.figma.createComponent = () => {
    const node = createComponent();
    node.fills = [{ type: 'SOLID', visible: false, opacity: 1, color: { r: 1, g: 1, b: 1 }, boundVariables: {} }];
    return node;
  };
  const byId = new Map([[c.id, c]]), compiled = f.engine.compileNativeContractDraft(c, byId, f.source);
  const emit = () => f.engine.buildNativeContractDraftScript(c, byId, f.source, f.supplemental);
  const created = await f.run(emit());
  assert.equal(created.status, 'created-candidate', JSON.stringify(created));
  const input: NativeContractObservationInput = { operation: f.supplemental.operation, planRevision: revisionOf('static-text'),
    projection: compiled.projection, component: compiled.component, tokenInput: f.supplemental.tokens.input,
    tokenIdentity: f.supplemental.tokens.identity, creation: created };
  const receipt = await f.run(emitNativeContractReadbackScript(input));
  assert.deepEqual(receipt.nodes.find((n: any) => n.type === 'COMPONENT').values.fills, [], 'unrequested native birth fill is cleared');
  assert.equal(verifyNativeContractReadback(input, receipt).status, 'supported-structure-observed', JSON.stringify(verifyNativeContractReadback(input, receipt)));
  const text = receipt.nodes.find((n: any) => n.type === 'TEXT');
  assert.equal(text.values.characters, 'Save changes');
  assert.equal(receipt.nodes.find((n: any) => n.type === 'COMPONENT').values.primaryAxisSizingMode, 'AUTO');
  const uniform = structuredClone(receipt);
  uniform.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize = [text.values.boundVariables.fontSize];
  assert.equal(verifyNativeContractReadback(input, uniform).status, 'supported-structure-observed', 'native uniform text binding arrays are supported');
  for (const mutate of [
    (n: any) => { n.values.characters = 'Changed'; },
    (n: any) => { n.values.fontName.family = 'Wrong'; },
    (n: any) => { n.values.boundVariables.fontSize = []; },
    (n: any) => { n.values.boundVariables.fontSize = [n.values.boundVariables.fontSize, n.values.boundVariables.fontSize]; },
    (n: any) => { n.values.fills[0].boundVariables.color.id = 'wrong'; },
    (n: any) => { n.metadata.fontWeightVar = 'invented'; },
    (n: any) => { n.metadata.lineHeightVar = 'invented'; },
    (n: any) => { n.metadata.nativeContractPart = '{}'; },
  ]) {
    const changed = structuredClone(receipt); mutate(changed.nodes.find((n: any) => n.type === 'TEXT'));
    assert.equal(verifyNativeContractReadback(input, changed).status, 'refused');
  }
  const count = f.figma.root.findAll(() => true).length;
  const repeat = await f.run(emit());
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  const wrapped = structuredClone(c);
  wrapped.anatomy.root.parts!.label.tokens!['background-color'] = '{surface}';
  assert.throws(() => f.engine.compileNativeContractDraft(wrapped, new Map([[wrapped.id, wrapped]]), f.source), /TEXT_OWNERSHIP_UNQUALIFIED/);
  const unavailable = structuredClone(c);
  unavailable.anatomy.root.parts!.label.declared!['font-family'] = 'Missing Face';
  const load = f.figma.loadFontAsync.bind(f.figma);
  f.figma.loadFontAsync = async (font: any) => { if (font.family === 'Missing Face') throw Error('unavailable'); return load(font); };
  const refused = await f.run(f.engine.buildNativeContractDraftScript(unavailable, new Map([[unavailable.id, unavailable]]), f.source, f.supplemental));
  assert.equal(refused.status, 'refused'); assert.equal(refused.allocationAttempted, false);
  assert.ok(refused.problems.includes('native-source-write-draft-font-unavailable'), JSON.stringify(refused));
});

// Native API mock evidence only. No raster or vector fidelity claims.
test('OKLab shadow rings retain their complete stack through native emission and independent readback', async () => {
  const f = await nativeComparisonFixture();
  // Browser-computed Tailwind ring plus elevation. Keep transparent layers and
  // order too: accepting only the final RGB layer would silently lose the ring.
  const shadow = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.145 0 0 / 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px';
  const c = structuredClone(f.main);
  c.anatomy.root.literals = { 'box-shadow': shadow };
  const byId = new Map([[c.id, c]]);
  const compiled = f.engine.compileNativeContractDraft(c, byId, f.source);
  const spec = compiled.component.variants[0].spec;
  assert.equal(spec.effectStack?.length, 3);
  assert.deepEqual(spec.effectStack?.[1], {
    x: 0, y: 0, radius: 0, spread: 1,
    color: { r: 10 / 255, g: 10 / 255, b: 10 / 255, a: 0.1 },
  });
  assert.ok(!compiled.component.codeOnlyFacts?.some(fact => fact.channel === 'box-shadow'));
  const tokenContract = structuredClone(c);
  delete tokenContract.anatomy.root.literals!['box-shadow'];
  tokenContract.anatomy.root.tokens!['box-shadow'] = '{ring}';
  const tokenEngine = createFigmaEngine({ tokens: { primitives: { ...f.tokens, ring: { $type: 'shadow', $value: shadow } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  assert.deepEqual(tokenEngine.compileComponentData(tokenContract, new Map([[tokenContract.id, tokenContract]])).variants[0].spec.effectStack, spec.effectStack);
  const created = await f.run(f.engine.buildNativeContractDraftScript(c, byId, f.source, f.supplemental));
  assert.equal(created.status, 'created-candidate');
  const input: NativeContractObservationInput = { operation: f.supplemental.operation, planRevision: revisionOf('shadow'),
    projection: compiled.projection, component: compiled.component, tokenInput: f.supplemental.tokens.input,
    tokenIdentity: f.supplemental.tokens.identity, creation: created };
  const receipt = await f.run(emitNativeContractReadbackScript(input));
  assert.equal(verifyNativeContractReadback(input, receipt).status, 'supported-structure-observed');
  const changed = structuredClone(receipt);
  changed.nodes.find((n: any) => n.type === 'COMPONENT').values.effects[1].color.a = 0;
  assert.equal(verifyNativeContractReadback(input, changed).status, 'refused');

  for (const color of ['oklch(14.5% 0 0 / 10%)', 'oklab(1.45e-1 0 0 / 10%)']) {
    c.anatomy.root.literals!['box-shadow'] = `${color} 0px 0px 0px 1px`;
    assert.deepEqual(f.engine.compileComponentData(c, byId).variants[0].spec.effectStack, [spec.effectStack![1]]);
  }
  for (const color of ['oklab(0.1 broken 0)', 'oklab(1e999 0 0)', 'oklch(0.1 0 unknown)', 'color-mix(in oklab, red, blue)']) {
    c.anatomy.root.literals!['box-shadow'] = `${color} 0px 0px 0px 1px, rgba(0,0,0,0.2) 0px 1px 2px`;
    const refused = f.engine.compileComponentData(c, byId);
    assert.equal(refused.variants[0].spec.effectStack, undefined);
    assert.ok(refused.codeOnlyFacts?.some(fact => fact.channel === 'box-shadow'));
  }
});

async function fixture() {
  const host = nativeFixtureHost(), { figma } = host;
  const proto = Object.getPrototypeOf(figma.currentPage);
  proto.setExplicitVariableModeForCollection = function(c: any, mode: string) { this.explicitVariableModes = { [c.id]: mode }; };
  const makeSvg = figma.createNodeFromSvg.bind(figma);
  figma.createNodeFromSvg = (svg: string) => {
    const frame = makeSvg(svg), vector = new proto.constructor('VECTOR');
    vector.fills = []; vector.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; frame.appendChild(vector); return frame;
  };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`, { figma, console }, { timeout: 5000 })));
  const tokens = { ink: { $type: 'color', $value: '#fafafa' }, size: { $type: 'dimension', $value: '16px' }, faded: { $type: 'number', $value: 0.5 } };
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map([['glyph', '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12L10 18L20 4" stroke="currentColor"/></svg>']]) });
  const contract = ContractSchema.parse({ id: 'fixture.initial', name: 'Initial', version: '0.1.0', status: 'draft',
    description: 'Synthetic finite initial-state draft', states: [], semantics: { element: 'button' }, props: [{ name: 'value', type: { enum: ['off','on'] },
      bindings: { code: { prop: 'value' }, figma: { kind: 'VARIANT', property: 'Value', unsetValue: '(unset)' } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row', align: 'center', justify: 'center' }, tokens: { width: '{size}', height: '{size}', opacity: '{faded}' }, parts: {
      glyph: { icon: { asset: 'glyph', size: 14 }, tokens: { color: '{ink}' }, visibleWhen: { prop: 'value', equals: 'on' } },
      region: { shape: { kind: 'rect', width: 38, height: 30 }, declared: { position: 'absolute', 'pointer-events': 'auto' },
        literals: { left: '-12px', top: '-8px', 'background-color': 'transparent' } },
    } } }, bindings: { code: { anchors: { importPath: './fixture', export: 'Initial' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const source = { revision: revisionOf('source'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf('observations') };
  const byId = new Map([[contract.id, contract]]), compiled = engine.compileNativeContractDraft(contract, byId, source);
  const operation = { id: '10000000-0000-4000-8000-000000000006', fileKey: figma.fileKey };
  const input: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + operation.id,
    source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens, tokenTreeRevision: revisionOf(tokens) }] };
  const created = await run(emitNativeTokenContextScript(input).script), observed = await run(emitNativeTokenContextReadbackScript(input, created.creationIdentity));
  const context = { operation, tokens: { input, identity: created.creationIdentity, receipt: observed.receipt } };
  const emit = () => engine.buildNativeContractDraftScript(contract, byId, source, context);
  return { figma, run, compiled, context, emit, contract, engine, source };
}

test('stateful native drafts own shapes and SVG descendants, verify them independently, and refuse duplicates', async () => {
  const f = await fixture(), created = await f.run(f.emit());
  assert.equal(created.status, 'created-candidate', JSON.stringify(created));
  assert.equal(created.variants.length, 3);
  assert.equal(created.nodes.filter((n: any) => n.type === 'RECTANGLE').length, 3);
  assert.equal(created.nodes.filter((n: any) => n.type === 'VECTOR').length, 1);
  const input: NativeContractObservationInput = { operation: f.context.operation, planRevision: revisionOf('plan'), projection: f.compiled.projection,
    component: f.compiled.component, tokenInput: f.context.tokens.input, tokenIdentity: f.context.tokens.identity, creation: created };
  const receipt = await f.run(emitNativeContractReadbackScript(input));
  const result = verifyNativeContractReadback(input, receipt);
  assert.equal(result.status, 'supported-structure-observed', JSON.stringify(result));
  for (const node of receipt.nodes.filter((n: any) => n.type === 'COMPONENT'))
    assert.equal(node.values.opacity, 0.5, 'the writer applies node opacity to every variant');
  assert.equal(result.nativeQualification, 'unqualified');
  for (const mutate of [
    (r: any) => { r.nodes.find((n: any) => n.type === 'COMPONENT').values.opacity = 1; },
    (r: any) => { delete r.nodes.find((n: any) => n.type === 'COMPONENT').values.opacity; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'RECTANGLE').values.width += 1; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'RECTANGLE').values.x += 1; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'RECTANGLE').metadata.nativeContractPart = '{}'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'VECTOR').metadata.nativeContractPart = '{}'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'VECTOR').values.strokes[0].boundVariables.color.id = 'wrong'; },
    (r: any) => { r.nodes = r.nodes.filter((n: any) => n.type !== 'VECTOR'); },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    assert.equal(verifyNativeContractReadback(input, changed).status, 'refused');
  }
  const count = f.figma.root.findAll(() => true).length;
  const repeat = await f.run(f.emit()); assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
});

test('partial shape initialization retains its allocated identity and does not authorize a retry', async () => {
  const f = await fixture(), make = f.figma.createRectangle.bind(f.figma);
  f.figma.createRectangle = () => {
    const node = make(), set = node.setSharedPluginData.bind(node);
    node.setSharedPluginData = (ns: string, key: string, value: string) => {
      if (key === 'nativeContractPart') throw Error('fixture partial metadata failure'); set(ns, key, value);
    }; return node;
  };
  const created = await f.run(f.emit());
  assert.notEqual(created.status, 'created-candidate'); assert.equal(created.allocationAttempted, true);
  assert.ok(created.nodes.some((n: any) => n.type === 'RECTANGLE'));
  const repeat = await f.run(f.emit()); assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
});

test('SVG import retains every allocated descendant before a root metadata failure', async () => {
  const f = await fixture(), make = f.figma.createNodeFromSvg.bind(f.figma);
  let ids: string[] = [];
  f.figma.createNodeFromSvg = (svg: string) => {
    const node = make(svg);
    ids = [node.id, ...node.findAll(() => true).map((child: any) => child.id)];
    node.setSharedPluginData = () => { throw Error('fixture SVG root metadata failure'); };
    return node;
  };
  const created = await f.run(f.emit());
  assert.notEqual(created.status, 'created-candidate'); assert.equal(created.allocationAttempted, true);
  assert.ok(ids.length > 1);
  for (const id of ids) assert.equal(created.nodes.filter((n: any) => n.id === id).length, 1);
  const repeat = await f.run(f.emit()); assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
});

for (const [flow, hug] of [[false, false], [true, false], [true, true]]) test(`native grid readback checks declared tracks, gaps, ${flow ? 'flow order' : 'cells and spans'}${hug ? ' and hugging height' : ''}`, async () => {
  const f = await nativeComparisonFixture();
  const contract = f.contract('fixture.grid', { root: {
    layout: { display: 'grid', rows: [{ fit: true }, hug ? { fit: true } : { fr: 1 }], columns: [{ px: 80 }, { fr: 1 }],
      gap: { row: 8, column: 12 }, ...(flow ? { flow: 'row' } : {}) },
    literals: { width: '300px', height: hug ? 'fit-content' : '180px' },
    parts: Object.fromEntries(['first', 'second', 'third'].map((name, i) => [name, {
      layout: { display: 'flex', direction: 'column' }, tokens: { width: '{size}', height: '{size}' },
      ...(!flow ? { placement: i === 0 ? { row: 0, column: 0, columnSpan: 2, alignX: 'center' }
        : { row: 1, column: i - 1 } } : {}),
    }])),
  } });
  const byId = new Map([[contract.id, contract]]), context = await f.context('10000000-0000-4000-8000-000000000007');
  const compiled = f.engine.compileNativeContractDraft(contract, byId, f.source);
  const creation = await f.run(f.engine.buildNativeContractDraftScript(contract, byId, f.source, context));
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  const input: NativeContractObservationInput = { operation: context.operation, planRevision: revisionOf('grid plan'),
    projection: compiled.projection, component: compiled.component, tokenInput: context.tokens.input,
    tokenIdentity: context.tokens.identity, creation };
  const read = () => f.run(emitNativeContractReadbackScript(input));
  const receipt = await read(), verify = (value: unknown) => verifyNativeContractReadback(input, value);
  assert.equal(verify(receipt).status, 'supported-structure-observed', JSON.stringify(verify(receipt)));
  const grid = receipt.nodes.find((n: any) => n.values.layoutMode === 'GRID');
  assert.deepEqual(grid.values.gridRowSizes, [{ type: 'HUG', value: 1 }, { type: hug ? 'HUG' : 'FLEX', value: 1 }]);
  if (hug) {
    const altered = structuredClone(receipt);
    altered.nodes.find((n: any) => n.id === grid.id).values.layoutSizingVertical = 'FIXED';
    assert.ok(verify(altered).problems.some(p => p.includes('grid-hug')));
  }
  const live = await f.figma.getNodeByIdAsync(grid.id);
  // Change the actual native API model, then execute a fresh independent read.
  live.gridRowGap = 9;
  assert.ok(verify(await read()).problems.some(p => p.includes('grid-gaps')));
  live.gridRowGap = 8;
  live.gridColumnSizes = [{ type: 'FIXED', value: 81 }, { type: 'FLEX', value: 1 }];
  assert.ok(verify(await read()).problems.some(p => p.includes('grid-columns')));
  live.gridColumnSizes = [{ type: 'FIXED', value: 80 }, { type: 'FLEX', value: 1 }];
  assert.equal(verify(await read()).status, 'supported-structure-observed');
  for (const change of [
    (v: any) => { v.gridRowCount++; },
    (v: any) => { v.gridRowSizes[0] = { type: 'FIXED', value: 1 }; },
    (v: any) => { v.gridColumnCount++; },
    (v: any) => { v.gridColumnSizes[1].value = 2; },
    (v: any) => { v.gridColumnGap++; },
    (v: any) => { v.gridItemsPositioning = flow ? 'MANUAL' : 'ROW_AUTO_FLOW'; },
    (v: any) => { delete v.gridRowSizes; },
  ]) {
    const altered = structuredClone(receipt); change(altered.nodes.find((n: any) => n.id === grid.id).values);
    assert.equal(verify(altered).status, 'refused');
  }
  for (const field of ['gridRowAnchorIndex', 'gridColumnAnchorIndex', 'gridRowSpan', 'gridColumnSpan',
    'gridChildHorizontalAlign', 'gridChildVerticalAlign']) {
    const altered = structuredClone(receipt), child = altered.nodes.find((n: any) => n.id === grid.childIds[0]);
    child.values[field] = field.includes('Align') ? 'MAX' : 99;
    assert.ok(verify(altered).problems.some(p => p.includes('grid-child-0')), field);
  }
  for (const row of f.comparison.receipt.nodes!) {
    assert.equal(Object.keys(row.values).some(key => key.startsWith('grid')), false, 'non-grid receipts retain their field vocabulary');
  }
});

test('native root grid content keeps a verified empty carrier inside its editable slot', async () => {
  const f=await nativeComparisonFixture();
  const contract=f.contract('fixture.grid-slot',{root:{slot:{name:'children'},
    layout:{display:'grid',columns:[{fr:1},{fr:1}],rows:[{fit:true},{fit:true}],flow:'row',gap:{row:8,column:12}},
    literals:{width:'300px',height:'fit-content'}}});
  const byId=new Map([[contract.id,contract]]),context=await f.context('10000000-0000-4000-8000-000000000008');
  const compiled=f.engine.compileNativeContractDraft(contract,byId,f.source);
  const creation=await f.run(f.engine.buildNativeContractDraftScript(contract,byId,f.source,context));
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const input:NativeContractObservationInput={operation:context.operation,planRevision:revisionOf('grid slot plan'),
    projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
  const receipt=await f.run(emitNativeContractReadbackScript(input));
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
  const slot=receipt.nodes.find((n:any)=>n.type==='SLOT'),grid=receipt.nodes.find((n:any)=>n.parentId===slot.id);
  assert.equal(grid.type,'FRAME');assert.equal(grid.values.layoutMode,'GRID');assert.deepEqual(grid.childIds,[]);
  const altered=structuredClone(receipt);altered.nodes.find((n:any)=>n.id===grid.id).values.gridRowGap++;
  assert.ok(verifyNativeContractReadback(input,altered).problems.some(p=>p.includes('grid-gaps')));
});
