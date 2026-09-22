import {nativeAppUpdateDesired,prepareNativeAppUpdate} from './native-app-update.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import { restoreReactOwnership } from './react-ownership-restore.js';
import { prepareReactInitialNativePlan, buildReactInitialNativeWrite } from './react-initial-native-plan.js';
import { reactInitialNativeReservation, isReactInitialNativeRequest, type ReactInitialNativeRequest } from './react-initial-native-request.js';
import type { compileReactInitialContract } from './react-initial-contract.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { revisionOf } from '../core/contract-provenance.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from '../core/token-set.js';
import { nativeFixtureHost } from './native-operation-test-fixture.js';
import { nativeTextBindings } from '../core/native-text-template-test-fixture.js';
import {emitNativeTemplateGraphScript,emitNativeTemplateGraphReadbackScript} from '../core/native-root-text-template-graph-native.js';
import {acceptTemplateGraphAllocation,observeTemplateGraph} from './native-template-operation.js';
import { SOURCE_NATIVE_FILE_KEY } from './native-operation-jobs.js';
import { prepareReactNativePlan, prepareReactNativeFreshPlan, prepareReactNativeCorrectionPlan, buildReactNativeComponentWrite, buildReactNativeFreshComponentWrite } from './react-native-plan.js';
import type { ReactRootMatrix } from './react-root-matrix.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from '../core/native-source-observation.js';
import { collectNativeImages } from './native-operation-images.js';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationJobsOptions } from './native-operation-jobs.js';
import { createNativeOperationTransport } from './native-operation-transport.js';
import { isReactNativeRequest, reactNativeReservation, type ReactNativeRequest } from './react-native-request.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { selectReactNativeRequest, readReactNativeEvidence } from './react-native-evidence.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { builtinReactCohort } from './react-cohort.js';

// Synthetic input and native API mock: guard/structure evidence, not visual fidelity.
function inputFixture(shadow?: string, template = false) {
  const contract = ContractSchema.parse({ id: 'check.react-native', name: 'ReactNativeDraft',
    status: 'draft', version: '0.1.0', description: 'Synthetic root draft', states: [],
    semantics: { element: 'button' }, props: [{ name: 'tone', type: { enum: ['quiet', 'null'] },
      default: 'quiet', bindings: { code: { prop: 'tone', values: { quiet: 'quiet', null: null } },
        figma: { kind: 'VARIANT', property: 'Tone', values: { quiet: 'Quiet', null: 'None' } } } }],
    anatomy: { root: { slot: { name: 'children' },
      layout: { display: 'inline-flex', direction: 'row', align: 'center', justify: 'center' },
      tokens: { 'background-color': '{surface}', 'padding-left': '{space}', 'padding-right': '{space}', height: '{height}',
        ...(shadow ? { 'box-shadow': '{shadow}' } : {}) },
      tokensByProp: [{ prop: 'tone', map: { null: { width: '{width}' } } }],
    } }, bindings: { code: { anchors: { importPath: './source', export: 'Surface' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const tokens = { surface: { $type: 'color', $value: '#123456' }, space: { $type: 'dimension', $value: '8px' },
    height: { $type: 'dimension', $value: '36px' }, width: { $type: 'dimension', $value: '72px' },
    ...(shadow ? { shadow: { $type: 'shadow', $value: shadow } } : {}) };
  if (template) {
    Object.assign(tokens,{size:{$type:'dimension',$value:'12px'},line:{$type:'dimension',$value:'18px'},weight:{$type:'fontWeight',$value:400}});
    contract.anatomy.root.slot!.bindings={figma:{textTemplate:true}};
    contract.anatomy.root.declared={'font-family':'Inter'};
    Object.assign(contract.anatomy.root.tokens!,{'font-size':'{size}','font-weight':'{weight}','line-height':'{line}',color:'{surface}'});
  }
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const matrix: ReactRootMatrix = { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
    draft: { properties: ['tone'], status: 'native-compiled', contract, tokens,
      native: engine.compileComponentData(contract, new Map([[contract.id, contract]])),
      problems: [], observations: ['0','1'], lowerings: [], limitations: ['native-fidelity-not-verified'] } };
  return { input: { operation: { id: '10000000-0000-4000-8000-000000000099', fileKey: SOURCE_NATIVE_FILE_KEY },
    source: { revision: revisionOf('synthetic source'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf(matrix) }, matrix }, engine };
}
async function hostFixture(shadow?: string) {
  const { input, engine } = inputFixture(shadow), host = nativeFixtureHost();
  const prototype = Object.getPrototypeOf(host.figma.currentPage);
  prototype.setExplicitVariableModeForCollection = function(collection: any, modeId: string) {
    this.explicitVariableModes = { [collection.id]: modeId };
  };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(
    `(async()=>{${script}\n})()`, { figma: host.figma, console }, { timeout: 5000 },
  )));
  const prepared = prepareReactNativePlan(input);
  const allocation = await run(emitNativeTokenContextScript(prepared.plan.tokenInput).script);
  assert.equal(allocation.status, 'created-candidate', JSON.stringify(allocation));
  const observed = await run(emitNativeTokenContextReadbackScript(prepared.plan.tokenInput, allocation.creationIdentity));
  assert.equal(observed.status, 'readback-collected');
  const tokens = { input: prepared.plan.tokenInput, identity: allocation.creationIdentity, receipt: observed.receipt };
  const emit = () => buildReactNativeComponentWrite({ ...input, expectedPlanRevision: prepared.revision, tokens }).script;
  return { ...host, input, engine, prepared, tokens, emit, run };
}

test('current correction compilation preserves archived output and cannot replace creation authority', async () => {
  const f = await hostFixture('oklab(0.145 0 0 / 0.1) 0px 0px 0px 1px');
  const saved = structuredClone(f.input);
  for(const variant of saved.matrix.draft!.native!.variants) delete variant.spec.effectStack;
  const frozen = structuredClone(saved);
  assert.throws(()=>prepareReactNativePlan(saved),/compiler-output-changed/);
  const correction = prepareReactNativeCorrectionPlan(saved);
  assert.ok(correction.plan.component.variants.every(v=>v.spec.effectStack?.length===1));
  assert.deepEqual(saved,frozen);
  assert.throws(()=>buildReactNativeComponentWrite({...saved,expectedPlanRevision:correction.revision,tokens:f.tokens}),/compiler-output-changed/);
  const fresh = prepareReactNativeFreshPlan(saved);
  assert.notEqual(fresh.revision, correction.revision, 'a new preparation has distinct authority from a correction');
  assert.deepEqual(prepareReactNativeFreshPlan(saved), fresh);
  assert.equal(fresh.plan.sourceCompilation.archivedDraftRevision, revisionOf(saved.matrix.draft!.native));
  assert.throws(()=>buildReactNativeFreshComponentWrite({...saved,expectedPlanRevision:correction.revision,tokens:f.tokens}),/write-stale/);
  const drifted=structuredClone(saved);drifted.matrix.draft!.contract!.name+='Changed';
  assert.throws(()=>buildReactNativeFreshComponentWrite({...drifted,expectedPlanRevision:fresh.revision,tokens:f.tokens}),/write-stale/);
  const write=buildReactNativeFreshComponentWrite({...saved,expectedPlanRevision:fresh.revision,tokens:f.tokens});
  const result=await f.run(write.script);assert.equal(result.status,'created-candidate',JSON.stringify(result.problems));
  assert.deepEqual(saved,frozen,'fresh preparation and creation cannot rewrite the original source draft');
});

test('React draft uses shared scoped writer without a retained runtime and preserves empty editable content', async () => {
  const f = await hostFixture(), script = f.emit();
  assert.deepEqual(prepareReactNativePlan(f.input), f.prepared);
  assert.equal(f.prepared.plan.projection.kind, 'contract-draft');
  assert.equal(f.prepared.plan.acceptedContract, null);
  assert(!('binding' in f.prepared.plan.projection));
  assert(!f.input.matrix.draft!.contract!.bindings.code.runtime);
  assert.equal(f.prepared.plan.component.variants.length, 2);
  assert.throws(() => f.engine.buildBatchScript([f.prepared.plan.component], f.input.operation.fileKey), /WRITE_CONTEXT_REQUIRED/);
  const result = await f.run(script);
  assert.equal(result.status, 'created-candidate', JSON.stringify(result.problems));
  assert.equal(result.nativeQualification, 'unqualified');
  const page = f.figma.root.children.find((p: any) => p.id === result.pageId);
  assert.equal(page.name, `DS contract draft / ${f.input.operation.id}`);
  assert.equal(page.children.length, 1);
  const set = page.children[0];
  assert.equal(set.type, 'COMPONENT_SET');
  assert.equal(set.children.length, 2);
  assert.deepEqual(JSON.parse(set.getSharedPluginData('ds_contracts', 'codeValueAxes')), f.prepared.plan.component.codeValueAxes);
  for (const [index, main] of set.children.entries()) {
    const expected = f.prepared.plan.component.variants[index];
    const nodes = [main, ...main.findAll(() => true)];
    assert.equal(main.name, expected.name);
    assert(nodes.some((n: any) => n.type === 'SLOT'));
    assert(nodes.filter((n: any) => n.type === 'SLOT').every((n: any) => n.children.length === 0));
    for (const node of nodes) {
      assert.equal(node.getSharedPluginData('ds_contracts', 'nativeSourcePart'), '');
      const identity = JSON.parse(node.getSharedPluginData('ds_contracts', 'nativeContractPart'));
      assert.equal(identity.contractRevision, f.prepared.plan.projection.contractRevision);
      assert.equal(identity.variant, expected.name);
      assert.equal(JSON.parse(node.getSharedPluginData('ds_contracts', 'nativeSourceOperation')).operationId, f.input.operation.id);
    }
    assert.equal(main.boundVariables.height.id, f.tokens.identity.variables.find((v: any) => v.tokenPath === 'height')!.id);
  }
  const count = f.figma.root.findAll(() => true).length;
  const observation: NativeContractObservationInput = { operation: f.input.operation,
    planRevision: f.prepared.revision, component: f.prepared.plan.component, projection: f.prepared.plan.projection,
    tokenInput: f.tokens.input, tokenIdentity: f.tokens.identity, creation: result };
  const receipt = await f.run(emitNativeContractReadbackScript(observation, true));
  const checked = verifyNativeContractReadback(observation, receipt);
  assert.equal(checked.status, 'supported-structure-observed', JSON.stringify(checked));
  assert.equal(checked.nativeQualification, 'unqualified');
  assert.equal(collectNativeImages(observation, receipt).observation.images.length, 2);
  for (const change of [
    (r: any) => { r.nodes.find((n: any) => n.type === 'SLOT').metadata.nativeContractPart = '{}'; },
    (r: any) => { delete r.nodes.find((n: any) => n.type === 'COMPONENT').values.boundVariables.height; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'COMPONENT_SET').metadata.codeValueAxes = '{}'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'COMPONENT_SET').metadata.rootSlot = '{}'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'COMPONENT_SET').definitions.Tone.defaultValue = 'None'; },
    (r: any) => { r.nodes.find((n: any) => n.type === 'COMPONENT').childIds = []; },
  ]) {
    const changed = structuredClone(receipt); change(changed);
    assert.equal(verifyNativeContractReadback(observation, changed).status, 'refused');
  }
  const repeat = await f.run(script);
  assert.equal(repeat.status, 'refused');
  assert.equal(repeat.allocationAttempted, false);
  assert.match(repeat.problems.join(','), /collision/);
  assert.equal(f.figma.root.findAll(() => true).length, count);
});

test('independent readback checks literal shadow fields, stack order, and float32 colours', async () => {
  for (const shadow of ['1px 2px 3px 4px #12345680', '0px 1px 2px rgba(0, 0, 0, 0.05), inset 2px 3px 4px 1px #abcdef']) {
    const f = await hostFixture(shadow), creation = await f.run(f.emit());
    assert.equal(creation.status, 'created-candidate');
    const input: NativeContractObservationInput = { operation: f.input.operation, planRevision: f.prepared.revision,
      component: f.prepared.plan.component, projection: f.prepared.plan.projection,
      tokenInput: f.tokens.input, tokenIdentity: f.tokens.identity, creation };
    const receipt = await f.run(emitNativeContractReadbackScript(input));
    const root = (r: any) => r.nodes.find((n: any) => n.type === 'COMPONENT').values;
    assert(root(receipt).effects.length > 0);
    assert.equal(verifyNativeContractReadback(input, receipt).status, 'supported-structure-observed');
    const rounded = structuredClone(receipt);
    for (const n of rounded.nodes) for (const e of n.values.effects ?? [])
      for (const channel of ['r', 'g', 'b', 'a']) e.color[channel] = Math.fround(e.color[channel]);
    assert.equal(verifyNativeContractReadback(input, rounded).status, 'supported-structure-observed');
    for (const mutate of [
      (v: any) => { v.effects = []; },
      (v: any) => { v.effects.push(structuredClone(v.effects[0])); },
      (v: any) => { v.effects[0].type = 'LAYER_BLUR'; },
      (v: any) => { v.effects[0].visible = false; },
      (v: any) => { v.effects[0].blendMode = 'MULTIPLY'; },
      (v: any) => { v.effects[0].color.a = 0.75; },
      (v: any) => { v.effects[0].offset.x += 1; },
      (v: any) => { v.effects[0].radius += 1; },
      (v: any) => { v.effects[0].spread += 1; },
      (v: any) => { v.effects[0].showShadowBehindNode = false; },
      (v: any) => { v.effects[0].boundVariables = { radius: { type: 'VARIABLE_ALIAS', id: 'foreign' } }; },
    ]) {
      const changed = structuredClone(receipt); mutate(root(changed));
      assert.match(verifyNativeContractReadback(input, changed).problems.join(','), /observation-effects/);
    }
    if (root(receipt).effects.length > 1) {
      const reversed = structuredClone(receipt); root(reversed).effects.reverse();
      assert.match(verifyNativeContractReadback(input, reversed).problems.join(','), /observation-effects/);
    }
  }
});

test('changed draft/evidence/compiler output and token receipts cannot reuse an earlier write plan', async () => {
  const f = await hostFixture();
  for (const change of [
    (x: typeof f.input) => { x.source.evidenceRevision = revisionOf('different evidence'); },
    (x: typeof f.input) => { x.matrix.draft!.limitations.push('changed scope'); },
    (x: typeof f.input) => { x.matrix.draft!.native!.variants[0].spec.name = 'substituted'; },
  ]) {
    const changed = structuredClone(f.input); change(changed);
    assert.throws(() => buildReactNativeComponentWrite({ ...changed, expectedPlanRevision: f.prepared.revision, tokens: f.tokens }), /write-stale|compiler-output-changed/);
  }
  const bad = structuredClone(f.tokens); bad.receipt.variables[0].key = 'replacement';
  assert.throws(() => buildReactNativeComponentWrite({ ...f.input, expectedPlanRevision: f.prepared.revision, tokens: bad }), /token-observation-refused/);
  const variable = f.variables[0], modeId = f.tokens.identity.modes[0].modeId;
  const script = f.emit(); variable.setValueForMode(modeId, 99);
  const before = f.figma.root.children.length, result = await f.run(script);
  assert.equal(result.status, 'refused');
  assert.equal(result.allocationAttempted, false);
  assert.match(result.problems.join(','), /tokens-changed/);
  assert.equal(f.figma.root.children.length, before);
});

test('wrong file and interrupted creation remain distinct from a safe repeat', async () => {
  const f = await hostFixture(), script = f.emit();
  f.figma.fileKey = 'ReadOnlyOtherFile';
  const wrong = await f.run(script);
  assert.equal(wrong.status, 'refused'); assert.equal(wrong.allocationAttempted, false);
  assert.match(wrong.problems.join(','), /file-mismatch/);
  f.figma.fileKey = f.input.operation.fileKey;
  f.figma.createComponent = () => { throw Error('lost during allocation'); };
  const interrupted = await f.run(script);
  assert.equal(interrupted.status, 'partial-or-unknown-allocation');
  assert.equal(interrupted.allocationAttempted, true);
  assert(interrupted.pageId); assert(interrupted.nodes.some((n: any) => n.id === interrupted.pageId));
  const repeat = await f.run(script);
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
});

test('graph allocation requires complete IDs and a separate read; malformed and partial results never authorize components', async () => {
  const {input}=inputFixture(undefined,true),plan=prepareReactNativePlan(input).plan,graph=plan.templateGraph!;
  const h=nativeFixtureHost({modeLimit:2,consumerVariableModes:true});nativeTextBindings(h.figma);
  const run=async(script:string,figma=h.figma)=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma,console},{timeout:5000})));
  const script=emitNativeTemplateGraphScript(graph.input).script,result=await run(script);
  const accepted=acceptTemplateGraphAllocation(graph.input,graph.graph.revision,result);
  assert.equal(accepted.phase,'tokens-created');assert.ok('templateGraphIdentity' in accepted);
  assert.equal(observeTemplateGraph(graph.input,result.identity,result).phase,'observation-refused','creation receipt is never independent readback');
  for(const mutate of [
    (r:any)=>{r.graphRevision=revisionOf('forged');},
    (r:any)=>{r.allocation.source.creationIdentity.collection.id='other';},
    (r:any)=>{r.allocation.selectors.pop();},
    (r:any)=>{r.identity.routes[0].id=r.identity.source.variables[0].id;},
    (r:any)=>{r.allocationAttempted=false;},
  ]){const changed=structuredClone(result);mutate(changed);assert.equal(acceptTemplateGraphAllocation(graph.input,graph.graph.revision,changed).phase,'creation-invalid');}
  const read=await run(emitNativeTemplateGraphReadbackScript(graph.input,result.identity));
  assert.equal(observeTemplateGraph(graph.input,result.identity,read).phase,'tokens-observed');
  for(const mutate of [
    (r:any)=>{r.receipt.routes[0].valuesByMode={};},
    (r:any)=>{r.receipt.source.variables[0].valuesByMode={};},
    (r:any)=>{r.receipt.selectors[0].variableIds=[];},
    (r:any)=>{r.graphRevision=revisionOf('forged');},
  ]){const changed=structuredClone(read);mutate(changed);assert.equal(observeTemplateGraph(graph.input,result.identity,changed).phase,'observation-refused');}
  assert.equal(observeTemplateGraph(graph.input,undefined,read).phase,'observation-refused');
  assert.throws(()=>buildReactNativeComponentWrite({...input,expectedPlanRevision:prepareReactNativePlan(input).revision,
    tokens:{input:plan.tokenInput,identity:result.identity.source,receipt:read.receipt.source}}),/CONTEXT_CHANGED|unqualified|graph/);
  const partialHost=nativeFixtureHost({modeLimit:1}),partial=await run(script,partialHost.figma),before=JSON.stringify(partial);
  assert.equal(acceptTemplateGraphAllocation(graph.input,graph.graph.revision,partial).phase,'partial-allocation');
  assert.equal(JSON.stringify(partial),before);assert.ok(partial.allocation.source.allocation.collection.id);assert.ok(partial.allocation.selectors[0].id);
  const refused=await run(script);
  assert.equal(acceptTemplateGraphAllocation(graph.input,graph.graph.revision,refused).phase,'creation-refused');
});

for (const kind of ['root', 'initial', 'nested', 'fresh', 'graph'] as const) test(`React ${kind} journal and real companion client run all phases, reopen, and retain one reservation`, async t => {
  const repo = mkdtempSync(path.join(tmpdir(), 'react-native-journal-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const { input } = inputFixture(undefined,kind==='graph');
  if (kind === 'fresh') input.matrix.draft!.native!.setName='Archived compiler output';
  const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64),
    ownership: { id: input.operation.id, sha256: 'b'.repeat(64) }, inventorySha256: 'c'.repeat(64),
    caseId: 'button-default', matrixRevision: revisionOf(input.matrix) };
  if (kind === 'nested') { request.version = 2; request.selection = { instanceId: 'instance-4' }; }
  if (kind === 'fresh') {
    request.compilation='current';
    const legacy={...request};delete legacy.compilation;
    assert.equal(reactNativeReservation(request),reactNativeReservation(legacy),'compiler refresh never obtains a replacement reservation');
    assert(isReactNativeRequest(request));assert(!isReactNativeRequest({...request,compilation:'unchecked'}));
    assert(!isReactNativeRequest({...request,script:'untrusted'}));
  }
  const initialRequest: ReactInitialNativeRequest = { version: 1, kind: 'react-initial-draft', anchor: request, caseId: 'button-default',
    observation: { id: '20000000-0000-4000-8000-000000000099', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  const draft: ReturnType<typeof compileReactInitialContract> = { version: 1, qualification: 'observed-initial-state-contract',
    acceptedContract: null, nativeQualification: 'unqualified', status: 'compiled-draft', problems: [], limitations: [], sourceBindings: [], nativeVariants: [],
    compiled: { contract: input.matrix.draft!.contract!, tokens: input.matrix.draft!.tokens!, component: input.matrix.draft!.native!, assets: [], problems: [], receipts: [], residuals: [] } };
  const operationRequest = kind === 'initial' ? initialRequest : request;
  assert.equal(isReactInitialNativeRequest(initialRequest), kind !== 'nested');
  assert.equal(isReactInitialNativeRequest({ ...initialRequest, executable: 'untrusted' }), false);
  assert.equal(isReactInitialNativeRequest({ ...initialRequest, observation: { ...initialRequest.observation, id: '../outside' } }), false);
  if(kind==='initial') {
    const nested: ReactInitialNativeRequest = { ...initialRequest, version: 2, instanceId: 'instance-4' };
    assert(isReactInitialNativeRequest(nested));
    assert(!isReactInitialNativeRequest({ ...nested, instanceId: '../outside' }));
    assert(!isReactInitialNativeRequest({ ...nested, version: 1 }));
    assert.notEqual(reactInitialNativeReservation(nested), reactInitialNativeReservation(initialRequest));
    assert.notEqual(reactInitialNativeReservation(nested), reactInitialNativeReservation({ ...nested, instanceId: 'instance-5' }));
    assert.equal(reactInitialNativeReservation(nested), reactInitialNativeReservation({ ...nested,
      observation: { ...nested.observation, reportSha256: 'f'.repeat(64) } }), 'a new observation does not allocate a duplicate of the same source instance');
  }
  let current = true;
  const options: NativeOperationJobsOptions = {
    prepare: () => { throw Error('legacy adapter must not run'); },
    reactInitial: {
      prepare: (selected, operation) => {
        assert.deepEqual(selected, initialRequest); if (!current) throw Error('source changed');
        return { visual: { id: request.ownership.id, reportSha256: request.ownership.sha256 },
          preparation: { id: initialRequest.observation.id, reportSha256: initialRequest.observation.reportSha256 },
          plan: prepareReactInitialNativePlan({ source: input.source, draft, operation }) };
      },
      buildComponent: (_, context) => buildReactInitialNativeWrite({ source: input.source, draft, operation: context.operation,
        expectedPlanRevision: context.planRevision, tokens: context.tokens }),
    },
    react: {
      prepare: (selected, operation) => {
        assert.deepEqual(selected, request); if (!current) throw Error('source changed');
        return { visual: { id: request.ownership.id, reportSha256: request.ownership.sha256 },
          preparation: { id: request.ownership.id, reportSha256: request.matrixRevision.slice(7) },
          plan: (request.compilation ? prepareReactNativeFreshPlan : prepareReactNativePlan)({ ...input, operation }) };
      },
      buildComponent: (_, context) => (request.compilation ? buildReactNativeFreshComponentWrite : buildReactNativeComponentWrite)({ ...input, operation: context.operation,
        expectedPlanRevision: context.planRevision, tokens: context.tokens, templateGraph: context.templateGraph }),
    },
  };
  let jobs = createNativeOperationJobs(repo, options), transport = createNativeOperationTransport(repo, jobs);
  const first = jobs.prepare(operationRequest), pair = transport.pair(first.id), secret = pair.split('.')[1];
  const host = nativeFixtureHost(kind==='graph'?{modeLimit:2,consumerVariableModes:true}:{}); host.figma.fileKey = REACT_NATIVE_FILE_KEY;
  if(kind==='graph')nativeTextBindings(host.figma);
  Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection = function(c: any, m: string) { this.explicitVariableModes = { ...this.explicitVariableModes, [c.id]: m }; };
  const storage = new Map<string, any>(), messages: any[] = [];
  host.figma.showUI = () => {};
  host.figma.clientStorage = { getAsync: async (k: string) => structuredClone(storage.get(k)),
    setAsync: async (k: string, v: any) => { storage.set(k, JSON.parse(JSON.stringify(v))); },
    deleteAsync: async (k: string) => { storage.delete(k); } };
  const plugin = readFileSync(new URL('../figma-sync/plugin/code.js', import.meta.url), 'utf8');
  const fetch = async (url: string, init: any) => {
    assert(url.startsWith(`http://localhost:5181/api/source-reference/native/${first.id}/`));
    const payload = JSON.parse(init.body), supplied = init.headers.Authorization.slice(7);
    const response = url.endsWith('/begin') ? transport.begin(first.id, supplied, payload.attemptId)
      : url.endsWith('/claim') ? transport.claim(first.id, supplied, payload.fileKey, payload.replaceReadbackAttemptId, payload.resolveWriteAttemptId, payload.protocol)
      : transport.accept(first.id, supplied, payload);
    return { ok: true, json: async () => JSON.parse(JSON.stringify(response)) };
  };
  const boot = () => {
    host.figma.ui = { postMessage: (m: any) => messages.push(JSON.parse(JSON.stringify(m))) };
    vm.runInNewContext(plugin, { figma: host.figma, fetch, __html__: '', console }, { timeout: 5000 });
    return (m: any) => host.figma.ui.onmessage(m);
  };
  let send = boot();
  assert.throws(() => transport.inspectSizing(first.id), /sizing-observation-refused/);
  await send({ type: 'native-connect', connection: pair }); assert.equal(messages.at(-1).status, 'ready');
  assert.throws(() => transport.claim(first.id, secret, SOURCE_NATIVE_FILE_KEY), /file-refused/);
  transport.start(first.id);
  for (const phase of ['tokens-created', 'tokens-observed', 'components-created', 'component-structure-observed']) {
    await send({ type: 'native-poll' });
    assert.equal(jobs.get(first.id).phase, phase, JSON.stringify(messages.slice(-3)));
    jobs = createNativeOperationJobs(repo, options); transport = createNativeOperationTransport(repo, jobs); send = boot();
  }
  assert.equal(jobs.get(first.id).nativeQualification, 'unqualified');
  assert.equal(jobs.get(first.id).imageObservation?.images.length, 2);
  assert.equal(jobs.listReact(request.referenceId)[0].fileKey, REACT_NATIVE_FILE_KEY);
  assert.equal(jobs.forBaseline(kind === 'initial' ? reactInitialNativeReservation(initialRequest) : reactNativeReservation(request))!.id, first.id);
  const before = host.figma.root.findAll(() => true).length;
  assert.equal(jobs.prepare(operationRequest).id, first.id);
  await send({ type: 'native-poll' }); assert.equal(messages.at(-1).status, 'finished');
  assert.equal(host.figma.root.findAll(() => true).length, before);
  assert.throws(() => jobs.prepare(kind === 'initial' ? { ...initialRequest, observation: { ...initialRequest.observation, reportSha256: 'f'.repeat(64) } } : { ...request, matrixRevision: revisionOf('changed') }), /baseline-already-reserved/);
  assert.equal(jobs.listReact(request.referenceId)[0].kind, kind === 'fresh'||kind==='graph' ? 'root' : kind);
  if(kind === 'fresh') {
    assert.equal(jobs.get(first.id).sourceCompilerRecompiled,true);
    const legacy={...request};delete legacy.compilation;
    assert.throws(()=>jobs.prepare(legacy),/baseline-already-reserved/);
  }
  if (kind === 'initial') {
    assert.deepEqual(jobs.reactInitialRequest(first.id), initialRequest);
    assert.deepEqual(jobs.verifiedReactInitialObservation(first.id).request, initialRequest);
    assert.throws(() => jobs.reactRequest(first.id), /react-operation-required/);
    const successor = structuredClone(initialRequest);
    successor.observation.id = '20000000-0000-4000-8000-000000000098';
    assert.equal(jobs.listReactMoved(request.referenceId, undefined, () => initialRequest).length, 0);
    assert.deepEqual(jobs.listReactMoved(request.referenceId, undefined, () => successor).map(row => ({
      id: row.operationId, kind: row.kind, missing: row.observationRequired,
    })), [{ id: first.id, kind: 'initial', missing: false }]);
    assert.equal(jobs.listReactMoved(request.referenceId, undefined, () => { throw Error('observation-incomplete'); })[0].observationRequired, true);
    assert.deepEqual(jobs.reactInitialRequest(first.id), initialRequest, 'listing a successor never adopts it or replaces creation evidence');
    assert.equal(host.figma.root.findAll(() => true).length, before, 'a newer observation cannot allocate native output');
  }
  const baseline = jobs.reactUpdateBaseline(first.id);
  const operationDir = path.join(repo,'private/source-native-app/operations',first.id);
  const headerFile = path.join(operationDir,'operation.json');
  const originalHeader = readFileSync(headerFile,'utf8');
  transport.retryObservation(first.id);
  assert.throws(() => jobs.reactUpdateBaseline(first.id,baseline.journalRevision), /baseline-observation-unsettled/);
  await send({type:'native-poll'});
  const latest = jobs.reactUpdateBaseline(first.id);
  assert.notEqual(latest.journalRevision,baseline.journalRevision);
  assert.deepEqual(jobs.reactUpdateBaseline(first.id,baseline.journalRevision),baseline,
    'later readback remains recorded but does not replace the correction baseline');
  assert.deepEqual(jobs.reactUpdateBaseline(first.id),latest,'historical access cannot change the current observation');
  const main = host.figma.root.findAll((node:any) => node.type==='COMPONENT')[0];
  const opacity = main.opacity;main.opacity=0.75;
  transport.retryObservation(first.id);await send({type:'native-poll'});
  assert.equal(jobs.get(first.id).phase,'component-observation-refused');
  assert.throws(() => jobs.reactUpdateBaseline(first.id),/react-update-verified-baseline-required/);
  assert.deepEqual(jobs.reactUpdateBaseline(first.id,baseline.journalRevision),baseline,
    'the immutable historical receipt stays historical when a later read reports changed canvas');
  main.opacity=opacity;
  transport.retryObservation(first.id);await send({type:'native-poll'});
  assert.equal(jobs.get(first.id).phase,'component-structure-observed');
  if(kind==='graph'){
    const graph=jobs.reactUpdateBaseline(first.id).input.templateGraph!;
    assert.ok(graph);
    assert.equal(jobs.get(first.id).counters.variables,graph.identity.source.variables.length+graph.identity.routes.length);
    const route=host.variables.find(v=>v.id===graph.identity.routes[0].id)!,saved=structuredClone(route.valuesByMode);
    const mode=Object.keys(route.valuesByMode)[1];route.setValueForMode(mode,{type:'VARIABLE_ALIAS',id:route.id});
    transport.retryObservation(first.id);await send({type:'native-poll'});
    assert.equal(jobs.get(first.id).phase,'component-observation-refused');
    assert.throws(()=>jobs.reactUpdateBaseline(first.id),/verified-baseline-required/);
    route.setValueForMode(mode,saved[mode]);transport.retryObservation(first.id);await send({type:'native-poll'});
    assert.equal(jobs.get(first.id).phase,'component-structure-observed');
    assert.throws(()=>transport.inspectSizing(first.id),/template-graph-sizing-unqualified/);
    const savedBaseline=jobs.reactUpdateBaseline(first.id);
    const desired=prepareReactNativeCorrectionPlan({...input,operation:savedBaseline.input.operation});
    assert.notDeepEqual(desired.plan.component,desired.plan.templateGraph!.input.component,
      'the real compiler binds and stamps native output after retaining its source graph');
    const updateInput={before:savedBaseline.input,baseline:savedBaseline.receipt,templateConsumers:[]};
    const proposal=prepareNativeAppUpdate({...updateInput,...nativeAppUpdateDesired(desired)});
    assert.equal(proposal.plan.kind,'native-contract-template-value-update');
    if(proposal.plan.kind!=='native-contract-template-value-update')throw Error('template expected');
    assert.deepEqual(proposal.plan.templateValueChanges,[]);
    assert.throws(()=>prepareNativeAppUpdate({...updateInput,templateGraph:desired.plan.templateGraph!.input,
      desired:{component:desired.plan.component,tokenInput:desired.plan.tokenInput,revision:desired.revision}}),/template-source-invalid/);
    const changed=structuredClone(input);(changed.matrix.draft!.tokens!.surface as {$value:string}).$value='#234567';
    const next=prepareReactNativeCorrectionPlan({...changed,operation:savedBaseline.input.operation});
    const color=prepareNativeAppUpdate({...updateInput,...nativeAppUpdateDesired(next)});
    assert.equal(color.plan.kind,'native-contract-template-value-update');
    if(color.plan.kind!=='native-contract-template-value-update')throw Error('template expected');
    assert.equal(color.plan.templateValueChanges.length,1);
    const forged=structuredClone(next);forged.plan.component.setName+='changed';
    assert.throws(()=>nativeAppUpdateDesired(forged),/compiled-source-changed/);
    return;
  }
  // The optional sizing reader is delivered by the real companion, and its
  // required facts survive restart, interruption and a failed read. Old journal
  // prefixes retain the old input and receipts exactly.
  const sizingNodes = host.figma.root.findAll((node: any) =>
    ['COMPONENT', 'FRAME', 'RECTANGLE', 'ELLIPSE'].includes(node.type));
  for (const node of sizingNodes) Object.assign(node, {
    constraints: {horizontal:'MIN',vertical:'MIN'}, targetAspectRatio:null,
    layoutAlign:'INHERIT', layoutGrow:0, strokesIncludedInLayout:false,
  });
  assert.equal(jobs.get(first.id).sizingObservation, undefined);
  transport.inspectSizing(first.id);
  const strictCommand = jobs.pendingCommand(first.id)!;
  assert.equal(strictCommand.phase, 'component-readback'); assert.equal(strictCommand.readOnly, true);
  assert.ok(strictCommand.fixedCrossSizeReadback!.nodeIds.length);
  assert.throws(() => jobs.reactUpdateBaseline(first.id), /react-update-verified-baseline-required/);
  assert.equal(jobs.get(first.id).sizingObservation?.status, 'pending');
  jobs = createNativeOperationJobs(repo, options); transport = createNativeOperationTransport(repo, jobs);
  assert.deepEqual(jobs.pendingCommand(first.id), strictCommand);
  transport.retryObservation(first.id);
  assert.deepEqual(jobs.pendingCommand(first.id)!.fixedCrossSizeReadback, strictCommand.fixedCrossSizeReadback);
  assert.notEqual(jobs.pendingCommand(first.id)!.attemptId, strictCommand.attemptId);
  const abandonedResult = await host.run(strictCommand);
  assert.throws(() => jobs.accept(first.id, abandonedResult), /result-correlation/);
  await send({type:'native-poll'});
  assert.equal(jobs.get(first.id).sizingObservation?.status, 'observed');
  const strictBaseline = jobs.reactUpdateBaseline(first.id);
  assert.deepEqual(strictBaseline.input.fixedCrossSizeReadback, strictCommand.fixedCrossSizeReadback);
  assert.deepEqual(jobs.reactUpdateBaseline(first.id,baseline.journalRevision), baseline);
  delete main.targetAspectRatio;
  transport.retryObservation(first.id); await send({type:'native-poll'});
  assert.equal(jobs.get(first.id).sizingObservation?.status, 'refused');
  assert.throws(() => jobs.reactUpdateBaseline(first.id), /react-update-verified-baseline-required/);
  main.targetAspectRatio = null;
  transport.retryObservation(first.id); await send({type:'native-poll'});
  assert.equal(jobs.get(first.id).sizingObservation?.status, 'observed');
  assert.equal(host.figma.root.findAll(() => true).length, before);
  assert.throws(() => jobs.reactUpdateBaseline(first.id,'f'.repeat(64)),/baseline-revision-unavailable/);
  assert.throws(() => jobs.reactUpdateBaseline(first.id,'not-a-hash'),/baseline-revision-invalid/);
  writeFileSync(headerFile,originalHeader.replace('"startedAt":','"unexpected":true,"startedAt":'));
  assert.throws(() => jobs.reactUpdateBaseline(first.id,baseline.journalRevision),/journal-chain-invalid/,
    'a saved prefix never bypasses complete current journal validation');
  writeFileSync(headerFile,originalHeader);
  const eventFile = path.join(operationDir,'events','00000009.json');
  const originalEvent = readFileSync(eventFile,'utf8');
  writeFileSync(eventFile,originalEvent.replace('"previousSha256": "','"previousSha256": "0'));
  assert.throws(() => jobs.reactUpdateBaseline(first.id,baseline.journalRevision),/journal-chain-invalid/,
    'corrupt later readback cannot be hidden behind an intact saved prefix');
  writeFileSync(eventFile,originalEvent);
  current = false;
  if (kind === 'initial') assert.throws(() => jobs.verifiedReactInitialObservation(first.id));
  assert.equal(jobs.get(first.id).sourceCurrent, false);
  assert.equal(jobs.get(first.id).phase, 'component-structure-observed');
});

test('host-selected React evidence reopens after restart and refuses changed source, archive or seal', t => {
  const repo = mkdtempSync(path.join(tmpdir(), 'react-native-evidence-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const { input } = inputFixture(), file = path.join(repo, 'source.tsx');
  writeFileSync(file, 'unchanged source');
  const reference = { id: 'a'.repeat(64), files: { [file]: evidenceSha('unchanged source') }, javascript: '', css: '', cohort: builtinReactCohort, sourceRoot: repo };
  const report: ReactOwnershipReport = { id: input.operation.id, referenceId: reference.id, state: 'complete', acceptedContract: null,
    denominator: 1, matched: 1, sourceUnchanged: true, rows: [{ id: 'button-default', matched: true, problems: [], rootMatrix: input.matrix }] };
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, report.id); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  writeFileSync(path.join(dir, 'program.json'), JSON.stringify({ files: reference.files }));
  const sealPath = path.join(dir, 'integrity.json');
  writeFileSync(sealPath, JSON.stringify({ version: 1, files: inventoryEvidence(dir) }));
  const request = selectReactNativeRequest(repo, report, 'button-default');
  assert.equal(readReactNativeEvidence(repo, reference, request).source.revision, 'sha256:'+reference.id);
  const freshRequest: ReactNativeRequest={...request,compilation:'current'};
  assert.equal(readReactNativeEvidence(repo,reference,freshRequest).source.revision,'sha256:'+reference.id);
  withEvidenceReadSnapshot(()=>{
    const checked=readReactNativeEvidence(repo,reference,request);checked.source.revision='mutated caller copy';
    writeFileSync(file,'changed during display');
    assert.equal(readReactNativeEvidence(repo,reference,structuredClone(request)).source.revision,'sha256:'+reference.id);
    assert.throws(()=>readReactNativeEvidence(repo,reference,{...request,inventorySha256:'f'.repeat(64)}),/unavailable/);
  });
  assert.throws(()=>readReactNativeEvidence(repo,reference,request),/unavailable/,'the next read must observe the changed source');
  writeFileSync(file,'unchanged source');
  const restored = restoreReactOwnership(repo, reference, request);
  assert.deepEqual(restored.report(), JSON.parse(JSON.stringify(report)));
  assert.equal(restored.dir, dir);
  const view = restored.report(); view.rows[0].matched = false;
  assert.equal(restored.report().rows[0].matched, true, 'views cannot mutate the restored archive');
  writeFileSync(file, 'changed source');
  assert.throws(()=>readReactNativeEvidence(repo,reference,freshRequest),/unavailable/);
  assert.equal(restored.report().sourceUnchanged, false);
  assert.equal(restored.report().matched, 0);
  assert.equal(restored.report().rows[0].rootMatrix, undefined);
  assert.throws(() => readReactNativeEvidence(repo, reference, request), /unavailable/);
  writeFileSync(file, 'unchanged source');
  const reportPath = path.join(dir, 'report.json'), original = readFileSync(reportPath);
  writeFileSync(reportPath, Buffer.concat([original, Buffer.from(' ')]));
  assert.throws(() => readReactNativeEvidence(repo, reference, request), /unavailable/);
  writeFileSync(reportPath, original);
  writeFileSync(path.join(dir, 'unexpected.txt'), 'new capture');
  assert.throws(() => readReactNativeEvidence(repo, reference, request), /unavailable/);
  rmSync(path.join(dir, 'unexpected.txt'));
  writeFileSync(sealPath, '{}');
  assert.equal(restored.report().matched, 0);
  assert.equal(restored.report().problem, 'react-ownership-evidence-changed');
  assert.throws(() => readReactNativeEvidence(repo, reference, request), /unavailable/);
});
