import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { nativeTextGraphFixture, nativeTextBindings, nativeTextNodeBindings } from '../core/native-text-template-test-fixture.js';
import { nativeFixtureHost } from './native-operation-test-fixture.js';
import { createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationPhase, type NativeOperationJobsOptions } from './native-operation-jobs.js';
import { prepareReactNativePlan, buildReactNativeComponentWrite } from './react-native-plan.js';
import { prepareReactComparisonPlan, buildReactComparisonWrite, type ReactComparisonPlanInput } from './react-comparison-plan.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactComparisonRequest } from './react-comparison-request.js';
import type { ReactRootMatrix } from './react-root-matrix.js';

/** Actual journal/compiler/reader protocol with a synthetic native API. This
 * validates authority and persistence, never live geometry or visual fidelity. */
async function fixture(t: test.TestContext) {
  const repo = mkdtempSync(path.join(tmpdir(), 'template-consumer-journal-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const f = nativeTextGraphFixture(2, 2), host = nativeFixtureHost({ modeLimit: 2, consumerVariableModes: true });
  host.figma.fileKey = REACT_NATIVE_FILE_KEY; nativeTextBindings(host.figma);
  Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection = function(c: any, m: string) {
    this.explicitVariableModes = { ...this.explicitVariableModes, [c.id]: m };
  };
  const engine = createFigmaEngine({ tokens: { primitives: f.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const source = { revision: revisionOf('journal source'), programSha256: 'a'.repeat(64), evidenceRevision: revisionOf('journal evidence') };
  const matrix: ReactRootMatrix = { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
    draft: { properties: ['size', 'ink'], status: 'native-compiled', contract: f.contract, tokens: f.tokens,
      native: engine.compileComponentData(f.contract, new Map([[f.contract.id, f.contract]])), problems: [], observations: [], lowerings: [], limitations: [] } };
  const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64),
    ownership: { id: '10000000-0000-4000-8000-000000000099', sha256: 'b'.repeat(64) }, inventorySha256: 'c'.repeat(64),
    caseId: 'template-main', matrixRevision: revisionOf(matrix) };
  const comparisons = new Map<string, Omit<ReactComparisonPlanInput, 'operation'>>();
  const options: NativeOperationJobsOptions = {
    prepare: () => { throw Error('legacy adapter must not run'); },
    react: {
      prepare: (_, operation) => ({ visual: { id: request.ownership.id, reportSha256: request.ownership.sha256 },
        preparation: { id: request.ownership.id, reportSha256: request.matrixRevision.slice(7) }, plan: prepareReactNativePlan({ operation, source, matrix }) }),
      buildComponent: (_, context) => buildReactNativeComponentWrite({ operation: context.operation, source, matrix,
        expectedPlanRevision: context.planRevision, tokens: context.tokens, templateGraph: context.templateGraph }),
    },
    reactComparison: {
      prepare: (selected, operation) => ({ visual: { id: selected.content.id, reportSha256: selected.content.reportSha256 },
        preparation: { id: selected.content.id, reportSha256: selected.content.reportSha256 },
        plan: prepareReactComparisonPlan({ ...comparisons.get(selected.root.caseId)!, operation }) }),
      buildComponent: (selected, context) => buildReactComparisonWrite({ ...comparisons.get(selected.root.caseId)!, operation: context.operation,
        expectedPlanRevision: context.planRevision, tokens: context.tokens }),
    },
  };
  let jobs = createNativeOperationJobs(repo, options);
  const phase = async (id: string, p: NativeOperationPhase) => {
    const result = await host.run(jobs.dispatch(id, p));
    if (p === 'component-create') for (const node of host.figma.root.findAll((n: any) => n.type === 'TEXT'))
      nativeTextNodeBindings(node, id => host.variables.find(v => v.id === id));
    return jobs.accept(id, result);
  };
  const finish = async (id: string) => {
    for (const p of ['token-create', 'token-readback', 'component-create', 'component-readback'] as const) await phase(id, p);
    assert.equal(jobs.get(id).phase, 'component-structure-observed', JSON.stringify(jobs.get(id).problems));
  };
  const parentId = jobs.prepare(request).id; await finish(parentId);
  const prepareCaller = (caseId: string) => {
    const parent = jobs.reactUpdateBaseline(parentId), contract = structuredClone(f.contract);
    contract.id = 'test.caller-' + caseId; contract.props = []; delete contract.anatomy.root.slot;
    for (const [key, value] of Object.entries(contract.anatomy.root.tokens!))
      contract.anatomy.root.tokens![key] = value.replace('{size}', 'v1').replace('{ink}', 'v1');
    contract.anatomy.root.parts = { label: { text: 'Retained caller' } };
    const treeRevision = revisionOf(['caller', caseId]);
    comparisons.set(caseId, { source, content: { version: 1, status: 'compiled-comparison-draft', qualification: 'observed-comparison-content-only',
      acceptedContract: null, nativeQualification: 'unqualified', inputRevision: treeRevision, treeRevision, fontsRevision: revisionOf('fonts'),
      contract, tokens: f.tokens, component: engine.compileComponentData(contract, new Map([[contract.id, contract]])), assets: [], receipts: [], residuals: [], problems: [], limitations: [] },
      comparison: { parent: parent.input, receipt: parent.receipt, caseId,
        variantName: parent.input.component.variants.find(v => v.name.includes('Size=v1') && v.name.includes('Ink=v1'))!.name,
        slotSpecPath: [0], rootText: { version: 1, kind: 'direct-root-text', characters: 'Retained caller', contractRevision: revisionOf(contract), treeRevision } } });
    const selected: ReactComparisonRequest = { version: 3, kind: 'react-content-comparison', parentOperationId: parentId,
      root: { ...request, caseId }, mainRoot: request,
      content: { id: request.ownership.id, reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
    return jobs.prepare(selected).id;
  };
  return { repo, host, parentId, prepareCaller, finish, phase, jobs: () => jobs,
    changeSource: () => { f.tokens.ink.v1.$value = '#abcdef'; },
    restart: () => { jobs = createNativeOperationJobs(repo, options); } };
}

test('template callers come from complete current journals and survive manager restarts', async t => {
  const f = await fixture(t), inventory = () => f.jobs().reactTemplateConsumerBaselines(f.parentId);
  assert.deepEqual(inventory().consumers, []);
  const id = f.prepareCaller('one');
  assert.throws(inventory, /template-consumer-observation-required/, 'planned callers cannot disappear from write scope');
  await f.finish(id);
  const saved = inventory(); assert.equal(saved.consumers.length, 1);
  const pins = saved.consumers.map(c => ({ operationId: c.operationId, journalRevision: c.journalRevision }));
  assert.equal(saved.consumers[0].operationId, id);
  assert.equal(saved.consumers[0].input.comparison.parent.operation.id, f.parentId);
  assert.match(saved.consumers[0].journalRevision, /^[a-f0-9]{64}$/);
  assert.equal(saved.consumers[0].baseline.content.images, undefined);
  assert.equal(saved.consumers[0].baseline.parent.images, undefined);
  f.restart(); assert.deepEqual(inventory(), saved);
  const changed = inventory(); changed.consumers[0].input.creation.pageId = 'wrong';
  assert.deepEqual(inventory(), saved, 'returned data cannot change saved authority');
  const command = f.jobs().retryObservation(id);
  assert.throws(inventory, /template-consumer-observation-required/, 'pending read clears previous observation authority');
  assert.throws(() => f.jobs().reactTemplateConsumerBaselines(f.parentId, pins), /baseline-observation-unsettled/);
  f.jobs().accept(id, await f.host.run(command));
  const fresh = inventory(); assert.notEqual(fresh.consumers[0].journalRevision, saved.consumers[0].journalRevision);
  assert.deepEqual(fresh.consumers[0].input, saved.consumers[0].input);
  assert.deepEqual(fresh.consumers[0].baseline, saved.consumers[0].baseline);
  assert.notEqual(fresh.currentRevision, saved.currentRevision);
  const pinned = f.jobs().reactTemplateConsumerBaselines(f.parentId, pins);
  assert.equal(pinned.consumers[0].journalRevision, saved.consumers[0].journalRevision);
  assert.equal(pinned.consumers[0].currentJournalRevision, fresh.consumers[0].journalRevision);
  assert.equal(pinned.currentRevision, fresh.currentRevision);
  assert.deepEqual(pinned.consumers[0].baseline, saved.consumers[0].baseline);
  for (const invalid of [[...pins, ...pins], [{ ...pins[0], operationId: f.parentId }],
    [{ ...pins[0], journalRevision: '../outside' }]])
    assert.throws(() => f.jobs().reactTemplateConsumerBaselines(f.parentId, invalid), /baseline-pin-invalid/);
  assert.throws(() => f.jobs().reactTemplateConsumerBaselines(f.parentId,
    [{ ...pins[0], journalRevision: '0'.repeat(64) }]), /baseline-revision-unavailable/);
  const other = f.prepareCaller('two'); await f.finish(other);
  assert.deepEqual(inventory().consumers.map(c => c.operationId), [id, other].sort());
  const linked = f.jobs().reactTemplateConsumerBaselines(f.parentId, pins);
  assert.deepEqual(linked.consumers.map(c => c.operationId), [id, other].sort(), 'a written prefix cannot hide a later caller');
  assert.equal(linked.consumers.find(c => c.operationId === id)!.journalRevision, pins[0].journalRevision);
  f.changeSource(); assert.equal(f.jobs().get(id).sourceCurrent, false);
  assert.deepEqual(f.jobs().reactTemplateConsumerBaselines(f.parentId, pins), linked,
    'historical caller authority remains separate from fresh desired-source compilation');
});

test('caller changes, journal corruption and pending parent reads cannot retain old write authority', async t => {
  const f = await fixture(t), id = f.prepareCaller('one'); await f.finish(id);
  const inventory = () => f.jobs().reactTemplateConsumerBaselines(f.parentId), saved = inventory();
  const pins = saved.consumers.map(c => ({ operationId: c.operationId, journalRevision: c.journalRevision }));
  const instance = await f.host.figma.getNodeByIdAsync(saved.consumers[0].input.creation.comparisons[0].instanceId);
  instance.opacity = 0.5;
  f.jobs().accept(id, await f.host.run(f.jobs().retryObservation(id)));
  assert.throws(inventory, /template-consumer-observation-required/);
  instance.opacity = 1;
  f.jobs().accept(id, await f.host.run(f.jobs().retryObservation(id))); inventory();
  const events = path.join(f.repo, 'private/source-native-app/operations', id, 'events');
  const file = path.join(events, readdirSync(events).sort().at(-1)!);
  const original = readFileSync(file, 'utf8'), broken = JSON.parse(original); broken.previousSha256 = '0'.repeat(64);
  writeFileSync(file, JSON.stringify(broken));
  assert.throws(inventory, /journal-chain-invalid/);
  assert.throws(() => f.jobs().reactTemplateConsumerBaselines(f.parentId, pins), /journal-chain-invalid/,
    'an intact historical caller observation cannot hide a corrupt later event');
  writeFileSync(file, original);
  const header = path.join(f.repo, 'private/source-native-app/operations', id, 'operation.json');
  const originalHeader = readFileSync(header, 'utf8'), forged = JSON.parse(originalHeader);
  forged.request.root.version = 99; writeFileSync(header, JSON.stringify(forged));
  assert.throws(inventory, /header-invalid/, 'an invalid related request is not filtered out of discovery');
  writeFileSync(header, originalHeader);
  f.jobs().withReadSnapshot(() => {
    inventory(); writeFileSync(file, JSON.stringify(broken));
    assert.throws(inventory, /journal-chain-invalid/, 'a display cache cannot mask changed underlying history');
    writeFileSync(file, original);
  });
  const pending = f.jobs().retryObservation(f.parentId);
  assert.throws(inventory, /template-consumer-parent-unavailable/);
  f.jobs().accept(f.parentId, await f.host.run(pending)); inventory();
});
