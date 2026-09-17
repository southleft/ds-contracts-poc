import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeSvgUpdateFixture as fixture} from './native-contract-svg-update-test-fixture.js';
import {prepareNativeContractUpdate,emitNativeContractUpdateScript,nativeContractUpdateMatches,verifyNativeContractUpdate} from './native-contract-update.js';
import type {NodeSpec} from './emit-figma-script.js';
const all=(n:NodeSpec):NodeSpec[]=>[n,...(n.children??[]).flatMap(all)];
const svg=(component:any)=>component.variants.flatMap((v:any)=>all(v.spec)).find((n:NodeSpec)=>n.type==='svg') as NodeSpec;

test('SVG stroke update preserves the full inventory, verifies, repeats as no-op and rolls back',async()=>{
 const f=await fixture(),ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
 assert.equal(f.plan.kind,'native-contract-svg-update');
 assert.equal(f.plan.changes[0].before,2);assert.equal(f.plan.changes[0].after,Math.fround(14/12));
 const preflight=await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
 assert.equal(preflight.status,'preflight-observed',JSON.stringify(preflight.problems));
 assert.equal(f.vectors[0].strokeWeight,2);
 const applied=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
 assert.ok(nativeContractUpdateMatches(f.plan,applied.observation,true));
 const wrong=structuredClone(applied.observation);wrong.nodes.find((n:any)=>n.type==='VECTOR').values.strokeWeight=2;
 assert.equal(verifyNativeContractUpdate(f.plan,wrong).status,'refused');
 assert.equal(verifyNativeContractUpdate(f.plan,applied.observation).status,'supported-structure-observed');
 assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
 assert.equal((await f.run(emitNativeContractUpdateScript(f.plan))).status,'no-op');
 const rollback=await f.run(emitNativeContractUpdateScript(f.plan,'rollback'));
 assert.equal(rollback.status,'updated');assert.ok(nativeContractUpdateMatches(f.plan,rollback.observation));
 assert.equal(f.vectors[0].strokeWeight,2);
});

test('SVG corrections reject ambiguous scale, path changes, bound strokes and mixed channels',async()=>{
 const f=await fixture();
 for(const mutate of [
  (input:any)=>{for(const c of [input.before.component,input.desired.component])svg(c).svg=svg(c).svg!.replace('24 24','24 12');},
  (input:any)=>{svg(input.desired.component).svg=svg(input.desired.component).svg!.replace('M4','M5');},
  (input:any)=>{for(const c of [input.before.component,input.desired.component])svg(c).svg=svg(c).svg!.replace('<path ','<path transform="scale(2)" ');},
  (input:any)=>{input.baseline.nodes.find((n:any)=>n.type==='VECTOR').values.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:'foreign'};},
  (input:any)=>{input.desired.component.variants[0].spec.opacity=0.2;},
 ]){const input=structuredClone(f.input);mutate(input);assert.throws(()=>prepareNativeContractUpdate(input),/native-update-svg/);}
});

test('independent vector path, weight, paint or binding edits are conflicts, never repair authority',async()=>{
 for(const mutate of [
  (n:any)=>{n.vectorPaths=[{windingRule:'NONZERO',data:'M0 0 L9 9'}];},
  (n:any)=>{n.strokeWeight=3;},
  (n:any)=>{n.strokes=[];},
  (n:any)=>{n.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:'foreign'};},
 ]){
  const f=await fixture();mutate(f.vectors[0]);const before=JSON.stringify(f.vectors[0].vectorPaths);
  const result=await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status,'refused');assert.deepEqual(result.changes,[]);assert.equal(JSON.stringify(f.vectors[0].vectorPaths),before);
 }
});

test('a postcondition failure rolls back the owned stroke without undoing another edit',async()=>{
 const f=await fixture(),node=f.vectors[0];let weight=node.strokeWeight;
 Object.defineProperty(node,'strokeWeight',{configurable:true,get:()=>weight,set:(value:number)=>{
  weight=value;if(value!==2)node.name='concurrent rename';
 }});
 const result=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(result.status,'rolled-back');assert.equal(node.strokeWeight,2);assert.equal(node.name,'concurrent rename');
});
