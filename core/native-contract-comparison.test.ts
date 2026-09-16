import { nativeComparisonFixture as fixture } from './native-contract-comparison-test-fixture.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationJobsOptions } from '../source-reference/native-operation-jobs.js';
import { prepareReactComparisonPlan, buildReactComparisonWrite, reactComparisonVariant } from '../source-reference/react-comparison-plan.js';
import type { ReactComparisonRequest } from '../source-reference/react-comparison-request.js';
import type { ObservedContentDraft } from '../source-reference/observed-content.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback, type NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractSchema } from '../scripts/contract-schema.js';
import { revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import { prepareNativeContractComparison, type NativeContractComparisonInput } from './native-contract-comparison.js';


test('shared writer fills an instance of the existing main, retaining editable content and both token contexts', async () => {
  const f = await fixture(), before = await f.run(emitNativeContractReadbackScript(f.comparison.parent));
  const componentCount = f.figma.root.findAll((n: any) => n.type === 'COMPONENT').length;
  const result = await f.run(f.emit());
  assert.equal(result.status, 'created-candidate', JSON.stringify(result));
  assert.equal(f.figma.root.findAll((n: any) => n.type === 'COMPONENT').length, componentCount);
  const record = result.comparisons[0], instance = await f.figma.getNodeByIdAsync(record.instanceId);
  assert.equal(instance.type, 'INSTANCE');
  assert.equal((await instance.getMainComponentAsync()).id, f.comparison.parent.creation.variants[0].id);
  const slot = await f.figma.getNodeByIdAsync(record.slots[0].nodeId);
  assert.equal(slot.type, 'SLOT'); assert.equal(slot.children.length, 2);
  assert.equal(slot.children[1].type, 'TEXT'); assert.equal(slot.children[1].characters, 'Save changes');
  assert.equal(slot.children[1].boundVariables.fontSize.id, f.supplemental.tokens.identity.variables.find((v: any) => v.tokenPath === 'size')!.id);
  assert.equal(instance.explicitVariableModes[f.comparison.parent.tokenIdentity.collection.id], f.comparison.parent.tokenIdentity.modes[0].modeId);
  assert.equal(instance.explicitVariableModes[f.supplemental.tokens.identity.collection.id], f.supplemental.tokens.identity.modes[0].modeId);
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.comparison.parent)), before);
  const count = f.figma.root.findAll(() => true).length;
  const repeat = await f.run(f.emit());
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  const plain = f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]]));
  plain.variants[0].spec.children![0].nativeContractSample = { caseId: 'x', contentRevision: revisionOf('x'), specPath: [0] };
  assert.throws(() => f.engine.buildBatchScript([plain], f.figma.fileKey), /WRITE_CONTEXT_REQUIRED/);
});

test('changed main or tokens, absent fonts, and substituted source fail before allocation', async () => {
  for (const mutation of ['main', 'tokens', 'font']) {
    const f = await fixture(), script = f.emit();
    if (mutation === 'main') (await f.figma.getNodeByIdAsync(f.comparison.parent.creation.variants[0].id)).name = 'Changed';
    if (mutation === 'tokens') f.variables.find((v: any) => v.id === f.comparison.parent.tokenIdentity.variables[0].id)!.setValueForMode(f.comparison.parent.tokenIdentity.modes[0].modeId, 'changed');
    if (mutation === 'font') f.figma.loadFontAsync = async () => { throw Error('missing'); };
    const count = f.figma.root.findAll(() => true).length, result = await f.run(script);
    assert.equal(result.status, 'refused', JSON.stringify(result)); assert.equal(result.allocationAttempted, false);
    assert.equal(f.figma.root.findAll(() => true).length, count);
  }
  const f = await fixture();
  const changed = structuredClone(f.comparison); changed.receipt.nodes!.find(n => n.type === 'COMPONENT')!.metadata.nativeContractPart = '{}';
  assert.throws(() => f.emit(f.content, changed), /parent-observation-required/);
  changed.slotSpecPath = [999];
  assert.throws(() => f.emit(f.content, { ...f.comparison, slotSpecPath: changed.slotSpecPath }), /slot-path-invalid/);
  const data = f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]]));
  assert.throws(() => prepareNativeContractComparison(f.content, data, { ...f.source, revision: revisionOf('different') }, revisionOf(f.tokens), { mode: 'light', brand: 'default' }, f.comparison), /source-changed/);
});

test('partial allocations are retained and never recreated by repeating the writer', async () => {
  const f = await fixture(), script = f.emit();
  f.figma.createText = () => { throw Error('simulated native allocation interruption'); };
  const result = await f.run(script);
  assert.equal(result.status, 'partial-or-unknown-allocation'); assert.equal(result.allocationAttempted, true);
  assert(result.pageId); assert(result.comparisonBoardId); assert(result.comparisons[0].instanceId);
  assert(result.nodes.some((n: any) => n.type === 'INSTANCE'));
  const count = f.figma.root.findAll(() => true).length, repeat = await f.run(script);
  assert.equal(repeat.status, 'refused'); assert.equal(repeat.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.comparison.parent)), f.comparison.receipt);
});

test('missing allocation ownership refuses instead of silently emitting styled text wrappers', async () => {
  const f = await fixture(), boxed = structuredClone(f.content);
  boxed.anatomy.root.parts!.label.tokens!['background-color'] = '{surface}';
  assert.throws(() => f.emit(boxed), /content-allocation-ownership-unqualified/);
  const wrongScope = structuredClone(f.supplemental); wrongScope.operation.id = f.comparison.parent.operation.id;
  assert.throws(() => f.engine.buildNativeContractComparisonScript(f.content, new Map([[f.content.id, f.content]]), f.source, wrongScope, f.comparison), /SCOPE_INVALID/);
});

async function observedFixture(grid: boolean | 'flow' = false) {
  const f = await fixture(undefined, grid), creation = await f.run(f.emit());
  const data = f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]]));
  const comparison = prepareNativeContractComparison(f.content, data, f.source, revisionOf(f.tokens), { mode: 'light', brand: 'default' }, f.comparison);
  const input: NativeContractComparisonObservationInput = { operation: f.supplemental.operation, planRevision: revisionOf('comparison plan'), comparison,
    tokenInput: f.supplemental.tokens.input, tokenIdentity: f.supplemental.tokens.identity, creation };
  const receipt = await f.run(emitNativeContractComparisonReadbackScript(input, true));
  return { ...f, input, receipt };
}
test('independent comparison readback verifies the unchanged main, native content, bindings, inventory and export', async () => {
  const f = await observedFixture(), count = f.figma.root.findAll(() => true).length;
  assert.equal(f.receipt.status, 'native-comparison-readback-collected', JSON.stringify(f.receipt));
  const checked = verifyNativeContractComparisonReadback(f.input, f.receipt);
  assert.equal(checked.status, 'supported-comparison-structure-observed', JSON.stringify(checked));
  assert.equal(checked.nativeQualification, 'unqualified');
  assert.equal(f.receipt.content.images.length, 1);
  assert.equal(f.receipt.content.images[0].nodeId, f.input.creation.comparisons[0].instanceId);
  assert.equal(f.figma.root.findAll(() => true).length, count);
  assert.deepEqual(await f.run(emitNativeContractComparisonReadbackScript(f.input, true)), f.receipt);
  for (const mutate of [
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'Changed'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.fontName.family = 'Substitute'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize.id = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.fills[0].boundVariables.color.id = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').metadata.nativeContractSample = '{}'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').mainId = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').values.fills = []; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').values.componentPropertyReferences.slotContentId = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').childIds.reverse(); },
    (r: any) => { r.content.nodes.pop(); },
    (r: any) => { r.content.tokens.receipt.variables[0].key = 'replacement'; },
    (r: any) => { r.parent.nodes.find((n: any) => n.type === 'COMPONENT').name = 'changed'; },
  ]) {
    const changed = structuredClone(f.receipt); mutate(changed);
    assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'refused', mutate.toString());
  }
});

test('native text binding arrays and empty root references preserve strict binding checks', async () => {
  const f = await observedFixture(), native = structuredClone(f.receipt);
  const text = native.content.nodes.find((n: any) => n.type === 'TEXT');
  const instance = native.content.nodes.find((n: any) => n.type === 'INSTANCE');
  text.values.boundVariables.fontSize = [text.values.boundVariables.fontSize];
  instance.values.componentPropertyReferences = null;
  assert.equal(verifyNativeContractComparisonReadback(f.input, native).status, 'supported-comparison-structure-observed');
  for (const mutate of [
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize = []; },
    (r: any) => { const n = r.content.nodes.find((n: any) => n.type === 'TEXT'); n.values.boundVariables.fontSize.push(n.values.boundVariables.fontSize[0]); },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize[0].id = 'replacement'; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'INSTANCE').values.componentPropertyReferences = { visible: 'unexpected' }; },
    (r: any) => { r.content.nodes.find((n: any) => n.type === 'SLOT').values.componentPropertyReferences = null; },
  ]) {
    const changed = structuredClone(native); mutate(changed);
    assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'refused', mutate.toString());
  }
});

test('instance-derived slot IDs retain allocated roles; a forged role or changed source main refuses', async () => {
  const f = await observedFixture(), changed = structuredClone(f.receipt);
  const slot = changed.content.nodes.find((n: any) => n.type === 'SLOT');
  const aliases = new Map(f.input.creation.nodes.filter((n: any) => n.slotIdentity)
    .map((n: any) => [n.id, `${slot.id};derived-${n.id}`]));
  for (const row of changed.content.nodes) {
    row.id = aliases.get(row.id) ?? row.id; row.parentId = aliases.get(row.parentId) ?? row.parentId;
    row.childIds = row.childIds.map((id: string) => aliases.get(id) ?? id);
  }
  assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'supported-comparison-structure-observed');
  changed.content.nodes.find((n: any) => n.type === 'TEXT').metadata.nativeSourceAllocation = 'forged';
  assert.equal(verifyNativeContractComparisonReadback(f.input, changed).status, 'refused');
  const main = await f.figma.getNodeByIdAsync(f.input.comparison.mainId); main.name = 'Changed';
  const live = await f.run(emitNativeContractComparisonReadbackScript(f.input));
  assert.equal(verifyNativeContractComparisonReadback(f.input, live).status, 'refused');
});

test('comparison operation persists through every journal phase and repeat selection keeps its identity', async t => {
  const f = await fixture(REACT_NATIVE_FILE_KEY), repo = mkdtempSync(path.join(tmpdir(), 'react-comparison-journal-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const content: ObservedContentDraft = { version: 1, status: 'compiled-comparison-draft', qualification: 'observed-comparison-content-only',
    acceptedContract: null, nativeQualification: 'unqualified', inputRevision: revisionOf('observations'), treeRevision: revisionOf('tree'), fontsRevision: revisionOf('fonts'),
    contract: f.content, tokens: f.tokens, assets: f.assets, component: f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]])),
    receipts: [], residuals: [], problems: [], limitations: ['synthetic-test-only'] };
  const request: ReactComparisonRequest = { version: 1, kind: 'react-content-comparison', parentOperationId: f.comparison.parent.operation.id,
    root: { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64), ownership: { id: '10000000-0000-4000-8000-000000000010', sha256: 'b'.repeat(64) },
      inventorySha256: 'c'.repeat(64), caseId: 'sample', matrixRevision: revisionOf('matrix') },
    content: { id: '10000000-0000-4000-8000-000000000011', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  let current = true, preparations = 0;
  const options: NativeOperationJobsOptions = { prepare: () => { throw Error('unexpected source adapter'); }, reactComparison: {
    prepare: (selected, operation) => {
      preparations++; assert.deepEqual(selected, request); if (!current) throw Error('source changed');
      return { visual: { id: request.root.ownership.id, reportSha256: request.root.ownership.sha256 },
        preparation: { id: request.content.id, reportSha256: request.content.reportSha256 },
        plan: prepareReactComparisonPlan({ operation, content, source: f.source, comparison: f.comparison }) };
    },
    buildComponent: (_, context) => buildReactComparisonWrite({ operation: context.operation, content, source: f.source,
      comparison: f.comparison, expectedPlanRevision: context.planRevision, tokens: context.tokens }),
  } };
  let jobs = createNativeOperationJobs(repo, options);
  const saved = jobs.prepare(request);
  for (const phase of ['token-create', 'token-readback', 'component-create', 'component-readback'] as const) {
    const command = jobs.dispatch(saved.id, phase), { script, readOnly: _, kind: __, ...identity } = command;
    const result = await f.run(script);
    jobs.accept(saved.id, { ...identity, result });
    jobs = createNativeOperationJobs(repo, options);
    assert.notEqual(jobs.get(saved.id).phase, 'evidence-unavailable', phase);
  }
  const final = jobs.get(saved.id);
  assert.equal(final.phase, 'component-structure-observed', JSON.stringify(final));
  assert.equal(final.structuralObservation?.status, 'supported-comparison-structure-observed');
  assert.equal(final.imageObservation?.images.length, 1);
  assert.equal(jobs.listReact(request.root.referenceId)[0].parentOperationId, request.parentOperationId);
  const beforeRootListing = preparations;
  assert.deepEqual(jobs.listReact(request.root.referenceId, 'root'), []);
  assert.equal(preparations, beforeRootListing, 'root discovery must not recursively authenticate comparison children');
  assert.equal(jobs.prepare(request).id, saved.id);
  assert.throws(() => jobs.dispatch(saved.id, 'component-create'), /already-dispatched/);
  const count = f.figma.root.findAll(() => true).length;
  const readback = jobs.retryObservation(saved.id), { script, readOnly: _, kind: __, ...identity } = readback;
  jobs.accept(saved.id, { ...identity, result: await f.run(script) });
  assert.equal(jobs.get(saved.id).phase, 'component-structure-observed');
  assert.equal(f.figma.root.findAll(() => true).length, count);
  current = false;
  assert.equal(jobs.get(saved.id).sourceCurrent, false);
  assert.throws(() => jobs.prepare(request), /source changed/);
});

test('comparison variant selection preserves typed null, string null, defaults and omitted values', () => {
  const prop = { name: 'tone', type: { enum: ['none', 'literal-null', 'quiet'] }, default: 'quiet',
    bindings: { code: { prop: 'appearance', values: { none: null, 'literal-null': 'null', quiet: 'quiet' } },
      figma: { kind: 'VARIANT', property: 'Tone', values: { none: 'None', 'literal-null': 'Null text', quiet: 'Quiet' } } } };
  const contract = ContractSchema.parse({ id: 'fixture.values', name: 'Values', version: '0.1.0', status: 'draft', description: 'Typed fixture',
    props: [prop], states: [], semantics: { element: 'div' }, anatomy: { root: {} }, bindings: { code: { anchors: { importPath: './fixture', export: 'Values' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  assert.equal(reactComparisonVariant(contract, { appearance: null }), 'Tone=None');
  assert.equal(reactComparisonVariant(contract, { appearance: 'null' }), 'Tone=Null text');
  assert.equal(reactComparisonVariant(contract, {}), 'Tone=Quiet');
  assert.equal(reactComparisonVariant(contract, { appearance: { kind: 'undefined' } }), 'Tone=Quiet');
  delete contract.props[0].default; contract.props[0].bindings.figma.unsetValue = '(unset)';
  assert.equal(reactComparisonVariant(contract, {}), 'Tone=(unset)');
  assert.throws(() => reactComparisonVariant(contract, { appearance: { kind: 'object' } }), /value-unqualified/);
});


async function nestedFixture(grid: boolean | 'flow' = false, fillWidth = false, block = false) {
  const f = await fixture(undefined, fillWidth ? 'flow' : grid);
  const child = f.contract('fixture.child', { root: { slot: { name: 'children' }, layout: { display: 'inline-flex', direction: 'row' }, tokens: { 'background-color': '{ink}' } } });
  if(grid) {
    child.anatomy.root.layout={display:'grid',columns:[{fr:1},{fr:1}],rows:[{fit:true},{fit:true}],flow:'row'};
    if(grid==='flow') { child.anatomy.root.layout.columns=[{fr:1}];delete child.anatomy.root.layout.rows;child.anatomy.root.layout.autoRows={fit:true}; }
    child.anatomy.root.literals={width:'300px',height:'fit-content'};
    child.anatomy.root.tokens!.gap='{size}';
  }
  if (fillWidth) {
    child.anatomy.root.literals={width:'100%',height:'fit-content'};
    if (!grid) child.anatomy.root.layout={display:'flex',direction:'column'};
  }
  if (block) { delete child.anatomy.root.layout; child.anatomy.root.declared={display:'block'}; }
  child.name = 'Main'; // Deliberate display-name collision with the outer main.
  const context = await f.context('10000000-0000-4000-8000-000000000003');
  const data = f.engine.compileNativeContractDraft(child, new Map([[child.id, child]]), f.source);
  const creation = await f.run(f.engine.buildNativeContractDraftScript(child, new Map([[child.id, child]]), f.source, context));
  assert.equal(creation.status, 'created-candidate');
  const parent: NativeContractObservationInput = { operation: context.operation, planRevision: revisionOf('nested main plan'),
    projection: data.projection, component: data.component, tokenInput: context.tokens.input, tokenIdentity: context.tokens.identity, creation };
  const receipt = await f.run(emitNativeContractReadbackScript(parent));
  assert.equal(verifyNativeContractReadback(parent,receipt).status,'supported-structure-observed',JSON.stringify({report:verifyNativeContractReadback(parent,receipt),root:receipt.nodes?.find((n:any)=>n.id===creation.variants[0].id)?.values}));
  const text = (value: string) => ({ text: value, tokens: { color: '{surface}', 'font-size': '{size}' }, declared: { 'font-family': 'Inter' } });
  const content = f.contract('fixture.composed', { root: { layout: { display: 'flex', direction: 'column' }, parts: {
    first: { layout: { display: 'flex', direction: 'row' }, parts: {
      nested: { layout: { display: 'flex', direction: 'row' }, parts: { label: text('First editable content') } },
    } },
    second: { layout: { display: 'flex', direction: 'row' }, parts: { secondLabel: text('Second editable content') } },
  } } });
  if(grid==='flow')Object.assign(content.anatomy.root.parts!.second.parts!,{thirdLabel:text('Third'),fourthLabel:text('Fourth')});
  if(block){content.anatomy.root.parts!.first.literals={width:'300px'};content.anatomy.root.parts!.first.layout!.direction='column';}
  const reference = { parent, receipt, variantName: data.component.variants[0].name, slotSpecPath: [0] };
  const selected: NativeContractComparisonInput = { ...f.comparison, instances: (block?[[0,0],[1]]:[[0], [0, 0], [1]]).map(specPath => ({ ...reference, specPath })) };
  const emit = (c=content, selection=selected) => f.emit(c, selection);
  const observe = async (creation: any) => {
    const component = f.engine.compileComponentData(content, new Map([[content.id, content]]));
    const comparison = prepareNativeContractComparison(content, component, f.source, revisionOf(f.tokens), { mode: 'light', brand: 'default' }, selected);
    const input: NativeContractComparisonObservationInput = { operation: f.supplemental.operation, planRevision: revisionOf('nested composition'), comparison,
      tokenInput: f.supplemental.tokens.input, tokenIdentity: f.supplemental.tokens.identity, creation };
    return { input, receipt: await f.run(emitNativeContractComparisonReadbackScript(input, true)) };
  };
  return { ...f, content, selected, reference, emit, observe };
}

test('block text instances keep native identities and reject unlowered inline composition before allocation',async()=>{
 const f=await nestedFixture(false,true,true);
 const mixed=structuredClone(f.content);
 mixed.anatomy.root.parts!.second.parts!.extra={text:'another inline run'};
 assert.throws(()=>f.emit(mixed),/block-inline-content-unqualified/);
 const before=await f.run(emitNativeContractReadbackScript(f.reference.parent));
 const creation=await f.run(f.emit());assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const {input,receipt}=await f.observe(creation);
 assert.equal(verifyNativeContractComparisonReadback(input,receipt).status,'supported-comparison-structure-observed');
 assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.reference.parent)),before);
 for(const record of creation.comparisons[0].nested){
  const node=await f.figma.getNodeByIdAsync(record.instanceId);
  assert.equal(node.layoutSizingHorizontal,'FILL');
  assert.equal((await node.getMainComponentAsync()).id,f.reference.parent.creation.variants[0].id);
  assert.equal(node.children[0].children.length,1);assert.equal(node.children[0].children[0].type,'TEXT');
 }
 const count=f.figma.root.findAll(()=>true).length;
 assert.equal((await f.run(f.emit())).allocationAttempted,false);assert.equal(f.figma.root.findAll(()=>true).length,count);
});

for (const grid of [false, 'flow'] as const) test(`nested full-width content uses its final parent and refuses an indefinite host (${grid || 'flex'})`, async () => {
  const f=await nestedFixture(grid,true);
  const before=await f.run(emitNativeContractReadbackScript(f.reference.parent));
  for(const mutate of [
    (r:any)=>{r.nodes.find((n:any)=>n.id===f.reference.parent.creation.variants[0].id).values.layoutSizingHorizontal='HUG';},
    (r:any)=>{r.nodes.find((n:any)=>n.type==='SLOT').values.layoutSizingHorizontal='HUG';},
  ]){const bad=structuredClone(before);mutate(bad);assert.equal(verifyNativeContractReadback(f.reference.parent,bad).status,'refused');}
  const creation=await f.run(f.emit());assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  for(const record of creation.comparisons[0].nested){
    const node=await f.figma.getNodeByIdAsync(record.instanceId);
    assert.equal(node.layoutSizingHorizontal,'FILL');
    assert.notEqual(node.parent.type,'PAGE');
  }
  const {input,receipt}=await f.observe(creation);
  const verified=verifyNativeContractComparisonReadback(input,receipt);
  assert.equal(verified.status,'supported-comparison-structure-observed',JSON.stringify(verified));
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.reference.parent)),before);
  for(const sizing of ['FIXED','HUG']) {
    const bad=structuredClone(receipt);
    bad.content.nodes.find((n:any)=>n.id===creation.comparisons[0].nested[1].instanceId).values.layoutSizingHorizontal=sizing;
    assert.equal(verifyNativeContractComparisonReadback(input,bad).status,'refused');
  }
  const noHost={...f.selected,instances:f.selected.instances!.filter(ref=>JSON.stringify(ref.specPath)!=='[0]')};
  assert.throws(()=>f.emit(f.content,noHost),/nested-fill-width-parent-unqualified/);
  assert.throws(()=>f.emit(f.content,{...f.reference,caseId:'standalone'}),/root-fill-width-needs-parent-context/);
  const count=f.figma.root.findAll(()=>true).length;
  assert.equal((await f.run(f.emit())).allocationAttempted,false);
  assert.equal(f.figma.root.findAll(()=>true).length,count);
});

for (const grid of [false, true, 'flow'] as const) test(`nested caller content keeps linkage, token contexts and editable slots (${grid === 'flow' ? 'managed grid' : grid ? 'grid' : 'flex'})`, async () => {
  const f = await nestedFixture(grid), before = await f.run(emitNativeContractReadbackScript(f.reference.parent));
  const mains = f.figma.root.findAll((n: any) => n.type === 'COMPONENT').map((n: any) => n.id);
  const creation = await f.run(f.emit());
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  assert.deepEqual(f.figma.root.findAll((n: any) => n.type === 'COMPONENT').map((n: any) => n.id), mains);
  const records = creation.comparisons[0].nested;
  assert.deepEqual(records.map((r: any) => r.index), [0, 1, 2]);
  for (const record of records) {
    const node = await f.figma.getNodeByIdAsync(record.instanceId);
    assert.equal(node.type, 'INSTANCE');
    assert.equal((await node.getMainComponentAsync()).id, f.reference.parent.creation.variants[0].id);
    assert.equal(node.children[0].type, 'SLOT');
    assert.equal(node.explicitVariableModes[f.reference.parent.tokenIdentity.collection.id], f.reference.parent.tokenIdentity.modes[0].modeId);
  }
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.reference.parent)), before);
  const { input, receipt } = await f.observe(creation);
  assert.equal(receipt.nested.length, 1, 'repeated uses share one independent read of their pinned main');
  assert.equal(verifyNativeContractComparisonReadback(input, receipt).status, 'supported-comparison-structure-observed', JSON.stringify(verifyNativeContractComparisonReadback(input, receipt)));
  assert.deepEqual(await f.run(emitNativeContractComparisonReadbackScript(input, true)), receipt);
  // Figma may materialize every descendant under the outer slot using
  // instance-derived IDs. Nested instances must retain their original roles.
  const rebased = structuredClone(receipt), outerSlot = creation.comparisons[0].slots[0].nodeId;
  const aliases = new Map(creation.nodes.filter((n: any) => n.slotIdentity).map((n: any) => [n.id, `${outerSlot};derived-${n.id}`]));
  for (const row of rebased.content.nodes) {
    row.id = aliases.get(row.id) ?? row.id; row.parentId = aliases.get(row.parentId) ?? row.parentId;
    row.childIds = row.childIds.map((id: string) => aliases.get(id) ?? id);
  }
  assert.equal(verifyNativeContractComparisonReadback(input, rebased).status, 'supported-comparison-structure-observed');
  rebased.content.nodes.find((n: any) => n.type === 'TEXT').metadata.nativeSourceAllocation = 'forged';
  assert.equal(verifyNativeContractComparisonReadback(input, rebased).status, 'refused');
  assert.equal((await f.run(f.emit())).allocationAttempted, false, 'repeat must not create another composition');
  const changed = structuredClone(receipt);
  changed.content.nodes.find((n: any) => n.id === records[1].instanceId).mainId = f.comparison.parent.creation.variants[0].id;
  assert.equal(verifyNativeContractComparisonReadback(input, changed).status, 'refused');
  const wrongContent = structuredClone(receipt);
  wrongContent.content.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'Lost caller text';
  assert.equal(verifyNativeContractComparisonReadback(input, wrongContent).status, 'refused');
  const wrongTokens = structuredClone(receipt);
  wrongTokens.content.nodes.find((n: any) => n.id === records[1].instanceId).values.explicitVariableModes = {};
  assert.equal(verifyNativeContractComparisonReadback(input, wrongTokens).status, 'refused');
  const omitted = structuredClone(input); omitted.creation.comparisons[0].nested.pop();
  assert.equal(verifyNativeContractComparisonReadback(omitted, receipt).status, 'refused');
  const changedMain = await f.figma.getNodeByIdAsync(f.reference.parent.creation.variants[0].id);
  changedMain.name = 'Native child changed after creation';
  const changedRead = await f.run(emitNativeContractComparisonReadbackScript(input));
  assert.equal(verifyNativeContractComparisonReadback(input, changedRead).status, 'refused');
});

test('nested references require pinned same-source mains and complete paths before allocation', async () => {
  const f = await nestedFixture();
  for (const mutate of [
    (c: NativeContractComparisonInput) => { c.instances![0].specPath = [99]; },
    (c: NativeContractComparisonInput) => { c.instances![0].specPath = [1]; },
    (c: NativeContractComparisonInput) => { c.instances![0].specPath = [0, 0, 0]; },
    (c: NativeContractComparisonInput) => { c.instances![0].parent.operation.fileKey = 'wrong-file'; },
    (c: NativeContractComparisonInput) => { c.instances![0].parent.projection.source.programSha256 = 'f'.repeat(64); },
    (c: NativeContractComparisonInput) => { c.instances![0].slotSpecPath = []; },
    (c: NativeContractComparisonInput) => { c.instances![0].receipt.nodes!.find(n => n.type === 'COMPONENT')!.metadata.nativeContractPart = '{}'; },
  ]) {
    const changed = structuredClone(f.selected); mutate(changed);
    assert.throws(() => f.engine.buildNativeContractComparisonScript(f.content, new Map([[f.content.id, f.content]]), f.source, f.supplemental, changed), /native-contract-comparison-/);
  }
  const script = f.emit();
  const count = f.figma.root.findAll(() => true).length;
  (await f.figma.getNodeByIdAsync(f.reference.parent.creation.variants[0].id)).name = 'Designer changed the main';
  const result = await f.run(script);
  assert.equal(result.status, 'refused'); assert.equal(result.allocationAttempted, false);
  assert.equal(f.figma.root.findAll(() => true).length, count);
});


test('root grid comparisons fill the verified content frame and independently check placements and gap bindings', async () => {
  const f=await observedFixture(true), {input,receipt}=f;
  assert.equal(input.creation.status,'created-candidate',JSON.stringify(input.creation));
  assert.deepEqual(input.comparison.contentSpecPath,[0,0]);
  const report=verifyNativeContractComparisonReadback(input,receipt);
  assert.equal(report.status,'supported-comparison-structure-observed',JSON.stringify(report));
  const slot=await f.figma.getNodeByIdAsync(input.creation.comparisons[0].slots[0].nodeId);
  const grid=slot.children[0];
  assert.equal(slot.children.length,1);assert.equal(grid.layoutMode,'GRID');assert.equal(grid.children.length,2);
  const main=await f.figma.getNodeByIdAsync(input.comparison.mainId);
  assert.equal(main.children[0].children[0].children.length,0,'comparison does not fill main defaults');
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.comparison.parent)),f.comparison.receipt);
  for(const change of [
    (r:any)=>{r.content.nodes.find((n:any)=>n.id===grid.id).values.gridRowGap++;},
    (r:any)=>{r.content.nodes.find((n:any)=>n.id===grid.id).values.boundVariables.gridColumnGap={type:'VARIABLE_ALIAS',id:'wrong'};},
    (r:any)=>{r.content.nodes.find((n:any)=>n.id===grid.children[1].id).values.gridColumnAnchorIndex=0;},
    (r:any)=>{r.content.nodes.find((n:any)=>n.id===grid.children[0].id).values.gridRowSpan=2;},
  ]) {const bad=structuredClone(receipt);change(bad);assert.equal(verifyNativeContractComparisonReadback(input,bad).status,'refused');}
  const count=f.figma.root.findAll(()=>true).length;
  assert.equal((await f.run(f.emit())).allocationAttempted,false);
  assert.equal(f.figma.root.findAll(()=>true).length,count,'repeat creates no duplicate');
  const overflow=structuredClone(f.content), label=overflow.anatomy.root.parts!.label;
  for(let i=0;i<4;i++)overflow.anatomy.root.parts!['extra'+i]={...label,text:'Extra '+i};
  assert.throws(()=>f.emit(overflow),/grid-content-placement-unqualified/,'implicit extra rows cannot be invented');
});


test('managed content materializes intrinsic flow rows without changing the reusable main', async () => {
  const f = await observedFixture('flow'), { input, receipt } = f;
  const report = verifyNativeContractComparisonReadback(input, receipt);
  assert.equal(report.status, 'supported-comparison-structure-observed', JSON.stringify(report));
  const slot = await f.figma.getNodeByIdAsync(input.creation.comparisons[0].slots[0].nodeId);
  const grid = slot.children[0];
  assert.equal(grid.gridRowCount, 2);
  const main = await f.figma.getNodeByIdAsync(input.comparison.mainId);
  assert.equal(main.children[0].children[0].gridRowCount, 1);
  assert.equal(main.children[0].children[0].children.length, 0);
  for (const mutate of [(v:any)=>{v.gridRowCount=1},(v:any)=>{v.gridRowSizes[1]={type:'FIXED',value:20}}]) {
    const bad = structuredClone(receipt); mutate(bad.content.nodes.find((n:any)=>n.id===grid.id).values);
    assert.equal(verifyNativeContractComparisonReadback(input,bad).status,'refused');
  }
  const missingRecipe=structuredClone(receipt);
  delete missingRecipe.content.nodes.find((n:any)=>n.id===grid.id).metadata.gridFlowRows;
  assert.equal(verifyNativeContractComparisonReadback(input,missingRecipe).status,'refused');
  const extra = structuredClone(f.content);
  for(let i=0;i<4;i++)extra.anatomy.root.parts!['extra'+i]={...extra.anatomy.root.parts!.label,text:'Extra '+i};
  const data=f.engine.compileComponentData(extra,new Map([[extra.id,extra]]));
  const plan=prepareNativeContractComparison(extra,data,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},f.comparison);
  assert.equal(plan.contentRows?.length,6);
  const count=f.figma.root.findAll(()=>true).length;
  assert.equal((await f.run(f.emit())).allocationAttempted,false);
  assert.equal(f.figma.root.findAll(()=>true).length,count);
});
