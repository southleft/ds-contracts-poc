import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeUpdatePlans } from '../source-reference/native-update-plans.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { emitNativeContractReadbackScript, type NativeContractObservationInput } from './native-source-observation.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, verifyNativeContractUpdate } from './native-contract-update.js';

async function fixture() {
  const { figma } = nativeFixtureHost(), proto = Object.getPrototypeOf(figma.currentPage);
  proto.setExplicitVariableModeForCollection = function(c: any, mode: string) { this.explicitVariableModes = { [c.id]: mode }; };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`, { figma, console }, { timeout: 5000 })));
  const tokens = { size: { $type: 'dimension', $value: '16px' }, opacity: { $type: 'number', $value: 0.5 } };
  const context = (t: Record<string,unknown>) => ({ tokens: { primitives: t, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map<string,string>() });
  const engine = createFigmaEngine(context(tokens));
  const contract = ContractSchema.parse({ id: 'fixture.update', name: 'Update', version: '0.1.0', status: 'draft', description: 'Bounded update fixture', states: [], semantics: { element: 'div' },
    props: [{ name: 'kind', type: { enum: ['a','b'] }, default: 'a', bindings: { code: { prop: 'kind' }, figma: { kind: 'VARIANT', property: 'Kind' } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, tokens: { width: '{size}', height: '{size}', opacity: '{opacity}' } } },
    bindings: { code: { anchors: { importPath: './fixture', export: 'Update' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const source = { revision: revisionOf('source'), programSha256: 'a'.repeat(64), evidenceRevision: revisionOf('evidence') };
  const byId = new Map([[contract.id,contract]]), compiled = engine.compileNativeContractDraft(contract, byId, source);
  const operation = { id: '10000000-0000-4000-8000-000000000008', fileKey: figma.fileKey };
  const tokenInput: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + operation.id,
    source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens, tokenTreeRevision: revisionOf(tokens) }] };
  const made = await run(emitNativeTokenContextScript(tokenInput).script), read = await run(emitNativeTokenContextReadbackScript(tokenInput, made.creationIdentity));
  const creation = await run(engine.buildNativeContractDraftScript(contract, byId, source, { operation, tokens: { input: tokenInput, identity: made.creationIdentity, receipt: read.receipt } }));
  assert.equal(creation.status,'created-candidate');
  const before: NativeContractObservationInput = { operation, planRevision: revisionOf('before'), component: compiled.component, projection: compiled.projection,
    tokenInput, tokenIdentity: made.creationIdentity, creation };
  const baseline = await run(emitNativeContractReadbackScript(before));
  const nextContract = structuredClone(contract); nextContract.anatomy.root.tokens!.opacity = '{nextOpacity}';
  const nextTokens = { ...tokens, nextOpacity: { $type: 'number', $value: 0.25 } };
  const nextEngine = createFigmaEngine(context(nextTokens)), next = nextEngine.compileNativeContractDraft(nextContract, new Map([[nextContract.id,nextContract]]), source);
  const desired = { component: next.component, revision: revisionOf(next), tokenInput: { ...tokenInput, modes: [{ ...tokenInput.modes[0], tokens: nextTokens }] } };
  const input = { before, baseline, desired }, { plan } = prepareNativeContractUpdate(input);
  return { figma, run, input, plan, nodes: await Promise.all(creation.variants.map((v: any) => figma.getNodeByIdAsync(v.id))) };
}

test('owned scalar update preserves identities, verifies, repeats without writes, and rolls back', async () => {
  const f = await fixture(), ids = f.figma.root.findAll(() => true).map((n:any)=>n.id);
  assert.equal(f.plan.changes.length,2);
  const preflight = await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
  assert.equal(preflight.status,'preflight-observed'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
  const applied = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(verifyNativeContractUpdate(f.plan,applied.observation).status,'supported-structure-observed');
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.25));
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  const repeat = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(repeat.status,'no-op'); assert.deepEqual(repeat.changes,[]);
  const rollback = await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));
  assert.equal(rollback.status,'updated'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
  assert.equal(verifyNativeContractUpdate(f.plan,rollback.observation,'rollback').status,'supported-structure-observed');
});

test('updates refuse changed live fields and unsupported desired channels before any write', async () => {
  const f = await fixture();
  const changed = structuredClone(f.input); changed.desired.component.variants[0].spec.fixedWidth!.px = 17;
  assert.throws(()=>prepareNativeContractUpdate(changed),/channel-change-unsupported/);
  const changedTokens = structuredClone(f.input); changedTokens.desired = structuredClone(f.input.desired);
  (changedTokens.desired.tokenInput.modes[0].tokens as any).size.$value = '17px';
  assert.throws(()=>prepareNativeContractUpdate(changedTokens),/token-change-unsupported/);
  for (const field of ['opacity','width','name']) {
    const previous = f.nodes[0][field]; f.nodes[0][field] = field === 'name' ? 'manual edit' : field === 'opacity' ? 0.75 : 30;
    const result = await f.run(emitNativeContractUpdateScript(f.plan));
    assert.equal(result.status,'refused'); assert.deepEqual(result.changes,[]); assert.equal(f.nodes[1].opacity,0.5);
    f.nodes[0][field] = previous;
  }
  f.figma.fileKey='DifferentAuthorizedFile';
  const wrongFile=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(wrongFile.status,'refused'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
});

test('a partial application can be inspected and resumed, while assignment failure restores attempted nodes', async () => {
  const f = await fixture(); f.nodes[0].opacity = 0.25;
  const read = await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
  assert.equal(read.status,'preflight-observed'); assert.deepEqual(read.states.map((s:any)=>s.value),[0.25,0.5]);
  const resumed = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(resumed.status,'updated'); assert.deepEqual(resumed.changes,[f.nodes[1].id]);
  await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));
  let value = f.nodes[1].opacity;
  Object.defineProperty(f.nodes[1],'opacity',{get:()=>value,set:(next:number)=>{ if(next===0.25) throw Error('native assignment failed'); value=next; },configurable:true});
  const failed = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(failed.status,'rolled-back'); assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
});

test('host update proposals reopen unchanged and reject drift, path substitution and altered records', async t => {
  const f=await fixture(),repo=mkdtempSync(path.join(tmpdir(),'native-update-plan-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const parentId=f.input.before.operation.id;
  let journal='a'.repeat(64);
  const store=()=>createNativeUpdatePlans(repo,()=>({parentJournalRevision:journal,input:f.input}));
  const first=store().prepare(parentId);
  assert.deepEqual(store().prepare(parentId),first);
  assert.deepEqual(store().list(parentId),[first]);
  assert.equal(store().current(parentId,first.id).update.plan.changes.length,2);
  journal='b'.repeat(64);
  assert.throws(()=>store().current(parentId,first.id),/input-changed/);
  assert.throws(()=>store().list('../outside'),/parent-invalid/);
  journal='a'.repeat(64);
  const file=path.join(repo,'private/source-native-update-plans',parentId,first.id+'.json');
  const altered=JSON.parse(readFileSync(file,'utf8')); altered.update.plan.changes[0].after=0;
  writeFileSync(file,JSON.stringify(altered));
  assert.throws(()=>store().current(parentId,first.id),/plan-changed/);
  assert.throws(()=>store().prepare(parentId),/plan-changed/);
});

test('a failed postcondition restores only the attempted opacity changes and preserves other edits', async () => {
  const f=await fixture(),originalWidth=f.nodes[1].width;
  let opacity=f.nodes[0].opacity;
  Object.defineProperty(f.nodes[0],'opacity',{get:()=>opacity,set:(value:number)=>{
    opacity=value; if(value===0.25) f.nodes[1].width=originalWidth+1;
  },configurable:true});
  const result=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status,'rolled-back');
  assert.ok(result.problems.includes('native-update-postcondition-conflict'));
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
  assert.equal(f.nodes[1].width,originalWidth+1);
});
