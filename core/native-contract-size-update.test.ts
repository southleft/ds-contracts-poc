import { nativeRootSizeUpdateFixture as fixture } from './native-contract-size-update-test-fixture.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, nativeContractUpdateMatches } from './native-contract-update.js';

test('zero root size repair preserves native identity, centered slot and untouched sizing; repeat and rollback', async () => {
  const f = await fixture(), ids = f.figma.root.findAll(() => true).map((n:any) => n.id), width=f.root.width;
  // An empty main slot keeps a 0.01 px seed so instances can be widened (§D.175); the hug root follows it.
  assert.deepEqual([width,f.root.height,f.slot.width,f.slot.height],[0.01,0,0.01,0]);
  assert.equal(f.plan.kind, 'native-contract-root-size-update');
  const preflight=await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
  assert.equal(preflight.status,'preflight-observed',JSON.stringify(preflight.problems));
  const applied=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(f.root.height,36); assert.equal(f.root.width,width); assert.equal(f.root.layoutSizingHorizontal,'HUG');
  assert.equal(f.slot.y,(36-f.slot.height)/2);
  assert.equal(nativeContractUpdateMatches(f.plan,applied.observation,true),true);
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  const repeat=await f.run(emitNativeContractUpdateScript(f.plan));assert.equal(repeat.status,'no-op');
  const rollback=await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));assert.equal(rollback.status,'updated',JSON.stringify(rollback.problems));
  assert.equal(nativeContractUpdateMatches(f.plan,rollback.observation),true);
  assert.deepEqual([f.root.width,f.root.height,f.slot.width,f.slot.height],[0.01,0,0.01,0]);
});
test('size repair refuses changed layout, manual geometry and populated content', async () => {
  const f=await fixture();
  f.root.paddingTop=2;
  const conflict=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(conflict.status,'refused');assert.deepEqual(conflict.changes,[]);
  const altered=structuredClone(f.input);altered.desired.component.variants[0].spec.layout!.counter='MAX';
  assert.throws(()=>prepareNativeContractUpdate(altered),/channel-change-unsupported/);
  const bound=structuredClone(f.input);bound.desired.component.variants[0].spec.fixedHeight={px:36,varName:'other'};
  assert.throws(()=>prepareNativeContractUpdate(bound),/channel-change-unsupported/);
  const content=structuredClone(f.input);content.before.component.variants[0].spec.children![0].slotDefault=[];
  content.baseline.nodes!.find((n: {id: string; childIds: string[]})=>n.id===f.slot.id)!.childIds=['foreign'];
  assert.throws(()=>prepareNativeContractUpdate(content),/baseline-required/);
});
test('size repair rolls back a failed postcondition without undoing an unrelated edit', async () => {
  const f=await fixture(), oldHeight=f.root.height, resize=f.root.resizeWithoutConstraints.bind(f.root);
  f.root.resizeWithoutConstraints=(width:number,height:number)=>{resize(width,height);if(height===36)f.root.name='manual edit';};
  const result=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status,'rolled-back',JSON.stringify(result.problems));assert.equal(f.root.height,oldHeight);
  assert.equal(f.root.name,'manual edit');
});

test('size repair restores a resize that throws after changing geometry', async () => {
  const f=await fixture(), oldHeight=f.root.height, resize=f.root.resizeWithoutConstraints.bind(f.root);
  f.root.resizeWithoutConstraints=(width:number,height:number)=>{resize(width,height);if(height===36)throw Error('native resize failure');};
  const result=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status,'rolled-back',JSON.stringify(result));
  assert.equal(f.root.height,oldHeight);assert.equal(f.root.layoutSizingVertical,'HUG');
});

test('empty baselines do not admit nonpositive or nonfinite target sizes', async () => {
  const f=await fixture();
  for(const height of [0,-1,NaN,Infinity]) {
    const input=structuredClone(f.input);input.desired.component.variants[0].spec.lits={height};
    assert.throws(()=>prepareNativeContractUpdate(input),Number.isFinite(height)
      ? /native-update-size-target-unqualified/ : /native-update-channel-change-unsupported/);
  }
});

// Figma stores node positions as float32; model that here (docs/23 D.175).
const storedX = (f: any, factor: number) => Object.defineProperty(f.slot, 'x', { configurable: true,
  get: () => Math.fround((f.root.width - f.slot.width) * factor) });

test('both literal axes repair together and preserve centered empty content', async () => {
  const f=await fixture();
  // An operation created before the D.175 seed: its empty slot is exactly 0,
  // so every centered offset is exact.
  f.slot.resizeWithoutConstraints(0, f.slot.height);
  f.root.primaryAxisAlignItems='CENTER';
  f.input.before.component.variants[0].spec.layout!.primary='CENTER';
  f.input.desired.component.variants[0].spec.layout!.primary='CENTER';
  storedX(f, 0.5);
  f.input.baseline=await f.run(emitNativeContractReadbackScript(f.input.before));
  f.input.desired.component.variants[0].spec.lits={width:40,height:36};
  const {plan}=prepareNativeContractUpdate(f.input);
  assert.equal(plan.changes.length,2);
  const applied=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(f.root.width,40);assert.equal(f.root.height,36);
  assert.equal(f.slot.x,20);assert.equal(f.slot.y,(36-f.slot.height)/2);
  assert.equal(nativeContractUpdateMatches(plan,applied.observation,true),true);
  const rolled=await f.run(emitNativeContractUpdateScript(plan,'rollback'));
  assert.equal(rolled.status,'updated',JSON.stringify(rolled.problems));
  assert.equal(nativeContractUpdateMatches(plan,rolled.observation),true);
});

test('a centered or end-aligned seeded slot refuses a width it cannot predict, before any write', async () => {
  for (const [alignment, factor] of [['CENTER', 0.5], ['MAX', 1]] as const) {
    const f=await fixture();
    f.root.primaryAxisAlignItems=alignment;
    f.input.before.component.variants[0].spec.layout!.primary=alignment;
    f.input.desired.component.variants[0].spec.layout!.primary=alignment;
    storedX(f, factor);
    f.input.baseline=await f.run(emitNativeContractReadbackScript(f.input.before));
    assert.equal(f.root.width, 0.01, 'the hug root follows the D.175 seed');
    f.input.desired.component.variants[0].spec.lits={width:40};
    // (40 - 0.01) * factor is not a float32, so Figma could never store it and
    // would roll the write back; the planner names that before writing.
    assert.throws(()=>prepareNativeContractUpdate(f.input),/native-update-size-numeric-domain-unqualified/, alignment);
    assert.equal(f.root.width, 0.01, alignment);
  }
  // Height has no seed, so a centered height stays exact and prepares.
  const f=await fixture();
  assert.equal(f.plan.kind,'native-contract-root-size-update');
});

test('a seeded empty slot does not raise the content floor', async () => {
  const f=await fixture({ 'padding-left': '8px', 'padding-right': '8px' });
  f.input.baseline=await f.run(emitNativeContractReadbackScript(f.input.before));
  assert.equal(f.root.width, 16.01, 'padding plus the D.175 seed');
  const lits=f.input.before.component.variants[0].spec.lits;
  f.input.desired.component.variants[0].spec.lits={...lits,width:16};
  // React draws the empty slot at 0, so 16 px is exactly the padding: it fits.
  const {plan}=prepareNativeContractUpdate(f.input);
  const applied=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(f.root.width,16);
  assert.equal(nativeContractUpdateMatches(plan,applied.observation,true),true);
  const rolled=await f.run(emitNativeContractUpdateScript(plan,'rollback'));
  assert.equal(rolled.status,'updated',JSON.stringify(rolled.problems));
  f.input.desired.component.variants[0].spec.lits={...lits,width:15};
  assert.throws(()=>prepareNativeContractUpdate(f.input),/native-update-size-content-overflow/);
});
