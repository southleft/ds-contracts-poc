import {createFigmaEngine} from './emit-figma-script.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {ContractSchema, walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {generateTsx} from './emit-react.js';
import {validateContract} from '../packages/core/src/validate.js';
import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){
 const child=ContractSchema.parse({id:'ds.mark',name:'Mark',version:'0.1.0',status:'draft',description:'Independent scalable drawing',semantics:{element:'span'},props:[],states:[],
 anatomy:{root:{tokens:{width:'{mark.size}',height:'{mark.size}'},overridable:['size'],parts:{ink:{literals:{'background-color':'currentColor'},declared:{position:'absolute'},shape:{kind:'path',width:18,height:18,paths:[{data:'M0 0L18 0L18 18L0 18Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24,x:3,y:3}}}}}},
 bindings:{figma:{anchors:{fileKey:'fixture',nodeId:'50:1',componentSetKey:'mark-key'}},code:{anchors:{importPath:'./Mark',export:'Mark'}}}});
 const set:DumpSet={setName:'Holder',type:'COMPONENT_SET',propertyDefinitions:{Selected:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']},Icon:{type:'INSTANCE_SWAP',defaultValue:'50:1'}},
 variants:['Off','On'].map(selected=>({name:`Selected=${selected}`,type:'COMPONENT',variantProperties:{Selected:selected},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Indicator',type:'FRAME',fixedSize:{width:16,height:16},clipsContent:true,children:selected==='Off'?[]:[{name:'Mark',type:'INSTANCE',instanceOf:'Mark',instanceKey:'mark-key',propRefs:{mainComponent:'Icon'},bbox:{width:16,height:16}}]}]}))};
 const read=(mode:'exact'|'reviewable-inversion'='exact',mintUnbound=true)=>{const result=proposeFromDump(set,{corpus,mintUnbound,fileKey:'fixture',projectionMode:mode,contractIdByName:new Map([['Mark',child.id]]),contractIdByKey:new Map([['mark-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]])});const contract=ContractSchema.parse(result.contract);return{result,contract,part:walkAnatomy(contract).find(p=>p.part.slot)!.part};};return{child,set,read};
}
test('a fixed slot wrapper keeps its box and gates only omitted default content',()=>{
 const f=fixture(),before=JSON.stringify(f.child),{contract,part,result}=f.read();assert(part.tokens?.width);assert(part.tokens?.height);assert(part.slot?.renderDefault);
 const fallback=Object.values(part.parts!)[0];assert.deepEqual(fallback.visibleWhen,{prop:'selected',equals:'on'});assert.equal(fallback.component?.id,f.child.id);assert(fallback.component?.overrides?.size);assert(result.mintedTokens!.entries.some(e=>e.value==='16px'));
 assert.equal(part.visibleWhen,undefined,'explicit caller replacements are not gated by default child presence');assert.equal(JSON.stringify(f.child),before,'shared main remains 24px');
 const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),errors:string[]=[];validateContract(contract,scope,errors,new Map());assert.deepEqual(errors,[]);const tsx=generateTsx(contract,scope,new Map());assert.match(tsx,/children === undefined/);assert.match(tsx,/selected === ['"]on['"]/);
});
test('observed clipping belongs to an explicit frame host in both projection modes',()=>{
 const f=fixture(),review=f.read('reviewable-inversion');assert.equal(review.part.element,'div');assert.equal(review.part.declared?.['overflow-x'],'hidden');assert.equal(review.part.declared?.['overflow-y'],'hidden');assert.equal(f.read().part.declared?.['overflow-x'],'hidden');
 const scope=new Map([[review.contract.id,review.contract],[f.child.id,f.child]]),errors:string[]=[];validateContract(review.contract,scope,errors,new Map());assert.deepEqual(errors,[]);
});
test('unknown linked default or drawing size cannot synthesize runtime fallback or a size override',()=>{
 const wrong=fixture();wrong.set.propertyDefinitions!.Icon.defaultValue='foreign:1';assert.equal(wrong.read().part.slot?.renderDefault,undefined);assert.equal(wrong.read().part.parts,undefined);
 const nonsquare=fixture();nonsquare.set.variants[1].children![0].children![0].bbox={width:16,height:15};const fallback=Object.values(nonsquare.read().part.parts!)[0];assert.equal(fallback.component?.overrides?.size,undefined);assert.deepEqual(fallback.visibleWhen,{prop:'selected',equals:'on'});
});

test('default presence is scoped to an exactly gated wrapper, without hiding caller replacements',()=>{
 const f=fixture(),original=f.set.variants;f.set.propertyDefinitions!.Mode={type:'VARIANT',defaultValue:'Shown',variantOptions:['Shown','Hidden']};
 f.set.variants=['Shown','Hidden'].flatMap(mode=>original.map(v=>({...structuredClone(v),name:`${v.name}, Mode=${mode}`,variantProperties:{...v.variantProperties,Mode:mode},children:mode==='Hidden'?[]:structuredClone(v.children)})));
 const {part}=f.read();assert.deepEqual(part.visibleWhen,{prop:'mode',equals:'shown'});const fallback=Object.values(part.parts!)[0];assert.deepEqual(fallback.visibleWhen,{prop:'selected',equals:'on'});
});


test('native slot fallback filters the same presence gate while retaining the wrapper box',()=>{
 const f=fixture(),{contract,result}=f.read();const engine=createFigmaEngine({tokens:{primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(contract,new Map([[contract.id,contract],[f.child.id,f.child]]));
 for(const v of data.variants){const slot=v.spec.children!.find(n=>n.type==='slot')!;assert.equal(slot.fixedWidth?.px,16);assert.equal(slot.fixedHeight?.px,16);assert.equal(slot.children?.length,v.name.includes('Selected=On')?1:0);}
});


test('direct swap false-side presence gates fallback while caller replacements remain available',()=>{
 const f=fixture();f.set.propertyDefinitions!.Selected={type:'VARIANT',defaultValue:'False',variantOptions:['False','True']};
 for(const [i,v] of f.set.variants.entries()){
  v.name=`Selected=${i?'True':'False'}`;v.variantProperties={Selected:i?'True':'False'};
  const drawing=structuredClone(f.set.variants[1].children![0].children![0]);
  v.children=i?[]:[drawing];
 }
 const {contract,part,result}=f.read();assert.equal(part.visibleWhen,undefined);
 assert.deepEqual(Object.values(part.parts!)[0].visibleWhen,{prop:'selected',equals:false});
 const unminted=f.read('exact',false).part;assert.equal(unminted.visibleWhen,undefined);assert.deepEqual(Object.values(unminted.parts!)[0].visibleWhen,{prop:'selected',equals:false});
 const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),errors:string[]=[];validateContract(contract,scope,errors,new Map());assert.deepEqual(errors,[]);
 const tsx=generateTsx(contract,scope,new Map());
 const mod={exports:{} as {Holder:ComponentType<{selected:boolean;children?:ReactNode}>}};
 vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{
  module:mod,exports:mod.exports,require:(id:string)=>id.endsWith('.css')?{}:id.endsWith('/Mark')?{Mark:()=>createElement('svg',{'data-mark':''})}:require(id),
 });
 const render=(selected:boolean,children?:ReactNode)=>renderToStaticMarkup(createElement(mod.exports.Holder,{selected,children}));
 assert.match(render(false),/data-mark/,'false selects the captured fallback');
 assert.doesNotMatch(render(true),/data-mark/,'true omits the captured fallback');
 for(const selected of [false,true]){
  const replacement=render(selected,createElement('b',null,'caller replacement'));
  assert.match(replacement,/caller replacement/);assert.doesNotMatch(replacement,/data-mark/);
 }
 const engine=createFigmaEngine({tokens:{primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(contract,scope);
 for(const v of data.variants){const slot=v.spec.children!.find(n=>n.type==='slot')!;assert.equal(slot.children?.length,v.name.includes('Selected=True')?0:1);}
});


test('bare instance-swap default carries keyed usage size while preserving caller input and the shared main',()=>{
 const f=fixture(),drawn=structuredClone(f.set.variants[1].children![0].children![0]);
 for(const variant of f.set.variants)variant.children=[structuredClone(drawn)];
 const before=JSON.stringify(f.child),{contract,part,result}=f.read();
 assert(part.slot?.renderDefault);const fallback=Object.values(part.parts!)[0];assert.equal(fallback.component?.id,f.child.id);assert(fallback.component?.overrides?.size);
 assert(result.mintedTokens!.entries.some(entry=>entry.value==='16px'));assert.equal(JSON.stringify(f.child),before);
 const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),tsx=generateTsx(contract,scope,new Map());assert.match(tsx,/children === undefined/);
 const engine=createFigmaEngine({tokens:{primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(contract,scope);for(const variant of data.variants){const slot=variant.spec.children!.find(node=>node.type==='slot')!;assert.equal(slot.children!.length,1);assert.equal(slot.children![0].type,'instance');assert.equal(slot.children![0].instanceSize?.px,16);}
});

test('bare slot default refuses to infer size from inconsistent boxes or display names',()=>{
 for(const mutation of ['nonsquare','name-only']){
  const f=fixture(),drawn=structuredClone(f.set.variants[1].children![0].children![0]);for(const variant of f.set.variants)variant.children=[structuredClone(drawn)];
  if(mutation==='nonsquare')f.set.variants[1].children![0].bbox={width:16,height:15};else for(const variant of f.set.variants)delete variant.children![0].instanceKey;
  const {part}=f.read();assert.equal(Object.values(part.parts??{})[0]?.component?.overrides?.size,undefined,mutation);
 }
});


import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {createElement, Fragment, type ComponentType, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const require = createRequire(import.meta.url);

test('bare slot collapses empty resolved fragments in both React surfaces; framed slots keep their box', () => {
 for (const bare of [false,true]) {
  const f=fixture();
  if(bare) for(const [i,v] of f.set.variants.entries()) v.children=i?[structuredClone(f.set.variants[1].children![0].children![0])]:[];
  const {contract,part,result}=f.read();assert.equal(part.slot!.collapseWhenEmpty,bare?true:undefined);
  const scope=new Map([[contract.id,contract],[f.child.id,f.child]]);
  const tokenTree={primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
  for(const tsx of [generateTsx(contract,scope,new Map()),emitReactInline(contract,{contracts:scope,icons:new Map(),tokens:tokenTree}).tsx]){
   const mod={exports:{} as {Holder: ComponentType<{selected:string;children?:ReactNode}>}};
   vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{
    module:mod,exports:mod.exports,require:(id:string)=>id.endsWith('.css')?{}:id.endsWith('/Mark')||id==='./Mark'?{Mark:()=>createElement('svg',{'data-mark':''})}:require(id),
   });
   const render=(selected:string,children?:ReactNode)=>renderToStaticMarkup(createElement(mod.exports.Holder,{selected,children}));
   const emptyHost=bare?0:1;
   assert.equal((render('off').match(/<div/g)||[]).length,1+emptyHost,'default absent');
   assert.equal((render('on').match(/<div/g)||[]).length,2,'default present');
   for(const empty of [null,false,'',createElement(Fragment,null,[null,false,createElement(Fragment,{key:"empty"})])])
    assert.equal((render('on',empty).match(/<div/g)||[]).length,1+emptyHost,'explicit empty caller');
   for(const filled of [0,'caller',createElement(Fragment,null,createElement('b',null,'caller'))])
    assert.equal((render('off',filled).match(/<div/g)||[]).length,2,'caller replaces absent default');
  }
 }
});

test('native runtime collapses an empty bare slot but preserves an independently framed host', async()=>{
 for(const bare of [false,true]){
  const f=fixture();delete f.child.anatomy.root.parts;if(bare)for(const [i,v] of f.set.variants.entries())v.children=i?[structuredClone(f.set.variants[1].children![0].children![0])]:[];
  const {contract,result}=f.read(),scope=new Map([[contract.id,contract],[f.child.id,f.child]]);
  const engine=createFigmaEngine({tokens:{primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  assert.equal(Boolean(engine.compileComponentData(contract,scope).codeOnlyFacts?.some(fact=>fact.channel==='slot.collapseWhenEmpty')),bare);
  const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
  const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
  await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,scope));await run(engine.buildComponentScript(contract,scope));
  const holder=root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===contract.id)!;assert(holder);
  for(const variant of holder.children!){const slot=variant.findOne(n=>n.type==='SLOT')!;assert(slot);assert.equal(slot.visible, !bare||variant.name.includes('Selected=On'));}
  const caller=ContractSchema.parse({...contract,id:'ds.caller',name:'Caller',anatomy:{root:{parts:{usage:{component:{id:contract.id,props:{selected:'off'}},parts:{replacement:{component:{id:f.child.id},visibleWhen:{prop:'selected',equals:'on'}}}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./Caller',export:'Caller'}}}});
  scope.set(caller.id,caller);await run(engine.buildComponentScript(caller,scope));
  const callers=root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===caller.id)!;assert(callers);
  for(const variant of callers.children!){const slot=variant.findOne(n=>n.type==='SLOT')!;assert(slot);assert.equal(slot.visible,!bare||variant.name.includes('Selected=On'),'caller replacement recomputes visibility on an initially empty dependency slot');}
 }
});


test('an explicitly gated collapsing slot composes boolean, enum and empty-content conditions as valid rendered JSX',()=>{
 const f=fixture();for(const [i,v] of f.set.variants.entries())v.children=i?[structuredClone(f.set.variants[1].children![0].children![0])]:[];
 const {contract,part,result}=f.read();
 contract.props.push({name:'show',type:'boolean',default:false,bindings:{code:{prop:'show'},figma:{kind:'BOOLEAN',property:'Show'}}});
 const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),tokens={primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 for(const gate of [{prop:'show'},{prop:'selected',equals:['on']}] as const){
  part.visibleWhen=gate.prop==='show'?{prop:'show'}:{prop:'selected',equals:['on']};
  for(const tsx of [generateTsx(contract,scope,new Map()),emitReactInline(contract,{contracts:scope,icons:new Map(),tokens}).tsx]){
   const mod={exports:{} as {Holder:ComponentType<{selected:string;show:boolean;children?:ReactNode}>}};
   vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module:mod,exports:mod.exports,require:(id:string)=>id.endsWith('.css')?{}:id.endsWith('/Mark')||id==='./Mark'?{Mark:()=>createElement('svg',{'data-mark':''})}:require(id)});
   const render=(selected:string,show:boolean,children?:ReactNode)=>renderToStaticMarkup(createElement(mod.exports.Holder,{selected,show,children}));
   assert.equal((render('on',true).match(/<div/g)||[]).length,2,'both visibility and default content allow the slot');
   assert.equal((render('on',false).match(/<div/g)||[]).length,gate.prop==='show'?1:2);
   assert.equal((render('off',true,'Caller').match(/<div/g)||[]).length,gate.prop==='show'?2:1,'caller content remains subject to the explicit host gate');
   assert.equal((render('on',true,createElement(Fragment,null)).match(/<div/g)||[]).length,1,'explicit caller emptiness collapses a visible host');
  }
 }
});


import {emitHtml} from './emit-html.js';
test('static HTML slot snapshots collapse explicit emptiness, preserve filled defaults and retain authored empty wrappers',()=>{
 const f=fixture();delete f.child.anatomy.root.parts;f.child.anatomy.root.text='DRAWING';
 const make=(collapse:boolean,filled:boolean)=>ContractSchema.parse({id:'ds.static-slot',name:'StaticSlot',version:'0.1.0',status:'draft',description:'Static sample',semantics:{element:'div'},props:[],states:[],anatomy:{root:{parts:{well:{element:'aside',slot:{name:'children',...(collapse?{collapseWhenEmpty:true}:{}),...(filled?{renderDefault:true,defaultContent:[{id:f.child.id}]}:{})}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./StaticSlot',export:'StaticSlot'}}}});
 for(const [collapse,filled] of [[true,false],[true,true],[false,false]]){
  const contract=make(collapse,filled),scope=new Map([[contract.id,contract],[f.child.id,f.child]]);
  const html=emitHtml(contract,{contracts:scope,icons:new Map(),tokens:new Set(['mark.size'])}).html;
  assert.equal(html.includes('<aside'),!collapse||filled);
  if(filled)assert(html.includes('DRAWING'));else if(collapse)assert(html.includes('empty static snapshot; host collapsed'));
 }
});

test('source-proven disjoint swap placements share one caller input and retain physical presence',()=>{
 const f=fixture(),drawing=structuredClone(f.set.variants[1].children![0].children![0]);
 f.set.propertyDefinitions!.Mode={type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Large']};
 f.set.variants=['Off','On'].flatMap(selected=>['Compact','Large'].map(mode=>({
  ...structuredClone(f.set.variants[0]),name:`Selected=${selected}, Mode=${mode}`,variantProperties:{Selected:selected,Mode:mode},
  children:[{...structuredClone(drawing),name:selected==='Off'&&mode==='Compact'?'First placement':'Other placement'}],
 })));
 const {contract}=f.read(),slots=walkAnatomy(contract).filter(w=>w.part.slot);
 assert.equal(slots.length,2);assert(slots.every(w=>w.part.slot!.name==='children'));
 assert(slots.every(w=>w.part.presenceByCombination),'host presence applies to caller replacements too');
 const source=generateTsx(contract,new Map([[contract.id,contract],[f.child.id,f.child]]),new Map());
 assert.equal((source.match(/, children, /g)??[]).length,1);
});

test('captured absolute slot placement belongs to an explicit host rather than caller content',()=>{
 const f=fixture(),drawing=structuredClone(f.set.variants[1].children![0].children![0]);
 drawing.abs={x:2,y:3,width:16,height:16,right:6,bottom:5,constraints:{horizontal:'LEFT',vertical:'TOP'}};
 for(const variant of f.set.variants){variant.bbox={width:24,height:24};variant.children=[structuredClone(drawing)];}
 const {contract,part}=f.read();assert.equal(part.element,'div');assert.equal(part.declared?.position,'absolute');
 const errors:string[]=[];validateContract(contract,new Map([[contract.id,contract],[f.child.id,f.child]]),errors,new Map());assert.deepEqual(errors,[]);
 assert.equal(part.parts && Object.values(part.parts)[0].component?.id,f.child.id);
});


test('statically hidden instances do not render, while live visibility and swap bindings survive',()=>{
 for(const binding of ['static','visible','mainComponent','mixed'] as const){
  const f=fixture();
  f.set.propertyDefinitions!['Show mark']={type:'BOOLEAN',defaultValue:false};
  for(const [i,v] of f.set.variants.entries())v.children=[{name:'Mark',type:'INSTANCE',instanceOf:'Mark',instanceKey:'mark-key',hidden:binding==='mixed'?i===0:true,
   ...(binding==='visible'?{propRefs:{visible:'Show mark'}}:binding==='mainComponent'?{propRefs:{mainComponent:'Icon'}}:{})}];
  const proposal=proposeFromDump(f.set,{corpus,mintUnbound:true,fileKey:'fixture',projectionMode:'exact',contractIdByName:new Map([['Mark',f.child.id]]),contractIdByKey:new Map([['mark-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});
  const c=ContractSchema.parse(proposal.contract),refs=walkAnatomy(c).filter(p=>p.part.component?.id===f.child.id);
  if(binding==='static'){
   assert.equal(refs.length,0);
   assert(!generateTsx(c,new Map([[c.id,c],[f.child.id,f.child]]),new Map()).includes('<Mark'));
   const engine=createFigmaEngine({tokens:{primitives:{...proposal.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
   const data=engine.compileComponentData(c,new Map([[c.id,c],[f.child.id,f.child]]));
   for(const v of data.variants)assert.equal(v.spec.children?.length??0,0);
  }else if(binding==='visible'){
   assert.equal(refs.length,1);assert.deepEqual(refs[0].part.visibleWhen,{prop:'showMark'});
  }else if(binding==='mainComponent')assert(walkAnatomy(c).some(p=>p.part.slot));
  else assert.equal(refs.length,1,'one visible occurrence must prevent static omission');
 }
});

test('native populated collapsing slot retains its own Boolean but refuses unknown or dynamic content', async()=>{
 const f=fixture();delete f.child.anatomy.root.parts;
 for(const shown of [true,false]){
  const contract=ContractSchema.parse({id:'ds.gated-slot',name:'GatedSlot',version:'0.1.0',status:'draft',description:'Populated gated slot',semantics:{element:'div'},props:[{name:'show',type:'boolean',default:shown,bindings:{figma:{kind:'BOOLEAN',property:'Show icon'},code:{prop:'show'}}}],states:[],anatomy:{root:{parts:{icon:{slot:{name:'children',collapseWhenEmpty:true,renderDefault:true,defaultContent:[{id:f.child.id}]},visibleWhen:{prop:'show'}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./GatedSlot',export:'GatedSlot'}}}});
  const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),engine=createFigmaEngine({tokens:{primitives:{mark:{size:{$type:'dimension',$value:'24px'}}},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
  const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
  await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,scope));await run(engine.buildComponentScript(contract,scope));
  const owner=root.findOne(n=>n.getSharedPluginData('ds_contracts','contractId')===contract.id)!;
  const slot=owner.findOne(n=>n.type==='SLOT')!;
  assert.equal(slot.visible,shown);assert.equal(slot.children!.length,1);
  assert(slot.componentPropertyReferences?.visible);assert(slot.componentPropertyReferences?.slotContentId,'visibility must preserve the slot binding');
  const caller=ContractSchema.parse({...contract,id:'ds.gated-caller',name:'GatedCaller',anatomy:{root:{parts:{usage:{component:{id:contract.id,props:{show:shown}},parts:{replacement:{component:{id:f.child.id}}}}}}}});
  scope.set(caller.id,caller);
  const compiled=engine.compileComponentData(caller,scope),slotSpec=compiled.variants[0].spec.children![0].children![0];
  assert.equal(slotSpec.callerSlotVisibleProp,'Show icon');assert.equal(slotSpec.visibleProp,undefined);
  assert.doesNotThrow(()=>engine.buildComponentScript(caller,scope));
  const emptyCaller=structuredClone(caller);emptyCaller.anatomy.root.parts!.usage.parts={};
  assert.throws(()=>engine.compileComponentData(emptyCaller,scope),/SLOT_COLLAPSE_LIVE_VISIBILITY_UNSUPPORTED/);
  const dynamicCaller=structuredClone(caller);dynamicCaller.anatomy.root.parts!.usage.parts!.replacement.visibleWhen={prop:'show'};
  assert.throws(()=>engine.compileComponentData(dynamicCaller,scope),/SLOT_COLLAPSE_LIVE_VISIBILITY_UNSUPPORTED/);
  for(const kind of ['empty','optional','descendant'] as const){
   const bad=structuredClone(contract),part=bad.anatomy.root.parts!.icon;
   if(kind==='empty')delete part.slot!.defaultContent;
   if(kind==='optional')part.optional=true;
   if(kind==='descendant'){delete part.slot!.defaultContent;part.parts={child:{component:{id:f.child.id},visibleWhen:{prop:'show'}}};}
   assert.throws(()=>engine.compileComponentData(bad,new Map([...scope,[bad.id,bad]])),/SLOT_COLLAPSE_LIVE_VISIBILITY_UNSUPPORTED/,kind);
  }
 }
});


test('variant slot defaults require matching main, set, file and uniform applied props',()=>{
 const make=()=>{
  const f=fixture();f.set.propertyDefinitions!.Icon.defaultValue='50:2';
  const n=f.set.variants[1].children![0].children![0];
  n.nodeId='instance:1';n.instanceKey='variant-key';n.instanceSetKey='mark-key';
  n.instanceGeometry={nodeId:n.nodeId,componentId:'50:2',transform:[[1,0,0],[0,1,0]],localSize:{width:16,height:16}};
  n.instanceRootOverrides={nodeId:n.nodeId,componentId:'50:2',componentKey:n.instanceKey,componentSetKey:n.instanceSetKey,fields:[]};
  return {f,n};
 };
 const {f}=make(),before=JSON.stringify(f.set),{part,contract}=f.read();
 assert.equal(part.slot?.renderDefault,true);assert.equal(JSON.stringify(f.set),before);
 assert.match(generateTsx(contract,new Map([[contract.id,contract],[f.child.id,f.child]]),new Map()),/children === undefined/);
 for(const mutation of ['main','instance','key','set','file','missing','props']){
  const {f,n}=make();
  if(mutation==='main')n.instanceGeometry!.componentId='foreign:1';
  if(mutation==='instance')n.instanceRootOverrides!.nodeId='foreign:1';
  if(mutation==='key')n.instanceRootOverrides!.componentKey='foreign-key';
  if(mutation==='set')n.instanceRootOverrides!.componentSetKey='foreign-key';
  if(mutation==='file')f.child.bindings.figma.anchors.fileKey='foreign-file';
  if(mutation==='missing')delete n.instanceRootOverrides;
  if(mutation==='props'){
   const other=structuredClone(f.set.variants[1]);other.name='Selected=Off';other.variantProperties={Selected:'Off'};
   other.children![0].children![0].componentProperties={Label:'Different'};f.set.variants[0]=other;
  }
  assert.equal(f.read().part.slot?.renderDefault,undefined,mutation);
 }
});

test('mixed component placement preserves absolute and flowing instances across a gated axis',async()=>{
 const f=fixture();f.child.anatomy.root={literals:{width:'24px',height:'24px','background-color':'#123456'}};
 f.set.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'Overlay',variantOptions:['Overlay','Flow','Absent']}};
 f.set.variants=['Overlay','Flow','Absent'].map(mode=>({name:`Mode=${mode}`,variantProperties:{Mode:mode},type:'COMPONENT',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},fixedSize:{width:80,height:40},children:mode==='Absent'?[]:[{name:'Mark',type:'INSTANCE',instanceOf:'Mark',instanceKey:'mark-key',...(mode==='Overlay'?{abs:{x:30,y:5,right:26,bottom:11,width:24,height:24,constraints:{horizontal:'LEFT' as const,vertical:'TOP' as const}}}:{})}]}));
 const result=proposeFromDump(f.set,{corpus,mintUnbound:true,fileKey:'fixture',projectionMode:'exact',contractIdByName:new Map([['Mark',f.child.id]]),contractIdByKey:new Map([['mark-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});
 const contract=ContractSchema.parse(result.contract),scope=new Map([[contract.id,contract],[f.child.id,f.child]]),errors:string[]=[];
 validateContract(contract,scope,errors,new Map());assert.deepEqual(errors,[]);
 const wrapper=Object.values(contract.anatomy.root.parts!)[0];
 assert(wrapper.parts,'mixed geometry needs a host around the unchanged dependency');
 assert.equal(wrapper.tokens?.width,undefined);assert.equal(wrapper.tokens?.height,undefined);
 for(const invalid of ['fill','scale','unknown-parent'] as const){
  const bad=structuredClone(f.set);
  if(invalid==='fill')bad.variants[1].children![0].fillWidth=true;
  if(invalid==='scale')bad.variants[0].children![0].abs!.constraints!.horizontal='SCALE';
  if(invalid==='unknown-parent')delete bad.variants[1].layout;
  const refused=proposeFromDump(bad,{corpus,mintUnbound:true,fileKey:'fixture',projectionMode:'exact',contractIdByName:new Map([['Mark',f.child.id]]),contractIdByKey:new Map([['mark-key',f.child.id]]),contractsById:new Map([[f.child.id,asMinimalChildContract(f.child)]])});
  const direct=Object.values(ContractSchema.parse(refused.contract).anatomy.root.parts!)[0];
  assert(direct.component,invalid+' must not acquire a misleading positioned wrapper');
 }
 const tokens={primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,scope);
 assert(native.variants.find(v=>v.name==='Mode=Overlay')!.spec.children![0].absolute);
 assert.equal(native.variants.find(v=>v.name==='Mode=Flow')!.spec.children![0].absolute,undefined);
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{mountGenerated}=await import('./react-test-runtime.js'),{chromium}=await import('playwright-core');
 const browser=await chromium.launch();
 try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={contracts:scope,icons:new Map<string,string>(),tokens},files=emitter.emit(contract,ctx),childFiles=emitter.emit(f.child,ctx),page=await browser.newPage();
  try{const render=await mountGenerated(page,contract.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents,{[f.child.name]:{tsx:childFiles[0].contents,css:childFiles.find(x=>x.path.endsWith('.css'))?.contents}});
  const {mintedTokenCss}=await import('./mint-tokens.js');await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});for(const mode of ['overlay','flow','absent','overlay']){
   await render({mode});
   const actual=await page.locator('#root').evaluate(root=>{const host=root.firstElementChild!,child=host.firstElementChild;if(!child)return null;const a=host.getBoundingClientRect(),b=child.getBoundingClientRect();return{position:getComputedStyle(child).position,x:b.x-a.x,y:b.y-a.y,width:b.width,height:b.height}});
   if(mode==='absent')assert.equal(actual,null);else{assert(actual);assert.equal(actual.position,mode==='overlay'?'absolute':'static');assert.equal(actual.x,mode==='overlay'?30:0);assert.equal(actual.y,mode==='overlay'?5:0);assert.equal(actual.width,24);assert.equal(actual.height,24);}
  }}finally{await page.close();}
 }}finally{await browser.close();}
});

test('native slots retain multiple keyed default instances and explicit replacement ownership',async()=>{
 const f=fixture();f.child.props=[{name:'label',type:'text',default:'Default',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}}];
 f.child.anatomy.root={parts:{label:{content:{prop:'label'}}}};
 for(const [i,v]of f.set.variants.entries())v.children=[{name:'Options',type:'SLOT',layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:4,padding:[0,0,0,0]},children:['First',...(i?['Second']:[])].map((name,index)=>({name:index?'Alpha':'Zulu',type:'INSTANCE',instanceOf:'Mark',instanceKey:'mark-key',componentProperties:{Label:name}}))}];
 const {contract,result,part}=f.read();assert.equal(part.slot?.renderDefault,true);assert.equal(part.slot?.defaultContent?.length,2);
 const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),errors:string[]=[];validateContract(contract,scope,errors,new Map());assert.deepEqual(errors,[]);
 const tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},engine=createFigmaEngine({tokens,icons:new Map()});
 const native=engine.compileComponentData(contract,scope);
 for(const variant of native.variants){const slot=variant.spec.children![0];assert.equal(slot.type,'slot');assert.equal(slot.slotDefault,undefined);assert.equal(slot.children?.length,variant.name.includes('On')?2:1);}
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{mountGenerated}=await import('./react-test-runtime.js'),{chromium}=await import('playwright-core');const browser=await chromium.launch();
 try{for(const emitter of [reactEmitter,reactInlineEmitter]){const ctx={contracts:scope,icons:new Map<string,string>(),tokens},files=emitter.emit(contract,ctx),dep=emitter.emit(f.child,ctx),page=await browser.newPage();try{
  const render=await mountGenerated(page,contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,{Mark:{tsx:dep[0].contents,css:dep.find(f=>f.path.endsWith('.css'))?.contents}});
  for(const selected of ['on','off','on']){
   await render({selected});let text=await page.locator('#root').innerText();assert.equal(text.replace(/\s+/g,' ').trim(),selected==='on'?'First Second':'First');
   await render({selected,[part.slot!.name]:'Replacement'});assert.equal(await page.locator('#root').innerText(),'Replacement');
   for(const value of [null,false,'']){await render({selected,[part.slot!.name]:value});assert.equal(await page.locator('#root').innerText(),'');}
  }
 }finally{await page.close();}}}finally{await browser.close();}
});
