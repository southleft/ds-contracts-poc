import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyReactSourceRepairStates,verifyReactSourceRepairBaseline,type RepairStateObservation} from './react-source-repair-observation.js';
import type {planReactOpacitySourceRepair} from './react-design-source-repair.js';
import {revisionOf} from '../core/contract-provenance.js';

function fixture() {
  const source={module:'control.tsx',exportName:'Control',sourceSha256:'a'.repeat(64),span:{start:0,end:80}};
  const next={...source,sourceSha256:'b'.repeat(64)};
  const values=[false,true,null],rows=values.map((value,i)=>({id:String(i),changes:{disabled:value===null?{kind:'omit'}:{kind:'set',value}},status:'observed',restored:true}));
  const observation={instanceId:'instance-0',source,axes:[{property:'disabled',values}],heldProps:{disabled:false},planned:3,problems:[],rows};
  const before={observation,snapshots:Object.fromEntries(rows.map(row=>[row.id,{tree:{tag:'button',classes:['disabled:opacity-50'],style:{opacity:row.id==='1'?'0.5':'1',width:'16px'},pseudo:{},nodes:[]},
    image:'original-'+row.id,ownership:{version:1,rendererVersions:['19.2.4'],components:[{id:'instance-0',source,props:row.changes,roots:['']}],nodes:[{path:'',tag:'button',nearestComponent:'instance-0'}],problems:[]},
    styleOrigin:{version:1,roots:[]},descendantSizes:{version:1,nodes:[]},bounds:{width:16,height:16}}]))} as unknown as RepairStateObservation;
  for(const snapshot of Object.values(before.snapshots)) {
    snapshot.fonts={version:1,treeRevision:revisionOf(snapshot.tree),status:'observed',rows:[],problems:[]};
    snapshot.svg={version:1,treeRevision:revisionOf(snapshot.tree),status:'observed',rows:[],problems:[]};
  }
  const after=structuredClone(before);after.observation.source=next;
  for(const [id,snapshot] of Object.entries(after.snapshots)) {
    snapshot.tree.classes=['disabled:opacity-60'];snapshot.ownership.components[0].source=next;
    if(id==='1'){snapshot.tree.style.opacity='0.6';snapshot.image='changed-1';}
    snapshot.fonts!.treeRevision=revisionOf(snapshot.tree);snapshot.svg.treeRevision=revisionOf(snapshot.tree);
  }
  const variants=values.map((value,i)=>({observation:String(i),variant:'disabled='+value}));
  const plan={changes:[{nodeId:'n1',variant:'disabled=true',before:0.5,after:0.6}],candidates:[{source,beforeSha256:source.sourceSha256,afterSha256:next.sourceSha256,edit:{before:'disabled:opacity-50',after:'disabled:opacity-60'}}]} as ReturnType<typeof planReactOpacitySourceRepair>;
  return {before,after,variants,plan};
}

test('all mapped states verify while permitting only the exact source token and requested root opacity',()=>{
  const f=fixture(),before=structuredClone(f.before),after=structuredClone(f.after);
  const result=verifyReactSourceRepairStates(f.before,f.after,f.variants,f.plan,0);
  assert.deepEqual(result.rows.map(r=>[r.observation,r.changed]),[['0',false],['1',true],['2',false]]);
  assert.deepEqual(f.before,before);assert.deepEqual(f.after,after);
  assert.doesNotThrow(()=>verifyReactSourceRepairBaseline(before,structuredClone(before)));
  assert.throws(()=>verifyReactSourceRepairBaseline(before,after),/recorded-domain-changed/);
});

test('missing states and unrelated descendant, ownership, font, geometry and image changes refuse the whole repair',()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.after.observation.rows.pop();},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['0'].tree.style.opacity='0.6';},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].tree.style.opacity='0.7';},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].tree.nodes.push({t:'text',v:'unexpected'});},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].tree.style.width='17px';},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['0'].image='unexpected-image';},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].ownership.components[0].props={};},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].fonts={version:2} as any;},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].fonts!.treeRevision=f.before.snapshots['1'].fonts!.treeRevision;},
    (f:ReturnType<typeof fixture>)=>{delete f.after.snapshots['1'].fonts;},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].svg.rows.push({path:[],width:'16px',height:'16px',viewport:{viewBox:[0,0,16,16],preserveAspectRatio:'none'}});},
    (f:ReturnType<typeof fixture>)=>{f.after.snapshots['1'].bounds={width:17,height:16} as any;},
    (f:ReturnType<typeof fixture>)=>{f.variants[0].observation='1';},
  ]) {
    const f=fixture();mutate(f);
    assert.throws(()=>verifyReactSourceRepairStates(f.before,f.after,f.variants,f.plan,0),/react-source-repair-observation-/);
  }
  const f=fixture(),changed=structuredClone(f.before);changed.snapshots['0'].image='changed';
  assert.throws(()=>verifyReactSourceRepairBaseline(f.before,changed),/recorded-image-changed/);
});
