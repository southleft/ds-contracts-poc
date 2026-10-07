import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){
 const child=(index:number)=>({name:'Icon',type:'INSTANCE',instanceOf:'Icon',instanceKey:'main-key',instanceSetKey:'set-key',bbox:{width:24,height:24},componentProperties:{Size:'Medium'},
  instanceVectorContent:{source:[{nodeId:`use-${index}`,componentId:'main',key:'main-key'}],paint:{hex:index?'00ff00':'ff0000'},shape:{kind:'path',width:20,height:19,x:2,y:2.5,right:2,bottom:2.5,paths:[{data:'M0 0L20 0L10 19Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24}}}});
 return {Holder:{setName:'Holder',type:'COMPONENT_SET',key:'holder-key',propertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'Red',variantOptions:['Red','Green']}},variants:[0,1].map(i=>({name:`Tone=${i?'Green':'Red'}`,type:'COMPONENT',variantProperties:{Tone:i?'Green':'Red'},bbox:{width:24,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[child(i)]}))}} as any;
}
const project=(dump=fixture())=>proposeBatchFromDump(dump,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture'});
function partitionedStateFixture(){
 const variants=['First','Second'].flatMap((platform,i)=>['White','Gray'].flatMap((style,j)=>['Default','Hover'].map(state=>({
  name:`Platform=${platform}, Style=${style}, State=${state}`,type:'COMPONENT',
  variantProperties:{Platform:platform,Style:style,State:state},bbox:{width:24,height:24},
  children:[{name:'Vector',nodeId:`${platform}-${style}-${state}`,type:'VECTOR',
   fill:{hex:state==='Default'?(j?'888888':'ffffff'):(i?'333333':'555555')},
   shape:{kind:'path',width:24,height:24,paths:[{data:`M0 0L24 0L${8+i*4+j} 24Z`,windingRule:'NONZERO'}]}}],
 }))));
 const dump={_provenance:{stampsObservable:true},Icons:{setName:'Icons',type:'COMPONENT_SET',propertyDefinitions:{
  Platform:{type:'VARIANT',defaultValue:'First',variantOptions:['First','Second']},
  Style:{type:'VARIANT',defaultValue:'White',variantOptions:['White','Gray']},
  State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']},
 },variants}} as any;
 return dump;
}
test('geometry-partitioned source layers retain their own hover paint',async()=>{
 const dump=partitionedStateFixture();
 const result=project(dump);assert.deepEqual(result.skipped,[]);
 const contract=ContractSchema.parse(result.proposals[0]!.contract);
 const parts=Object.values(contract.anatomy.root.parts??{}) as any[];
 assert.equal(parts.length,4,'both axes require separate geometry owners');
 for(const part of parts){
  assert.ok(part.shape);
  assert.ok(part.states?.hover?.['background-color'],'each captured owner gets its hover paint');
 }
 assert.notEqual(parts[0].states.hover['background-color'],parts[2].states.hover['background-color'],'different source owners do not share the first paint');
 const tokens={primitives:result.proposals[0]!.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const engine=createFigmaEngine({tokens,icons:new Map()});
 const native=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
 assert.equal(native.variants.length,4);
 assert.equal(native.stateVariants?.length,4);
 for(const cell of [...native.variants,...native.stateVariants??[]]){
  const ink=cell.spec.children![0].children![0];
  assert.equal(cell.spec.children!.length,1);
  const token=ink.fill!.split('/').reduce((value:any,key)=>value[key],tokens.primitives);
  const expected=cell.name.includes('State=Hover')?(cell.name.includes('Platform=First')?'#555555':'#333333'):(cell.name.includes('Style=White')?'#ffffff':'#888888');
  assert.equal(token.$value,expected,cell.name+' native paint matches its source owner');
 }
 const ambiguous=structuredClone(dump);
 for(const variant of ambiguous.Icons.variants)variant.children[0].nodeId='ambiguous-owner';
 const refused=project(ambiguous);
 assert.equal(refused.proposals.length,0,'ambiguous captured identities cannot route paint by guess');
 assert.match(refused.skipped[0]!.reason,/state-axis-state-not-carried:hover/);
});
test('shares observed shape while carrying both host paints independently',()=>{
 const result=project();assert.deepEqual(result.skipped,[]);const p=result.proposals[0]!;
 const child=p.childStubs![0] as any;assert.equal(child.anatomy.root.parts.glyph.shape.paths[0].data,'M0 0L20 0L10 19Z');
 assert.deepEqual(child.anatomy.root.overridable,['color']);
 const components:any[]=[];const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(v.component)components.push(v.component);Object.values(v).forEach(visit);};visit(p.contract.anatomy);assert.ok(components.some(c=>c.id===child.id&&c.overrides?.color));
 assert.match(child.description,/unobserved variants remain unknown/);
});
test('missing or conflicting later observations cannot freeze the first host',()=>{
 for(const mutate of [
  (n:any)=>delete n.instanceVectorContent,
  (n:any)=>{n.instanceVectorContent.shape.width=18;},
  (n:any)=>{n.instanceVectorContent.source[0].key='other';},
  (n:any)=>{n.componentProperties.Size=true;},
 ]){const dump=fixture();mutate(dump.Holder.variants[1].children[0]);const p=project(dump).proposals[0]!;
  assert.equal((p.childStubs![0] as any).anatomy.root.parts.glyph,undefined);
  assert.ok(p.notes.some(n=>n.includes('observed-vector-content-refused')));
 }
});

test('the proposal boundary refuses a shared path whose control hull escapes the observed parent',()=>{
 const dump=fixture();
 for(const variant of dump.Holder.variants) variant.children[0].instanceVectorContent.shape.paths[0].data='M0 0C-3 0 20 0 10 19Z';
 const p=project(dump).proposals[0]!;
 assert.equal((p.childStubs![0] as any).anatomy.root.parts.glyph,undefined);
 assert.ok(p.notes.some(n=>n.includes('observed-vector-content-refused')));
});

 test('parent-relative curves retain original controls outside intrinsic bounds',()=>{
 const dump=fixture(),path='M0 0C-1 0 20 0 10 19Z';
 for(const v of dump.Holder.variants)v.children[0].instanceVectorContent.shape.paths[0].data=path;
 const p=project(dump).proposals[0]!,shape=(p.childStubs![0] as any).anatomy.root.parts.glyph.shape;
 assert.equal(shape.paths[0].data,path);
 assert.deepEqual(shape.parentViewport,{width:24,height:24,x:2,y:2.5});
 });

test('repeated vector state names keep distinct owners and refuse changed sibling identity',()=>{
 for(const nested of [false,true])for(const fault of ['none','missing','extra','reordered']){
  const dump=partitionedStateFixture();
  for(const variant of dump.Icons.variants){
   const first=variant.children[0],second=structuredClone(first);
   second.nodeId+='-second';second.shape.paths[0].data='M0 0L20 0L20 20Z';
   second.fill.hex=variant.variantProperties.State==='Hover'?'aa5500':'0055aa';
   const siblings=[first,second];
   if(variant.variantProperties.State==='Hover'){
    if(fault==='missing')siblings.pop();
    if(fault==='extra')siblings.push({...structuredClone(second),nodeId:second.nodeId+'-extra'});
    if(fault==='reordered')siblings.reverse();
   }
   variant.children=nested?[{name:'Group',type:'FRAME',nodeId:first.nodeId+'-group',bbox:{width:24,height:24},children:siblings}]:siblings;
  }
  const result=project(dump);
  if(fault!=='none'){
   assert.equal(result.proposals.length,0,`${nested}/${fault}`);
   assert.match(result.skipped[0]!.reason,/state-axis-state-not-carried/);continue;
  }
  assert.deepEqual(result.skipped,[]);
  const proposal=result.proposals[0]!,parts:any[]=[];
  const walk=(part:any)=>{if(part.shape)parts.push(part);Object.values(part.parts??{}).forEach(walk);};walk(ContractSchema.parse(proposal.contract).anatomy.root);
  assert.equal(parts.length,5);
  const colors=parts.map(part=>part.states.hover['background-color'].slice(1,-1).split('.').reduce((value:any,key:string)=>value[key],proposal.mintedTokens!.tree).$value);
  assert.deepEqual(colors.sort(),['#333333','#333333','#555555','#555555','#aa5500'].sort());
  const contract=ContractSchema.parse(proposal.contract);
  const tokens={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
  const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,new Map([[contract.id,contract]]));
  for(const cell of [...native.variants,...native.stateVariants??[]]){
   const paints:string[]=[];
   const collect=(node:any)=>{
    if(node.nativePathInk)paints.push(node.fill.split('/').reduce((value:any,key:string)=>value[key],tokens.primitives).$value);
    (node.children??[]).forEach(collect);
   };
   collect(cell.spec);
   const hover=cell.name.includes('State=Hover');
   const first=hover?(cell.name.includes('Platform=First')?'#555555':'#333333'):(cell.name.includes('Style=White')?'#ffffff':'#888888');
   assert.deepEqual(paints.sort(),[first,hover?'#aa5500':'#0055aa'].sort(),`${nested}/${cell.name} native owners`);
  }
 }
});

function sizedDrawingFixture(){
 const dump=fixture();
 for(const [i,variant] of dump.Holder.variants.entries()){
  const use=variant.children[0]; use.componentProperties.Size=i?'Small':'Medium';
  if(i){use.instanceKey='small-key';use.instanceVectorContent.source[0].key='small-key';
   use.instanceVectorContent.source[0].componentId='small-main';
   use.bbox={width:20,height:20};use.instanceVectorContent.shape={kind:'path',width:12,height:12,x:4,y:4,right:4,bottom:4,
    paths:[{data:'M0 0L12 0L6 12Z',windingRule:'NONZERO'}],parentViewport:{width:20,height:20}};}
 }
 return dump;
}
test('observed drawing variants retain each keyed path, size and host paint',()=>{
 const result=project(sizedDrawingFixture());assert.deepEqual(result.skipped,[]);
 const p=result.proposals[0]!, child=ContractSchema.parse(p.childStubs![0]);
 const root=child.anatomy.root,parts=Object.values(root.parts!);
 assert.equal(parts.length,2);
 assert.deepEqual(root.literalsByCombination?.[0].rows,[
  {values:['medium'],literals:{width:'24px',height:'24px'}},
  {values:['small'],literals:{width:'20px',height:'20px'}},
 ]);
 assert.deepEqual(parts.map(part=>Object.values(Object.values(part.parts!)[0].parts!)[0].shape!.paths?.[0].data),['M0 0L20 0L10 19Z','M0 0L12 0L6 12Z']);
 for(const [i,part] of parts.entries())assert.deepEqual(part.presenceByCombination?.rows.map(r=>r.present),[i===0,i===1]);
 assert.deepEqual(root.overridable,['color']);
 const components:any[]=[];const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(v.component)components.push(v.component);Object.values(v).forEach(visit);};visit(p.contract.anatomy);
 assert.ok(components.some(c=>c.id===child.id&&c.overrides?.color),'each host retains independently captured ink');
});
test('prop selection does not excuse missing or conflicting drawing evidence',()=>{
 for(const fault of ['missing','conflicting','canonical-collision']){
  const dump=sizedDrawingFixture();
  if(fault==='missing')delete dump.Holder.variants[1].children[0].instanceVectorContent;
  else{const duplicate=structuredClone(dump.Holder.variants[1]);duplicate.name='Tone=Other';duplicate.variantProperties.Tone='Other';
   if(fault==='conflicting')duplicate.children[0].instanceVectorContent.shape.width=11;
   else duplicate.children[0].componentProperties.Size='small';
   dump.Holder.variants.push(duplicate);dump.Holder.propertyDefinitions.Tone.variantOptions.push('Other');}
  const p=project(dump).proposals[0]!;
  assert.ok(p.notes.some(n=>n.includes('observed-vector-content-refused')),fault);
  assert.equal(Object.keys((p.childStubs![0] as any).anatomy.root.parts).length,0,fault);
 }
});

test('both React surfaces switch observed drawing paths and coordinate planes',async()=>{
 const {chromium}=await import('playwright-core');
 const {emitReact}=await import('./emit-react.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const p=project(sizedDrawingFixture()).proposals[0]!;
 const child=ContractSchema.parse(p.childStubs![0]);
 child.anatomy.root.tokens={color:'{ink}'};
 const tokens={primitives:{ink:{$value:'#2468ac',$type:'color'}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const contracts=new Map([[child.id,child]]),browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
  const page=await browser.newPage();
  try{
   const out=surface==='module'?emitReact(child,{tokens:new Set(['ink']),icons:new Map(),contracts}):{...emitReactInline(child,{tokens,icons:new Map(),contracts}),css:''};
   const render=await mountGenerated(page,child.name,out.tsx,out.css);
   await page.addStyleTag({content:':root{--ink:#2468ac}'});
   for(const [size,dimension,path] of [['medium',24,'M0 0L20 0L10 19Z'],['small',20,'M0 0L12 0L6 12Z'],['medium',24,'M0 0L20 0L10 19Z']] as const){
    await render({size});
    const result=await page.evaluate(()=>{
     const paths=[...document.querySelectorAll('#root svg[viewBox] path')];
     const plane=paths[0]?.closest('svg')?.parentElement?.getBoundingClientRect();
     return {count:paths.length,path:paths[0]?.getAttribute('d'),width:plane?.width,height:plane?.height,ink:paths[0]&&getComputedStyle(paths[0]).fill};
    });
    assert.deepEqual(result,{count:1,path,width:dimension,height:dimension,ink:'rgb(36, 104, 172)'},surface+'/'+size);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
});
