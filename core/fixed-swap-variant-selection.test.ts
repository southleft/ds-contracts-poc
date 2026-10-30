import assert from 'node:assert/strict';
import test from 'node:test';
import {fixedSwapOwnerRoots,fixedSwapVariantOwner,qualifyFixedSwapVariantSelection,qualifyFixedSwapRootAllocation,capturedSelectedDefaultsMatch} from './fixed-swap-root-allocation.js';
import {qualifyCharacterOwnerDomain,characterBindingMatches} from './source-character-control.js';
import {revisionOf} from './contract-provenance.js';
import {ContractSchema,walkAnatomy,resolvePresence} from '../scripts/contract-schema.js';
import {proposeFromDump,asMinimalChildContract,proposeDeclaredDrawnCandidate} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const layout={mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'} as const;
const base={version:'0.1.0',status:'draft',description:'Exact selected source ownership fixture',semantics:{element:'div'},states:[]};
const anchors=(key:string,id:string,name:string)=>({figma:{anchors:{fileKey:'fixture',componentSetKey:key,nodeId:id}},code:{anchors:{importPath:'./'+name,export:name}}});
function fixture(){
 const source:DumpSet={setName:'Selected',type:'COMPONENT_SET',key:'selected-set-key',nodeId:'selected-set',propertyDefinitions:{
  Layout:{type:'VARIANT',defaultValue:'Horizontal',variantOptions:['Horizontal','Vertical']},Enabled:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']}},
  variants:['Horizontal','Vertical'].flatMap((Layout,i)=>['False','True'].map((Enabled,j)=>({name:`Layout=${Layout}, Enabled=${Enabled}`,type:'COMPONENT',nodeId:`main-${i}-${j}`,componentKey:`main-key-${i}-${j}`,variantProperties:{Layout,Enabled},bbox:{width:360,height:52}})))};
 const target=ContractSchema.parse({...base,id:'test.selected',name:'Selected',props:[
  {name:'layout',type:{enum:['horizontal','vertical']},default:'horizontal',bindings:{code:{prop:'layout'},figma:{kind:'VARIANT',property:'Layout',values:{horizontal:'Horizontal',vertical:'Vertical'}}}},
  {name:'enabled',type:'boolean',default:false,bindings:{code:{prop:'enabled'},figma:{kind:'VARIANT',property:'Enabled',values:{false:'False',true:'True'}}}}],anatomy:{root:{text:'Selected body'}},bindings:anchors(source.key!,source.nodeId!,'Selected')});
 const swap={id:'main-1-1',key:'main-key-1-1'},roots=()=>fixedSwapOwnerRoots([source]);
 return {source,target,swap,roots};
}
test('selected variant ownership maps all structured axes to canonical typed values, never names or defaults',()=>{
 const f=fixture(),before=JSON.stringify(f);assert.deepEqual(qualifyFixedSwapVariantSelection(f.swap,f.roots(),f.target,'fixture'),{layout:'vertical',enabled:true});
 assert.equal(fixedSwapVariantOwner(f.swap,f.roots())!.setKey,f.source.key);assert.equal(JSON.stringify(f),before);
 f.source.variants[3].name='renamed without any axis words';assert.deepEqual(qualifyFixedSwapVariantSelection(f.swap,f.roots(),f.target,'fixture'),{layout:'vertical',enabled:true});
});
test('variant selection refuses incomplete, ambiguous, stale or unavailable source/contract identities',()=>{
 const poison:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.swap.key='foreign';},f=>{f.source.variants[3].nodeId='foreign';},f=>{f.source.variants.push(structuredClone(f.source.variants[3]));},
  f=>{delete f.source.variants[3].variantProperties!.Layout;},f=>{f.source.variants[3].variantProperties!.Layout='Unknown';},
  f=>{f.target.bindings.figma.anchors.nodeId='other-set';},f=>{f.target.bindings.figma.anchors.fileKey='foreign';},
  f=>{f.target.props[0].bindings.figma.values={horizontal:'Horizontal'};},
  f=>{f.target.props[0].bindings.figma.values={horizontal:'Vertical',vertical:'Vertical'};},
  f=>{f.target.props.push({name:'requiredText',type:'text',required:true,bindings:{code:{prop:'requiredText'},figma:{kind:'TEXT',property:'Text'}}});},
  f=>{f.target.bindings.figma.absentVariants=[{layout:'vertical',enabled:true}];},
 ];for(const mutate of poison){const f=fixture();mutate(f);assert.equal(qualifyFixedSwapVariantSelection(f.swap,f.roots(),f.target,'fixture'),undefined,String(mutate));}
});
function callerFixture(){
 const f=fixture(),sample=ContractSchema.parse({...base,id:'test.sample',name:'Sample',props:[],anatomy:{root:{text:'Sample only'}},bindings:anchors('sample-key','sample-main','Sample')});
 const child=ContractSchema.parse({...base,id:'test.host',name:'Host',props:[],anatomy:{root:{parts:{content:{slot:{name:'children',bindings:{figma:{property:'Payload'}},defaultContent:[{id:sample.id}]}}}}},bindings:anchors('host-key','host-main','Host')});
 const source:DumpSet={setName:'Caller',type:'COMPONENT_SET',key:'caller-key',nodeId:'caller-set',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']}},variants:['One','Two'].map((Mode,i)=>({name:'Mode='+Mode,type:'COMPONENT',nodeId:'caller-'+i,variantProperties:{Mode},layout:layout as any,children:[{name:'Host',type:'INSTANCE',nodeId:'host-'+i,instanceOf:'Host',instanceKey:'host-key',fixedSwaps:{Payload:{...f.swap}}}]}))};
 const scope=new Map([child,sample,f.target].map(c=>[c.id,c]));
 const propose=()=>proposeFromDump(source,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Host',child.id]]),contractIdByKey:new Map([['host-key',child.id],['sample-key',sample.id],['selected-set-key',f.target.id]]),contractsById:new Map([...scope].map(([id,c])=>[id,asMinimalChildContract(c)])),fixedSwapOwnerRoots:f.roots()});
 return {...f,child,sourceCaller:source,scope,propose};
}
test('ordinary proposer emits the selected owning contract with exact values and preserves sample content',()=>{
 const f=callerFixture(),before=JSON.stringify([...f.scope]);const proposal=f.propose(),c=ContractSchema.parse(proposal.contract);
 const caller=walkAnatomy(c).find(w=>w.part.component?.id===f.child.id)!.part;
 assert.deepEqual(Object.values(caller.parts!).map(p=>p.component),[{id:f.target.id,props:{layout:'vertical',enabled:true}}]);
 assert.equal(JSON.stringify([...f.scope]),before);assert.equal(f.child.anatomy.root.parts!.content.slot!.defaultContent![0].id,'test.sample');
});
test('a swapped label that differs from the child default is passed on the caller',()=>{
 const f=callerFixture();
 f.target.props.push({name:'label',type:'text',default:'Button',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Button Text'}}});
 for(const variant of f.sourceCaller.variants)variant.children![0].fixedSwaps!.Payload.observedInstances=[{selectedRoot:{properties:{'Show Icon#1:2':false,'Button Text#37:10':'Action'}}} as never];
 const c=ContractSchema.parse(f.propose().contract),host=walkAnatomy(c).find(w=>w.part.component?.id===f.child.id)!.part;
 assert.deepEqual(Object.values(host.parts!).map(p=>p.component!.props),[{layout:'vertical',enabled:true,label:'Action'}]);
 const changed=callerFixture();
 changed.target.props.push({name:'label',type:'text',default:'Button',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Button Text'}}});
 changed.sourceCaller.variants[0].children![0].fixedSwaps!.Payload.observedInstances=[{selectedRoot:{properties:{'Button Text#37:10':'Action'}}} as never];
 changed.sourceCaller.variants[1].children![0].fixedSwaps!.Payload.observedInstances=[{selectedRoot:{properties:{'Button Text#37:10':'Other'}}} as never];
 const mixed=ContractSchema.parse(changed.propose().contract);
 assert.equal(Object.values(walkAnatomy(mixed).find(w=>w.part.component?.id===changed.child.id)!.part.parts!).some(part=>part.component?.props?.label!==undefined),false);
});
test('a false show-slot still carries the glyph its selected variant draws',()=>{
 const icon=ContractSchema.parse({...base,id:'test.icon',name:'Icon',props:[],anatomy:{root:{text:'glyph',overridable:['size']}},bindings:anchors('icon-key','icon-main','Icon')});
 const iconSet:DumpSet={setName:'Icon',type:'COMPONENT',key:'icon-key',nodeId:'icon-main',variants:[{name:'Icon',type:'COMPONENT',nodeId:'icon-main',componentKey:'icon-key'}]};
 const propose=(f:ReturnType<typeof callerFixture>,hidden:boolean)=>{
  f.target.anatomy.root={parts:{leftIcon:{slot:{name:'leftIcon',bindings:{figma:{property:'Left Icon'}},defaultContent:[{id:'test.circle'}]}}}};
  const selected=f.source.variants.find(variant=>variant.nodeId==='main-1-1')!;
  selected.children=[{name:'Icon',type:'INSTANCE',nodeId:'icon-child',hidden,propRefs:{mainComponent:'Left Icon'},instanceGeometry:{localSize:{width:16,height:16}} as never}];
  for(const variant of f.sourceCaller.variants)variant.children![0].fixedSwaps!.Payload.observedInstances=[{selectedRoot:{properties:{'Show Left Icon#37:11':false,'Left Icon#46:0':'icon-main',Layout:'Vertical',Enabled:'True'}}} as never];
  const scope=new Map([...f.scope].map(([id,contract])=>[id,asMinimalChildContract(contract)]));
  scope.set(icon.id,asMinimalChildContract(icon));
  return proposeFromDump(f.sourceCaller,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Host',f.child.id]]),contractIdByKey:new Map([['host-key',f.child.id],['sample-key','test.sample'],['selected-set-key',f.target.id],['icon-key',icon.id]]),contractsById:scope,fixedSwapOwnerRoots:fixedSwapOwnerRoots([f.source,iconSet])});
 };
 const drawn=propose(callerFixture(),false),c=ContractSchema.parse(drawn.contract);
 const selected=walkAnatomy(c).find(part=>part.part.component?.id==='test.selected')!.part;
 assert.deepEqual(selected.component!.contentSlots,{leftIcon:['selectedGlyph']});
 assert.equal(selected.parts!.selectedGlyph.component!.id,'test.icon');
 assert.match(String(selected.parts!.selectedGlyph.component!.overrides?.size),/^\{imported\..+\}$/);
 assert(drawn.notes.some(note=>note.includes('still draws leftIcon')));
 const hidden=propose(callerFixture(),true),hiddenContract=ContractSchema.parse(hidden.contract);
 const hiddenSelected=walkAnatomy(hiddenContract).find(part=>part.part.component?.id==='test.selected')!.part;
 assert.equal(hiddenSelected.component!.contentSlots,undefined);
 assert.equal(hiddenSelected.parts,undefined);
});
test('a conditional swap keeps the glyph only on the variant that still draws it',()=>{
 const f=callerFixture();
 const icon=ContractSchema.parse({...base,id:'test.icon',name:'Icon',props:[],anatomy:{root:{text:'glyph'}},bindings:anchors('icon-key','icon-main','Icon')});
 const buttons:DumpSet={setName:'Buttons',type:'COMPONENT_SET',key:'btn-set',nodeId:'btn-set',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Icon',variantOptions:['Icon','Text']}},variants:[
  {name:'Size=Icon',type:'COMPONENT',nodeId:'btn-icon',componentKey:'btn-icon-key',variantProperties:{Size:'Icon'},children:[{name:'Glyph',type:'INSTANCE',hidden:false,propRefs:{mainComponent:'Payload'}}]},
  {name:'Size=Text',type:'COMPONENT',nodeId:'btn-text',componentKey:'btn-text-key',variantProperties:{Size:'Text'},children:[{name:'Glyph',type:'INSTANCE',hidden:true,propRefs:{mainComponent:'Payload'}}]},
 ]};
 const hosts=f.sourceCaller.variants.map(variant=>variant.children![0]);
 hosts[0].instanceGeometry={componentId:'btn-icon'} as never;
 hosts[0].componentProperties={'Show Payload#1:2':false};
 hosts[0].fixedSwaps!.Payload={id:'icon-main',key:'icon-key'};
 hosts[1].instanceGeometry={componentId:'btn-text'} as never;
 hosts[1].componentProperties={'Show Payload#1:2':false};
 const scope=new Map([...f.scope].map(([id,contract])=>[id,asMinimalChildContract(contract)]));
 scope.set(icon.id,asMinimalChildContract(icon));
 const proposal=proposeFromDump(f.sourceCaller,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Host',f.child.id]]),contractIdByKey:new Map([['host-key',f.child.id],['sample-key','test.sample'],['selected-set-key',f.target.id],['icon-key',icon.id]]),contractsById:scope,fixedSwapOwnerRoots:fixedSwapOwnerRoots([f.source,buttons,{setName:'Icon',type:'COMPONENT',key:'icon-key',nodeId:'icon-main',variants:[{name:'Icon',type:'COMPONENT',nodeId:'icon-main',componentKey:'icon-key'}]}])});
 const c=ContractSchema.parse(proposal.contract);
 const selected=Object.values(walkAnatomy(c).find(part=>part.part.component?.id===f.child.id)!.part.parts!);
 assert.equal(selected.length,1);
 assert.equal(selected[0].component!.id,'test.icon');
 assert.equal(selected[0].presenceByCombination!.rows.filter(row=>row.present).length,1);
 assert(proposal.notes.some(note=>note.includes('conditional occurrence')));
});
test('a true show-slot does not invent an icon the selected variant omits',()=>{
 const f=callerFixture();
 const icon=ContractSchema.parse({...base,id:'test.icon',name:'Icon',props:[],anatomy:{root:{text:'glyph'}},bindings:anchors('icon-key','icon-main','Icon')});
 const buttons:DumpSet={setName:'Buttons',type:'COMPONENT',key:'btn-key',nodeId:'btn-main',variants:[{name:'Icon size',type:'COMPONENT',nodeId:'btn-main',componentKey:'btn-key',children:[{name:'Label',type:'TEXT'}]}]};
 for(const host of f.sourceCaller.variants.map(variant=>variant.children![0])){
  host.instanceGeometry={componentId:'btn-main'} as never;
  host.componentProperties={'Show Payload#1:2':true};
  host.fixedSwaps!.Payload={id:'icon-main',key:'icon-key'};
 }
 const scope=new Map([...f.scope].map(([id,contract])=>[id,asMinimalChildContract(contract)]));
 scope.set(icon.id,asMinimalChildContract(icon));
 const proposal=proposeFromDump(f.sourceCaller,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['Host',f.child.id]]),contractIdByKey:new Map([['host-key',f.child.id],['sample-key','test.sample'],['selected-set-key',f.target.id],['icon-key',icon.id]]),contractsById:scope,fixedSwapOwnerRoots:fixedSwapOwnerRoots([f.source,buttons,{setName:'Icon',type:'COMPONENT',key:'icon-key',nodeId:'icon-main',variants:[{name:'Icon',type:'COMPONENT',nodeId:'icon-main',componentKey:'icon-key'}]}])});
 const c=ContractSchema.parse(proposal.contract);
 assert.equal(walkAnatomy(c).find(part=>part.part.component?.id===f.child.id)!.part.parts,undefined);
 assert(proposal.notes.some(note=>note.includes('hidden by its show-slot boolean')));
});
test('conditional selections retain two exact branches while missing source identity carries neither',()=>{
 const f=callerFixture();f.sourceCaller.variants[0].children![0].fixedSwaps!.Payload={id:'main-0-0',key:'main-key-0-0'};
 const c=ContractSchema.parse(f.propose().contract),host=walkAnatomy(c).find(w=>w.part.component?.id===f.child.id)!.part;
 const parts=Object.values(host.parts!);assert.equal(parts.length,2);assert(parts.every(p=>p.presenceByCombination));
 assert.deepEqual(parts.map(p=>p.component!.props).sort((a,b)=>String(a!.layout).localeCompare(String(b!.layout))),[{layout:'horizontal',enabled:false},{layout:'vertical',enabled:true}]);
 f.sourceCaller.variants[1].children![0].fixedSwaps!.Payload.key='stale';
 assert.equal(walkAnatomy(ContractSchema.parse(f.propose().contract)).find(w=>w.part.component?.id===f.child.id)!.part.parts,undefined);
});
test('affine child retains exact structural membership under an independent live Boolean host',()=>{
 const child=ContractSchema.parse({...base,id:'test.glyph',name:'Glyph',props:[],anatomy:{root:{instanceRootInputs:['width','height'],literals:{width:'14px',height:'14px'},text:'?'}},bindings:anchors('glyph-key','glyph-main','Glyph')});
 const matrix:[[number,number,number],[number,number,number]]=[[1,-1.2246468525851679e-16,52],[1.2246468525851679e-16,1,4]];
 const source:DumpSet={setName:'Label',key:'label-key',nodeId:'label-set',type:'COMPONENT_SET',propertyDefinitions:{Layout:{type:'VARIANT',defaultValue:'Horizontal',variantOptions:['Horizontal','Vertical']},Kind:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']},Hint:{type:'BOOLEAN',defaultValue:false}},boolDefaults:{Hint:false},variants:['Horizontal','Vertical'].flatMap(Layout=>['One','Two'].map(Kind=>({name:`Layout=${Layout}, Kind=${Kind}`,nodeId:`label-${Layout}-${Kind}`,type:'COMPONENT',variantProperties:{Layout,Kind},layout:layout as any,children:Layout==='Horizontal'?[]:[{name:'Question',nodeId:'question-'+Kind,type:'INSTANCE',hidden:true,propRefs:{visible:'Hint'},instanceOf:'Glyph',instanceKey:'glyph-key',instanceGeometry:{nodeId:'question-'+Kind,componentId:'glyph-main',localSize:{width:14,height:14},transform:matrix},instanceRootOverrides:{nodeId:'question-'+Kind,componentId:'glyph-main',componentKey:'glyph-key',fields:[],mainSize:{width:14,height:14},localSize:{width:14,height:14},localTransform:matrix}}]})))};
 const result=proposeFromDump(source,{corpus,mintUnbound:true,fileKey:'fixture',hiddenCaptured:true,contractIdByName:new Map([['Glyph',child.id]]),contractIdByKey:new Map([['glyph-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]])});
 const c=ContractSchema.parse(result.contract),part=walkAnatomy(c).find(w=>w.part.instanceAffineLayout)!.part;
 assert.equal(part.instanceAffineLayout!.rows.length,2);assert(part.presenceByCombination);assert.equal(resolvePresence(part,{layout:'horizontal',kind:'one'}),false);assert.equal(resolvePresence(part,{layout:'vertical',kind:'two'}),true);
 assert.equal(part.instanceAffineLayout!.rows[0].geometry.transform[0][1],matrix[0][1]);assert.deepEqual(part.visibleWhen,{prop:'hint'});
 const broken=structuredClone(c);walkAnatomy(broken).find(w=>w.part.instanceAffineLayout)!.part.instanceAffineLayout!.rows.pop();assert.equal(ContractSchema.safeParse(broken).success,false);
});
test('partial character ownership carries a unique nested original path with exact compound presence',()=>{
 const tuples=['Wide','Narrow'].flatMap(Size=>['Idle','Active'].flatMap(State=>['Filled','Empty'].map(Fill=>({Size,State,Fill}))));
 const definitions:Array<[string,string[]]>=[['Size',['Wide','Narrow']],['State',['Idle','Active']],['Fill',['Filled','Empty']]];
 const source:DumpSet={setName:'Entry',key:'entry-key',nodeId:'entry-set',type:'COMPONENT_SET',propertyDefinitions:Object.fromEntries(definitions.map(([name,options])=>[name,{type:'VARIANT',defaultValue:options[0],variantOptions:options}])),variants:tuples.map((tuple,i)=>({name:Object.entries(tuple).map(([k,v])=>k+'='+v).join(', '),type:'COMPONENT',nodeId:'entry-'+i,variantProperties:tuple,layout:layout as any,children:[{name:'wrapper',type:'FRAME',nodeId:'wrapper-'+i,layout:layout as any,children:tuple.Fill==='Filled'&&tuple.State==='Idle'?[{name:'content',type:'FRAME',nodeId:'content-'+i,layout:layout as any,children:[{name:'input',type:'TEXT',nodeId:'input-'+i,text:{characters:'Original',fontSize:14,fontStyle:'Regular',lineHeight:20},propRefs:{characters:'Value'}}]}]:[]}]}))};
 source.propertyDefinitions!.Value={type:'TEXT',defaultValue:'Original'};
 const target={instanceId:'usage',componentId:'entry-0',nodeId:'Iusage;input-0',instancePath:[],childPath:[0,0,0]};
 const result=proposeDeclaredDrawnCandidate(source,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',stampsObservable:true,hiddenCaptured:true,projectionMode:'exact',characterDemands:[{fileKey:'fixture',target}]},tuples);
 const c=ContractSchema.parse(result.proposal.contract),part=walkAnatomy(c).find(w=>w.part.content)!.part;
 assert(part.presenceByCombination);assert(result.proposal.characterBindings!.length);assert.equal(c.props.find(p=>p.name===part.content!.prop)!.default,'Original');
 for(const tuple of tuples)assert.equal(resolvePresence(part,{size:tuple.Size.toLowerCase(),state:tuple.State.toLowerCase(),fill:tuple.Fill.toLowerCase()}),tuple.Fill==='Filled'&&tuple.State==='Idle');
 const changed=structuredClone(source);changed.variants[0].children![0].children![0].children![0].hidden=true;
 assert.throws(()=>proposeDeclaredDrawnCandidate(changed,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',stampsObservable:true,hiddenCaptured:true,projectionMode:'exact',characterDemands:[{fileKey:'fixture',target}]},tuples),/character-demand-owned-part-unqualified|source-target-unqualified|presence/);
});

function sharedTextFixture(){
 const source:DumpSet={setName:'Shared text',key:'shared-key',nodeId:'shared-set',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'First',variantOptions:['First','Second','Empty']},Value:{type:'TEXT',defaultValue:'Original'}},variants:['First','Second','Empty'].map((Mode,i)=>({name:'Mode='+Mode,nodeId:'shared-'+i,type:'COMPONENT',variantProperties:{Mode},children:Mode==='Empty'?[]:[{name:'region'+i,nodeId:'region'+i,type:'FRAME',children:[{name:'label',nodeId:'text'+i,type:'TEXT',propRefs:{characters:'Value'},text:{characters:'Original',fontSize:14,fontStyle:'Regular'}}]}]}))};
 const c=ContractSchema.parse({...base,id:'test.shared',name:'Shared',props:[{name:'mode',type:{enum:['first','second','empty']},default:'first',bindings:{code:{prop:'mode'},figma:{kind:'VARIANT',property:'Mode',values:{first:'First',second:'Second',empty:'Empty'}}}},{name:'value',type:'text',default:'Original',bindings:{code:{prop:'value'},figma:{kind:'TEXT',property:'Value'}}}],anatomy:{root:{parts:{first:{content:{prop:'value'},visibleWhen:{prop:'mode',equals:'first'}},second:{content:{prop:'value'},visibleWhen:{prop:'mode',equals:'second'}}}}},bindings:{...anchors('shared-key','shared-set','Shared'),figma:{anchors:{fileKey:'fixture',componentSetKey:'shared-key',nodeId:'shared-set'},drawnVariants:[{mode:'first'},{mode:'second'},{mode:'empty'}]}}});
 const owners=new Map([['text0',new Set([c.anatomy.root.parts!.first as unknown as Record<string,unknown>])],['text1',new Set([c.anatomy.root.parts!.second as unknown as Record<string,unknown>])]]);return {source,c,owners};
}
test('shared native TEXT has one default and one original owner per complete tuple, including absent planes',()=>{
 const f=sharedTextFixture(),domain=qualifyCharacterOwnerDomain(f.source,f.c,'value',f.owners);assert(domain);assert.equal(domain.rows.length,3);assert.equal(domain.rows[2].partPath,null);
 const t={componentId:'shared-0',instanceId:'use',nodeId:'Iuse;text0',instancePath:[],childPath:[0,0]},b={fileKey:'fixture',setKey:'shared-key',componentId:t.componentId,childPath:t.childPath,prop:'value',contractRevision:revisionOf(f.c),ownerDomain:domain};
 assert.equal(characterBindingMatches(b,f.c,'fixture',t),true);assert.equal(characterBindingMatches({...b,ownerDomain:undefined},f.c,'fixture',t),false);
 assert.equal(characterBindingMatches(b,f.c,'fixture',{...t,childPath:[1,0]}),false);
 for(const mutation of [(x:typeof f)=>{x.c.anatomy.root.parts!.second.visibleWhen={prop:'mode',equals:['first','second']};},(x:typeof f)=>{x.source.variants[0].children!.push(structuredClone(x.source.variants[0].children![0]));},(x:typeof f)=>{x.owners.delete('text0');},(x:typeof f)=>{x.source.variants[0].children![0].hidden=true;}]){const x=sharedTextFixture();mutation(x);assert.equal(qualifyCharacterOwnerDomain(x.source,x.c,'value',x.owners),undefined,String(mutation));}
 const malformed=structuredClone(b);malformed.ownerDomain!.rows.pop();assert.equal(characterBindingMatches(malformed,f.c,'fixture',t),false);
});

function selectedAllocationFixture(){
 const f=fixture();const hostMain:DumpSet={setName:'SlotHost',type:'COMPONENT',key:'slot-host-key',nodeId:'host-main',propertyDefinitions:{'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'placeholder'}},variants:[{name:'SlotHost',type:'COMPONENT',nodeId:'host-main',componentKey:'slot-host-key',children:[{name:'Old placeholder',nodeId:'slot-child',type:'INSTANCE',instanceKey:'placeholder-key',propRefs:{mainComponent:'Payload'}}]}]};
 const transform=[[1,0,80],[0,1,0]];const host:any={name:'Host',nodeId:'host-use',type:'INSTANCE',instanceKey:'slot-host-key',instanceGeometry:{nodeId:'host-use',componentId:'host-main',localSize:{width:220,height:104},transform},instanceRootOverrides:{nodeId:'host-use',componentId:'host-main',componentKey:'slot-host-key',fields:['width','height'],localSize:{width:220,height:104},localTransform:transform},fixedSwaps:{Payload:{...f.swap,observedInstances:[{nodeId:'Ihost-use;slot-child',path:[0],componentId:f.swap.id,size:{width:220,height:52},parentSize:{width:220,height:104},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'LEFT',vertical:'TOP'},selectedRoot:{kind:'selected-slot-root-v1',hostId:'host-use',hostMainId:'host-main',property:'Payload#1:2',componentKey:f.swap.key,componentSetKey:f.source.key,mainSize:{width:360,height:52},parentId:'host-use',parentLayout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'FIXED'},sizing:{horizontal:'FILL',vertical:'HUG'},fields:['layoutAlign'],properties:{Layout:'Vertical',Enabled:'True'},inFlow:true,sizeBound:false,layoutGrow:0}}]}}};
 const roots=()=>fixedSwapOwnerRoots([hostMain,f.source]);const qualify=()=>qualifyFixedSwapRootAllocation(host,'Payload','slot-host-key',f.swap.id,f.swap.key,roots());return {...f,host,hostMain,roots,qualify};
}
test('current selected-root FILL allocation authenticates its own geometry while HUG is never a height override',()=>{
 const f=selectedAllocationFixture(),before=JSON.stringify(f.host),result=f.qualify();assert.deepEqual(result,{width:220,height:52,sizing:{horizontal:'FILL',vertical:'HUG'},remainingFields:['layoutAlign'],channels:['width']});assert.equal(JSON.stringify(f.host),before);
 const proof=f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot;assert(capturedSelectedDefaultsMatch(proof.properties,f.target,{layout:'vertical',enabled:true}));assert(!capturedSelectedDefaultsMatch({...proof.properties,Enabled:'False'},f.target,{layout:'vertical',enabled:true}));
 proof.fields.push('width','height');f.host.fixedSwaps.Payload.observedInstances[0].size.height=64;assert.deepEqual((f.qualify() as any).channels,['width'],'observed HUG extent and literal override fields do not freeze a CSS height');
});
test('selected-root allocation rejects wrong identities, paths, parent layout, bound sizes and active grow',()=>{
 const mutations:Array<(f:ReturnType<typeof selectedAllocationFixture>)=>void>=[f=>{f.host.instanceRootOverrides.localSize={width:221,height:104};},f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot.hostId='other';},f=>{f.host.fixedSwaps.Payload.observedInstances[0].path=[1];},f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot.componentKey='other';},f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot.parentLayout.padding[1]=1;},f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot.sizeBound=true;},f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot.layoutGrow=1;},f=>{f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot.fields.push('fills');},f=>{delete f.host.fixedSwaps.Payload.observedInstances[0].selectedRoot;}];
 for(const mutate of mutations){const f=selectedAllocationFixture();mutate(f);assert('issue'in f.qualify(),String(mutate));}
});
