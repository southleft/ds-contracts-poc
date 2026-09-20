import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  stateApiEvidence,
  stateApiObservation,
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

function fixture() {
  const { initial, behavior } = stateApiEvidence();
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
    restorationChecks: 81,
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

test('state API journal and actual companion complete all phases, reopen, reject changed evidence and retain one output', async (t) => {
  const repo = mkdtempSync(path.join(tmpdir(), 'state-api-native-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const f = fixture();
  let current = true;
  const options: NativeOperationJobsOptions = {
    prepare: () => {
      throw Error('legacy adapter must not run');
    },
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
  assert.throws(
    () => jobs.reactUpdateBaseline(first.id),
    /verified-baseline-required/,
  );
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
