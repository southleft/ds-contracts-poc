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
test('observed-swap-default-drawn: an uncarried fixed swap to another component clears the child fallback; the declared default keeps it',async()=>{
 const {emitReact}=await import('./emit-react.js'),{createFigmaEngine}=await import('./emit-figma-script.js');
 const child=ContractSchema.parse({...base,id:'test.glyph-host',name:'GlyphHost',props:[],anatomy:{root:{parts:{icon:{slot:{name:'glyph',bindings:{figma:{property:'Payload'}},renderDefaultAnatomy:true},parts:{mark:{literals:{width:'8px',height:'8px'}}}}}}},bindings:anchors('glyph-host-key','glyph-host-main','GlyphHost')});
 const childSet:DumpSet={setName:'GlyphHost',type:'COMPONENT_SET',key:'glyph-host-key',nodeId:'glyph-host-set',propertyDefinitions:{'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'default-main'}},variants:[{name:'Default',type:'COMPONENT',nodeId:'glyph-host-main',componentKey:'glyph-host-main-key'}]};
 const propose=(swapId:string,conventions:string[])=>{const caller:DumpSet={setName:'Caller',type:'COMPONENT_SET',key:'caller-key',nodeId:'caller-set',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'One',variantOptions:['One']}},
  variants:[{name:'Mode=One',type:'COMPONENT',nodeId:'caller-0',variantProperties:{Mode:'One'},layout:layout as any,children:[{name:'GlyphHost',type:'INSTANCE',nodeId:'use-0',instanceOf:'GlyphHost',instanceKey:'glyph-host-key',
   instanceGeometry:{nodeId:'use-0',componentId:'glyph-host-main',transform:[[1,0,0],[0,1,0]],localSize:{width:16,height:16}},fixedSwaps:{Payload:{id:swapId,key:swapId+'-key'}}} as any]}]};
  const p=proposeFromDump(caller,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['GlyphHost',child.id]]),contractIdByKey:new Map([['glyph-host-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]]),fixedSwapOwnerRoots:fixedSwapOwnerRoots([childSet]),conventions});
  const c=ContractSchema.parse(p.contract);return {p,c,use:walkAnatomy(c).find(w=>w.part.component?.id===child.id)!.part};};
 const other=propose('other-main',['observed-swap-default-drawn']);
 assert.deepEqual(other.use.component!.clearedSlots,['glyph']);assert(other.p.notes.some(n=>n.includes('slot cleared so the child')));
 const scope=new Map([[child.id,child],[other.c.id,other.c]]);
 assert.match(emitReact(other.c,{contracts:scope,icons:new Map(),tokens:new Set()}).tsx,/<GlyphHost[^>]* glyph=\{null\}/);
 assert.throws(()=>createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(other.c,scope),/FIGMA_COMPONENT_CLEARED_SLOT_UNSUPPORTED/);
 assert.equal(propose('default-main',['observed-swap-default-drawn']).use.component!.clearedSlots,undefined,'the declared default keeps the fallback');
 assert.equal(propose('other-main',[]).use.component!.clearedSlots,undefined,'convention off: unchanged');
});
test('fixed-swap-drawing-carried: a captured drawing reaches the child slot only for uses whose child variant draws one placement',async()=>{
 const {emitReact}=await import('./emit-react.js'),{createFigmaEngine}=await import('./emit-figma-script.js'),{validateContract}=await import('../packages/core/src/validate.js');
 const {defaultSlotFamilyIssue}=await import('../scripts/contract-schema.js');
 const placement=(a:boolean,b:boolean)=>({slot:{name:'glyph',bindings:{figma:{property:'Payload'}}},presenceByCombination:{props:['mode'],rows:[{values:['a'],present:a},{values:['b'],present:b}]}});
 const child=ContractSchema.parse({...base,id:'test.glyph-host',name:'GlyphHost',props:[{name:'mode',type:{enum:['a','b']},default:'a',bindings:{code:{prop:'mode'},figma:{kind:'VARIANT',property:'Mode',values:{a:'A',b:'B'}}}}],
  anatomy:{root:{parts:{one:placement(true,false),two:placement(false,true),three:placement(false,true)}}},bindings:anchors('glyph-host-key','glyph-host-set','GlyphHost')});
 assert.equal(defaultSlotFamilyIssue(child,'glyph'),'children-slot-placements-overlap','the contract-wide family stays unqualified');
 const childSet:DumpSet={setName:'GlyphHost',type:'COMPONENT_SET',key:'glyph-host-key',nodeId:'glyph-host-set',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']},'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'default-main'}},
  variants:['A','B'].map(m=>({name:'Mode='+m,type:'COMPONENT',nodeId:'main-'+m,componentKey:'main-'+m+'-key',variantProperties:{Mode:m}}))};
 const drawing={name:'Selected',type:'FRAME',nodeId:'I9;1',fixedSize:{width:16,height:16},children:[{name:'Mark',type:'RECTANGLE',nodeId:'I9;1;2',fill:{hex:'161616'},fixedSize:{width:8,height:8}}]};
 const propose=(mode:string,conventions:string[])=>{const caller:DumpSet={setName:'Caller',type:'COMPONENT_SET',key:'caller-key',nodeId:'caller-set',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One']}},
  variants:[{name:'Case=One',type:'COMPONENT',nodeId:'caller-0',variantProperties:{Case:'One'},layout:layout as any,children:[{name:'GlyphHost',type:'INSTANCE',nodeId:'use-0',instanceOf:'GlyphHost',instanceKey:'main-'+mode+'-key',instanceSetKey:'glyph-host-key',
   instanceGeometry:{nodeId:'use-0',componentId:'main-'+mode,transform:[[1,0,0],[0,1,0]],localSize:{width:16,height:16}},fixedSwaps:{Payload:{id:'other-main',key:'other-key',observedInstances:[{nodeId:'I9;1',path:[0]}]}},
   fixedSwapDrawings:{Payload:[{path:[0],root:drawing}]}} as any]}]};
  const p=proposeFromDump(caller,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['GlyphHost',child.id]]),contractIdByKey:new Map([['glyph-host-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]]),fixedSwapOwnerRoots:fixedSwapOwnerRoots([childSet]),conventions});
  const c=ContractSchema.parse(p.contract);return {p,c,use:walkAnatomy(c).find(w=>w.part.component?.id===child.id)!.part};};
 const a=propose('A',['fixed-swap-drawing-carried']);
 assert.equal(a.use.component!.contentSlot,'glyph');assert.deepEqual(a.use.component!.callerSlotSelections,{slot:'glyph',rows:[{mode:'a'}]});assert(a.use.parts);
 const scope=new Map([[child.id,child],[a.c.id,a.c]]),errors:string[]=[];validateContract(a.c,scope,errors,new Map());assert.deepEqual(errors,[]);
 const tree=a.p.mintedTokens?.tree??{},tokens={primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const {flattenTokens}=await import('./tokens.js');
 assert.match(emitReact(a.c,{contracts:scope,icons:new Map(),tokens:new Set(flattenTokens(tree).keys()),tokenValues:tokens}).tsx,/glyph=\{/);
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(a.c,scope),/FIGMA_COMPONENT_CALLER_SLOT_SELECTIONS_UNSUPPORTED|qualified glyph slot family/);
 const b=propose('B',['fixed-swap-drawing-carried']);assert.equal(b.use.component!.contentSlot,undefined);assert(b.p.notes.some(n=>n.includes('does not draw exactly one')));
 assert.equal(propose('A',[]).use.component!.contentSlot,undefined,'convention off: unchanged');
});
test('swap-drawing-path-box-whole-pixel: a half-pixel path in a captured drawing starts its box on the whole pixel and draws the remainder inside',async()=>{
 const {emitReact}=await import('./emit-react.js'),{validateContract}=await import('../packages/core/src/validate.js'),{flattenTokens}=await import('./tokens.js');
 const child=ContractSchema.parse({...base,id:'test.bar-host',name:'BarHost',props:[{name:'mode',type:{enum:['a','b']},default:'a',bindings:{code:{prop:'mode'},figma:{kind:'VARIANT',property:'Mode',values:{a:'A',b:'B'}}}}],
  anatomy:{root:{parts:{icon:{slot:{name:'glyph',bindings:{figma:{property:'Payload'}}}}}}},bindings:anchors('bar-host-key','bar-host-set','BarHost')});
 const childSet:DumpSet={setName:'BarHost',type:'COMPONENT_SET',key:'bar-host-key',nodeId:'bar-host-set',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']},'Payload#1:2':{type:'INSTANCE_SWAP',defaultValue:'default-main'}},
  variants:['A','B'].map(m=>({name:'Mode='+m,type:'COMPONENT',nodeId:'bar-'+m,componentKey:'bar-'+m+'-key',variantProperties:{Mode:m}}))};
 const drawing={name:'Selected',type:'FRAME',nodeId:'I9;1',fixedSize:{width:16,height:16},clipsContent:true,children:[{name:'Bar',type:'VECTOR',nodeId:'I9;1;2',fill:{hex:'161616'},
  shape:{kind:'path',width:8,height:1,x:4,y:7.5,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:'M8 0L0 0L0 1L8 1L8 0Z',windingRule:'NONZERO'}]}}]};
 const propose=(conventions:string[])=>{const caller:DumpSet={setName:'Caller',type:'COMPONENT_SET',key:'caller-key',nodeId:'caller-set',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One']}},
  variants:[{name:'Case=One',type:'COMPONENT',nodeId:'caller-0',variantProperties:{Case:'One'},layout:layout as any,children:[{name:'BarHost',type:'INSTANCE',nodeId:'use-0',instanceOf:'BarHost',instanceKey:'bar-A-key',instanceSetKey:'bar-host-key',
   instanceGeometry:{nodeId:'use-0',componentId:'bar-A',transform:[[1,0,0],[0,1,0]],localSize:{width:16,height:16}},fixedSwaps:{Payload:{id:'other-main',key:'other-key',observedInstances:[{nodeId:'I9;1',path:[0]}]}},
   fixedSwapDrawings:{Payload:[{path:[0],root:drawing}]}} as any]}]};
  const p=proposeFromDump(caller,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['BarHost',child.id]]),contractIdByKey:new Map([['bar-host-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]]),fixedSwapOwnerRoots:fixedSwapOwnerRoots([childSet]),conventions});
  const c=ContractSchema.parse(p.contract);return {p,c,bar:walkAnatomy(c).find(w=>w.part.shape?.kind==='path')?.part};};
 const off=propose(['fixed-swap-drawing-carried']);assert(off.bar?.shape?.kind==='path');assert.deepEqual([off.bar.shape.width,off.bar.shape.height],[8,1]);
 assert(off.p.notes.some(n=>n.includes('swap-drawing-path-offset-not-snapped')),JSON.stringify(off.p.notes));
 const on=propose(['fixed-swap-drawing-carried','swap-drawing-path-box-whole-pixel']);assert(on.bar?.shape?.kind==='path');
 assert.deepEqual([on.bar.shape.width,on.bar.shape.height,on.bar.shape.paths![0]!.data],[8,2,'M8 0.5L0 0.5L0 1.5L8 1.5L8 0.5Z']);
 assert(!on.p.notes.some(n=>n.includes('swap-drawing-path-offset-not-snapped')));
 const scope=new Map([[child.id,child],[on.c.id,on.c]]),errors:string[]=[];validateContract(on.c,scope,errors,new Map());assert.deepEqual(errors,[]);
 const tree=on.p.mintedTokens?.tree??{},css=emitReact(on.c,{contracts:scope,icons:new Map(),tokens:new Set(flattenTokens(tree).keys()),tokenValues:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}}}).css;
 assert.match(css,/top: 7px/);assert.doesNotMatch(css,/top: 7\.5px/);assert.match(css,/viewBox%3D%220%200%208%202%22/);
});
test('drawing-path-box-whole-pixel-by-value: an observed default glyph at a half-pixel offset starts its box on the whole pixel, per value or for every variant',async()=>{
 const {validateContract}=await import('../packages/core/src/validate.js');
 const use=(v:string,big:boolean)=>{const w=big?20:16,g=big?15:12,at=big?2.5:2;return {name:'Icon',type:'INSTANCE',nodeId:'use-'+v,instanceOf:'Glyph',instanceKey:'glyph-main-key',propRefs:{mainComponent:'Swap icon'},bbox:{width:w,height:w},
  instanceGeometry:{nodeId:'use-'+v,componentId:'glyph-main',transform:[[1,0,0],[0,1,0]],localSize:{width:w,height:w}},instanceSwapContent:{root:{name:'Glyph',type:'FRAME',nodeId:'I-'+v,fixedSize:{width:w,height:w},clipsContent:true,
   children:[{name:'Vector',type:'VECTOR',nodeId:'I-'+v+';1',fill:{hex:'161616'},shape:{kind:'path',width:g,height:g,x:at,y:at,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:`M0 0L${g} 0L${g} ${g}L0 ${g}L0 0Z`,windingRule:'NONZERO'}]}}]}}};};
 const propose=(bigA:boolean,conventions:string[])=>{const set={setName:'Glyph cell',type:'COMPONENT_SET',propertyDefinitions:{'Swap icon#1:0':{type:'INSTANCE_SWAP',defaultValue:'glyph-main'},State:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}},
  variants:['A','B'].map(v=>({name:'State='+v,type:'COMPONENT',nodeId:'cell-'+v,variantProperties:{State:v},bbox:{width:20,height:20},layout,children:[use(v,v==='B'||bigA)]}))};
  const p=proposeFromDump(set as any,{corpus,mintUnbound:true,fileKey:'fixture',contractIdByName:new Map(),conventions}),c=ContractSchema.parse(p.contract),errors:string[]=[];validateContract(c,new Map([[c.id,c]]),errors,new Map());
  return {p,errors,glyph:walkAnatomy(c).find(w=>w.part.shape?.kind==='path')!.part};};
 const offsets=(g:any)=>g.stylesWhen.map((r:any)=>r.styles.left);
 // One path for every variant: off keeps the half-pixel offset; on, the box starts on the whole pixel and the path carries the half pixel.
 const off=propose(true,['observed-swap-default-drawn']);assert.deepEqual([off.glyph.shape!.width,offsets(off.glyph)],[15,['2.5px','2.5px']]);
 const on=propose(true,['observed-swap-default-drawn','drawing-path-box-whole-pixel-by-value']);assert.deepEqual(on.errors,[]);
 assert.deepEqual([on.glyph.shape!.width,on.glyph.shape!.paths![0]!.data,offsets(on.glyph)],[16,'M0.5 0.5L15.5 0.5L15.5 15.5L0.5 15.5L0.5 0.5Z',['2px','2px']]);
 assert(on.p.notes.some(n=>n.includes('for every variant (+0.5, +0.5 px) (profile convention drawing-path-box-whole-pixel-by-value)')));
 // Path data by value: only the half-pixel value moves; the whole-pixel value and the base path keep theirs.
 const byValue=propose(false,['observed-swap-default-drawn','drawing-path-box-whole-pixel-by-value']).glyph;assert.deepEqual(offsets(byValue),['2px','2px']);
 assert.deepEqual(Object.values(byValue.shape!.pathsByProp!.map).map(b=>[b.width,b.paths[0]!.data]),[[12,'M0 0L12 0L12 12L0 12L0 0Z'],[16,'M0.5 0.5L15.5 0.5L15.5 15.5L0.5 15.5L0.5 0.5Z']]);
 assert.deepEqual([byValue.shape!.width,byValue.literalsByProp![0]!.map.b],[12,{width:'16px',height:'16px'}]);
});
