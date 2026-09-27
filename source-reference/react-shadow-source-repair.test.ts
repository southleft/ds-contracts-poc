import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {nativeDesignChanges} from '../core/native-design-changes.js';
import {revisionOf} from '../core/contract-provenance.js';
import {planReactDesignSourceRepair,planReactShadowSourceRepair} from './react-design-source-repair.js';
import {proposeReactShadowUtilityEdits,type NativeShadowEffect} from './react-utility-source-edit.js';
import {verifyReactSourceRepairStates,type RepairStateObservation} from './react-source-repair-observation.js';
import {repairShadowShows} from './react-repair-shadow.js';

// Tailwind's composition: four invisible slots, then --tw-shadow (§D.177).
const layer=(x:number,y:number,radius:number,spread:number,a:number):NativeShadowEffect=>({type:'DROP_SHADOW',visible:true,blendMode:'NORMAL',
  radius,spread,offset:{x,y},color:{r:0,g:0,b:0,a:Math.fround(a)}});
const slots=[0,1,2,3].map(()=>layer(0,0,0,0,0));
const XS=[...slots,layer(0,1,2,0,0.05)],SM=[...slots,layer(0,1,3,0,0.1),layer(0,1,2,-1,0.1)];
const CSS_XS='rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px';
const CSS_SM='rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px';
const text='function Control() { return <button className="inline-flex shadow-xs data-disabled:opacity-50"/>; }';
const source={module:'control.tsx',exportName:'Control',span:{start:0,end:text.length},sourceSha256:createHash('sha256').update(text).digest('hex')};

test('a designer shadow proposes every other named size and one exact arbitrary value, preserving every other byte',()=>{
  const candidates=proposeReactShadowUtilityEdits(text,source,{before:XS,after:SM});
  assert.deepEqual(candidates.map(c=>[c.edit.after,c.rank]),[
    ['shadow-2xs',0],['shadow-sm',0],['shadow-md',0],['shadow-lg',0],['shadow-xl',0],['shadow-2xl',0],['shadow-none',0],
    ['shadow-[0px_1px_3px_0px_rgb(0_0_0/0.1),0px_1px_2px_-1px_rgb(0_0_0/0.1)]',1]]);
  for(const c of candidates) {
    assert.equal(c.edit.before,'shadow-xs');
    assert.equal(c.result.slice(0,c.edit.start),text.slice(0,c.edit.start));
    assert.equal(c.result.slice(c.edit.start+c.edit.after.length),text.slice(c.edit.end));
    assert.ok(c.limitations.includes('unique-effect-required')&&c.limitations.includes('source-write-not-authorized'));
  }
  // A colour off the 8-bit grid has no exact CSS spelling: only named sizes remain.
  const odd=[...slots,{...layer(0,1,3,0,0.1),color:{r:Math.fround(0.3333),g:0,b:0,a:Math.fround(0.1)}}];
  assert.ok(proposeReactShadowUtilityEdits(text,source,{before:XS,after:odd}).every(c=>c.rank===0));
  assert.throws(()=>proposeReactShadowUtilityEdits(text,source,{before:XS,after:structuredClone(XS)}),/shadow-change-invalid/);
  const plain='function Control() { return <button className="inline-flex"/>; }';
  assert.throws(()=>proposeReactShadowUtilityEdits(plain,{...source,span:{start:0,end:plain.length},sourceSha256:createHash('sha256').update(plain).digest('hex')},{before:XS,after:SM}),
    /shadow-utility-unavailable/);
  assert.throws(()=>proposeReactShadowUtilityEdits(text+' ',source,{before:XS,after:SM}),/react-utility-source-changed/);
});

test('the compiler parser reads both renders: a stack shows only its own native effects',()=>{
  assert.ok(repairShadowShows(CSS_XS,XS));assert.ok(repairShadowShows(CSS_SM,SM));
  assert.equal(repairShadowShows(CSS_SM,XS),false);assert.equal(repairShadowShows(CSS_XS.replace('0.05','0.06'),XS),false);
  assert.equal(repairShadowShows(undefined,XS),false);
});

async function evidence(edit:(variantIndex:number)=>NativeShadowEffect[]) {
  const f=await nativeUpdateFixture(),baseline=structuredClone(f.input.baseline);
  const roots=new Set(f.input.before.creation.variants.map((v:{id:string})=>v.id));
  for(const row of baseline.nodes!)if(roots.has(row.id))row.values.effects=structuredClone(XS);
  const observed=structuredClone(baseline);
  [...roots].forEach((id,i)=>{observed.nodes!.find((n:any)=>n.id===id)!.values.effects=edit(i);});
  return {operationId:'10000000-0000-4000-8000-000000000009',parentId:f.input.before.operation.id,
    proposalId:'a'.repeat(64),journalRevision:'b'.repeat(64),attemptId:'10000000-0000-4000-8000-000000000010',
    input:f.input.before,baseline,observed,difference:nativeDesignChanges(baseline,observed)};
}

test('a shared root shadow edit becomes a shadow plan; the host entry dispatches by channel',async()=>{
  const e=await evidence(()=>structuredClone(SM)),plan=planReactShadowSourceRepair(e,text,source);
  assert.equal(plan.channel,'effects');assert.equal(plan.changes.length,2);assert.equal(plan.candidates.length,8);
  assert.deepEqual(planReactShadowSourceRepair(e,text,source),plan,'same bytes produce the same plan');
  assert.deepEqual(planReactDesignSourceRepair(e,text,source),plan);
  assert.equal(plan.revision,revisionOf({...plan,revision:undefined}),'the revision covers the plan');
  // Every changed root must move from one stack to one stack.
  const split=await evidence(i=>i?structuredClone(SM):[...slots,layer(0,2,4,0,0.1)]);
  assert.throws(()=>planReactShadowSourceRepair(split,text,source),/multiple-shadow-values/);
  // A shadow edit beside any other native fact is not a shadow repair.
  const mixed=await evidence(()=>structuredClone(SM));
  mixed.observed.nodes!.find((n:any)=>n.id===mixed.difference.changes[0].nodeId)!.values.opacity=0.6;
  mixed.difference=nativeDesignChanges(mixed.baseline,mixed.observed);
  assert.throws(()=>planReactDesignSourceRepair(mixed,text,source),/react-design-source-repair-unsupported-change/);
});

function states() {
  const owner={id:'instance-0',source,props:{},roots:['']};
  const snapshot=(css:string,cls:string,image:string)=>({tree:{tag:'button',classes:['inline-flex',cls],style:{'box-shadow':css,opacity:'1',width:'32px'},pseudo:{},nodes:[]},image,
    ownership:{version:1,rendererVersions:['19.2.4'],components:[owner],nodes:[{path:'',tag:'button',nearestComponent:'instance-0'}],problems:[]},
    styleOrigin:{version:1,roots:[]},descendantSizes:{version:1,nodes:[]},bounds:{width:32,height:18}});
  const rows=['0','1'].map(id=>({id,changes:{checked:{kind:'set',value:id==='1'}},status:'observed',restored:true}));
  const observation={instanceId:'instance-0',source,axes:[{property:'checked',values:[false,true]}],heldProps:{},planned:2,problems:[],rows};
  const before={observation,snapshots:{'0':snapshot(CSS_XS,'shadow-xs','a'),'1':snapshot(CSS_XS,'shadow-xs','b')}} as unknown as RepairStateObservation;
  const candidate=proposeReactShadowUtilityEdits(text,source,{before:XS,after:SM}).find(c=>c.edit.after==='shadow-sm')!;
  const next={...source,sourceSha256:candidate.afterSha256};
  const after=structuredClone(before);after.observation.source=next;
  for(const snap of Object.values(after.snapshots)){snap.tree.classes=['inline-flex','shadow-sm'];snap.tree.style['box-shadow']=CSS_SM;snap.image+='-changed';snap.ownership.components[0].source=next;}
  for(const snap of [...Object.values(before.snapshots),...Object.values(after.snapshots)]) {
    snap.fonts={version:1,treeRevision:revisionOf(snap.tree),status:'observed',rows:[],problems:[]} as any;
    snap.svg={version:1,treeRevision:revisionOf(snap.tree),status:'observed',rows:[],problems:[]} as any;
  }
  const plan={channel:'effects',changes:[{nodeId:'n0',variant:'checked=false',before:XS,after:SM},{nodeId:'n1',variant:'checked=true',before:XS,after:SM}],
    candidates:[candidate]} as any;
  return {before,after,plan,variants:[{observation:'0',variant:'checked=false'},{observation:'1',variant:'checked=true'}]};
}

test('every recorded state must render the edit and nothing else',()=>{
  const f=states(),result=verifyReactSourceRepairStates(f.before,f.after,f.variants,f.plan,0);
  assert.deepEqual(result.rows.map(r=>[r.changed,r.beforeShadow===CSS_XS,r.afterShadow===CSS_SM]),[[true,true,true],[true,true,true]]);
  for(const mutate of [
    (g:ReturnType<typeof states>)=>{g.after.snapshots['1'].tree.style['box-shadow']=CSS_XS;},
    (g:ReturnType<typeof states>)=>{g.after.snapshots['1'].tree.style['box-shadow']=CSS_SM.replace('3px 0px','4px 0px');},
    (g:ReturnType<typeof states>)=>{g.before.snapshots['0'].tree.style['box-shadow']=CSS_SM;},
    (g:ReturnType<typeof states>)=>{g.after.snapshots['0'].tree.style.opacity='0.5';},
    (g:ReturnType<typeof states>)=>{g.plan.changes.pop();},
  ]) {
    const g=states();mutate(g);
    for(const snap of Object.values(g.after.snapshots)){snap.fonts!.treeRevision=revisionOf(snap.tree);snap.svg.treeRevision=revisionOf(snap.tree);}
    for(const snap of Object.values(g.before.snapshots)){snap.fonts!.treeRevision=revisionOf(snap.tree);snap.svg.treeRevision=revisionOf(snap.tree);}
    assert.throws(()=>verifyReactSourceRepairStates(g.before,g.after,g.variants,g.plan,0),/react-source-repair-observation-/);
  }
});
