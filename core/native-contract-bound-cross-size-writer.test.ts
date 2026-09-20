import assert from 'node:assert/strict';
import test from 'node:test';
import {boundCrossSizeFixture} from './native-contract-bound-cross-size-test-fixture.js';
import {prepareNativeBoundCrossSizeUpdate} from './native-contract-bound-cross-size-update.js';
import {emitNativeBoundCrossSizeUpdateScript} from './native-contract-bound-cross-size-writer.js';
import {prepareNativeContractUpdate,type NativeOpacityUpdatePlan} from './native-contract-update.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback} from './native-source-observation.js';
import {nativeBoundCrossSizeObservationMatches} from './native-bound-cross-size-observation.js';

async function fixture(channel:'width'|'height'='height') {
  const f=await boundCrossSizeFixture(channel,true);
  const {plan}=prepareNativeBoundCrossSizeUpdate(f.input,input=>prepareNativeContractUpdate(input) as {plan:NativeOpacityUpdatePlan;revision:string})!;
  const nodes=new Map<string,any>(),stack=[f.figma.root];
  while(stack.length){const n=stack.pop();nodes.set(n.id,n);stack.push(...n.children??[]);}
  f.figma.getNodeById=(id:string)=>nodes.get(id);
  f.figma.variables.getVariableById=(id:string)=>f.variables.find(v=>v.id===id);
  f.figma.variables.getVariableCollectionById=(id:string)=>f.collections.find(c=>c.id===id);
  const variable=f.figma.variables.getVariableById(plan.variable.id),set=variable.setValueForMode.bind(variable);
  const writes:string[]=[];
  // Explicit synthetic propagation, using fixture geometry. These tests prove
  // control flow and protection, never Figma's actual propagation timing.
  variable.setValueForMode=(mode:string,value:number)=>{
    writes.push('variable');set(mode,value);
    for(const id of plan.scope.nodeIds){const root=nodes.get(id);
      root.resize(channel==='width'?value:root.width,channel==='height'?value:root.height);
      root.children[0][channel==='height'?'y':'x']=(value-6)/2;
    }
  };
  for(const t of plan.absolute){const n=nodes.get(t.nodeId),resize=n.resizeWithoutConstraints.bind(n);
    n.resizeWithoutConstraints=(w:number,h:number)=>{writes.push(n.id);resize(w,h);};}
  const read=()=>f.run(emitNativeContractReadbackScript(plan.before));
  const run=(direction:'apply'|'rollback'='apply',readOnly=false)=>f.run(emitNativeBoundCrossSizeUpdateScript(plan,direction,readOnly));
  return {...f,plan,nodes,variable,writes,read,run};
}

test('isolated writer preflights, applies, repeats without writes and reverses both cross axes',async()=>{
  for(const channel of ['width','height'] as const){const f=await fixture(channel);
    const preflight=await f.run('apply',true);assert.equal(preflight.status,'preflight-observed',JSON.stringify(preflight.problems));assert.deepEqual(f.writes,[]);
    const applied=await f.run();assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
    assert.equal(verifyNativeContractReadback(f.plan.after,applied.observation).status,'supported-structure-observed');
    assert(nativeBoundCrossSizeObservationMatches(f.plan,applied.observation,'after'));
    const count=f.writes.length;assert.equal((await f.run()).status,'no-op');assert.equal(f.writes.length,count);
    const reversed=await f.run('rollback');assert.equal(reversed.status,'updated',JSON.stringify(reversed.problems));
    assert(nativeBoundCrossSizeObservationMatches(f.plan,reversed.observation,'before'));
    const restored=structuredClone(reversed.observation);delete restored.images;
    assert.deepEqual(restored,f.plan.baseline);
  }
});

test('final registry-warmup edits refuse before any setter, including indirect instance consumers',async()=>{
  for(const edit of [
    (f:any)=>{f.nodes.get(f.plan.scope.nodeIds[0]).name='independent rename';},
    (f:any)=>{f.nodes.get(f.plan.scope.nodeIds[0]).opacity=.37;},
    (f:any)=>{f.nodes.get(f.plan.scope.nodeIds[0]).children[0].layoutAlign='STRETCH';},
    (f:any)=>{f.variable.valuesByMode[f.plan.variable.modeId]=19;},
    (f:any)=>{f.figma.root.children[0].boundVariables={width:{type:'VARIABLE_ALIAS',id:f.plan.variable.id}};},
    (f:any)=>{f.figma.root.children[0].children.push({id:'late-instance',type:'INSTANCE',mainComponent:f.nodes.get(f.plan.scope.nodeIds[0]),boundVariables:{},componentProperties:{},children:[]});},
  ]){const f=await fixture(),warm=f.figma.variables.getLocalVariablesAsync.bind(f.figma.variables);
    f.figma.variables.getLocalVariablesAsync=async()=>{edit(f);return warm();};
    const result=await f.run();assert.equal(result.status,'refused',JSON.stringify(result.problems));assert.deepEqual(f.writes,[]);
  }
});

test('known setter failures restore the actual starting state, including a pre-existing partial update',async()=>{
  for(const startPartial of [false,true]){const f=await fixture();
    if(startPartial)f.variable.setValueForMode(f.plan.variable.modeId,f.plan.variable.after);
    const start=await f.read(),node=f.nodes.get(f.plan.absolute[0].nodeId),resize=node.resizeWithoutConstraints.bind(node);let once=true;
    node.resizeWithoutConstraints=(w:number,h:number)=>{resize(w,h);if(once){once=false;throw Error('controlled setter failure after resize');}};
    const result=await f.run();assert.equal(result.status,'rolled-back',JSON.stringify(result.problems));
    assert.deepEqual(await f.read(),start,'restore the state observed immediately before this attempt');
  }
});

test('recovery keeps independent edits and foreign consumers instead of overwriting them',async()=>{
  for(const edit of [
    (f:any)=>{f.nodes.get(f.plan.scope.nodeIds[0]).name='independent edit during setter';},
    (f:any)=>{f.figma.root.children[0].boundVariables={height:{type:'VARIABLE_ALIAS',id:f.plan.variable.id}};},
    (f:any)=>{f.nodes.get(f.plan.scope.nodeIds[0]).children[0].y=999;},
  ]){const f=await fixture(),node=f.nodes.get(f.plan.absolute[0].nodeId),resize=node.resizeWithoutConstraints.bind(node);
    node.resizeWithoutConstraints=(w:number,h:number)=>{resize(w,h);edit(f);throw Error('controlled interrupted assignment');};
    const result=await f.run();assert.equal(result.status,'recovery-required',JSON.stringify(result.problems));
    assert.equal(f.variable.valuesByMode[f.plan.variable.modeId],f.plan.variable.after);
    assert.equal(f.writes.filter(x=>x==='variable').length,1,'no rollback writer may run after scope or baseline conflict');
    assert.equal(f.writes.filter(x=>x===node.id).length,1);
  }
});

test('unknown partial propagation remains recovery-required and read-only mode never repairs it',async()=>{
  const f=await fixture(),original=f.variable.setValueForMode.bind(f.variable);
  f.variable.setValueForMode=(mode:string,value:number)=>{original(mode,value);f.nodes.get(f.plan.scope.nodeIds[1]).children[0].y=4;};
  const result=await f.run();assert.equal(result.status,'recovery-required',JSON.stringify(result.problems));
  const count=f.writes.length,recheck=await f.run('apply',true);
  assert.equal(recheck.status,'refused');assert.equal(f.writes.length,count);
});

test('every assignment shares the uninterrupted turn of the final synchronous consumer scan',async()=>{
  const f=await fixture(),scan=f.figma.variables.getLocalVariables.bind(f.figma.variables);let inFinalTurn=false;
  f.figma.variables.getLocalVariables=()=>{inFinalTurn=true;queueMicrotask(()=>{inFinalTurn=false;});return scan();};
  const set=f.variable.setValueForMode.bind(f.variable);
  f.variable.setValueForMode=(mode:string,value:number)=>{assert(inFinalTurn,'variable assignment yielded after final scan');set(mode,value);};
  for(const t of f.plan.absolute){const node=f.nodes.get(t.nodeId),resize=node.resizeWithoutConstraints.bind(node);
    node.resizeWithoutConstraints=(w:number,h:number)=>{assert(inFinalTurn,'leaf assignment yielded after final scan');resize(w,h);};}
  assert.equal((await f.run()).status,'updated');
  assert.equal((await f.run('rollback')).status,'updated');
});
