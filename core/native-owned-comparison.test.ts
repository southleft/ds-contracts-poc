import {nativeOwnedComparisonFixture as fixture} from './native-owned-comparison-test-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';
import { revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import { prepareNativeContractComparison, type NativeContractComparisonInput } from './native-contract-comparison.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback } from './native-contract-comparison-observation.js';


for(const wrapped of [false,true]) test(`source-owned child preserves fixed sizing and per-descendant modes (wrapped=${wrapped})`,async()=>{
  const f=await fixture(wrapped);
  const creation=await f.run(f.emit());
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const record=creation.comparisons[0].nested[0];
  assert.deepEqual(record.slots,[]);
  const child=await f.figma.getNodeByIdAsync(record.instanceId);
  assert.equal((await child.getMainComponentAsync()).id,f.comparison.instances![0].mainId);
  assert.equal(child.findAll((n:any)=>n.type==='TEXT').length,0);
  const input={operation:f.supplemental.operation,planRevision:revisionOf('owned comparison'),comparison:f.comparison,
    tokenInput:f.supplemental.tokens.input,tokenIdentity:f.supplemental.tokens.identity,creation};
  const read=()=>f.run(emitNativeContractComparisonReadbackScript(input));
  const receipt=await read();
  assert.equal(verifyNativeContractComparisonReadback(input,receipt).status,'supported-comparison-structure-observed',JSON.stringify(verifyNativeContractComparisonReadback(input,receipt)));
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.parent)),f.receipt);
  for(const field of ['width','height']){
    const changed=structuredClone(receipt);changed.content.nodes.find((n:any)=>n.id===child.id).values[field]+=1;
    assert.equal(verifyNativeContractComparisonReadback(input,changed).status,'refused');
  }
  const descendant=child.children[0], oldX=descendant.x;descendant.x+=2;
  assert.equal(verifyNativeContractComparisonReadback(input,await read()).status,'refused');descendant.x=oldX;
  const changed=structuredClone(creation);changed.comparisons[0].nested[0].slots=[{}];
  assert.equal(verifyNativeContractComparisonReadback({...input,creation:changed},receipt).status,'refused');
});

test('source-owned references reject slots, overlap and changed native baselines before allocation',async()=>{
  const f=await fixture();
  const slot={...f.selected,instances:[{...f.selected.instances![0],parent:f.comparison.parent,receipt:f.comparison.receipt,
    variantName:f.comparison.variantName}]};
  assert.throws(()=>f.emit(slot),/source-owned-main-unqualified/);
  const overlap=structuredClone(f.selected);overlap.instances!.push({...overlap.instances![0],specPath:[0,0]});
  assert.throws(()=>f.emit(overlap),/nested-main-path-missing/);
  const changed=structuredClone(f.selected);changed.instances![0].receipt.nodes!.find(n=>n.type==='COMPONENT')!.values.opacity=0.25;
  assert.throws(()=>f.emit(changed),/nested-main-observation-required/);
});
