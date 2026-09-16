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

// Native API mock evidence only. No raster or vector fidelity claims.
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
  const tokens = { ink: { $type: 'color', $value: '#fafafa' }, size: { $type: 'dimension', $value: '16px' } };
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map([['glyph', '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12L10 18L20 4" stroke="currentColor"/></svg>']]) });
  const contract = ContractSchema.parse({ id: 'fixture.initial', name: 'Initial', version: '0.1.0', status: 'draft',
    description: 'Synthetic finite initial-state draft', states: [], semantics: { element: 'button' }, props: [{ name: 'value', type: { enum: ['off','on'] },
      bindings: { code: { prop: 'value' }, figma: { kind: 'VARIANT', property: 'Value', unsetValue: '(unset)' } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row', align: 'center', justify: 'center' }, tokens: { width: '{size}', height: '{size}' }, parts: {
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
  assert.equal(result.nativeQualification, 'unqualified');
  for (const mutate of [
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
