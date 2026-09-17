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
import { SOURCE_NATIVE_FILE_KEY } from './native-operation-jobs.js';
import { prepareReactNativePlan, prepareReactNativeCorrectionPlan, buildReactNativeComponentWrite } from './react-native-plan.js';
import type { ReactRootMatrix } from './react-root-matrix.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from '../core/native-source-observation.js';
import { collectNativeImages } from './native-operation-images.js';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationJobsOptions } from './native-operation-jobs.js';
import { createNativeOperationTransport } from './native-operation-transport.js';
import { reactNativeReservation, type ReactNativeRequest } from './react-native-request.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { selectReactNativeRequest, readReactNativeEvidence } from './react-native-evidence.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';

// Synthetic input and native API mock: guard/structure evidence, not visual fidelity.
function inputFixture(shadow?: string) {
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

for (const kind of ['root', 'initial', 'nested'] as const) test(`React ${kind} journal and real companion client run all phases, reopen, and retain one reservation`, async t => {
  const repo = mkdtempSync(path.join(tmpdir(), 'react-native-journal-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const { input } = inputFixture();
  const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64),
    ownership: { id: input.operation.id, sha256: 'b'.repeat(64) }, inventorySha256: 'c'.repeat(64),
    caseId: 'button-default', matrixRevision: revisionOf(input.matrix) };
  if (kind === 'nested') { request.version = 2; request.selection = { instanceId: 'instance-4' }; }
  const initialRequest: ReactInitialNativeRequest = { version: 1, kind: 'react-initial-draft', anchor: request, caseId: 'button-default',
    observation: { id: '20000000-0000-4000-8000-000000000099', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  const draft: ReturnType<typeof compileReactInitialContract> = { version: 1, qualification: 'observed-initial-state-contract',
    acceptedContract: null, nativeQualification: 'unqualified', status: 'compiled-draft', problems: [], limitations: [], sourceBindings: [], nativeVariants: [],
    compiled: { contract: input.matrix.draft!.contract!, tokens: input.matrix.draft!.tokens!, component: input.matrix.draft!.native!, assets: [], problems: [], receipts: [], residuals: [] } };
  const operationRequest = kind === 'initial' ? initialRequest : request;
  assert.equal(isReactInitialNativeRequest(initialRequest), kind !== 'nested');
  assert.equal(isReactInitialNativeRequest({ ...initialRequest, executable: 'untrusted' }), false);
  assert.equal(isReactInitialNativeRequest({ ...initialRequest, observation: { ...initialRequest.observation, id: '../outside' } }), false);
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
          plan: prepareReactNativePlan({ ...input, operation }) };
      },
      buildComponent: (_, context) => buildReactNativeComponentWrite({ ...input, operation: context.operation,
        expectedPlanRevision: context.planRevision, tokens: context.tokens }),
    },
  };
  let jobs = createNativeOperationJobs(repo, options), transport = createNativeOperationTransport(repo, jobs);
  const first = jobs.prepare(operationRequest), pair = transport.pair(first.id), secret = pair.split('.')[1];
  const host = nativeFixtureHost(); host.figma.fileKey = REACT_NATIVE_FILE_KEY;
  Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection = function(c: any, m: string) { this.explicitVariableModes = { [c.id]: m }; };
  const storage = new Map<string, any>(), messages: any[] = [];
  host.figma.showUI = () => {};
  host.figma.clientStorage = { getAsync: async (k: string) => structuredClone(storage.get(k)),
    setAsync: async (k: string, v: any) => { storage.set(k, JSON.parse(JSON.stringify(v))); },
    deleteAsync: async (k: string) => { storage.delete(k); } };
  const plugin = readFileSync(new URL('../figma-sync/plugin/code.js', import.meta.url), 'utf8');
  const fetch = async (url: string, init: any) => {
    assert(url.startsWith(`http://localhost:5181/api/source-reference/native/${first.id}/`));
    const payload = JSON.parse(init.body), supplied = init.headers.Authorization.slice(7);
    const response = url.endsWith('/claim') ? transport.claim(first.id, supplied, payload.fileKey, payload.replaceReadbackAttemptId)
      : transport.accept(first.id, supplied, payload);
    return { ok: true, json: async () => JSON.parse(JSON.stringify(response)) };
  };
  const boot = () => {
    host.figma.ui = { postMessage: (m: any) => messages.push(JSON.parse(JSON.stringify(m))) };
    vm.runInNewContext(plugin, { figma: host.figma, fetch, __html__: '', console }, { timeout: 5000 });
    return (m: any) => host.figma.ui.onmessage(m);
  };
  let send = boot();
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
  assert.equal(jobs.listReact(request.referenceId)[0].kind, kind);
  if (kind === 'initial') {
    assert.deepEqual(jobs.reactInitialRequest(first.id), initialRequest);
    assert.deepEqual(jobs.verifiedReactInitialObservation(first.id).request, initialRequest);
    assert.throws(() => jobs.reactRequest(first.id), /react-operation-required/);
  }
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
  const reference = { id: 'a'.repeat(64), files: { [file]: evidenceSha('unchanged source') }, javascript: '', css: '' };
  const report: ReactOwnershipReport = { id: input.operation.id, referenceId: reference.id, state: 'complete', acceptedContract: null,
    denominator: 1, matched: 1, sourceUnchanged: true, rows: [{ id: 'button-default', matched: true, problems: [], rootMatrix: input.matrix }] };
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, report.id); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  writeFileSync(path.join(dir, 'program.json'), JSON.stringify({ files: reference.files }));
  const sealPath = path.join(dir, 'integrity.json');
  writeFileSync(sealPath, JSON.stringify({ version: 1, files: inventoryEvidence(dir) }));
  const request = selectReactNativeRequest(repo, report, 'button-default');
  assert.equal(readReactNativeEvidence(repo, reference, request).source.revision, 'sha256:'+reference.id);
  const restored = restoreReactOwnership(repo, reference, request);
  assert.deepEqual(restored.report(), JSON.parse(JSON.stringify(report)));
  assert.equal(restored.dir, dir);
  const view = restored.report(); view.rows[0].matched = false;
  assert.equal(restored.report().rows[0].matched, true, 'views cannot mutate the restored archive');
  writeFileSync(file, 'changed source');
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
