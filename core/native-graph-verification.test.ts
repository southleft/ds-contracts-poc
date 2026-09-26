import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput} from './native-source-observation.js';
import {validNativeGraphCreation} from './native-graph-creation.js';

async function fixture(graphVerification?:1, absolute=false, conditional=false) {
  const f=await nativeComparisonFixture();
  const leaf=f.contract('fixture.graph-leaf',{root:{layout:{display:'flex'},parts:{
    label:{content:{prop:'label'},tokens:{color:'{ink}'},declared:{'font-family':'Inter'}},
  }}});
  leaf.name='Leaf';
  leaf.props=[{name:'label',type:'text',default:'Dependency label',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},
    {name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}];
  const middle=f.contract('fixture.graph-middle',{root:{layout:{display:'flex',direction:'column'},parts:{leaf:{component:{id:leaf.id}}}}});
  middle.name='Middle';
  const parent=f.contract('fixture.graph-main',{root:{layout:{display:'flex'},parts:{first:{component:{id:middle.id}},second:{component:{id:leaf.id}}}}});
  if(absolute) {
    parent.anatomy.root.declared={position:'relative'};
    parent.anatomy.root.parts!.second.absolutePlacement={left:16,top:1};
    if(conditional) {
      parent.props=[{name:'active',type:'boolean',bindings:{code:{prop:'active'},figma:{kind:'VARIANT',property:'Active',unsetValue:'(unset)',values:{false:'Off',true:'On'}}}}];
      delete parent.anatomy.root.parts!.second.absolutePlacement;
      parent.anatomy.root.parts!.second.absolutePlacementByCombination={props:['active'],rows:[
        {values:[null],left:-2.125,top:0},{values:['false'],left:1,top:1},{values:['true'],left:16,top:3.25},
      ]};
    }
  }
  const contracts=new Map([[parent.id,parent],[middle.id,middle],[leaf.id,leaf]]);
  const engine=createFigmaEngine({tokens:{primitives:f.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(f.assets)});
  const context=await f.context('30000000-0000-4000-8000-000000000001');
  const compiled=engine.compileNativeContractGraphDraft(parent,contracts,f.source,context.operation.id);
  const script=engine.buildNativeContractGraphDraftScript(parent,contracts,f.source,context,graphVerification);
  const creation=await f.run(script);
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const input:NativeContractObservationInput={operation:context.operation,planRevision:revisionOf({name:'graph-verification',graphVerification:graphVerification??null}),
    projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,
    tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation,
    ...(graphVerification?{graphVerification}:{})};
  const receipt=await f.run(emitNativeContractReadbackScript(input));
  assert.equal(receipt.status,'native-readback-collected',JSON.stringify(receipt.problems));
  return {f,input,receipt,creation,script,compiled};
}

test('versioned graph creation retains every dependency identity and independently checks its semantics',async()=>{
  const {input,receipt,creation,compiled,f,script}=await fixture(1);
  assert.ok(validNativeGraphCreation(compiled.components,creation));
  assert.equal(creation.graphTargets.length,3);
  assert.equal(creation.graphTargets[0].variants.length,2);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
  let nextY=0;
  const positions=[];
  for(const identity of creation.graphTargets) {
    const node=await f.figma.getNodeByIdAsync(identity.id);
    assert.equal(node.parent.id,creation.pageId);
    assert.equal(node.x,0);
    assert.equal(node.y,nextY,'fresh authored mains must not overlap on their page');
    positions.push([node.id,node.x,node.y]);
    nextY=Math.fround(nextY+node.height+200);
  }
  for(const instance of receipt.nodes.filter((n:any)=>n.type==='INSTANCE')) {
    const node=await f.figma.getNodeByIdAsync(instance.id);
    assert.equal(node.x,instance.values.x);
    assert.equal(node.y,instance.values.y);
    assert.equal((await node.getMainComponentAsync()).id,instance.mainId,'page placement preserves nested main identity');
  }
  const target=creation.graphTargets[0], text=receipt.nodes.find((n:any)=>n.parentId===target.variants[0].id&&n.type==='TEXT');
  assert.ok(text);assert.equal(text.metadata.fontWeightVar,'','dependency-only text metadata is independently collected');
  for(const [name,mutate] of [
    ['text',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.characters='Corrupted';}],
    ['binding',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.boundVariables={fontSize:{type:'VARIABLE_ALIAS',id:'foreign:1'}};}],
    ['property references',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.componentPropertyReferences={};}],
    ['extra property',(r:any)=>{r.nodes.find((n:any)=>n.id===target.id).definitions['Extra#bad']={type:'TEXT',defaultValue:'bad'};}],
    ['variant order',(r:any)=>{r.nodes.find((n:any)=>n.id===target.id).childIds.reverse();}],
    ['variant values',(r:any)=>{r.nodes.find((n:any)=>n.id===target.variants[1].id).variantProperties.Size='Wrong';}],
    ['missing descendant',(r:any)=>{r.nodes=r.nodes.filter((n:any)=>n.id!==text.id);}],
  ] as const){const changed=structuredClone(receipt);mutate(changed);assert.notDeepEqual(changed,receipt,name);assert.equal(verifyNativeContractReadback(input,changed).status,'refused',name);}
  for(const mutate of [
    (c:any)=>{delete c.graphTargets[0].variants;},
    (c:any)=>{c.graphTargets[0].variants.reverse();},
    (c:any)=>{c.graphTargets[0].variants[0].id=c.graphTargets[1].variants[0].id;},
    (c:any)=>{c.graphTargets[0].propertyDefinitions=null;},
    (c:any)=>{delete c.graphVerification;},
    (c:any)=>{c.graphVerification=2;},
  ]){const changed=structuredClone(creation);mutate(changed);assert.equal(validNativeGraphCreation(compiled.components,changed),false);assert.throws(()=>emitNativeContractReadbackScript({...input,creation:changed}),/creation-invalid/);}
  assert.throws(()=>emitNativeContractReadbackScript({...input,graphVerification:undefined}),/creation-invalid/,'a new acknowledgement cannot be downgraded');
  const repeated=await f.run(script);
  assert.equal(repeated.allocationAttempted,false,'a raw replay must refuse before allocating duplicates');
  assert.equal(repeated.status,'refused');
  assert.deepEqual(await Promise.all(creation.graphTargets.map(async(identity:any)=>{
    const node=await f.figma.getNodeByIdAsync(identity.id);return [node.id,node.x,node.y];
  })),positions,'a refused repeat must not reposition existing mains');
});

test('legacy graph receipts remain readable and are not silently upgraded',async()=>{
  const {input,receipt,creation}=await fixture();
  assert.equal(creation.graphVerification,undefined);
  assert.ok(creation.graphTargets.every((row:any)=>Object.keys(row).sort().join(',')==='contractId,id,key'));
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed');
  assert.throws(()=>emitNativeContractReadbackScript({...input,graphVerification:1}),/creation-invalid/);
});

test('a single authored main does not require graph placement identities',async()=>{
  const f=await nativeComparisonFixture();
  const parent=f.contract('fixture.single-main',{root:{layout:{display:'flex'},literals:{width:'24px',height:'18px'}}});
  const context=await f.context('30000000-0000-4000-8000-000000000003');
  const creation=await f.run(f.engine.buildNativeContractGraphDraftScript(parent,new Map([[parent.id,parent]]),f.source,context,1));
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation.problems));
  const node=await f.figma.getNodeByIdAsync(creation.target.id);
  assert.equal(node.x,0);assert.equal(node.y,0);
});

test('absolute instance offsets are independently verified before accepting a graph',async()=>{
  const {input,receipt,compiled}=await fixture(1,true);
  const spec=compiled.component.variants[0].spec.children!.find(s=>s.absolute)!;
  assert.deepEqual(spec.absolute,{h:'MIN',v:'MIN',left:16,top:1});
  const instance=receipt.nodes.find((n:any)=>n.type==='INSTANCE' && n.name===spec.name && n.values.layoutPositioning==='ABSOLUTE');
  assert.ok(instance);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed');
  for(const [field,value] of [['x',14],['y',2],['layoutPositioning','AUTO']] as const) {
    const changed=structuredClone(receipt);changed.nodes.find((n:any)=>n.id===instance.id).values[field]=value;
    const checked=verifyNativeContractReadback(input,changed);
    assert.equal(checked.status,'refused',field);
    assert.ok(checked.problems.some(p=>p.startsWith('native-contract-observation-instance-position')),field);
  }
});

test('independent graph readback verifies each conditional instance offset and refuses a moved state',async()=>{
  const {input,receipt,compiled,creation}=await fixture(1,true,true);
  assert.equal(compiled.component.variants.length,3);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed');
  const parent=creation.graphTargets.find((target:any)=>target.contractId===compiled.component.contractId);assert(parent);
  for(const variant of compiled.component.variants) {
    const target=parent.variants.find((v:any)=>v.name===variant.name);assert(target,variant.name);
    const spec=variant.spec.children!.find(s=>s.absolute)!;
    const instance=receipt.nodes.find((n:any)=>n.parentId===target.id && n.type==='INSTANCE' && n.name===spec.name);assert(instance);
    assert.equal(instance.values.x,spec.absolute!.left);assert.equal(instance.values.y,spec.absolute!.top);
    const changed=structuredClone(receipt);changed.nodes.find((n:any)=>n.id===instance.id).values.x+=1;
    const checked=verifyNativeContractReadback(input,changed);assert.equal(checked.status,'refused',variant.name);
    assert(checked.problems.some(p=>p.startsWith('native-contract-observation-instance-position')),variant.name);
  }
});
