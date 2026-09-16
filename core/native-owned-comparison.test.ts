import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';
import { revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import { prepareNativeContractComparison, type NativeContractComparisonInput } from './native-contract-comparison.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback } from './native-contract-comparison-observation.js';

async function fixture() {
  const f = await nativeComparisonFixture();
  const child = f.contract('fixture.owned', {root: {layout: {display:'inline-flex',direction:'row'}, literals:{width:'32px',height:'32px'}, parts:{
    indicator:{icon:{asset:'check',size:16},tokens:{color:'{ink}'}},
  }}});
  const context = await f.context('10000000-0000-4000-8000-000000000003');
  const data = f.engine.compileNativeContractDraft(child,new Map([[child.id,child]]),f.source);
  const creation = await f.run(f.engine.buildNativeContractDraftScript(child,new Map([[child.id,child]]),f.source,context));
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const parent: NativeContractObservationInput = {operation:context.operation,planRevision:revisionOf('owned'),
    projection:data.projection,component:data.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
  const receipt = await f.run(emitNativeContractReadbackScript(parent));
  assert.equal(verifyNativeContractReadback(parent,receipt).status,'supported-structure-observed');
  const content = f.contract('fixture.content',{root:{layout:{display:'flex',direction:'row'},parts:{
    owned:{layout:{display:'flex',direction:'row'},parts:{ignored:{text:'Do not duplicate internal content'}}},
  }}});
  const selected: NativeContractComparisonInput = {...f.comparison,instances:[{specPath:[0],parent,receipt,
    variantName:data.component.variants[0].name,slotSpecPath:[],contentMode:'source-owned'}]};
  const component = f.engine.compileComponentData(content,new Map([[content.id,content]]));
  const comparison = prepareNativeContractComparison(content,component,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},selected);
  const emit = (input = selected) => f.emit(content,input);
  return {...f,selected,comparison,emit,parent,receipt};
}

test('source-owned child preserves its complete native subtree and main link without inserting caller content',async()=>{
  const f=await fixture();
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
