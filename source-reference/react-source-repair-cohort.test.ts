import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {revisionOf} from '../core/contract-provenance.js';
import {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';
import {repairCallerProfile,verifyRepairCallerFrames,type RepairCallerFrame} from './react-source-repair-cohort.js';
import type {ReactSourceRepairInput} from './react-source-repair-preview.js';
import type {SourceProfile} from './check.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const profile=(opacity='0.5'):SourceProfile=>({id:'toggle',provenance:'fixture',path:['button'],fontFamily:'Inter',requiredTokens:{},requiredStyles:{opacity,width:'16px'}});

function fixture(){
  const text='function Toggle() { return <button className="disabled:opacity-50"/>; }';
  const source={module:'toggle.tsx',exportName:'Toggle',sourceSha256:sha(text),span:{start:0,end:text.length}};
  const candidate=proposeReactOpacityUtilityEdits(text,source,{before:.5,after:.6})[0];
  const tree={tag:'button',classes:['disabled:opacity-50'],style:{opacity:'0.5',width:'16px'},pseudo:{},nodes:[]};
  const ownership={version:1,rendererVersions:['19.2.4'],components:[{id:'instance-0',source,props:{disabled:true},roots:['']}],nodes:[{path:'',tag:'button',nearestComponent:'instance-0'}],problems:[]};
  const fonts={version:1,treeRevision:revisionOf(tree),status:'observed',rows:[],problems:[]};
  const snapshot={tree,image:sha('before'),ownership,styleOrigin:{version:1,roots:[]},bounds:{width:16,height:16},descendantSizes:{version:1,nodes:[]},fonts,svg:{version:1,treeRevision:revisionOf(tree),status:'observed',rows:[],problems:[]}};
  const recorded={observation:{instanceId:'instance-0',source,axes:[],heldProps:{disabled:true},planned:1,problems:[],rows:[{id:'0',changes:{disabled:{kind:'set',value:true}},status:'observed',restored:true}]},snapshots:{'0':snapshot}} as unknown as ReactSourceRepairInput['recorded'];
  const plan={revision:revisionOf('plan'),changes:[{nodeId:'1:1',variant:'disabled=true',before:.5,after:.6}],candidates:[candidate]} as ReactSourceRepairInput['plan'];
  const variants=[{observation:'0',variant:'disabled=true'}];
  const behavior={instanceId:'instance-0',observation:{version:1,scope:'source-checkbox-interactions',status:'observed',role:'checkbox',problems:[],rows:['associated-label','space'].map(action=>({action,before:'false',after:'false',expected:'false',passed:true}))}};
  const before={caseId:'toggle',captured:{status:'captured',tree,sourcePngSha256:sha('before')},ownership,fonts,finite:[{instanceId:'instance-0',...recorded}],behavior:[behavior]} as unknown as RepairCallerFrame;
  const after=structuredClone(before);
  after.captured.tree!.classes=[candidate.edit.after];after.captured.tree!.style.opacity='0.6';after.captured.sourcePngSha256=sha('after');
  after.ownership.components[0].source.sourceSha256=candidate.afterSha256;
  after.fonts.treeRevision=revisionOf(after.captured.tree);
  const changed=after.finite[0];changed.observation.source.sourceSha256=candidate.afterSha256;
  changed.snapshots['0'].tree.classes=[candidate.edit.after];changed.snapshots['0'].tree.style.opacity='0.6';changed.snapshots['0'].image=sha('after');
  changed.snapshots['0'].ownership.components[0].source.sourceSha256=candidate.afterSha256;
  changed.snapshots['0'].fonts!.treeRevision=revisionOf(changed.snapshots['0'].tree);changed.snapshots['0'].svg.treeRevision=revisionOf(changed.snapshots['0'].tree);
  const peerTree={tag:'div',classes:[],style:{opacity:'1'},pseudo:{},nodes:[]};
  const peer={caseId:'other',captured:{status:'captured',tree:peerTree,sourcePngSha256:sha('peer')},ownership:{version:1,rendererVersions:['19.2.4'],components:[],nodes:[],problems:[]},fonts:{...fonts,treeRevision:revisionOf(peerTree)},finite:[],behavior:[]} as unknown as RepairCallerFrame;
  const old=[before,peer],now=[after,structuredClone(peer)];
  return {old,now,recorded,variants,plan,verify:()=>verifyRepairCallerFrames(['toggle','other'],old,now,recorded,variants,plan,0)};
}

test('all caller contexts preserve their own finite states, interactions and unrelated pixels',()=>{
  const f=fixture(),result=f.verify();
  assert.equal(result.cases.length,2);assert.equal(result.cases[0].changedRoots,1);assert.equal(result.cases[0].finite[0].rows.length,1);
  assert.equal(result.cases[1].beforeImage,result.cases[1].afterImage);
  const original=profile(),derived=repairCallerProfile(original,f.old[0],f.recorded,f.variants,f.plan,0);
  assert.equal(derived.requiredStyles?.opacity,'0.6');assert.equal(original.requiredStyles?.opacity,'0.5');
  assert.deepEqual({...derived,requiredStyles:original.requiredStyles},original);
});

test('missing callers, finite states or interaction coverage cannot qualify a source write',()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>f.now.pop(),
    (f:ReturnType<typeof fixture>)=>f.now.reverse(),
    (f:ReturnType<typeof fixture>)=>f.now[0].finite.pop(),
    (f:ReturnType<typeof fixture>)=>f.now[0].behavior.pop(),
    (f:ReturnType<typeof fixture>)=>f.recorded.observation.rows.pop(),
  ]){const f=fixture();mutate(f);assert.throws(f.verify,/inventory|coverage|domain/);}
});

test('agreeing records cannot omit a control action or an unchanged native state',()=>{
  const f=fixture();f.old[0].behavior[0].observation.rows.pop();f.now[0].behavior[0].observation.rows.pop();
  assert.throws(f.verify,/behavior-changed/);
  const missing=fixture(),extra=structuredClone(missing.recorded.observation.rows[0]);
  missing.old[0].finite[0].observation=structuredClone(missing.old[0].finite[0].observation);
  extra.id='1';extra.changes={disabled:{kind:'set',value:false}};
  missing.recorded.observation.rows.push(extra);missing.variants.push({observation:'1',variant:'disabled=false'});
  // Keep the actual caller records internally consistent but incomplete.
  assert.throws(missing.verify,/caller-domain-incomplete/);
});

test('unrelated styling, fonts, source identity, caller pixels and interactions remain exact',()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.now[1].captured.tree!.style.opacity='0';},
    (f:ReturnType<typeof fixture>)=>{f.now[0].captured.tree!.style.width='17px';},
    (f:ReturnType<typeof fixture>)=>{f.now[1].captured.sourcePngSha256=sha('changed');},
    (f:ReturnType<typeof fixture>)=>{f.now[0].ownership.components[0].props.disabled=false;},
    (f:ReturnType<typeof fixture>)=>{f.now[0].ownership.components[0].source.sourceSha256=sha('wrong-source');},
    (f:ReturnType<typeof fixture>)=>{f.now[0].fonts.problems.push('missing-font');},
    (f:ReturnType<typeof fixture>)=>{f.now[0].behavior[0].observation.rows[0].after='true';},
  ]){const f=fixture();mutate(f);assert.throws(f.verify);}
});

test('unmapped caller inputs, an unrelated root utility and a conflicting original witness refuse',()=>{
  const absent=fixture();absent.old[0].ownership.components[0].props.disabled='unsupported';assert.throws(absent.verify,/caller-state-unmapped/);
  const utility=fixture();utility.old[0].captured.tree!.classes=['opacity-50'];assert.throws(utility.verify,/root-class-unavailable/);
  const f=fixture();assert.throws(()=>repairCallerProfile(profile('0.4'),f.old[0],f.recorded,f.variants,f.plan,0),/original-witness-mismatch/);
});
