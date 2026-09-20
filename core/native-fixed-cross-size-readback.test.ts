import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeUpdateFixture } from './native-contract-update-test-fixture.js';
import { emitNativeContractReadbackScript, emitNativeFixedCrossSizeSyncReadback, verifyNativeContractReadback } from './native-source-observation.js';

test('explicit cross-axis readback captures actual layout facts while historical readback stays unchanged', async () => {
  const f = await nativeUpdateFixture(), before = structuredClone(f.input.before);
  const ids = before.creation.variants.map((v: any) => v.id);
  for (const id of ids) Object.assign(await f.figma.getNodeByIdAsync(id), {
    targetAspectRatio: null, layoutAlign: 'INHERIT', layoutGrow: 0,
    strokesIncludedInLayout: false, constraints: { horizontal: 'MIN', vertical: 'MIN' },
  });
  const historical = emitNativeContractReadbackScript(before);
  before.fixedCrossSizeReadback = { version: 1, nodeIds: ids };
  const script = emitNativeContractReadbackScript(before), read = await f.run(script);
  assert.equal(verifyNativeContractReadback(before, read).status, 'supported-structure-observed');
  for (const id of ids) {
    const row = read.nodes.find((n: any) => n.id === id);
    assert.equal(row.values.targetAspectRatio, null); assert.equal(row.values.layoutAlign, 'INHERIT');
    assert.equal(row.values.layoutGrow, 0); assert.equal(row.values.strokesIncludedInLayout, false);
    for (const field of ['targetAspectRatio','layoutAlign','layoutGrow','strokesIncludedInLayout','constraints']) {
      const missing = structuredClone(read); delete missing.nodes.find((n: any) => n.id === id).values[field];
      assert.equal(verifyNativeContractReadback(before, missing).status, 'refused', field);
    }
  }
  const omitted = structuredClone(before); delete omitted.fixedCrossSizeReadback;
  assert.equal(emitNativeContractReadbackScript(omitted), historical);
  assert.ok(!historical.includes('native-fixed-cross-size'));
  const root = await f.figma.getNodeByIdAsync(ids[0]); delete root.targetAspectRatio;
  const unavailable = await f.run(script);
  assert.equal(unavailable.status, 'refused');
  assert.ok(unavailable.problems.includes('native-fixed-cross-size-layout-unavailable:targetAspectRatio'));
});

test('the strict readback never accepts unowned, duplicate, unsupported or versionless scope', async () => {
  const f = await nativeUpdateFixture();
  for (const guard of [
    {version:1,nodeIds:[]}, {version:1,nodeIds:['unowned']},
    {version:1,nodeIds:[f.input.before.creation.pageId]},
    {version:1,nodeIds:[f.input.before.creation.variants[0].id,f.input.before.creation.variants[0].id]},
    {version:2,nodeIds:[f.input.before.creation.variants[0].id]},
  ]) {
    const before = structuredClone(f.input.before); before.fixedCrossSizeReadback = guard as any;
    assert.throws(() => emitNativeContractReadbackScript(before), /native-fixed-cross-size-readback-input-invalid/);
  }
});

test('the synchronous final sizing recheck yields nowhere and reads all current facts from warmed static APIs', async()=>{
  const f=await nativeUpdateFixture(),input=structuredClone(f.input.before);
  const nodes=new Map<string,any>();
  for(const row of input.creation.nodes)nodes.set(row.id,await f.figma.getNodeByIdAsync(row.id));
  const ids=input.creation.variants.map((v:any)=>v.id);
  for(const id of ids)Object.assign(nodes.get(id),{constraints:{horizontal:'MIN',vertical:'MIN'},targetAspectRatio:null,
    layoutAlign:'INHERIT',layoutGrow:0,strokesIncludedInLayout:false});
  input.fixedCrossSizeReadback={version:1,nodeIds:ids};
  const expected=await f.run(emitNativeContractReadbackScript(input));
  const collection=await f.figma.variables.getVariableCollectionByIdAsync(input.tokenIdentity.collection.id);
  const variables=new Map<string,any>();
  for(const row of input.tokenIdentity.variables)variables.set(row.id,await f.figma.variables.getVariableByIdAsync(row.id));
  f.figma.getNodeById=(id:string)=>nodes.get(id);
  f.figma.variables.getVariableCollectionById=(id:string)=>id===collection.id?collection:null;
  f.figma.variables.getVariableById=(id:string)=>variables.get(id);
  const forbidden=()=>{throw Error('unexpected asynchronous native API');};
  f.figma.loadAllPagesAsync=forbidden;f.figma.getNodeByIdAsync=forbidden;
  f.figma.variables.getVariableCollectionByIdAsync=forbidden;f.figma.variables.getVariableByIdAsync=forbidden;
  const script=emitNativeFixedCrossSizeSyncReadback(input);
  assert(!/\bawait\b/.test(script));
  const actual=await f.run(script);assert.deepEqual(actual,expected);
  assert.equal(verifyNativeContractReadback(input,actual).status,'supported-structure-observed');
  const root=nodes.get(ids[0]);root.name='independent name edit';root.opacity=.37;
  const changed=await f.run(script),row=changed.nodes.find((n:any)=>n.id===root.id);
  assert.equal(row.name,'independent name edit');assert.equal(row.values.opacity,.37);
  assert.notDeepEqual(changed,expected,'the final check reads unrelated live facts too');
  root.type='INSTANCE';root.getMainComponentAsync=forbidden;
  const instance=await f.run(script);assert.equal(instance.status,'refused');
  assert(instance.problems.includes('native-fixed-cross-size-sync-instance-unsupported'));
  const historical=structuredClone(input);delete historical.fixedCrossSizeReadback;
  assert.throws(()=>emitNativeFixedCrossSizeSyncReadback(historical),/sync-input-invalid/);
});
