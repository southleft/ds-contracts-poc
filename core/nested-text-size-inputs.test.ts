import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema,resolveLiterals} from '../scripts/contract-schema.js';
import {settleNestedTextSizes,observedScalarTextSize} from './nested-text-size-inputs.js';
import {reactEmitter} from './emitter.js';
import vm from 'node:vm';
import {scalarTextSizeInput} from '../packages/schema/src/scalar-text-size-input.js';
import {mapNativeTextSizes,NATIVE_SCALAR_TEXT_SIZE_FUNCTION} from './native-scalar-text-size.js';
import {createFigmaEngine,figmaRuntimeRevision} from './emit-figma-script.js';

function fixture(){
 const text:any={characters:'Label',fontFamily:'PingFang SC',fontStyle:'Regular',fontWeight:400,fontSize:14,lineHeight:22,letterSpacing:0,textAlign:'LEFT',textAutoResize:'WIDTH_AND_HEIGHT',sourceAppearance:{issue:'text-appearance-range-incomplete'}};
 const Label:any={setName:'Owned label',type:'COMPONENT_SET',nodeId:'item-set',key:'item-key',propertyDefinitions:{Layout:{type:'VARIANT',defaultValue:'vertical',variantOptions:['vertical']}},variants:[{name:'Layout=vertical',type:'COMPONENT',nodeId:'item-main',componentKey:'item-main-key',variantProperties:{Layout:'vertical'},children:[{name:'Any wrapper name',type:'FRAME',nodeId:'label-wrap',children:[{name:'Any text name',type:'TEXT',nodeId:'label-node',text}]}]}]};
 const Carrier:any={setName:'Carrier',type:'COMPONENT',nodeId:'carrier-main',key:'carrier-key',propertyDefinitions:{'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'item-main'}},variants:[{name:'Carrier',type:'COMPONENT',nodeId:'carrier-main',children:[{name:'Renamed placeholder',type:'INSTANCE',nodeId:'slot-node',instanceSetKey:'item-key',instanceKey:'item-main-key',propRefs:{mainComponent:'Payload'}}]}]};
 const witness:any={kind:'scalar-text-size-v1',lineHeightUnit:'PIXELS',ownerId:'carrier-use',ownerComponentId:'carrier-main',ownerComponentKey:'carrier-key',target:{nodeId:'Icarrier-use;slot-node;label-node',instanceId:'Icarrier-use;slot-node',componentId:'item-main',instancePath:[0],childPath:[0,0]},text:{...text,fontSize:12,lineHeight:20},characterStyleOverrides:[],styleOverrideTable:{}};
 const host:any={name:'Renamed carrier',type:'INSTANCE',nodeId:'carrier-use',instanceKey:'carrier-key',instanceGeometry:{componentId:'carrier-main'},fixedSwaps:{Payload:{id:'item-main',key:'item-main-key',observedInstances:[{nodeId:'Icarrier-use;slot-node',componentId:'item-main',path:[0]}]}},hostOverrides:[{path:'Names do not authorize',fields:['inheritTextStyleId','text'],textSizeOverride:witness}]};
 const Parent:any={setName:'Parent',type:'COMPONENT',nodeId:'parent-main',key:'parent-key',variants:[{name:'Parent',type:'COMPONENT',nodeId:'parent-main',children:[host]}]};
 const make=(id:string,name:string,key:string,nodeId:string,props:any[],root:any)=>ContractSchema.parse({id,name,description:'Scalar text owner regression',version:'0.1.0',status:'draft',semantics:{element:'div'},states:[],props,bindings:{code:{anchors:{importPath:'./'+name,export:name}},figma:{anchors:{fileKey:'file',componentSetKey:key,nodeId}}},anatomy:{root}});
 const label=make('ds.label','OwnedLabel','item-key','item-set',[{name:'layout',type:{enum:['vertical']},default:'vertical',bindings:{code:{prop:'layout'},figma:{kind:'VARIANT',property:'Layout',values:{vertical:'vertical'}}}}],{parts:{title:{text:'Label',literals:{'font-size':'14px','line-height':'22px'},declared:{'font-family':'PingFang SC'}}}});
 const carrier=make('ds.carrier','Carrier','carrier-key','carrier-main',[],{parts:{payload:{slot:{name:'payload',bindings:{figma:{property:'Payload'}},defaultContent:[{id:label.id,props:{layout:'vertical'}}],renderDefault:true},parts:{fallback:{component:{id:label.id,props:{layout:'vertical'}}}}}}});
 const parent=make('ds.parent','Parent','parent-key','parent-main',[],{parts:{host:{component:{id:carrier.id,contentSlots:{payload:['selected']}},parts:{selected:{component:{id:label.id,props:{layout:'vertical'}}}}}}});
 const proposal=(setName:string,contract:any,more:any={})=>({setName,contract,notes:[],unbound:[],...more});
 const proposals:any[]=[proposal(Label.setName,label,{sourceTextParts:[{nodeId:'label-node',partKey:'title'}]}),proposal('Carrier',carrier),proposal('Parent',parent,{sourceInstanceParts:[{nodeId:'carrier-use',partKey:'host',childId:carrier.id}]})];
 return {dump:{[Label.setName]:Label,Carrier,Parent},host,witness,proposals,text,label};
}

test('scalar source typography uses optional literal choice and leaves default and unrelated channels intact',()=>{
 const f=fixture(),before=JSON.stringify(f.dump),base=structuredClone(f.label);
 settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
 const owner=ContractSchema.parse(f.proposals[0].contract),parent=ContractSchema.parse(f.proposals[2].contract),part=owner.anatomy.root.parts!.title;
 const input=owner.props.find(p=>p.name!=='layout')!;assert(input,JSON.stringify(f.proposals.map(p=>p.notes)));assert.equal(input.default,undefined);assert.equal(input.required,undefined);assert.equal(input.bindings.figma.kind,'NONE');
 assert.deepEqual(resolveLiterals(part,{}),base.anatomy.root.parts!.title.literals);
 assert.deepEqual(resolveLiterals(part,{[input.name]:'size12Line20'}),{'font-size':'12px','line-height':'20px'});
 assert.deepEqual(part.declared,base.anatomy.root.parts!.title.declared);assert.deepEqual(part.tokens,base.anatomy.root.parts!.title.tokens);
 assert.deepEqual(parent.anatomy.root.parts!.host.parts!.selected.component!.props,{layout:'vertical',[input.name]:'size12Line20'});
 assert.equal(JSON.stringify(f.dump),before);
 const contracts=new Map(f.proposals.map(p=>[p.contract.id,p.contract]));
 const files=reactEmitter.emit(owner,{contracts,icons:new Map(),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}});
 const css=files.find(f=>f.path.endsWith('.css'))!.contents;assert.match(css,/font-size: 14px/);assert.match(css,/font-size: 12px/);assert.match(css,/line-height: 20px/);
});

test('stale targets swapped ownership duplicate rows and unsupported typography refuse atomically',()=>{
 const mutations:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.witness.ownerComponentKey='other';},f=>{f.witness.target.nodeId+='wrong';},f=>{f.witness.target.componentId='other';},
  f=>{f.witness.target.instancePath=[1];},f=>{f.witness.target.childPath=[0,1];},
  f=>{f.host.fixedSwaps.Payload.key='other';},f=>{f.host.fixedSwaps.Payload.observedInstances.push(structuredClone(f.host.fixedSwaps.Payload.observedInstances[0]));},
  f=>{f.host.hostOverrides.push(structuredClone(f.host.hostOverrides[0]));},
  f=>{f.witness.text.fontFamily='Other';},f=>{f.witness.text.fontStyle='Medium';},f=>{f.witness.text.fontSize=NaN;},
  f=>{f.witness.text.lineHeight=Infinity;},f=>{f.witness.text.textAutoResize='HEIGHT';},
  f=>{f.witness.characterStyleOverrides=[0,0,1,0,0];},f=>{f.witness.characterStyleOverrides=new Array(5);},
  f=>{f.witness.styleOverrideTable={1:{fontSize:10}};},f=>{f.witness.text.fontSizeVar='bound.size';},
  f=>{f.witness.text.sourceAppearance={issue:'text-appearance-font-unqualified'};},
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedTextSizes(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,String(mutate));assert(f.proposals[2].notes.some((n:string)=>n.includes('nested-text-size-not-carried')),String(mutate));}
});

test('equal size facts are deterministic no-ops and protected or ambiguous source owners keep defaults',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.witness.text.fontSize=14;f.witness.text.lineHeight=22;},
  (f:ReturnType<typeof fixture>)=>{f.proposals[0].sourceTextParts.push({...f.proposals[0].sourceTextParts[0]});},
 ]){const f=fixture();mutate(f);const before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedTextSizes(f.dump,'file',f.proposals,new Set());assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before);}
 const f=fixture(),before=JSON.stringify(f.proposals.map(p=>p.contract));settleNestedTextSizes(f.dump,'file',f.proposals,new Set(['ds.label']));assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before);
 const one=fixture(),two=fixture();settleNestedTextSizes(one.dump,'file',one.proposals,new Set());settleNestedTextSizes(two.dump,'file',two.proposals,new Set());assert.deepEqual(one.proposals,two.proposals);
});

test('scalar eligibility refuses missing font facts and preserves the separate rich-text boundary',()=>{
 const f=fixture();assert.deepEqual(observedScalarTextSize(f.witness,{type:'TEXT',name:'different',text:f.text}),{'font-size':'12px','line-height':'20px'});
 for(const key of ['fontFamily','fontStyle','fontWeight','letterSpacing','textAlign','textAutoResize']){const g=fixture();delete g.text[key];delete g.witness.text[key];assert.equal(observedScalarTextSize(g.witness,{type:'TEXT',name:'x',text:g.text}),undefined,key);}
 const g=fixture();g.witness.text.sourceAppearance={characters:'Label',runs:[{},{}]};assert.equal(observedScalarTextSize(g.witness,{type:'TEXT',name:'x',text:g.text}),undefined);
});

test('shared structural predicate refuses competing uses or broader literal styling',()=>{
 const f=fixture();settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
 const c=ContractSchema.parse(f.proposals[0].contract),name=c.props[1].name;
 assert(scalarTextSizeInput(c,name));
 for(const mutate of [
  (c:any)=>{c.props[1].default='size12Line20';},
  (c:any)=>{c.anatomy.root.visibleWhen={prop:name,equals:'size12Line20'};},
  (c:any)=>{c.anatomy.root.parts.title.literalsByProp[0].map.size12Line20.color='#000000';},
  (c:any)=>{c.anatomy.root.parts.title.literalsByProp[0].map.size12Line20['font-size']='var(--unknown)';},
  (c:any)=>{c.anatomy.root.parts.other={text:'Other',literalsByProp:structuredClone(c.anatomy.root.parts.title.literalsByProp)};},
 ]){const bad=structuredClone(c);mutate(bad);assert.equal(scalarTextSizeInput(bad,name),undefined);}
});

test('native direct reference compiles the same selected size and exact owned target',async()=>{
 const f=fixture();settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
 const owner=ContractSchema.parse(f.proposals[0].contract),parent=ContractSchema.parse(f.proposals[2].contract),name=owner.props[1].name;
 const map=mapNativeTextSizes(owner,{[name]:'size12Line20'},{});assert(map);
 assert.deepEqual(Object.values(map),[{characters:'Label',fontSize:12,lineHeight:20}]);
 assert.equal(mapNativeTextSizes(owner,{},{}),undefined);
 assert.throws(()=>mapNativeTextSizes(owner,{[name]:'unknown'},{}),/scalar-text-size-native-value/);
 const contracts=new Map(f.proposals.map(p=>[p.contract.id,p.contract]));
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(parent,contracts);assert(JSON.stringify(data).includes('instanceTextSizes'));
 const own=engine.compileComponentData(owner,contracts);assert(JSON.stringify(own).includes('textSizeTarget'));
});

test('native whole-node setter preserves other text facts and rejects wrong target or refused readback',async()=>{
 const f=fixture();settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
 const owner=ContractSchema.parse(f.proposals[0].contract),name=owner.props[1].name,sizes=mapNativeTextSizes(owner,{[name]:'size12Line20'},{}),key=Object.keys(sizes!)[0];
 const make=()=>({type:'TEXT',children:[],characters:'Label',fontName:{family:'PingFang SC',style:'Regular'},fontWeight:400,fontSize:14,lineHeight:{unit:'PIXELS',value:22},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:{r:0,g:0,b:0}}],boundVariables:{fontSize:{id:'old-size'},fills:[{id:'ink'}]},getSharedPluginData:(_ns:string,k:string)=>k==='textSizeOverride'?key:'',setBoundVariable(k:string,v:unknown){if(v===null)delete(this.boundVariables as any)[k];}});
 const run=async(target:any,children:any[]=[target])=>{const sandbox:any={node:{type:'INSTANCE',children},spec:{instanceTextSizes:sizes},figma:{mixed:Symbol('mixed'),skipInvisibleInstanceChildren:true,loadFontAsync:async()=>{}}};await vm.runInNewContext('(async()=>{'+NATIVE_SCALAR_TEXT_SIZE_FUNCTION+';await applyInstanceTextSizes(node,spec);})()',sandbox);assert.equal(sandbox.figma.skipInvisibleInstanceChildren,true);};
 const target=make(),before=structuredClone({characters:target.characters,fontName:target.fontName,fontWeight:target.fontWeight,fills:target.fills,letterSpacing:target.letterSpacing});await run(target);assert.equal(target.fontSize,12);assert.equal(target.lineHeight.value,20);assert.deepEqual({characters:target.characters,fontName:target.fontName,fontWeight:target.fontWeight,fills:target.fills,letterSpacing:target.letterSpacing},before);
 await assert.rejects(run(make(),[]),/target-unqualified/);await assert.rejects(run(make(),[make(),make()]),/target-unqualified/);
 const wrong=make();wrong.characters='Other';await assert.rejects(run(wrong),/source-unqualified/);
 const refused=make();Object.defineProperty(refused,'fontSize',{get:()=>14,set:()=>{}});await assert.rejects(run(refused),/readback-mismatch/);
});

test('scalar domain exclusion requires an independent one-child local allocation',()=>{
 const f=fixture();settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
 const c=ContractSchema.parse(f.proposals[0].contract),name=c.props[1].name;
 const geometry={localSize:{width:14,height:14},transform:[[1,0,0],[0,1,0]]};
 c.anatomy.root.parts!.tip={layout:{display:'flex',direction:'row'},parts:{allocation:{component:{id:'ds.icon'},instanceAffineLayout:{props:['layout'],rows:[{values:['vertical'],geometry:geometry as any,fill:{width:false,height:false}}]}}}};
 assert(scalarTextSizeInput(c,name));
 for(const mutate of [
  (c:any)=>{c.anatomy.root.parts.tip.parts.other={text:'Other'};},
  (c:any)=>{c.anatomy.root.parts.tip.parts.allocation.instanceAffineLayout.rows[0].fill.height=true;},
  (c:any)=>{c.anatomy.root.parts.tip.parts.allocation.instanceAffineLayout.rows[0].geometry.parentSize={width:20,height:20};},
  (c:any)=>{c.anatomy.root.parts.tip.layout.grow=true;},
  (c:any)=>{c.anatomy.root.parts.tip.parts.title=c.anatomy.root.parts.title;delete c.anatomy.root.parts.title;},
 ]){const bad=structuredClone(c);mutate(bad);assert.equal(scalarTextSizeInput(bad,name),undefined);}
});

test('padded and runtime-boxed native text retain markers on actual TEXT nodes',async()=>{
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 for(const kind of ['padding','width']){
  const f=fixture();settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
  const owner=ContractSchema.parse(f.proposals[0].contract),parent=ContractSchema.parse(f.proposals[2].contract),part=owner.anatomy.root.parts!.title;
  if(kind==='padding')part.literals!['padding-bottom']='2px';else part.literals!.width='80px';
  f.proposals[0].contract=owner;
  const contracts=new Map(f.proposals.map(p=>[p.contract.id,p.contract]));
  const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),mock=createFigmaMock();
  const sandbox=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}}),run=(code:string)=>vm.runInContext('(async()=>{'+code+'\n})()',sandbox);
  await run(engine.buildTokensScript(null));for(const c of contracts.values())await run(engine.buildComponentScript(c,contracts));
  const node=mock.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;assert(node);
  const marked=node.findAll((n:any)=>!!n.getSharedPluginData('ds_contracts','textSizeOverride'));
  assert(marked.length>0,kind);assert(marked.every((n:any)=>n.type==='TEXT'),kind);assert(marked.some((n:any)=>n.fontSize===12&&n.lineHeight.value===20),kind);
 }
});


function slotSizeFixture(){
 const f=fixture();settleNestedTextSizes(f.dump,'file',f.proposals,new Set());
 const owner=ContractSchema.parse(f.proposals[0].contract),input=owner.props.find(p=>p.name!=='layout')!.name;
 const parent=ContractSchema.parse({...f.proposals[2].contract,props:[],
  anatomy:{root:{layout:{display:'flex'},parts:{body:{slot:{name:'content',renderDefault:true,defaultContent:[{id:owner.id,props:{layout:'vertical',[input]:'size12Line20'}}]}}}}}});
 const contracts=new Map([[owner.id,owner],[parent.id,parent]]),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 return {owner,parent,input,contracts,tokens};
}

test('ordinary slot default maps scalar size, preserves omission, and refuses unknown values',()=>{
 const f=slotSizeFixture(),engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),data=engine.compileComponentData(f.parent,f.contracts);
 const defaults=data.variants.map(v=>v.spec.children![0].slotDefault![0]);
 assert.deepEqual(Object.values(defaults[0].instanceTextSizes!),[{characters:'Label',fontSize:12,lineHeight:20}]);
 assert(defaults.every(item=>!Object.hasOwn(item.props??{},f.input)),'NONE input is consumed only as the scalar operation');
 assert.match(figmaRuntimeRevision(data),/text-appearance-property-finalization-v1/);
 const omitted=structuredClone(f.parent);delete omitted.anatomy.root.parts!.body.slot!.defaultContent![0].props![f.input];
 const omittedData=engine.compileComponentData(omitted,new Map([[f.owner.id,f.owner],[omitted.id,omitted]]));
 assert(!figmaRuntimeRevision(omittedData).includes('text-appearance-property-finalization-v1'));
 const bad=structuredClone(f.parent);bad.anatomy.root.parts!.body.slot!.defaultContent![0].props![f.input]='unknown';
 assert.throws(()=>engine.compileComponentData(bad,new Map([[f.owner.id,f.owner],[bad.id,bad]])),/scalar-text-size-native-value-unqualified/);
});

test('ordinary slot defaults apply and finalize scalar size on the cloned owned text',async()=>{
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const f=slotSizeFixture(),engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),mock=createFigmaMock();
 // Model a native refresh on append: finalization must restore the selected
 // scalar after the newly created instance joins its slot.
 const createComponent=(mock.figma as any).createComponent.bind(mock.figma);let refreshes=0;
 (mock.figma as any).createComponent=()=>{const comp=createComponent(),createSlot=comp.createSlot.bind(comp);comp.createSlot=()=>{const slot=createSlot(),append=slot.appendChild.bind(slot);slot.appendChild=(node:any)=>{append(node);for(const text of node.findAll?.((n:any)=>!!n.getSharedPluginData('ds_contracts','textSizeOverride'))??[]){text.fontSize=14;text.lineHeight={unit:'PIXELS',value:22};refreshes++;}};return slot;};return comp;};
 const sandbox=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}}),run=(script:string)=>vm.runInContext('(async()=>{'+script+'\n})()',sandbox);
 const omitted=structuredClone(f.parent);omitted.id='ds.omitted';omitted.name='Omitted';delete omitted.anatomy.root.parts!.body.slot!.defaultContent![0].props![f.input];f.contracts.set(omitted.id,omitted);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.owner,f.contracts));await run(engine.buildComponentScript(f.parent,f.contracts));await run(engine.buildComponentScript(omitted,f.contracts));
 assert(refreshes>0);
 for(const [id,size,line]of [[f.parent.id,12,20],[omitted.id,14,22]] as const){
  const parent=mock.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===id)!;assert(parent);
  const texts=parent.findAll((n:any)=>!!n.getSharedPluginData('ds_contracts','textSizeOverride'));assert.equal(texts.length,1);
  assert.equal(texts[0].type,'TEXT');assert.equal(texts[0].fontSize,size);assert(texts[0].lineHeight);assert.equal(texts[0].lineHeight.value,line);
 }
 const main=mock.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===f.owner.id)!;
 assert(main.findAll!((n:any)=>n.type==='TEXT').every((n:any)=>n.fontSize===14&&n.lineHeight.value===22),'main defaults remain unchanged');
});
