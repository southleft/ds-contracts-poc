import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript, type NativeContractObservationInput} from './native-source-observation.js';
import {prepareNativeContractUpdate, type NativeContractUpdateInput, type NativeOpacityUpdatePlan} from './native-contract-update.js';
import {prepareNativeBoundCrossSizeUpdate} from './native-contract-bound-cross-size-update.js';
import {nativeBoundCrossSizeObservationMatches} from './native-bound-cross-size-observation.js';

const base=(input:NativeContractUpdateInput)=>{
  const result=prepareNativeContractUpdate(input);
  assert.equal(result.plan.kind,'native-contract-opacity-update');
  return result as {plan:NativeOpacityUpdatePlan;revision:string};
};
async function fixture(channel:'width'|'height',absolute:boolean) {
  const f=await nativeComparisonFixture(), horizontal=channel==='height';
  const contract=f.contract('fixture.bound-cross-size',{root:{
    layout:{display:'flex',direction:horizontal?'row':'column',align:'center'},
    declared:{position:'relative'}, tokens:{[channel]:'{size}'},literals:{[horizontal?'width':'height']:'32px'},
    parts:{flow:{shape:{kind:'rect',width:6,height:6},tokens:{'background-color':'{surface}'}},
      absolute:{shape:{kind:'rect',width:20,height:20},declared:{position:'absolute'},literals:{left:'-3px',top:'-3px','background-color':'transparent'}}},
  }});
  contract.props=[{name:'tone',type:{enum:['a','b']},default:'a',bindings:{code:{prop:'tone'},figma:{kind:'VARIANT',property:'Tone'}}}];
  const byId=new Map([[contract.id,contract]]),compiled=f.engine.compileNativeContractDraft(contract,byId,f.source);
  const context=await f.context('40000000-0000-4000-8000-000000000089');
  const creation=await f.run(f.engine.buildNativeContractDraftScript(contract,byId,f.source,context));
  assert.equal(creation.status,'created-candidate');
  const strictIds=creation.nodes.filter((n:any)=>['COMPONENT','FRAME','RECTANGLE','ELLIPSE'].includes(n.type)).map((n:any)=>n.id);
  // Explicit synthetic API facts. This fixture does not simulate native layout
  // propagation; the separate measured matrix is the evidence for prediction.
  for(const id of strictIds){const node=await f.figma.getNodeByIdAsync(id);
    Object.assign(node,{targetAspectRatio:null,constraints:{horizontal:'MIN',vertical:'MIN'},layoutAlign:'INHERIT',layoutGrow:0,
      strokesIncludedInLayout:false,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',
      minWidth:null,maxWidth:null,minHeight:null,maxHeight:null});
    Object.defineProperty(node,'relativeTransform',{get(){return [[1,0,this.x],[0,1,this.y]];}});
  }
  for(const variant of creation.variants){const root=await f.figma.getNodeByIdAsync(variant.id);
    Object.assign(root,{primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED',layoutWrap:'NO_WRAP',
      strokeTopWeight:0,strokeRightWeight:0,strokeBottomWeight:0,strokeLeftWeight:0,
      resolvedVariableModes:{[context.tokens.identity.collection.id]:context.tokens.identity.modes[0].modeId}});
    const flow=root.children[0];flow[horizontal?'y':'x']=4;
  }
  const before:NativeContractObservationInput={operation:context.operation,planRevision:revisionOf(contract),
    component:compiled.component,projection:compiled.projection,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,
    creation,fixedCrossSizeReadback:{version:1,nodeIds:strictIds}};
  const baseline=await f.run(emitNativeContractReadbackScript(before));
  const tokens=structuredClone(f.tokens);tokens.size.$value='20px';
  const nextContract=structuredClone(contract);
  if(absolute)nextContract.anatomy.root.parts!.absolute.shape![channel]=26;
  const next=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(f.assets)})
    .compileNativeContractDraft(nextContract,new Map([[nextContract.id,nextContract]]),f.source);
  const input:NativeContractUpdateInput={before,baseline,desired:{component:next.component,revision:revisionOf(next),
    tokenInput:{...structuredClone(before.tokenInput),modes:[{...before.tokenInput.modes[0],tokens,tokenTreeRevision:revisionOf(tokens)}]}}};
  return {input};
}

test('bound cross-size planning compiles both orientations, coupled geometry, optional absolute correction and exact reverse history',async()=>{
  for(const channel of ['width','height'] as const)for(const absolute of [false,true]){
    const {input}=await fixture(channel,absolute),original=structuredClone(input);
    const prepared=prepareNativeBoundCrossSizeUpdate(input,base)!;
    assert.deepEqual(input,original,'planning cannot mutate the saved observation or desired source');
    assert.equal(prepared.plan.version,8);assert.equal(prepared.plan.scope.channel,channel);
    assert.equal(prepared.plan.scope.nodeIds.length,2);
    assert.equal(prepared.plan.derived.length,4);assert.equal(prepared.plan.absolute.length,2*Number(absolute));
    assert.equal(prepared.plan.after.tokenInput.allocatedValueProtocol,'px-dimension-v1');
    assert.deepEqual(prepared.plan.after.tokenIdentity,input.before.tokenIdentity);
    assert(nativeBoundCrossSizeObservationMatches(prepared.plan,input.baseline,'before'));
    const expected=structuredClone(prepared.plan.baseline);
    for(const t of [...prepared.plan.derived,...prepared.plan.absolute])Object.assign(expected.nodes!.find(n=>n.id===t.nodeId)!.values,t.after);
    expected.tokens!.receipt!.variables.find((v:any)=>v.id===prepared.plan.variable.id)!.valuesByMode[prepared.plan.variable.modeId]=20;
    assert(nativeBoundCrossSizeObservationMatches(prepared.plan,expected,'after'));
    const reversed=prepareNativeBoundCrossSizeUpdate({before:prepared.plan.after,baseline:expected,
      desired:{component:input.before.component,revision:revisionOf('reverse'),tokenInput:input.before.tokenInput}},base)!;
    assert.equal(reversed.plan.after.tokenInput.allocatedValues,undefined);
    assert.equal(reversed.plan.after.tokenInput.allocatedValueProtocol,undefined);
    assert.deepEqual(reversed.plan.after.tokenInput,input.before.tokenInput);
    assert.deepEqual(reversed.plan.after.tokenIdentity,input.before.tokenIdentity);
  }
});

test('bound cross-size planning refuses missing evidence, unsupported roots, unrelated edits and inconsistent source values',async()=>{
  const {input}=await fixture('height',true),main=input.before.creation.variants[0].id;
  for(const edit of [
    (x:any)=>{delete x.before.fixedCrossSizeReadback;},
    (x:any)=>{x.before.fixedCrossSizeReadback.nodeIds=[main];},
    (x:any)=>{x.desired.component.variants[0].spec.opacity=.5;},
    (x:any)=>{x.desired.component.variants[0].spec.fixedHeight.px=21;},
    (x:any)=>{x.desired.component.variants[1].spec.fixedHeight.px=14;},
    (x:any)=>{x.desired.component.variants[0].spec.fixedHeight.varName='other';},
    (x:any)=>{x.desired.tokenInput.modes[0].tokens.size.$value='1.25rem';},
    (x:any)=>{x.desired.tokenInput.modes[0].tokens.surface.$value='#ff0000';},
    (x:any)=>{x.desired.tokenInput.tokenPaths.push('new');},
    (x:any)=>{x.baseline.nodes.find((n:any)=>n.id===main).values.targetAspectRatio=2;},
    (x:any)=>{delete x.baseline.nodes.find((n:any)=>n.id===main).values.strokesIncludedInLayout;},
    (x:any)=>{x.baseline.nodes.find((n:any)=>n.id===main).values.resolvedVariableModes={};},
    (x:any)=>{x.baseline.nodes.find((n:any)=>n.id===main).values.paddingTop=.1;},
    (x:any)=>{x.before.creation.variants[0].id='foreign';},
  ]){const changed=structuredClone(input);edit(changed);assert.throws(()=>prepareNativeBoundCrossSizeUpdate(changed,base));}
  const unchanged=structuredClone(input);unchanged.desired.component=structuredClone(input.before.component);
  assert.equal(prepareNativeBoundCrossSizeUpdate(unchanged,base),null,'unchanged fixed bindings do not intercept existing update kinds');
});
