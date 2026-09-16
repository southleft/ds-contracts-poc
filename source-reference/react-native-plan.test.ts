import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { revisionOf } from '../core/contract-provenance.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from '../core/token-set.js';
import { nativeFixtureHost } from './native-operation-test-fixture.js';
import { SOURCE_NATIVE_FILE_KEY } from './native-operation-jobs.js';
import { prepareReactNativePlan, buildReactNativeComponentWrite } from './react-native-plan.js';
import type { ReactRootMatrix } from './react-root-matrix.js';

// Synthetic input and native API mock: guard/structure evidence, not visual fidelity.
function inputFixture() {
  const contract = ContractSchema.parse({ id: 'check.react-native', name: 'ReactNativeDraft',
    status: 'draft', version: '0.1.0', description: 'Synthetic root draft', states: [],
    semantics: { element: 'button' }, props: [{ name: 'tone', type: { enum: ['quiet', 'null'] },
      default: 'quiet', bindings: { code: { prop: 'tone', values: { quiet: 'quiet', null: null } },
        figma: { kind: 'VARIANT', property: 'Tone', values: { quiet: 'Quiet', null: 'None' } } } }],
    anatomy: { root: { slot: { name: 'children' },
      layout: { display: 'inline-flex', direction: 'row', align: 'center', justify: 'center' },
      tokens: { 'background-color': '{surface}', 'padding-left': '{space}', 'padding-right': '{space}', height: '{height}' },
      tokensByProp: [{ prop: 'tone', map: { null: { width: '{width}' } } }],
    } }, bindings: { code: { anchors: { importPath: './source', export: 'Surface' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const tokens = { surface: { $type: 'color', $value: '#123456' }, space: { $type: 'dimension', $value: '8px' },
    height: { $type: 'dimension', $value: '36px' }, width: { $type: 'dimension', $value: '72px' } };
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const matrix: ReactRootMatrix = { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
    draft: { properties: ['tone'], status: 'native-compiled', contract, tokens,
      native: engine.compileComponentData(contract, new Map([[contract.id, contract]])),
      problems: [], observations: ['0','1'], lowerings: [], limitations: ['native-fidelity-not-verified'] } };
  return { input: { operation: { id: '10000000-0000-4000-8000-000000000099', fileKey: SOURCE_NATIVE_FILE_KEY },
    source: { revision: revisionOf('synthetic source'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf(matrix) }, matrix }, engine };
}
async function hostFixture() {
  const { input, engine } = inputFixture(), host = nativeFixtureHost();
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
  const repeat = await f.run(script);
  assert.equal(repeat.status, 'refused');
  assert.equal(repeat.allocationAttempted, false);
  assert.match(repeat.problems.join(','), /collision/);
  assert.equal(f.figma.root.findAll(() => true).length, count);
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
