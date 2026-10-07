import {ContractSchema} from '../scripts/contract-schema.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifySourceTextAppearance,textAppearanceDemandsFromDumps,sourceTextAppearanceInput,selectSourceTextAppearance,inspectTextAppearance} from './source-text-appearance-control.js';
import {observeTextAppearance} from '../extract/figma/text-appearance-observation.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';

function fixture(){
 const characters='Text\nLearn more';
 const appearance=observeTextAppearance(characters,[{start:0,end:5,color:{r:0,g:0,b:0}},{start:5,end:15,color:{r:0,g:0,b:1}}].map(s=>({...s,characters:characters.slice(s.start,s.end),fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:s.color}]})))!;
 const leaf:DumpNode={name:'Description',type:'TEXT',nodeId:'2:3',text:{characters:'Default',fontSize:14,fontStyle:'Regular'}};
 const set:DumpSet={setName:'Card',type:'COMPONENT_SET',key:'set-key',variants:[{name:'Product',type:'COMPONENT',nodeId:'2:1',componentKey:'main-key',children:[{name:'Text',type:'FRAME',nodeId:'2:2',children:[leaf]}]}]};
 const root=structuredClone(set.variants[0]);root.nodeId='3:1';root.type='FRAME';root.children![0].nodeId='I3:1;2:2';const text=root.children![0].children![0];text.nodeId='I3:1;2:3';text.text={...leaf.text!,characters,sourceAppearance:appearance};
 const instance:DumpNode={name:'Renamed instance',type:'INSTANCE',nodeId:'3:1',instanceKey:'main-key',instanceSetKey:'set-key',instanceGeometry:{nodeId:'3:1',componentId:'2:1',transform:[[1,0,0],[0,1,0]],localSize:{width:280,height:100}},instanceContent:{root,propertyTypes:{}}};
 const parent:DumpSet={setName:'Parent',type:'COMPONENT',variants:[{name:'Parent',type:'COMPONENT',children:[instance]}]};
 const demand=()=>qualifySourceTextAppearance(set,instance,[0,0],'file');
 return {set,instance,parent,text,demand};
}
test('exact text appearance ownership survives display renaming without mutating source',()=>{
 const f=fixture(),before=JSON.stringify(f),d=f.demand();
 assert.equal(d.appearance.characters,'Text\nLearn more');assert.deepEqual(d.childPath,[0,0]);assert.equal(d.sourceNodeId,'2:3');assert.equal(JSON.stringify(f),before);
 f.set.setName='Different name';f.instance.name='Different instance';f.text.name='Different label';assert.deepEqual(f.demand(),d);
});
test('text appearance demand refuses foreign identity, changed text and nested instance ownership',()=>{
 const mutations:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.instance.instanceKey='foreign';},f=>{f.instance.instanceSetKey='foreign';},
  f=>{f.instance.instanceGeometry!.componentId='foreign';},f=>{f.instance.instanceGeometry!.nodeId='foreign';},
  f=>{f.instance.instanceContent!.root.nodeId='foreign';},f=>{f.text.nodeId='foreign';},
  f=>{f.text.text!.characters='Different text';},f=>{delete f.text.text!.sourceAppearance;},
  f=>{f.set.variants.push(structuredClone(f.set.variants[0]));},
  f=>{f.set.variants[0].children![0].type='INSTANCE';},
  f=>{f.instance.instanceContent!.root.children![0].type='INSTANCE';},
  f=>{f.set.contractId='authored.contract';},
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(f.demand,/text-appearance-/,String(mutate));}
 const f=fixture();for(const path of [[],[-1],[0,.5],[0,1]])assert.throws(()=>qualifySourceTextAppearance(f.set,f.instance,path,'file'),/text-appearance-/);
 assert.throws(()=>qualifySourceTextAppearance(f.set,f.instance,[0,0],''),/identity/);
});
test('standalone keyed definitions use the same direct-owner text proof',()=>{
 const f=fixture();f.set.type='COMPONENT';f.set.key='main-key';delete f.instance.instanceSetKey;assert.equal(f.demand().setKey,'main-key');
});
test('finite appearance choice includes exact characters, preserves omission and is order independent',()=>{
 const a=fixture().demand(),b=structuredClone(a);b.instanceId='second';b.instanceNodeId='Isecond;2:3';b.appearance.runs[1].fill.paint.color={r:1,g:0,b:0};
 const input=sourceTextAppearanceInput([b,a,a]);assert.deepEqual(input,sourceTextAppearanceInput([a,b]));assert.equal(input.choices.length,2);assert.equal(input.callers.length,2);
 assert.equal(selectSourceTextAppearance(input,undefined,'anything'),undefined);
 const selected=selectSourceTextAppearance(input,input.callers[0].value,a.appearance.characters)!;
 selected.runs[0].fontSize=99;assert.equal(input.choices[0].appearance.runs[0].fontSize,14);
 assert.throws(()=>selectSourceTextAppearance(input,input.callers[0].value,'changed caller text'),/characters-unqualified/);
 assert.throws(()=>selectSourceTextAppearance(input,'text99',a.appearance.characters),/value/);
 assert.throws(()=>sourceTextAppearanceInput([a,{...b,sourceNodeId:'foreign'}]),/owner/);
 assert.throws(()=>sourceTextAppearanceInput([a,{...b,instanceId:a.instanceId,instanceNodeId:a.instanceNodeId}]),/conflicting-caller/);
});
test('serialized text appearances are revalidated rather than trusting a typed field',()=>{
 const original=fixture().demand().appearance;
 for(const mutate of [(v:any)=>{v.runs[0]=null;},(v:any)=>{v.runs[1].start=6;},(v:any)=>{v.runs[0].fill.paint.blendMode='MULTIPLY';},(v:any)=>{v.runs[0].fontSize=NaN;},(v:any)=>{v.runs[1].fill={issue:'unsupported'};}]){const v=structuredClone(original);mutate(v);assert.throws(()=>inspectTextAppearance(v),/text-appearance-observation-unqualified/);}
});
test('discovery keeps unsupported and unlinked evidence named and never crosses nested owners',()=>{
 const f=fixture(),dump={Parent:f.parent,Child:f.set};
 const result=textAppearanceDemandsFromDumps(dump,'file');assert.deepEqual(result.notes,[]);assert.deepEqual(result.demands,[f.demand()]);
 f.set.variants[0].children![0].type='INSTANCE';const nested=textAppearanceDemandsFromDumps(dump,'file');assert.equal(nested.demands.length,0);assert.match(nested.notes[0],/crosses-instance-owner/);
 delete (dump as any).Child;const unlinked=textAppearanceDemandsFromDumps(dump,'file');assert.equal(unlinked.demands.length,0);assert.match(unlinked.notes[0],/main-ambiguous-or-missing/);
});

test('automatic proposals route an observed text appearance through the exact child input',async()=>{
 const {proposeBatchFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');const {ContractSchema,walkAnatomy}=await import('../scripts/contract-schema.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};f.instance.instanceOf='Card';
 f.parent.key='parent-key';f.parent.propertyDefinitions={};f.parent.variants[0].nodeId='4:1';f.parent.variants[0].variantProperties={};
 const dump={Parent:f.parent,Card:f.set},before=JSON.stringify(dump);
 const result=proposeBatchFromDump(dump,{fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(result.skipped,[]);
 const child=result.proposals.find(p=>p.setName==='Card')!,host=result.proposals.find(p=>p.setName==='Parent')!;
 assert.equal(child.textAppearanceBindings?.length,1);
 const binding=child.textAppearanceBindings![0];const ref=walkAnatomy(ContractSchema.parse(host.contract)).find(w=>w.part.component?.id===child.contract.id)!.part.component!;
 assert.equal(ref.props?.[binding.prop],'text1');assert.equal(JSON.stringify(dump),before);
});

test('main proposal rejects foreign appearance demands before emitting a control',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};
 const demand=f.demand(),opts={fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
 for(const change of [{fileKey:'foreign'},{sourceNodeId:'foreign'},{childPath:[0,1]},{instanceNodeId:'Iforeign;2:3'}])assert.throws(()=>proposeFromDump(f.set,{...opts,textAppearanceDemands:[{...demand,...change}]}),/text-appearance-demand-/);
 const child=proposeFromDump(f.set,{...opts,textAppearanceDemands:[demand]});
 const binding=child.textAppearanceBindings![0];assert.equal(typeof child.contract.id,'string');const childId=String(child.contract.id);
 f.instance.instanceOf='Card';f.parent.key='parent-key';f.parent.propertyDefinitions={};f.parent.variants[0].variantProperties={};
 const parentOpts={...opts,contractsById:new Map([[childId,ContractSchema.parse(child.contract)]]),contractIdByName:new Map([['Card',childId]]),contractIdByKey:new Map([['set-key',childId]]),textAppearanceBindingsByContract:new Map([[childId,[{...binding,contractRevision:'stale'}]]])};
 assert.throws(()=>proposeFromDump(f.parent,parentOpts),/text-appearance-argument-binding-unqualified/);
 parentOpts.textAppearanceBindingsByContract.set(childId,[binding]);f.text.text!.characters='stale';
 assert.throws(()=>proposeFromDump(f.parent,parentOpts),/text-appearance-argument-observation-unqualified/);
});
