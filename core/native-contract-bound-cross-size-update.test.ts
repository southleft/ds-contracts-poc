import assert from 'node:assert/strict';
import test from 'node:test';
import {revisionOf} from './contract-provenance.js';
import {prepareNativeContractUpdate, type NativeContractUpdateInput, type NativeOpacityUpdatePlan} from './native-contract-update.js';
import {prepareNativeBoundCrossSizeUpdate} from './native-contract-bound-cross-size-update.js';
import {nativeBoundCrossSizeObservationMatches} from './native-bound-cross-size-observation.js';

import {boundCrossSizeFixture as fixture} from './native-contract-bound-cross-size-test-fixture.js';

const base=(input:NativeContractUpdateInput)=>{
  const result=prepareNativeContractUpdate(input);
  assert.equal(result.plan.kind,'native-contract-opacity-update');
  return result as {plan:NativeOpacityUpdatePlan;revision:string};
};

test('bound cross-size planning compiles both orientations, coupled geometry, optional absolute correction and exact reverse history',async()=>{
  for(const channel of ['width','height'] as const)for(const absolute of [false,true]){
    const {input}=await fixture(channel,absolute),original=structuredClone(input);
    const prepared=prepareNativeBoundCrossSizeUpdate(input,base)!;
    assert.deepEqual(input,original,'planning cannot mutate the saved observation or desired source');
    assert.equal(prepared.plan.version,9);assert.equal(prepared.plan.scope.channel,channel);
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
