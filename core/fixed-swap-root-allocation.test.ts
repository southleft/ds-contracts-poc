import assert from 'node:assert/strict';
import test from 'node:test';
import {fixedSwapOwnerRoots, qualifyFixedSwapRootAllocation} from './fixed-swap-root-allocation.js';
import {proposeFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';
import {reactInstanceRootStyle} from './react-instance-root.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {createFigmaEngine} from './emit-figma-script.js';

function fixture(width=824,height=32){
 const transform:[[number,number,number],[number,number,number]]=[[1,0,16],[0,1,4]];
 const leaf:DumpNode={name:'Body',nodeId:'20:2',type:'INSTANCE',instanceOf:'Selected',instanceKey:'selected-key',propRefs:{mainComponent:'Payload'},instanceSizing:{horizontal:'FILL',vertical:'HUG'},
  bbox:{width,height},instanceRootOverrides:{nodeId:'20:2',componentId:'40:1',componentKey:'selected-key',fields:['width','height','counterAxisSizingMode'],mainSize:{width:32,height:32},localSize:{width,height},localTransform:transform},
  instanceGeometry:{nodeId:'20:2',componentId:'40:1',localSize:{width,height},transform}};
 const main:DumpNode={name:'Main',nodeId:'20:1',componentKey:'owner-main-key',type:'COMPONENT',bbox:{width:856,height:64},children:[leaf]};
 const source:DumpSet={setName:'Owner',type:'COMPONENT_SET',key:'owner-key',propertyDefinitions:{'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'40:1',preferredValues:[]}},variants:[main]};
 const host:DumpNode={name:'Host',nodeId:'10:1',type:'INSTANCE',instanceOf:'Owner',instanceKey:'owner-main-key',instanceSetKey:'owner-key',
  instanceRootOverrides:{nodeId:'10:1',componentId:'20:1',componentKey:'owner-main-key',componentSetKey:'owner-key',fields:[],localTransform:[[1,0,0],[0,1,0]]},
  instanceGeometry:{nodeId:'10:1',componentId:'20:1',localSize:{width:856,height:64},transform:[[1,0,0],[0,1,0]]},
  fixedSwaps:{Payload:{id:'40:1',key:'selected-key',observedInstances:[{nodeId:'I10:1;20:2',path:[0],componentId:'40:1',size:{width,height},parentSize:{width:856,height:64},relativeTransform:transform,constraints:{horizontal:'LEFT',vertical:'TOP'}}]}}};
 const targetSource:DumpSet={setName:'Selected',type:'COMPONENT',key:'selected-key',variants:[{name:'Selected',type:'COMPONENT',nodeId:'40:1',componentKey:'selected-key',bbox:{width:32,height:32}}]};
 const qualify=()=>qualifyFixedSwapRootAllocation(host,'Payload','owner-key','40:1','selected-key',fixedSwapOwnerRoots([source,targetSource]));
 return {host,leaf,main,source,targetSource,qualify};
}

test('rectangular per-host pixels require the exact original property/path/lineage join, retaining source sizing',()=>{
 for(const [width,height] of [[824,32],[800,32],[71.25,18.5]]){const f=fixture(width,height),before=JSON.stringify(f);assert.deepEqual(f.qualify(),{width,height,sizing:{horizontal:'FILL',vertical:'HUG'},remainingFields:['counterAxisSizingMode']});assert.equal(JSON.stringify(f),before);}
});
test('later hosts and independently captured owner planes retain their own allocation instead of the first host',()=>{
 const a=fixture(60,44),b=fixture(93,71);b.host.nodeId='10:2';b.host.instanceRootOverrides!.nodeId='10:2';b.host.instanceGeometry!.nodeId='10:2';b.host.fixedSwaps!.Payload.observedInstances![0].nodeId='I10:2;20:2';
 assert.equal((a.qualify() as {width:number}).width,60);assert.equal((b.qualify() as {width:number}).width,93);
 b.leaf.instanceRootOverrides!.localSize!.width=60;assert('issue'in b.qualify());
});
test('missing, null, explicit zero and malformed dimensions remain distinct',()=>{
 const zero=fixture(0,32);assert.equal((zero.qualify() as {width:number}).width,0);
 for(const value of [undefined,null,NaN,Infinity,-1]){const f=fixture();(f.host.fixedSwaps!.Payload.observedInstances![0].size as any).width=value;assert('issue'in f.qualify(),String(value));}
 const f=fixture();delete (f.host.fixedSwaps!.Payload.observedInstances![0].size as Partial<{width:number}>).width;assert('issue'in f.qualify());
});
test('uncaptured, observed-empty and duplicate observations cannot borrow a source-main measurement',()=>{
 for(const value of [undefined,null,[],[fixture().host.fixedSwaps!.Payload.observedInstances![0],fixture().host.fixedSwaps!.Payload.observedInstances![0]]]){const f=fixture();f.host.fixedSwaps!.Payload.observedInstances=value as any;assert('issue'in f.qualify());}
});
test('malformed and sparse path/transform/field arrays never become an omission or identity transform',()=>{
 const poisons:Array<(f:ReturnType<typeof fixture>)=>void>=[
 f=>{f.host.fixedSwaps!.Payload.observedInstances=new Array(1);},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].path=new Array(1);},
 f=>{f.leaf.instanceRootOverrides!.fields=new Array(2);},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].relativeTransform=[new Array(3),[0,1,0]];},
 f=>{delete f.main.children![0];},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].path=[-1];},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].path=[0,0];},
 ];for(const poison of poisons){const f=fixture();poison(f);assert('issue'in f.qualify(),String(poison));}
});
test('rotation/reflection/scale, wrong identities and moving or bound allocations stay refused',()=>{
 const poisons:Array<(f:ReturnType<typeof fixture>)=>void>=[
 f=>{f.host.fixedSwaps!.Payload.key='wrong';},f=>{f.host.instanceSetKey='wrong';},f=>{f.host.instanceGeometry!.localSize.width=NaN;},f=>{f.host.instanceRootOverrides!.componentId='missing';},
 f=>{f.leaf.propRefs!.mainComponent='Other';},f=>{f.host.fixedSwaps!.Payload.observedInstances![0].nodeId='Iother;20:2';},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].relativeTransform=[[0,-1,0],[1,0,0]];},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].relativeTransform=[[-1,0,0],[0,1,0]];},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].relativeTransform=[[2,0,0],[0,1,0]];},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].constraints!.horizontal='SCALE';},
 f=>{f.leaf.bound={width:'reviewed.width'};},f=>{f.leaf.instanceRootOverrides!.fields=['width'];},
 f=>{f.host.fixedSwaps!.Payload.observedInstances![0].constraints={} as any;},f=>{f.leaf.instanceSizing={horizontal:'FIXED',vertical:'FIXED',width:999,height:32};},f=>{f.leaf.instanceSizing!.width=999;},f=>{delete f.leaf.instanceSizing;},f=>{f.host.fixedSwaps!.Payload.observedInstances![0].parentSize!.height=65;},
 f=>{f.main.componentKey='stale-main';},f=>{f.leaf.instanceRootOverrides!.mainSize!.width=99;},f=>{f.targetSource.variants[0].componentKey='wrong-key';},f=>{f.source.propertyDefinitions!['Payload#3:4']=f.source.propertyDefinitions!['Payload#1:2'];},
 ];for(const poison of poisons){const f=fixture();poison(f);assert('issue'in f.qualify(),String(poison));}
 const f=fixture();assert('issue'in qualifyFixedSwapRootAllocation(f.host,'Payload','owner-key','40:1','selected-key',fixedSwapOwnerRoots([f.source,f.source])));
});
function integration(){
 const f=fixture(),anchors=(key:string,nodeId?:string)=>({figma:{anchors:{fileKey:'fixture',componentSetKey:key,...(nodeId?{nodeId}:{})}},code:{anchors:{importPath:'./Owner',export:'Owner'}}});
 const child=ContractSchema.parse({id:'check.owner',name:'Owner',version:'0.1.0',status:'draft',semantics:{element:'div'},description:'Own caller slot',props:[],states:[],anatomy:{root:{parts:{content:{slot:{name:'children',bindings:{figma:{property:'Payload'}},renderDefault:true,defaultContent:[{id:'check.selected'}]}}}}},bindings:anchors('owner-key')});
 const target=ContractSchema.parse({...child,id:'check.selected',name:'Selected',anatomy:{root:{instanceRootInputs:['width','height'],text:'Fixed original label',literals:{width:'32px',height:'32px'}}},bindings:anchors('selected-key','40:1')});
 const variants=['False','True'].map((value,i)=>{const host=structuredClone(f.host);host.nodeId='10:'+String(i+1);host.instanceRootOverrides!.nodeId=host.nodeId;host.instanceGeometry!.nodeId=host.nodeId;host.fixedSwaps!.Payload.observedInstances![0].nodeId='I'+host.nodeId+';20:2';return {name:'Power='+value,type:'COMPONENT' as const,variantProperties:{Power:value},bbox:{width:856,height:64},children:[host]};});
 const set:DumpSet={setName:'Housing',type:'COMPONENT_SET',propNames:{Power:'power'},propertyDefinitions:{Power:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']}},variants};
 const scope=new Map([child,target].map(c=>[c.id,c]));
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Owner',child.id]]),contractIdByKey:new Map([['owner-key',child.id],['selected-key',target.id]]),contractsById:new Map([...scope].map(([id,c])=>[id,asMinimalChildContract(c)])),fixedSwapOwnerRoots:fixedSwapOwnerRoots([f.source,f.targetSource])};
 const propose=()=>proposeFromDump(set,opts);
 return {...f,set,scope,target,child,opts,propose};
}
test('existing rootOverrides receiver carries the pair and never scales glyphs or changes omitted/default caller identity',()=>{
 const f=integration(),before=JSON.stringify([...f.scope]),r=f.propose(),c=ContractSchema.parse(r.contract),ref=walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)!.part.component!;
 assert.deepEqual(Object.keys(ref.rootOverrides!).sort(),['height','width']);assert.equal(ref.overrides,undefined);assert.equal(ref.rootFill,undefined);assert.equal(JSON.stringify([...f.scope]),before);
 assert(r.notes.some(n=>n.includes('FILL/HUG')&&n.includes('not responsive rootFill')));assert(r.notes.some(n=>n.includes('counterAxisSizingMode')));
 assert(r.mintedTokens!.entries.some(e=>e.value==='824px'));assert(r.mintedTokens!.entries.some(e=>e.value==='32px'));
 const style=reactInstanceRootStyle(c,{component:ref},path=>r.mintedTokens!.entries.find(e=>e.ref==='{'+path+'}')!.value as string,n=>n);assert.match(style,/"width": "824px"/);assert.match(style,/"height": "32px"/);assert.doesNotMatch(style,/scale|transform/);
 assert.equal(f.child.anatomy.root.parts!.content.slot!.renderDefault,true);assert.equal(f.child.anatomy.root.parts!.content.slot!.defaultContent![0].id,f.target.id);
});
test('missing source join/receiver opt-in or a later invalid occurrence names the new refusal without inventing pair refs',()=>{
 const poisons:Array<(f:ReturnType<typeof integration>)=>void>=[f=>{f.opts.fixedSwapOwnerRoots=new Map();},f=>{f.target.anatomy.root.instanceRootInputs=['width'];},f=>{f.set.variants[1].children![0].fixedSwaps!.Payload.observedInstances![0].size!.width=800;},f=>{f.set.variants[1].children![0].fixedSwaps!.Payload.observedInstances=undefined;}];
 for(const poison of poisons){const f=integration();poison(f);const r=f.propose(),c=ContractSchema.parse(r.contract),ref=walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)!.part.component!;assert.equal(ref.rootOverrides,undefined);assert(r.notes.some(n=>n.includes('fixed-swap-caller-root-allocation-not-carried')),String(poison));}
});

test('Boolean-dependent per-host dimensions resolve on both React outputs and native without changing explicit false or defaults',()=>{
 const f=integration(),second=structuredClone(f.main);second.nodeId='20:3';second.componentKey='owner-main-2';second.children![0].nodeId='20:4';
 const leaf=second.children![0];leaf.instanceRootOverrides!.nodeId='20:4';leaf.instanceRootOverrides!.localSize!.width=800;leaf.instanceGeometry!.nodeId='20:4';leaf.instanceGeometry!.localSize.width=800;
 f.source.variants.push(second);const host=f.set.variants[1].children![0];host.instanceKey='owner-main-2';host.instanceRootOverrides!.componentId='20:3';host.instanceRootOverrides!.componentKey='owner-main-2';host.instanceGeometry!.componentId='20:3';const row=host.fixedSwaps!.Payload.observedInstances![0];row.nodeId='I'+host.nodeId+';20:4';row.size!.width=800;
 f.opts.fixedSwapOwnerRoots=fixedSwapOwnerRoots([f.source,f.targetSource]);const r=f.propose(),c=ContractSchema.parse(r.contract),ref=walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)!.part.component!;
 assert.equal(c.props.find(p=>p.name==='power')!.type,'boolean');assert.equal(c.props.find(p=>p.name==='power')!.default,false);assert.match(ref.rootOverrides!.width??'',/\{power\}/);
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([...f.scope,[c.id,c]]),ctx={contracts:scope,tokens,icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){const files=emitter.emit(c,ctx);assert.match(files[0].contents,/width/);assert.match(files[0].contents,/824px|width-false/);assert.match(files[0].contents,/800px|width-true/);assert.match(files[0].contents,/height/);assert.match(files[0].contents,/32px|selected-content-height/);assert.doesNotMatch(files[0].contents,/scale\(/);}
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 const instances=(n:any):any[]=>[...(n.type==='instance'?[n]:[]),...(n.children??[]).flatMap(instances),...(n.slotChildren??[]).flatMap(instances)];
 for(const variant of native.variants){const selected=instances(variant.spec).find(n=>n.componentId===f.target.id||n.componentRefId===f.target.id||n.instanceRootOverrides?.width);assert(selected,JSON.stringify(variant.spec));assert.equal(selected.instanceRootOverrides.width.px,variant.name.includes('True')?800:824);assert.equal(selected.instanceRootOverrides.height.px,32);assert.equal(selected.instanceAffineAllocation,undefined);}
});
test('semantic promotion remains a named allocation refusal rather than freezing the surviving rest source',()=>{
 const f=integration();(f.opts as any).stampsObservable=true;delete f.set.propNames;f.set.propertyDefinitions={State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']}};
 f.set.variants.forEach((v,i)=>{v.name='State='+['Default','Hover'][i];v.variantProperties={State:['Default','Hover'][i]};});
 assert.throws(()=>f.propose(),(error:any)=>error.code==='EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
 (f.opts as any).projectionMode='reviewable-inversion';const r=f.propose(),c=ContractSchema.parse(r.contract),ref=walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)!.part.component!;
 assert.equal(ref.rootOverrides,undefined);assert(r.notes.some(n=>n.includes('fixed-swap-caller-root-allocation-not-carried:promoted-source-plane')),r.notes.join('\n'));
});

test('absent parent bbox grants no responsive authority and does not discard independently explicit local root dimensions',()=>{
 const f=fixture();delete f.main.bbox;assert.deepEqual(f.qualify(),{width:824,height:32,sizing:{horizontal:'FILL',vertical:'HUG'},remainingFields:['counterAxisSizingMode']});
 f.host.fixedSwaps!.Payload.observedInstances![0].parentSize=undefined;assert('issue'in f.qualify());
});
test('a genuinely three-axis rectangular width refuses the whole pair instead of publishing only constant height',()=>{
 const f=integration();delete f.set.propNames;f.set.propertyDefinitions=Object.fromEntries(['A','B','C'].map(name=>[name,{type:'VARIANT' as const,defaultValue:'One',variantOptions:['One','Two']}]));f.set.variants=[];f.source.variants=[];
 for(let i=0;i<8;i++){const tuple=Object.fromEntries(['A','B','C'].map((name,index)=>[name,i&(1<<index)?'Two':'One']));const main=structuredClone(f.main),leaf=main.children![0],host=structuredClone(f.host),width=60+i;main.nodeId=`20:${10+i}`;main.componentKey=`main-${i}`;leaf.nodeId=`30:${i}`;leaf.instanceRootOverrides!.nodeId=leaf.nodeId;leaf.instanceRootOverrides!.localSize!.width=width;leaf.instanceGeometry!.nodeId=leaf.nodeId;leaf.instanceGeometry!.localSize.width=width;host.nodeId=`10:${10+i}`;host.instanceKey=main.componentKey;host.instanceRootOverrides!.nodeId=host.nodeId;host.instanceRootOverrides!.componentId=main.nodeId;host.instanceRootOverrides!.componentKey=main.componentKey;host.instanceGeometry!.nodeId=host.nodeId;host.instanceGeometry!.componentId=main.nodeId;host.fixedSwaps!.Payload.observedInstances![0].nodeId=`I${host.nodeId};${leaf.nodeId}`;host.fixedSwaps!.Payload.observedInstances![0].size!.width=width;f.source.variants.push(main);f.set.variants.push({name:Object.entries(tuple).map(([key,value])=>key+'='+value).join(', '),variantProperties:tuple,type:'COMPONENT',children:[host]});}
 f.opts.fixedSwapOwnerRoots=fixedSwapOwnerRoots([f.source,f.targetSource]);const r=f.propose(),c=ContractSchema.parse(r.contract),ref=walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)!.part.component!;assert.equal(ref.rootOverrides,undefined);assert(r.notes.some(n=>n.includes('fixed-swap-caller-root-allocation-not-carried:paired-classification-or-receiver-ownership')),r.notes.join('\n'));
});
test('legacy square scalable source stays on its original receiver when rectangular root authority is unavailable',()=>{
 const f=integration();f.target.anatomy.root={overridable:['size'],tokens:{width:'{drawing.size}',height:'{drawing.size}'}};(f.opts as any).fixedSwapOwnerRoots=undefined;
 for(const v of f.set.variants){const row=v.children![0].fixedSwaps!.Payload.observedInstances![0];row.size={width:7.25,height:7.25};}
 const r=f.propose(),c=ContractSchema.parse(r.contract),ref=walkAnatomy(c).find(p=>p.part.component?.id===f.target.id)!.part.component!;assert(ref.overrides?.size);assert.equal(ref.rootOverrides,undefined);assert(r.mintedTokens!.entries.some(e=>e.value==='7.25px'));assert(r.notes.some(n=>n.includes('captured local square size')));
});
test('unknown or contradictory structured parent tuples still refuse before dimensions can authorize a wider domain',()=>{
 const f=integration();f.set.variants[1].variantProperties={Power:'Unknown'};assert.throws(()=>f.propose(),(error:any)=>String(error.code).startsWith('EXACT_'));
 const duplicate=integration();duplicate.set.variants[1].name='Power=False';duplicate.set.variants[1].variantProperties={Power:'False'};assert.throws(()=>duplicate.propose(),(error:any)=>String(error.code).startsWith('EXACT_'));
});
