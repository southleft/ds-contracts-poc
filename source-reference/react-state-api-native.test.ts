import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  stateApiEvidence,
  stateApiObservation,
  mixedStateApiEvidence,
} from './react-state-api-fixture.js';
import { planReactStateApi } from './react-state-api.js';
import { projectReactStateApiContract } from './react-state-api-contract.js';
import { revisionOf } from '../core/contract-provenance.js';
import {
  prepareReactStateApiNativePlan,
  buildReactStateApiNativeWrite,
} from './react-state-api-native-plan.js';
import {
  isReactStateApiNativeRequest,
  reactStateApiNativeReservation,
  type ReactStateApiNativeRequest,
} from './react-state-api-native-request.js';
import { reactInitialNativeReservation } from './react-initial-native-request.js';
import {
  createNativeOperationJobs,
  REACT_NATIVE_FILE_KEY,
  SOURCE_NATIVE_FILE_KEY,
  type NativeOperationJobsOptions,
} from './native-operation-jobs.js';
import { createNativeOperationTransport } from './native-operation-transport.js';
import { nativeFixtureHost } from './native-operation-test-fixture.js';
import { createNativeSourceSuccessions } from './native-source-succession.js';
import { createNativeUpdatePlans } from './native-update-plans.js';
import { createNativeUpdateJobs } from './native-update-jobs.js';

function fixture(mixed = false) {
  const { initial, behavior } = mixed ? mixedStateApiEvidence() : stateApiEvidence();
  for (const row of behavior.observation!.rows) row.callback = 'onNotify';
  for (const row of behavior.observation!.relationships)
    row.callback = 'onNotify';
  for (const row of behavior.observation!.candidates) row.callback = 'onNotify';
  for (const row of behavior.observation!.refusals!) row.callback = 'onNotify';
  const plan = planReactStateApi(initial, behavior);
  delete initial.draft!.compiled!.contract!.anatomy.root.text;
  initial.draft!.compiled!.contract!.anatomy.root.tokens = {
    'background-color': '{surface}',
    height: '{height}',
    width: '{width}',
  };
  const tokens = {
    surface: { $type: 'color', $value: '#123456' },
    height: { $type: 'dimension', $value: '24px' },
    width: { $type: 'dimension', $value: '40px' },
  };
  initial.draft!.compiled!.tokens = tokens;
  const draft = projectReactStateApiContract(initial, {
    id: 'bounded',
    caseId: plan.caseId,
    phase: 'complete',
    qualification: plan.qualification,
    plan,
    sourceUnchanged: true,
    restorationChecks: plan.cases.length * 3,
    problems: [],
    observation: stateApiObservation(plan),
  });
  assert.equal(draft.status, 'generated-draft', JSON.stringify(draft.problems));
  const id = '10000000-0000-4000-8000-000000000001',
    hash = 'a'.repeat(64);
  const request: ReactStateApiNativeRequest = {
    version: 1,
    kind: 'react-state-api-draft',
    initial: {
      version: 1,
      kind: 'react-initial-draft',
      caseId: 'source',
      anchor: {
        version: 1,
        kind: 'react-root-draft',
        caseId: 'source',
        referenceId: hash,
        inventorySha256: hash,
        ownership: { id, sha256: hash },
        matrixRevision: 'sha256:' + hash,
      },
      observation: {
        id: '20000000-0000-4000-8000-000000000002',
        inventorySha256: hash,
        reportSha256: hash,
      },
    },
    observation: {
      id: '30000000-0000-4000-8000-000000000003',
      key: hash,
      inventorySha256: hash,
      reportSha256: hash,
    },
  };
  return {
    request,
    draft,
    tokens,
    assets: [] as Array<[string, string]>,
    source: {
      revision: revisionOf('source'),
      programSha256: hash,
      evidenceRevision: revisionOf('evidence'),
    },
  };
}

test('state API requests have a distinct, stable reservation and reject untrusted selectors', () => {
  const f = fixture(),
    r = f.request;
  assert(isReactStateApiNativeRequest(r));
  assert.notEqual(
    reactStateApiNativeReservation(r),
    reactInitialNativeReservation(r.initial),
  );
  assert.equal(
    reactStateApiNativeReservation(r),
    reactStateApiNativeReservation({
      ...r,
      observation: {
        ...r.observation,
        id: '40000000-0000-4000-8000-000000000004',
        key: 'f'.repeat(64),
      },
    }),
  );
  for (const bad of [
    { ...r, fileKey: 'other' },
    { ...r, script: 'arbitrary()' },
    { ...r, observation: { ...r.observation, key: '../escape' } },
    { ...r, initial: { ...r.initial, version: 2, instanceId: 'instance-0' } },
  ])
    assert(!isReactStateApiNativeRequest(bad));
  const operation = {
    id: '50000000-0000-4000-8000-000000000005',
    fileKey: REACT_NATIVE_FILE_KEY,
  };
  const p = prepareReactStateApiNativePlan({ ...f, operation });
  assert.equal(p.plan.component.codeValueAxes?.version, 2);
  assert.equal(p.plan.component.variants.length, 9);
  const changed = structuredClone(f);
  changed.request.observation.reportSha256 = 'f'.repeat(64);
  assert.notEqual(
    prepareReactStateApiNativePlan({ ...changed, operation }).revision,
    p.revision,
  );
  delete changed.draft.contract!.props[0].bindings.code.initial;
  assert.throws(
    () => prepareReactStateApiNativePlan({ ...changed, operation }),
    /metadata-unavailable/,
  );
});

test('a three-state API retains its typed domain and twelve native variants without changing the write protocol', () => {
  const f = fixture(true), operation = { id: '50000000-0000-4000-8000-000000000005', fileKey: REACT_NATIVE_FILE_KEY };
  const prepared = prepareReactStateApiNativePlan({ ...f, operation });
  assert.equal(prepared.plan.component.codeValueAxes?.version, 2);
  assert.equal(prepared.plan.component.variants.length, 12);
  assert.deepEqual(f.draft.contract!.props[0].bindings.code.values, { off: false, on: true, mixed: 'indeterminate' });
  assert.deepEqual(f.draft.contract!.props[0].bindings.code.initial, { prop: 'seed', default: 'off' });
  assert.equal(f.draft.contract!.semantics.role, 'checkbox');
});

test('state API journal and actual companion complete all phases, reopen, reject changed evidence and retain one output', async (t) => {
  const repo = mkdtempSync(path.join(tmpdir(), 'state-api-native-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const f = fixture(), successions = createNativeSourceSuccessions(repo);
  let current = true;
  const options: NativeOperationJobsOptions = {
    prepare: () => {
      throw Error('legacy adapter must not run');
    },
    react: { effectiveSource: (id, original) => successions.effective(id, original),
      prepare: () => { throw Error('root adapter must not run'); },
      buildComponent: () => { throw Error('root adapter must not run'); } },
    reactStateApi: {
      prepare: (request, operation) => {
        assert.deepEqual(request, f.request);
        if (!current) throw Error('source changed');
        return {
          visual: {
            id: request.initial.anchor.ownership.id,
            reportSha256: request.initial.anchor.ownership.sha256,
          },
          preparation: {
            id: request.observation.id,
            reportSha256: request.observation.reportSha256,
          },
          plan: prepareReactStateApiNativePlan({ ...f, operation }),
        };
      },
      buildComponent: (_request, context) =>
        buildReactStateApiNativeWrite({
          ...f,
          operation: context.operation,
          tokensContext: context.tokens,
          expectedPlanRevision: context.planRevision,
        }),
    },
  };
  let jobs = createNativeOperationJobs(repo, options),
    transport = createNativeOperationTransport(repo, jobs);
  const first = jobs.prepare(f.request),
    pair = transport.pair(first.id),
    secret = pair.split('.')[1],
    host = nativeFixtureHost();
  host.figma.fileKey = REACT_NATIVE_FILE_KEY;
  Object.getPrototypeOf(
    host.figma.currentPage,
  ).setExplicitVariableModeForCollection = function (c: any, m: string) {
    this.explicitVariableModes = { [c.id]: m };
  };
  const storage = new Map(),
    messages: any[] = [];
  host.figma.showUI = () => {};
  host.figma.clientStorage = {
    getAsync: async (k: string) => structuredClone(storage.get(k)),
    setAsync: async (k: string, v: any) => {
      storage.set(k, JSON.parse(JSON.stringify(v)));
    },
    deleteAsync: async (k: string) => {
      storage.delete(k);
    },
  };
  const plugin = readFileSync(
    new URL('../figma-sync/plugin/code.js', import.meta.url),
    'utf8',
  );
  const fetch = async (url: string, init: any) => {
    assert(
      url.startsWith(
        `http://localhost:5181/api/source-reference/native/${first.id}/`,
      ),
    );
    const payload = JSON.parse(init.body),
      supplied = init.headers.Authorization.slice(7);
    const response = url.endsWith('/begin')
      ? transport.begin(first.id, supplied, payload.attemptId)
      : url.endsWith('/claim')
        ? transport.claim(
            first.id,
            supplied,
            payload.fileKey,
            payload.replaceReadbackAttemptId,
            payload.resolveWriteAttemptId,
            payload.protocol,
          )
        : transport.accept(first.id, supplied, payload);
    return { ok: true, json: async () => JSON.parse(JSON.stringify(response)) };
  };
  const boot = () => {
    host.figma.ui = {
      postMessage: (m: any) => messages.push(JSON.parse(JSON.stringify(m))),
    };
    vm.runInNewContext(
      plugin,
      { figma: host.figma, fetch, __html__: '', console },
      { timeout: 5000 },
    );
    return (m: any) => host.figma.ui.onmessage(m);
  };
  let send = boot();
  await send({ type: 'native-connect', connection: pair });
  assert.equal(messages.at(-1).status, 'ready');
  assert.throws(
    () => transport.claim(first.id, secret, SOURCE_NATIVE_FILE_KEY),
    /file-refused/,
  );
  current = false;
  assert.equal(jobs.get(first.id).sourceCurrent, false);
  assert.throws(
    () => transport.start(first.id),
    /native-transport-start-refused/,
  );
  current = true;
  transport.start(first.id);
  for (const phase of [
    'tokens-created',
    'tokens-observed',
    'components-created',
    'component-structure-observed',
  ]) {
    await send({ type: 'native-poll' });
    assert.equal(
      jobs.get(first.id).phase,
      phase,
      JSON.stringify(messages.slice(-3)),
    );
    jobs = createNativeOperationJobs(repo, options);
    transport = createNativeOperationTransport(repo, jobs);
    send = boot();
  }
  assert.equal(jobs.get(first.id).imageObservation?.images.length, 9);
  assert.equal(
    jobs.listReact(f.request.initial.anchor.referenceId)[0].kind,
    'state-api',
  );
  assert.deepEqual(jobs.reactStateApiRequest(first.id), f.request);
  assert.equal(
    jobs.reactIdentity(first.id).referenceId,
    f.request.initial.anchor.referenceId,
  );
  assert.throws(
    () => jobs.reactInitialRequest(first.id),
    /initial-operation-required/,
  );
  assert.deepEqual(jobs.reactUpdateBaseline(first.id).source, f.request);
  assert.deepEqual(jobs.reactSuccessionSubject(first.id), f.request);
  assert.equal(
    jobs.forBaseline(reactStateApiNativeReservation(f.request))!.id,
    first.id,
  );
  const count = host.figma.root.findAll(() => true).length;
  assert.equal(jobs.prepare(f.request).id, first.id);
  await send({ type: 'native-poll' });
  assert.equal(host.figma.root.findAll(() => true).length, count);
  assert.throws(
    () =>
      jobs.prepare({
        ...f.request,
        observation: { ...f.request.observation, reportSha256: 'f'.repeat(64) },
      }),
    /baseline-already-reserved/,
  );
  const originalPin = structuredClone(f.request), successor = structuredClone(f.request);
  successor.observation.key = 'b'.repeat(64);
  assert.equal(jobs.listReactMoved(f.request.initial.anchor.referenceId, () => originalPin).length, 0);
  assert.equal(jobs.listReactMoved(f.request.initial.anchor.referenceId, () => successor)[0].kind, 'state-api');
  assert.equal(jobs.listReactMoved(f.request.initial.anchor.referenceId, () => { throw Error('experiment-running'); })[0].observationRequired, true);
  successions.adopt(first.id, originalPin, successor);
  assert.equal(jobs.listReactMoved(f.request.initial.anchor.referenceId, () => successor).length, 0);
  assert.deepEqual(jobs.reactStateApiRequest(first.id), originalPin, 'recorded review keeps creation evidence');
  assert.deepEqual(jobs.reactEffectiveStateApiRequest(first.id), successor);
  assert.deepEqual(jobs.reactUpdateBaseline(first.id).source, successor);

  // The actual state-API baseline traverses the shared guarded correction
  // journal. No state metadata or allocation may be changed by this route.
  const baseline = jobs.reactUpdateBaseline(first.id), desired = structuredClone(baseline.input.component);
  for (const variant of desired.variants) variant.spec.opacity = 0.4;
  const plans = createNativeUpdatePlans(repo, (id, prefix) => {
    const before = jobs.reactUpdateBaseline(id, prefix);
    return { parentJournalRevision: before.journalRevision, input: { before: before.input, baseline: before.receipt,
      desired: { component: desired, revision: revisionOf(desired), tokenInput: before.input.tokenInput } } };
  }, id => updates.updateHistory(id), id => jobs.reactUpdateJournalRevision(id));
  const updates = createNativeUpdateJobs(repo, plans);
  const proposal = plans.prepare(first.id), update = updates.prepare(first.id, proposal.id);
  for (const phase of ['update-preflight-readback', 'update-apply', 'update-readback'] as const) {
    const command = updates.dispatch(update.id, phase);
    updates.accept(update.id, await host.run(command as any));
  }
  assert.equal(updates.get(update.id).phase, 'update-verified');
  assert.equal(host.figma.root.findAll(() => true).length, count, 'correction allocates nothing');
  assert.equal(plans.prepare(first.id).id, proposal.id, 'repeat reuses the verified correction');
  const retainedApi = structuredClone(desired.codeValueAxes!);
  for (const change of [
    (api: any) => { api.version = 1; },
    (api: any) => { api.stateApi.events[0].bindings.code.prop = 'differentCallback'; },
    (api: any) => { api.stateApi.props[0].bindings.code.initial.default = 'true'; },
    (api: any) => { api.axes[0].values[0].code = true; },
  ]) {
    desired.codeValueAxes = structuredClone(retainedApi); change(desired.codeValueAxes);
    assert.throws(() => plans.prepare(first.id), /component-change-unsupported/);
    assert.equal(host.figma.root.findAll(() => true).length, count);
  }
  desired.codeValueAxes = retainedApi;
  for (let i = 0; i < desired.variants.length; i++) desired.variants[i].spec.opacity = baseline.input.component.variants[i].spec.opacity;
  const restore = plans.prepare(first.id), restoreUpdate = updates.prepare(first.id, restore.id);
  for (const phase of ['update-preflight-readback', 'update-apply', 'update-readback'] as const) {
    const command = updates.dispatch(restoreUpdate.id, phase);
    updates.accept(restoreUpdate.id, await host.run(command as any));
  }
  assert.equal(updates.get(restoreUpdate.id).phase, 'update-verified');
  assert.equal(host.figma.root.findAll(() => true).length, count);

  const set = host.figma.root.findOne((n: any) => n.type === 'COMPONENT_SET'),
    stamp = set.getSharedPluginData('ds_contracts', 'codeValueAxes'),
    metadata = JSON.parse(stamp);
  assert.equal(metadata.version, 2);
  metadata.stateApi.events[0].bindings.code.prop = 'onOther';
  set.setSharedPluginData(
    'ds_contracts',
    'codeValueAxes',
    JSON.stringify(metadata),
  );
  transport.retryObservation(first.id);
  await send({ type: 'native-poll' });
  assert.equal(jobs.get(first.id).phase, 'component-observation-refused');
  set.setSharedPluginData('ds_contracts', 'codeValueAxes', stamp);
  transport.retryObservation(first.id);
  await send({ type: 'native-poll' });
  assert.equal(jobs.get(first.id).phase, 'component-structure-observed');
  assert.equal(host.figma.root.findAll(() => true).length, count);
});
