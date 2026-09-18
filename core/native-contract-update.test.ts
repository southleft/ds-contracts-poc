import { nativeUpdateFixture as fixture } from './native-contract-update-test-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNativeUpdatePlans } from '../source-reference/native-update-plans.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, verifyNativeContractUpdate, nativeContractUpdateMatches, nativeContractUpdateAfter } from './native-contract-update.js';

async function shadowFixture() {
  const f = await fixture(), input = structuredClone(f.input);
  input.desired.component = structuredClone(input.before.component);
  for (const variant of input.desired.component.variants) variant.spec.effectStack = [
    { x: 0, y: 0, radius: 0, spread: 1, color: { r: 10/255, g: 10/255, b: 10/255, a: 0.1 } },
    { x: 0, y: 1, radius: 2, color: { r: 0, g: 0, b: 0, a: 0.05 } },
  ];
  return { ...f, input, plan: prepareNativeContractUpdate(input).plan };
}

test('root shadow correction preserves nodes, verifies complete stacks, repeats and rolls back', async () => {
  const f = await shadowFixture(), ids = f.figma.root.findAll(() => true).map((n:any)=>n.id);
  assert.equal(f.plan.kind, 'native-contract-shadow-update');
  const preflight = await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
  assert.equal(preflight.status,'preflight-observed',JSON.stringify(preflight.problems));
  const applied = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(verifyNativeContractUpdate(f.plan,applied.observation).status,'supported-structure-observed');
  assert.ok(nativeContractUpdateMatches(f.plan,applied.observation,true));
  const nativeFloats = structuredClone(applied.observation);
  for(const row of nativeFloats.nodes.filter((n:any)=>n.type==='COMPONENT')) for(const e of row.values.effects) {
    e.color.r=Math.fround(e.color.r);e.color.a=Math.fround(e.color.a);e.showShadowBehindNode=true;e.boundVariables={};
  }
  assert.ok(nativeContractUpdateMatches(f.plan,nativeFloats,true));
  nativeFloats.nodes.find((n:any)=>n.type==='COMPONENT').values.effects[0].color.a=0;
  assert.equal(nativeContractUpdateMatches(f.plan,nativeFloats,true),false);
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  assert.equal((await f.run(emitNativeContractUpdateScript(f.plan))).status,'no-op');
  const rollback=await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));
  assert.equal(rollback.status,'updated');assert.ok(nativeContractUpdateMatches(f.plan,rollback.observation));
});

test('shadow correction refuses concurrent edits, mixed changes and invalid effects', async () => {
  const f=await shadowFixture();
  const mixed=structuredClone(f.input);mixed.desired.component.variants[0].spec.opacity=0.8;
  assert.throws(()=>prepareNativeContractUpdate(mixed),/shadow-mixed-channels/);
  const invalid=structuredClone(f.input);invalid.desired.component.variants[0].spec.effectStack![0].color.a=2;
  assert.throws(()=>prepareNativeContractUpdate(invalid),/shadow-values-invalid/);
  f.nodes[0].effects=[{type:'LAYER_BLUR',radius:4,visible:true}];
  const refused=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(refused.status,'refused');assert.deepEqual(refused.changes,[]);
  assert.equal(f.nodes[0].effects[0].type,'LAYER_BLUR');
});

test('restored shadow refusals may change only the generated description count',async()=>{
  const f=await shadowFixture(),input=structuredClone(f.input);
  input.before.component.codeOnlyFacts=[{part:'root',kind:'shadow',channel:'box-shadow',value:'old unsupported stack',
    reason:'unsupported',variants:{count:2,of:2}}];
  input.before.component.description='Fixture † (1 code-only facts — see plugin report)';
  input.desired.component.codeOnlyFacts=[];input.desired.component.description='Fixture';
  const plan=prepareNativeContractUpdate(input).plan;
  assert.equal(plan.after.component.description,input.before.component.description);
  assert.deepEqual(plan.after.component.codeOnlyFacts,[]);
  input.desired.component.description='unrelated replacement';
  assert.throws(()=>prepareNativeContractUpdate(input),/shadow-description-change/);
});

test('shadow assignment failure restores attempted changes and preserves independent edits',async()=>{
  const f=await shadowFixture();let effects=f.nodes[1].effects;
  Object.defineProperty(f.nodes[1],'effects',{configurable:true,get:()=>effects,set:(next:any[])=>{
    if(next.length){f.nodes[0].name='independent rename';throw Error('effect assignment failed');}effects=next;
  }});
  const result=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status,'rolled-back',JSON.stringify(result.problems));
  assert.ok(f.nodes.every((n:any)=>n.effects.length===0));assert.equal(f.nodes[0].name,'independent rename');
});

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

// Found live on 2026-09-18: a source change to opacity 0.4 wrote the value, read
// back 0.4000000059604645, called that a conflict and then declined to roll back.
test('an opacity that float32 cannot hold exactly is written, verified, repeated and rolled back', async () => {
  const f = await fixture();
  // The Plugin API stores opacity as IEEE-754 float32.
  for (const node of f.nodes) {
    let value = Math.fround(node.opacity);
    Object.defineProperty(node, 'opacity', { get: () => value, set: next => { value = Math.fround(next); }, enumerable: true, configurable: true });
  }
  const input = structuredClone(f.input);
  input.baseline = await f.run((await import('./native-source-observation.js')).emitNativeContractReadbackScript(input.before));
  for (const variant of input.desired.component.variants) variant.spec.opacity = 0.4;
  const { plan } = prepareNativeContractUpdate(input);
  assert.ok(plan.kind === 'native-contract-opacity-update' && plan.changes.length && plan.changes.every(c => c.after === 0.4));
  const applied = await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(applied.status, 'updated', JSON.stringify(applied.problems));
  assert.ok(f.nodes.every(node => node.opacity === Math.fround(0.4) && node.opacity !== 0.4));
  assert.ok(nativeContractUpdateMatches(plan, applied.observation, true));
  assert.equal(verifyNativeContractUpdate(plan, applied.observation).status, 'supported-structure-observed');
  assert.equal((await f.run(emitNativeContractUpdateScript(plan))).status, 'no-op', 'the stored float32 value is already the target');
  // The next plan starts from the stored value and proposes nothing for it.
  assert.equal(prepareNativeContractUpdate({ ...input, baseline: applied.observation, before: nativeContractUpdateAfter(plan, applied.observation) }).plan.changes.length, 0);
  // A value that is neither side of the change is still a conflict.
  f.nodes[0].opacity = 0.41;
  assert.deepEqual((await f.run(emitNativeContractUpdateScript(plan, 'apply', true))).problems, ['native-update-opacity-conflict:' + f.nodes[0].id]);
  f.nodes[0].opacity = 0.4;
  const rolledBack = await f.run(emitNativeContractUpdateScript(plan, 'rollback'));
  assert.equal(rolledBack.status, 'updated', JSON.stringify(rolledBack.problems));
  assert.ok(f.nodes.every(node => node.opacity === 0.5));
});
