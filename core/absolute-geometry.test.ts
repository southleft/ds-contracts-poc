import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeAbsoluteGeometry, type AbsoluteGeometryInput} from '../packages/schema/src/absolute-geometry.js';
const captured = (): AbsoluteGeometryInput => ({box:{x:0,y:37,width:12,height:225,right:0,bottom:38,constraints:{horizontal:'SCALE',vertical:'SCALE'}},parent:{width:12,height:300}});
test('captured scale geometry preserves source extent and constraints without mutating source',()=>{
 const input=captured(),before=structuredClone(input),result=normalizeAbsoluteGeometry(input);
 assert.deepEqual(result.native,{x:0,y:37,width:12,height:225,constraints:input.box.constraints});
 assert.equal(result.css.width,'100%');assert.equal(result.css.height,'75%');assert.deepEqual(input,before);
 assert.notEqual(result.native.constraints,input.box.constraints);
});
test('a border-changing coordinate origin is compensated in both offset and extent',()=>{
 const result=normalizeAbsoluteGeometry({...captured(),border:{left:1,right:2,top:3,bottom:4}});
 assert.equal(result.css.left,'calc(0% - 1px)');assert.equal(result.css.width,'calc(100% + 3px)');
 assert.equal(result.css.height,'calc(75% + 5.25px)');
});
test('axis changes clear inactive edges and dimensions instead of keeping previous variant styles',()=>{
 const input=captured(),right=normalizeAbsoluteGeometry({...input,box:{...input.box,constraints:{horizontal:'RIGHT',vertical:'BOTTOM'}}});
 assert.equal(right.css.left,'auto');assert.equal(right.css.top,'auto');assert.equal(right.css.right,'0px');assert.equal(right.css.bottom,'38px');
 const stretch=normalizeAbsoluteGeometry({...input,box:{...input.box,constraints:{horizontal:'STRETCH',vertical:'STRETCH'}}});
 assert.equal(stretch.css.width,'auto');assert.equal(stretch.css.height,'auto');assert.equal(stretch.css.top,'37px');assert.equal(stretch.css.bottom,'38px');
});
test('parent inconsistency and impossible padding boxes refuse instead of inventing scale ratios',()=>{
 const input=captured();assert.throws(()=>normalizeAbsoluteGeometry({...input,parent:{width:0,height:300}}),/parent-unqualified/);
 assert.throws(()=>normalizeAbsoluteGeometry({...input,parent:{width:13,height:300}}),/parent-inconsistent/);
 assert.throws(()=>normalizeAbsoluteGeometry({...input,border:{left:6,right:6,top:0,bottom:0}}),/padding-box-unqualified/);
 assert.throws(()=>normalizeAbsoluteGeometry({...input,box:{...input.box,width:NaN}}),/box-unqualified/);
});
test('synthetic observations and independently bound dimensions cannot authorize a new placement',()=>{
 assert.throws(()=>normalizeAbsoluteGeometry({...captured(),synthetic:true}),/synthetic-observation/);
 assert.throws(()=>normalizeAbsoluteGeometry({...captured(),boundSize:{height:true}}),/bound-size-needs-owner/);
});

import {AbsoluteGeometrySchema, AbsoluteGeometryByCombinationSchema, ContractSchema, resolveAbsoluteGeometry} from '../packages/schema/src/contract-schema.js';
const geometry = (): ReturnType<typeof AbsoluteGeometrySchema.parse> => ({...captured(),border:{left:0,right:0,top:0,bottom:0}});
const placementContract = (table: unknown) => ({id:'ds.slider',name:'Slider',version:'0.1.0',status:'draft',description:'Captured slider geometry',semantics:{element:'div'},
 props:[{name:'orientation',type:{enum:['horizontal','vertical']},required:false,bindings:{code:{prop:'orientation'},figma:{kind:'VARIANT',property:'Orientation',unsetValue:'Unset',values:{horizontal:'Horizontal',vertical:'Vertical'}}}}],states:[],
 anatomy:{root:{parts:{range:{absoluteGeometryByCombination:table}}}},
 bindings:{figma:{anchors:{fileKey:'fixture',nodeId:'1:2',componentSetKey:'fixture-key'}},code:{anchors:{importPath:'./Slider',export:'Slider'}}}});
const table = () => ({props:['orientation'],rows:[null,'horizontal','vertical'].map(value=>({values:[value],geometry:geometry()}))});
test('contract carrier validates captured basis rather than merely accepting finite numbers',()=>{
 assert(AbsoluteGeometrySchema.safeParse(geometry()).success);
 assert(!AbsoluteGeometrySchema.safeParse({...geometry(),parent:{width:13,height:300}}).success);
 assert(!AbsoluteGeometrySchema.safeParse({...geometry(),synthetic:true}).success);
 assert(!AbsoluteGeometrySchema.safeParse({...geometry(),box:{...captured().box,constraints:{horizontal:'UNKNOWN',vertical:'SCALE'}}}).success);
});
test('placement table refuses duplicate identities and truncated tuple arity',()=>{
 const t=table();assert(!AbsoluteGeometryByCombinationSchema.safeParse({...t,props:['orientation','orientation']}).success);
 assert(!AbsoluteGeometryByCombinationSchema.safeParse({...t,rows:[...t.rows,t.rows[0]]}).success);
 assert(!AbsoluteGeometryByCombinationSchema.safeParse({...t,props:['orientation','size']}).success);
});
test('contract table must cover omission and every declared axis value exactly',()=>{
 const parsed=ContractSchema.safeParse(placementContract(table()));assert(parsed.success,JSON.stringify(parsed.error?.issues));
 const t=table();const missing=ContractSchema.safeParse(placementContract({...t,rows:t.rows.slice(1)}));
 assert(!missing.success);assert(missing.error.issues.some(issue=>issue.message==='absolute-geometry-combination-incomplete'));
 assert(!ContractSchema.safeParse(placementContract({...t,props:['unknown']})).success);
 assert(!ContractSchema.safeParse(placementContract({...t,rows:t.rows.map((row,i)=>i===0?{...row,values:['diagonal']}:row)})).success);
});
test('shared resolver preserves omission identity and refuses absent concrete planes',()=>{
 const t=table();t.rows[1].geometry=AbsoluteGeometrySchema.parse({...geometry(),box:{...geometry().box,constraints:{horizontal:'SCALE',vertical:'CENTER'}}});
 const part=ContractSchema.parse(placementContract(t)).anatomy.root.parts!.range;
 assert.equal(resolveAbsoluteGeometry(part,{})!.box.constraints.vertical,'SCALE');
 assert.equal(resolveAbsoluteGeometry(part,{orientation:'horizontal'})!.box.constraints.vertical,'CENTER');
 assert.throws(()=>resolveAbsoluteGeometry(part,{orientation:'false'}),/combination-unavailable/);
});
test('geometry requires a parent and cannot coexist with another placement owner',()=>{
 const c=placementContract(table());c.anatomy.root={absoluteGeometry:geometry()} as never;
 assert(!ContractSchema.safeParse(c).success);
 const competing={absoluteGeometry:geometry(),absolutePlacement:{left:0,top:0}};
 c.anatomy.root={parts:{range:competing}} as never;assert(!ContractSchema.safeParse(c).success);
});

import {validateContract} from '../packages/core/src/validate.js';
test('placement referee refuses bound dimensions and unowned component or slot hosts',()=>{
 const raw=ContractSchema.parse(placementContract(table()));
 raw.anatomy.root={declared:{position:'relative'},parts:{range:{absoluteGeometry:geometry()}}};
 const check=(input:unknown)=>{const c=ContractSchema.parse(input),errors:string[]=[];validateContract(c,new Map([[c.id,c]]),errors,new Map());return errors;};
 assert.deepEqual(check(raw),[]);
 const bound=structuredClone(raw);bound.anatomy.root.parts!.range.tokens={height:'{range.height}'};
 assert(check(bound).some(error=>error.includes('absolute-geometry-competing-channel')));
 const unpositioned=structuredClone(raw);delete unpositioned.anatomy.root.declared;
 assert(check(unpositioned).some(error=>error.includes('absolute-geometry-host-unproven')));
 const transformed=structuredClone(raw);transformed.anatomy.root.tokens={transform:'{parent.transform}'};
 assert(check(transformed).some(error=>error.includes('absolute-geometry-host-unproven')));
});

import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {emitReact,generateCss,generateTsx} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
test('actual generated React surfaces preserve captured boxes through resize and constraint transitions',async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();
  for (const bordered of [false,true]) {
   const t=table();
   t.rows[1].geometry.box.constraints={horizontal:'RIGHT',vertical:'BOTTOM'};
   t.rows[2].geometry.box.constraints={horizontal:'STRETCH',vertical:'STRETCH'};
   if(bordered)for(const row of t.rows)row.geometry.border={left:1,right:2,top:3,bottom:4};
   const c=ContractSchema.parse(placementContract(t));
   c.anatomy.root.declared={position:'relative'};
   c.anatomy.root.literals={width:'12px',height:'300px',...(bordered?{'border-left-width':'1px','border-right-width':'2px','border-top-width':'3px','border-bottom-width':'4px','border-color':'transparent'}:{})};
   c.anatomy.root.parts!.range.element='div';
   const contracts=new Map([[c.id,c]]),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
   for(const surface of ['module','inline']){
    const output=surface==='module'?emitReact(c,{contracts,icons:new Map(),tokens:new Set()}):{...emitReactInline(c,{contracts,icons:new Map(),tokens}),css:''};
    assert.deepEqual(generatedTypeErrors(c.name,output.tsx),[],surface);
    const render=await mountGenerated(page,c.name,output.tsx,output.css);
    for(const scale of [1,2]){
     await page.locator('#root > *').evaluate((root,scale)=>{(root as HTMLElement).style.width=`${12*scale}px`;(root as HTMLElement).style.height=`${300*scale}px`;},scale);
     for(const orientation of [undefined,'horizontal','vertical',undefined]){
      await render(orientation===undefined?{}:{orientation});
      const actual=await page.locator('#root > *').evaluate(root=>{const p=root.getBoundingClientRect(),c=root.children[0].getBoundingClientRect();return{x:c.x-p.x,y:c.y-p.y,width:c.width,height:c.height};});
      const expected=orientation===undefined?{x:0,y:37*scale,width:12*scale,height:225*scale}
       :orientation==='horizontal'?{x:12*(scale-1),y:300*scale-38-225,width:12,height:225}
       :{x:0,y:37,width:12*scale,height:300*scale-37-38};
      for(const key of ['x','y','width','height'] as const)assert(Math.abs(actual[key]-expected[key])<=.05,JSON.stringify({surface,bordered,scale,orientation,key,actual,expected}));
     }
    }
   }
  }
 }finally{await browser.close();}
});

import {resolveNativeAbsoluteGeometry} from '../packages/schema/src/absolute-geometry.js';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback} from './native-source-observation.js';
import {revisionOf} from './contract-provenance.js';
test('native geometry resolves each captured constraint after the parent changes size',()=>{
 const input=geometry();
 assert.deepEqual(resolveNativeAbsoluteGeometry(input,{width:24,height:600}),{x:0,y:74,width:24,height:450,constraints:{horizontal:'SCALE',vertical:'SCALE'}});
 input.box.constraints={horizontal:'RIGHT',vertical:'BOTTOM'};
 assert.deepEqual(resolveNativeAbsoluteGeometry(input,{width:24,height:600}),{x:12,y:337,width:12,height:225,constraints:{horizontal:'MAX',vertical:'MAX'}});
 input.box.constraints={horizontal:'STRETCH',vertical:'CENTER'};
 assert.deepEqual(resolveNativeAbsoluteGeometry(input,{width:24,height:600}),{x:0,y:187,width:24,height:225,constraints:{horizontal:'STRETCH',vertical:'CENTER'}});
 assert.throws(()=>resolveNativeAbsoluteGeometry(input,{width:0,height:600}),/native-parent-unqualified/);
});
test('emitted native creation and independent readback retain source box and constraints at both parent sizes',async()=>{
 const f=await nativeComparisonFixture();
 for(const scale of [1,2]){
  const c=f.contract(`fixture.captured-geometry-${scale}`,{root:{layout:{display:'flex'},declared:{position:'relative'},literals:{width:`${12*scale}px`,height:`${300*scale}px`},parts:{range:{element:'div',absoluteGeometry:geometry(),literals:{'background-color':'#5555ff'}}}}});
  const scope=new Map([[c.id,c]]),compiled=f.engine.compileNativeContractDraft(c,scope,f.source);
  const child=compiled.component.variants[0].spec.children![0];assert.deepEqual(child.capturedAbsoluteGeometry,geometry());
  const context=await f.context(`10000000-0000-4000-8000-00000000009${scale}`);
  const created=await f.run(f.engine.buildNativeContractDraftScript(c,scope,f.source,context));
  assert.equal(created.status,'created-candidate',JSON.stringify(created));
  const input={operation:context.operation,planRevision:revisionOf(c),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation:created};
  const receipt=await f.run(emitNativeContractReadbackScript(input));
  const observed=verifyNativeContractReadback(input,receipt);
  assert.equal(observed.status,'supported-structure-observed',JSON.stringify(observed));
  const row=receipt.nodes.find((n:{name:string})=>n.name==='range');assert(row);assert.equal(row.values.y,37*scale);assert.equal(row.values.height,225*scale);assert.equal(row.values.width,12*scale);assert.deepEqual(row.values.constraints,{horizontal:'SCALE',vertical:'SCALE'});
  for(const corruption of ['constraint','offset','extent','paint-color','paint-alpha','paint-binding','paint-stack']){
   const bad=structuredClone(receipt),changed=bad.nodes.find((n:{id:string})=>n.id===row.id);
   if(corruption==='constraint')changed.values.constraints.vertical='MIN';
   if(corruption==='offset')changed.values.y+=1;
   if(corruption==='extent')changed.values.height+=1;
   if(corruption==='paint-color')changed.values.fills[0].color.r=0;
   if(corruption==='paint-alpha')changed.values.fills[0].opacity=0.5;
   if(corruption==='paint-binding')changed.values.fills[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'foreign-variable'}};
   if(corruption==='paint-stack')changed.values.fills.push(structuredClone(changed.values.fills[0]));
   assert.equal(verifyNativeContractReadback(input,bad).status,'refused',corruption);
  }
 }
});

import {flattenTokens} from './tokens.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {walkAnatomy} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpSet} from '../extract/figma/types.js';
const sourceGeometryFixture=()=>{
 const primitives={w:{$type:'dimension',$value:'12px'},h:{$type:'dimension',$value:'300px'}};
 const set:DumpSet={setName:'Captured Range',type:'COMPONENT_SET',propertyDefinitions:{Orientation:{type:'VARIANT',defaultValue:'Horizontal',variantOptions:['Horizontal','Vertical']}},variants:['Horizontal','Vertical'].map((value,index)=>({name:`Orientation=${value}`,type:'COMPONENT',bbox:{width:12,height:300},bound:{width:'w',height:'h'},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',primarySizing:'FIXED',counterSizing:'FIXED',padding:[0,0,0,0]},children:[{name:'Range',type:'FRAME',fill:{hex:'abcdef'},abs:{...captured().box,constraints:{horizontal:'SCALE',vertical:index?'CENTER':'SCALE'}}}]}))};
 const read=()=>proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),fileKey:'fixture',projectionMode:'reviewable-inversion'});
 return{set,read,primitives};
};
test('captured SCALE dump reaches contract and both emitted directions without changing source bytes',()=>{
 const f=sourceGeometryFixture(),source=JSON.stringify(f.set),proposal=f.read(),c=ContractSchema.parse(proposal.contract);
 const found=walkAnatomy(c).find(row=>row.part.absoluteGeometryByCombination);assert(found,JSON.stringify(proposal.notes));
 assert(proposal.notes.some(note=>note.includes('absolute placement carried through captured geometry')));
 const table=found.part.absoluteGeometryByCombination!;assert.equal(table.rows.length,2);assert.deepEqual(table.rows.map(row=>row.geometry.box.constraints.vertical),['SCALE','CENTER']);
 assert.deepEqual(table.rows.map(row=>row.geometry.parent),[{width:12,height:300},{width:12,height:300}]);
 assert.equal(found.part.tokens?.height,undefined);assert.equal(found.part.declared?.position,undefined);
 const scope=new Map([[c.id,c]]),errors:string[]=[];validateContract(c,scope,errors,new Map());assert.deepEqual(errors,[]);
 const primitives={...f.primitives,...proposal.mintedTokens!.tree},tokens={primitives,semantic:{},light:{},dark:{},brands:{default:{}}};
 const react=emitReact(c,{contracts:scope,icons:new Map(),tokens:new Set(flattenTokens(primitives).keys()),tokenValues:tokens});assert.match(react.css,/height: 75%/);
 const inline=emitReactInline(c,{contracts:scope,icons:new Map(),tokens});assert.match(inline.tsx,/'?75%'?/);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 for(const variant of native.variants){const child=variant.spec.children!.find(child=>child.capturedAbsoluteGeometry);assert(child);assert.equal(child.capturedAbsoluteGeometry!.box.height,225);assert.equal(child.capturedAbsoluteGeometry!.box.y,37);}
 assert.equal(JSON.stringify(f.set),source);
});
test('source geometry cannot override bindings, inconsistent parent bounds or synthetic observations',()=>{
 for(const condition of ['binding','parent','synthetic']){
  const f=sourceGeometryFixture();
  for(const variant of f.set.variants){const child=variant.children![0];
   if(condition==='binding')child.bound={height:'h'};
   if(condition==='parent')variant.bbox!.height=301;
   if(condition==='synthetic')Object.assign(child,{__synthetic:true});
  }
  const proposed=f.read(),c=ContractSchema.parse(proposed.contract);
  assert(!walkAnatomy(c).some(row=>row.part.absoluteGeometry || row.part.absoluteGeometryByCombination),condition);
  assert(proposed.notes.some(note=>/absolute.*NOT carried/.test(note)),condition);
 }
});

test('a real absolute child witnesses only its explicit FIXED non-FILL parent axis',()=>{
 const f=sourceGeometryFixture();
 for(const [index,v] of f.set.variants.entries()){
  const box={...captured().box,constraints:{horizontal:'SCALE',vertical:'SCALE'}};
  const host={name:'Track',type:'FRAME',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',primarySizing:'FIXED',counterSizing:'FIXED',padding:[0,0,0,0]},...(index?{fillWidth:true}:{fillHeight:true}),children:[{name:'Range',type:'FRAME',fill:{hex:'abcdef'},abs:box}]};
  v.children=[host] as never;
 }
 const proposed=f.read(),c=ContractSchema.parse(proposed.contract),track=walkAnatomy(c).find(row=>row.name==='Track')!.part;
 const rows=track.literalsByCombination?.flatMap(table=>table.rows)??[];
 assert(rows.some(row=>row.literals.width==='12px'));
 assert(rows.some(row=>row.literals.height==='300px'));
 assert(rows.filter(row=>row.literals.width).every(row=>row.values.includes('horizontal')),'FILL width never receives a fixed width');
 assert(rows.filter(row=>row.literals.height).every(row=>row.values.includes('vertical')),'FILL height never receives a fixed height');
});
test('conflicting child parent witnesses cannot mint a parent extent',()=>{
 const f=sourceGeometryFixture();
 for(const v of f.set.variants){v.children=[{name:'Track',type:'FRAME',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',primarySizing:'FIXED',counterSizing:'FIXED',padding:[0,0,0,0]},children:[{name:'Range',type:'FRAME',abs:captured().box},{name:'Conflict',type:'FRAME',abs:{...captured().box,right:1}}]}] as never;}
 const proposed=f.read(),c=ContractSchema.parse(proposed.contract),track=walkAnatomy(c).find(row=>row.name==='Track')!.part;
 assert.equal(track.tokens?.width,undefined);assert(!track.literalsByCombination?.some(table=>table.rows.some(row=>row.literals.width)));
});

test('conditional geometry covers every visible enum plane and never substitutes a missing visible rectangle',()=>{
 const t=table(),raw:any=placementContract({...t,rows:t.rows.slice(1)});
 raw.anatomy.root.parts.range.visibleWhen={prop:'orientation',equals:['horizontal','vertical']} as never;
 const parsed=ContractSchema.safeParse(raw);assert(parsed.success,JSON.stringify(parsed.error?.issues));if(!parsed.success)return;
 const part=parsed.data.anatomy.root.parts!.range;
 assert.equal(resolveAbsoluteGeometry(part,{}),undefined);
 assert(resolveAbsoluteGeometry(part,{orientation:'horizontal'}));
 const hole=structuredClone(raw);hole.anatomy.root.parts.range.absoluteGeometryByCombination.rows.pop();assert(!ContractSchema.safeParse(hole).success);
 const wrongGate=structuredClone(raw);wrongGate.anatomy.root.parts.range.visibleWhen={prop:'unknown',equals:['horizontal','vertical']} as never;assert(!ContractSchema.safeParse(wrongGate).success);
 const complete:any=placementContract(t);complete.anatomy.root.parts.range.visibleWhen=raw.anatomy.root.parts.range.visibleWhen;assert(ContractSchema.safeParse(complete).success);
 const forged=structuredClone(part);forged.absoluteGeometryByCombination!.rows=forged.absoluteGeometryByCombination!.rows.slice(1);
 assert.throws(()=>resolveAbsoluteGeometry(forged,{orientation:'horizontal'}),/combination-unavailable/);
});

test('captured conditional overlay preserves geometry on visible planes in React and native compilation',()=>{
 const f=sourceGeometryFixture(),original=f.set.variants;
 f.set.propertyDefinitions!.Decoration={type:'VARIANT',defaultValue:'None',variantOptions:['None','Glow','Ink']};
 f.set.variants=original.flatMap(v=>['None','Glow','Ink'].map(decoration=>({...structuredClone(v),name:v.name+`, Decoration=${decoration}`,children:decoration==='None'?[]:structuredClone(v.children)})));
 const before=JSON.stringify(f.set),proposal=f.read(),c=ContractSchema.parse(proposal.contract);
 const found=walkAnatomy(c).find(row=>row.part.absoluteGeometryByCombination);assert(found,JSON.stringify(proposal.notes));
 assert.deepEqual(found.part.visibleWhen,{prop:'decoration',equals:['glow','ink']});
 assert.equal(found.part.absoluteGeometryByCombination!.rows.length,4);
 const scope=new Map([[c.id,c]]),errors:string[]=[];validateContract(c,scope,errors,new Map());assert.deepEqual(errors,[]);
 const primitives={...f.primitives,...proposal.mintedTokens!.tree},tokens={primitives,semantic:{},light:{},dark:{},brands:{default:{}}};
 const inline=emitReactInline(c,{contracts:scope,icons:new Map(),tokens});assert.match(inline.tsx,/'?75%'?/);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 assert.equal(native.variants.length,6);
 for(const variant of native.variants){
  const children=variant.spec.children??[];
  if(variant.name.includes('Decoration=None'))assert.equal(children.length,0);
  else{assert.equal(children.length,1);assert(children[0].capturedAbsoluteGeometry);}
 }
 assert.equal(JSON.stringify(f.set),before);
});

test('mask ownership admits only observed native types and requires a sibling parent',()=>{
 const base=ContractSchema.parse(placementContract(table()));
 for(const type of ['ALPHA','VECTOR','LUMINANCE']){
  const c=structuredClone(base);c.anatomy.root.parts!.range.mask={type:type as 'ALPHA'};
  assert(ContractSchema.safeParse(c).success);
 }
 const unknown=structuredClone(base);unknown.anatomy.root.parts!.range.mask={type:'UNKNOWN'} as never;
 assert(!ContractSchema.safeParse(unknown).success);
 const root=structuredClone(base);root.anatomy.root.mask={type:'ALPHA'};
 assert(!ContractSchema.safeParse(root).success);
});
test('native mask ownership and following sibling order survive creation and independent readback; changed ownership refuses',async()=>{
 const f=await nativeComparisonFixture();let i=0;
 for(const type of ['ALPHA','VECTOR','LUMINANCE'] as const){
  const c=f.contract(`fixture.mask-${type.toLowerCase()}`,{root:{layout:{display:'flex'},literals:{width:'120px',height:'80px'},parts:{
   mask:{mask:{type},shape:{kind:'rect',width:40,height:40},tokens:{'background-color':'{ink}'}},
   paint:{shape:{kind:'rect',width:30,height:30},tokens:{'background-color':'{surface}'}},
  }}});
  const scope=new Map([[c.id,c]]),compiled=f.engine.compileNativeContractDraft(c,scope,f.source);
  assert.deepEqual(compiled.component.variants[0].spec.children!.map(s=>({name:s.name,mask:s.mask})),[{name:'mask',mask:{type}},{name:'paint',mask:undefined}]);
  const context=await f.context(`20000000-0000-4000-8000-00000000000${++i}`);
  const created=await f.run(f.engine.buildNativeContractDraftScript(c,scope,f.source,context));
  assert.equal(created.status,'created-candidate',JSON.stringify(created));
  const input={operation:context.operation,planRevision:revisionOf(c),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation:created};
  const receipt=await f.run(emitNativeContractReadbackScript(input)),observed=verifyNativeContractReadback(input,receipt);
  assert.equal(observed.status,'supported-structure-observed',JSON.stringify(observed));
  const mask=receipt.nodes.find((n:{name:string})=>n.name==='mask'),paint=receipt.nodes.find((n:{name:string})=>n.name==='paint');
  assert.equal(mask.values.isMask,true);assert.equal(mask.values.maskType,type);
  for(const corruption of ['lost-mask','changed-type','missing-type','foreign-mask','reordered-siblings']){
   const bad=structuredClone(receipt),m=bad.nodes.find((n:{id:string})=>n.id===mask.id),p=bad.nodes.find((n:{id:string})=>n.id===paint.id);
   if(corruption==='lost-mask')m.values.isMask=false;
   if(corruption==='changed-type')m.values.maskType=type==='ALPHA'?'VECTOR':'ALPHA';
   if(corruption==='missing-type')delete m.values.maskType;
   if(corruption==='foreign-mask')p.values.isMask=true;
   if(corruption==='reordered-siblings'){
    const parent=bad.nodes.find((n:{childIds:string[]})=>n.childIds?.includes(mask.id)&&n.childIds?.includes(paint.id));
    parent.childIds.reverse();
   }
   const result=verifyNativeContractReadback(input,bad);assert.equal(result.status,'refused',corruption);
  }
 }
});
test('React surfaces refuse masks whose sibling coordinate plane is unqualified',()=>{
 const c=ContractSchema.parse(placementContract(table()));c.anatomy.root.declared={position:'relative'};c.anatomy.root.parts!.range.mask={type:'ALPHA'};
 const ctx={contracts:new Map([[c.id,c]]),tokens:new Set<string>(),icons:new Map()};
 assert.throws(()=>emitReact(c,ctx),/react-mask-composition-unqualified/);
 assert.throws(()=>emitReactInline(c,{...ctx,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{}}}),/react-mask-composition-unqualified/);
});

// Actual native reference: Evaluations 280:6/280:10, 2026-10-01.
// Overlapping opaque red + half blue, ALPHA .5 => RGBA(128,0,128,128).
// VECTOR ignores mask paint opacity => RGBA(127,0,128,255).
// These controls prove compositing semantics, not a real-kit pass rate.
test('both generated React surfaces mask the combined absolute sibling plane and preserve earlier siblings',async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:160,height:100}});
  const capturedBox=(width:number,height:number)=>({box:{x:0,y:0,width,height,right:120-width,bottom:80-height,constraints:{horizontal:'SCALE' as const,vertical:'SCALE' as const}},parent:{width:120,height:80},border:{left:0,right:0,top:0,bottom:0}});
  for(const type of ['ALPHA','VECTOR'] as const){
   for(const paintSource of ['literal','token']){
   const c=ContractSchema.parse({...placementContract(table()),name:'MaskControl',props:[],anatomy:{root:{element:'div',declared:{position:'relative'},literals:{width:'120px',height:'80px'},parts:{
    earlier:{element:'div',absoluteGeometry:capturedBox(90,60),literals:{'background-color':'#00ff00'}},
    mask:{mask:{type},shape:{kind:'rect',width:40,height:40},absoluteGeometry:capturedBox(40,40),literals:{'background-color':type==='ALPHA'?'#ffffff80':'#00000080'}},
    red:{element:'div',absoluteGeometry:capturedBox(90,60),literals:{'background-color':'#ff0000'}},
    blue:{element:'div',absoluteGeometry:capturedBox(90,60),literals:{'background-color':'#0000ff80'}}
   }}}});
   const tokenTree={primitives:{mask:{color:{$type:'color',$value:type==='ALPHA'?'#ffffff80':'#00000080'}}},semantic:{},light:{},dark:{},brands:{}};
   if(paintSource==='token'){
    delete c.anatomy.root.parts!.mask.literals;
    c.anatomy.root.parts!.mask.tokens={'background-color':'{mask.color}'};
   }
   const ctx={contracts:new Map([[c.id,c]]),tokens:new Set<string>(['mask.color']),icons:new Map()};
   for(const surface of ['module','inline']){
    const output=surface==='module'?emitReact(c,ctx):{...emitReactInline(c,{...ctx,tokens:tokenTree}),css:''};
    assert.deepEqual(generatedTypeErrors(c.name,output.tsx),[],surface);
    await mountGenerated(page,c.name,output.tsx,output.css);
    await page.addStyleTag({content:'html,body{margin:0;background:transparent;--mask-color:#ffffff80}'});
    // Earlier green remains outside the mask. Its opaque background also
    // distinguishes group masking from individually masked paint children.
    const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
    const pixel=(x:number,y:number)=>Array.from(png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4));
    const expected=type==='ALPHA'?[64,127,64,255]:[127,0,128,255];
    pixel(10,10).forEach((v,i)=>assert(Math.abs(v-expected[i])<=1,JSON.stringify({surface,type,pixel:pixel(10,10),expected})));
    assert.deepEqual(pixel(50,10),[0,255,0,255]);
    assert.equal(await page.locator('[data-ds-mask-scope]').count(),1);
    // Removing the earlier unmasked child exposes the native alpha exactly.
    await page.locator('#root > * > :first-child').evaluate(n=>n.remove());
    const isolated=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
    const rgba=Array.from(isolated.data.subarray((10*isolated.width+10)*4,(10*isolated.width+10)*4+4));
    const native=type==='ALPHA'?[128,0,128,128]:[127,0,128,255];
    rgba.forEach((v,i)=>assert(Math.abs(v-native[i])<=1,JSON.stringify({surface,type,rgba,native})));
    if(surface==='module' && paintSource==='token' && type==='ALPHA'){
     await page.locator('body').evaluate(n=>(n as HTMLElement).style.setProperty('--mask-color','transparent'));
     const hidden=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
     assert.equal(hidden.data[(10*hidden.width+10)*4+3],0,'theme alpha changes must reach the mask without regenerating code');
     await page.locator('body').evaluate(n=>(n as HTMLElement).style.setProperty('--mask-color','initial'));
     const absent=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
     assert.equal(absent.data[(10*absent.width+10)*4+3],0,'missing token uses transparent mask fallback');
    }
   }
   const unsupported=structuredClone(c);unsupported.anatomy.root.parts!.mask.mask={type:'LUMINANCE'};
   assert.throws(()=>emitReact(unsupported,ctx),/native-luminance-transfer-unqualified/);
   const flow=structuredClone(c);delete flow.anatomy.root.parts!.red.absoluteGeometry;
   assert.throws(()=>emitReact(flow,ctx),/sibling-plane-unqualified:red/);
   }
  }
 }finally{await browser.close();}
});

test('captured mask geometry tables and aliased visibility inputs survive both on-mask and off-mask transitions',async()=>{
 const geometryAt=(scale:number,width:number,height:number)=>({box:{x:0,y:0,width:width*scale,height,right:(120-width)*scale,bottom:80-height,constraints:{horizontal:'SCALE',vertical:'SCALE'}},parent:{width:120*scale,height:80},border:{left:0,right:0,top:0,bottom:0}});
 const placements=(width:number,height:number)=>({props:['extent'],rows:[null,'small','large'].map(value=>({values:[value],geometry:geometryAt(value==='large'?2:1,width,height)}))});
 const parse=(input:unknown)=>{const result=ContractSchema.safeParse(input);assert(result.success,JSON.stringify(result.error?.issues));return result.data!;};
 const c=parse({...placementContract(table()),name:'ConditionalMask',props:[
  {name:'extent',type:{enum:['small','large']},required:false,bindings:{code:{prop:'sizeChoice'},figma:{kind:'VARIANT',property:'Extent',unsetValue:'Unset',values:{small:'Small',large:'Large'}}}},
  {name:'masked',type:'boolean',default:false,required:false,bindings:{code:{prop:'showMask'},figma:{kind:'BOOLEAN',property:'Masked'}}},
 ],anatomy:{root:{declared:{position:'relative'},literals:{width:'120px',height:'80px'},literalsByProp:[{prop:'extent',map:{small:{width:'120px'},large:{width:'240px'}}}],parts:{
  mask:{mask:{type:'ALPHA',outline:'rect'},visibleWhen:{prop:'masked'},absoluteGeometryByCombination:placements(40,40),literals:{'background-color':'#ffffff80'}},
  red:{element:'div',absoluteGeometryByCombination:placements(90,60),literals:{'background-color':'#ff0000'}},
  blue:{element:'div',absoluteGeometryByCombination:placements(90,60),literals:{'background-color':'#0000ff80'}},
 }}}});
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  const ctx={contracts:new Map([[c.id,c]]),icons:new Map(),tokens:new Set<string>()};
  for(const surface of ['module','public-split','inline']){
   const css=surface==='public-split'?generateCss(c,ctx.tokens,[]):'';
   const output=surface==='module'?emitReact(c,ctx):surface==='public-split'?{tsx:generateTsx(c,ctx.contracts,ctx.icons,css),css}
    :{...emitReactInline(c,{...ctx,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{}}}),css:''};
   assert.deepEqual(generatedTypeErrors(c.name,output.tsx),[],surface);
   const render=await mountGenerated(page,c.name,output.tsx,output.css);
   await page.addStyleTag({content:'html,body{margin:0;background:transparent}'});
   for(const [sizeChoice,showMask] of [['small',false],['large',true],['large',false],['small',true],['small',false],[undefined,true]] as const){
    await render({sizeChoice,showMask});
    const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
    assert.equal(png.width,sizeChoice==='large'?240:120,surface);
    const alpha=(x:number,y:number)=>png.data[(y*png.width+x)*4+3];
    assert(Math.abs(alpha(10,10)-(showMask?128:255))<=1,JSON.stringify({surface,sizeChoice,showMask,alpha:alpha(10,10)}));
    assert.equal(alpha(sizeChoice==='large'?100:50,10),showMask?0:255,JSON.stringify({surface,sizeChoice,showMask}));
    assert.equal(await page.locator('[data-ds-mask-scope]').count(),1,'coordinate wrapper remains stable when masking turns off');
   }
  }
 }finally{await browser.close();}
 const f=await nativeComparisonFixture(),native=structuredClone(c);
 native.bindings=f.contract('fixture.mask-anchor-context',{root:{}}).bindings;
 native.props=native.props.filter(p=>p.name==='extent');
 delete native.anatomy.root.parts!.mask.visibleWhen;
 const scope=new Map([[native.id,native]]),compiled=f.engine.compileNativeContractDraft(native,scope,f.source);
 for(const variant of compiled.component.variants){
  const mask=variant.spec.children!.find((n:{name:string})=>n.name==='mask')!;
  assert.equal(mask.type,'shape');assert.equal(mask.shape!.kind,'rect');
  assert.equal(mask.shape!.width,mask.capturedAbsoluteGeometry!.box.width,'native primitive uses each captured plane, never the first variant extent');
 }
 const context=await f.context('10000000-0000-4000-8000-000000000198');
 const creation=await f.run(f.engine.buildNativeContractDraftScript(native,scope,f.source,context));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation:context.operation,planRevision:revisionOf(native),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
 const receipt=await f.run(emitNativeContractReadbackScript(input));
 assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed');
});

import {mintTokens,mintedTokenCss} from './mint-tokens.js';
import {tokenInventoryFromJson} from './tokens.js';
test('complete four-axis root paint matrices render through public generators with boolean and aliased props',async()=>{
 const axes:import('./mint-tokens.js').MintAxis[]=[...['a','b','c'].map(propName=>({propName,values:['low','high']})),{propName:'d',values:['false','true'],bool:true},{propName:'inert',values:['low','high']}];
 const occurrences:any[]=[];
 for(const a of axes[0].values)for(const b of axes[1].values)for(const c of axes[2].values)for(const d of axes[3].values)for(const inert of axes[4].values){
  const axisValues={a,b,c,d,inert};const parity=[a,b,c,d].filter(v=>v==='high'||v==='true').length%2;
  occurrences.push({variant:JSON.stringify(axisValues),axisValues,value:parity?'00ff00':'ff0000'});
 }
 const observation={nodePath:'Matrix:root',part:'',cssProperty:'outline-color',kind:'color' as const,occurrences};
 const minted=mintTokens('matrix',[observation],axes),binding=minted.bindings[0];
 const five=mintTokens('matrix',[{...observation,occurrences:occurrences.map(o=>({...o,value:((o.value==='00ff00')!==(o.axisValues.inert==='high'))?'00ff00':'ff0000'}))}],axes);
 assert.equal(five.count,32);assert.match(five.bindings[0].ref!,/\{inert\}/,'a genuinely fifth driving axis is retained');
 assert.equal(binding.ref,'{imported.matrix.root.outline-color.{a}.{b}.{c}.{d}}');
 assert.equal(minted.count,16,'inert axis must not multiply measured cells');assert.match(binding.caveat!,/complete observed matrix/);
 assert.deepEqual(mintTokens('matrix',[{...observation,occurrences:[...occurrences].reverse()}],axes),minted,'declared axis order determines the minted matrix');
 const missing=occurrences.filter(o=>!(o.axisValues.a==='high'&&o.axisValues.b==='high'&&o.axisValues.c==='high'&&o.axisValues.d==='true'));
 assert.equal(mintTokens('matrix',[{...observation,occurrences:missing}],axes).bindings[0].ref,null,'missing measured cell cannot mint a root matrix');
 const conflict=[...occurrences,{...occurrences[0],value:'0000ff'}];
 assert.equal(mintTokens('matrix',[{...observation,occurrences:conflict}],axes).bindings[0].ref,null,'contradictory repeated tuple must refuse');
 const unknown=occurrences.map((o,i)=>i===0?{...o,axisValues:{...o.axisValues,a:'unknown'}}:o);
 assert.equal(mintTokens('matrix',[{...observation,occurrences:unknown}],axes).bindings[0].ref,null,'unknown declared value must refuse');
 const contract=ContractSchema.parse({...placementContract(table()),name:'PaintMatrix',props:axes.map(axis=>axis.bool
  ?{name:axis.propName,type:'boolean',default:false,required:false,bindings:{code:{prop:'showGreen'},figma:{kind:'BOOLEAN',property:'D'}}}
  :{name:axis.propName,type:{enum:axis.values},default:'low',required:false,bindings:{code:{prop:`choice${axis.propName.toUpperCase()}`},figma:{kind:'VARIANT',property:axis.propName,values:{low:'Low',high:'High'}}}}),anatomy:{root:{element:'div',literals:{width:'30px',height:'30px'},declared:{'outline-style':'solid'},tokens:{'outline-color':binding.ref!,'outline-width':'{outlineWidth}'}}}});
 const primitives={outlineWidth:{$type:'dimension',$value:'1px'}};const tokenTrees={primitives,semantic:minted.tree,light:{},dark:{},brands:{default:{}}};
 const ctx={contracts:new Map([[contract.id,contract]]),icons:new Map(),tokens:tokenInventoryFromJson([minted.tree,primitives])};
 const browser=await chromium.launch();
 try{const page=await browser.newPage();
  for(const surface of ['module','public-split','inline']){
   const css=surface==='public-split'?generateCss(contract,ctx.tokens,[]):'';
   const output=surface==='module'?emitReact(contract,ctx):surface==='public-split'?{tsx:generateTsx(contract,ctx.contracts,ctx.icons,css),css}
    :{...emitReactInline(contract,{...ctx,tokens:tokenTrees}),css:''};
   assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[],surface);
   const render=await mountGenerated(page,contract.name,output.tsx,output.css+'\n'+mintedTokenCss(minted.tree)+'\n'+mintedTokenCss(primitives));
   for(const o of occurrences.filter(o=>o.axisValues.inert==='low')){
    const values=o.axisValues;await render({choiceA:values.a,choiceB:values.b,choiceC:values.c,showGreen:values.d==='true'});
    const actual=await page.locator('#root > *').evaluate(el=>getComputedStyle(el).outlineColor);
    assert.equal(actual,o.value==='00ff00'?'rgb(0, 255, 0)':'rgb(255, 0, 0)',JSON.stringify({surface,values,actual}));
   }
  }
 }finally{await browser.close();}
 const native=structuredClone(contract);
 native.props=native.props.map(p=>p.name==='d'?{...p,type:{enum:['false','true']},default:'false',bindings:{...p.bindings,figma:{kind:'VARIANT',property:'D',values:{false:'False',true:'True'}}}}:p);
 const data=createFigmaEngine({tokens:tokenTrees,icons:new Map()}).compileComponentData(ContractSchema.parse(native),new Map([[native.id,native]]));
 assert.equal(data.variants.length,32);
 for(const variant of data.variants){
  const values=Object.fromEntries(variant.name.split(', ').map(p=>p.split('=')));
  const parity=[values.a,values.b,values.c,values.D].filter(v=>v==='High'||v==='True').length%2;
  assert.equal(flattenTokens(minted.tree).get(variant.spec.stroke!.replaceAll('/','.'))?.value,parity?'#00ff00':'#ff0000',variant.name);
 }
});

test('geometry coverage excludes only valid complete globally absent tuples',()=>{
 const c:any=placementContract(table());c.props=[
  {name:'tone',type:{enum:['a','b','c']},default:'a',bindings:{code:{prop:'tone'},figma:{kind:'VARIANT',property:'Tone',values:{a:'A',b:'B',c:'C'}}}},
  {name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}
 ];c.bindings.figma.absentVariants=[{tone:'c',size:'large'}];
 const rows=['a','b','c'].flatMap(tone=>['small','large'].filter(size=>tone!=='c'||size!=='large').map(size=>({values:[tone,size],geometry:geometry()})));
 c.anatomy.root.parts.range.absoluteGeometryByCombination={props:['tone','size'],rows};
 assert(ContractSchema.safeParse(c).success);
 const part=ContractSchema.parse(c).anatomy.root.parts!.range;
 assert.throws(()=>resolveAbsoluteGeometry(part,{tone:'c',size:'large'}),/combination-unavailable/);
 const missing=structuredClone(c);missing.anatomy.root.parts.range.absoluteGeometryByCombination.rows.shift();
 assert(!ContractSchema.safeParse(missing).success,'a globally drawn tuple is still mandatory');
 const undeclared=structuredClone(c);delete undeclared.bindings.figma.absentVariants;
 assert(!ContractSchema.safeParse(undeclared).success,'absence needs its declaration');
 const wrong=structuredClone(c);wrong.bindings.figma.absentVariants=[{tone:'b',size:'large'}];
 assert(!ContractSchema.safeParse(wrong).success,'a different absent tuple cannot cover this hole');
 const partial=structuredClone(c);partial.anatomy.root.parts.range.absoluteGeometryByCombination={props:['tone'],rows:[{values:['a'],geometry:geometry()},{values:['b'],geometry:geometry()}]};
 assert(!ContractSchema.safeParse(partial).success,'projected c/large absence cannot erase the still-drawn c/small plane');
 const gated=structuredClone(c);gated.anatomy.root.parts.range.visibleWhen={prop:'tone',equals:'c'};
 gated.anatomy.root.parts.range.absoluteGeometryByCombination.rows=rows.filter(row=>row.values[0]==='c');
 assert(ContractSchema.safeParse(gated).success,'exact visible geometry covers the one drawn c plane');
});

test('a direct swap SCALE host preserves its slot API and captured geometry without duplicate dimensions',()=>{
 const f=sourceGeometryFixture();
 for(const variant of f.set.variants){
  const n=variant.children![0];n.type='INSTANCE';n.instanceOf='Overlay';n.propRefs={mainComponent:'Overlay'};
  n.bbox={width:12,height:225};n.instanceSizing={horizontal:'FIXED',vertical:'FIXED',width:12,height:225};
 }
 const proposal=f.read(),c=ContractSchema.parse(proposal.contract);
 const host=walkAnatomy(c).find(({part})=>part.slot);
 assert(host,JSON.stringify(proposal.notes));assert.equal(host.part.element,'div');
 assert(host.part.absoluteGeometryByCombination);assert.equal(host.part.absoluteGeometryByCombination.rows.length,2);
 assert.equal(host.part.absoluteGeometryByCombination.rows[0].geometry.box.constraints.vertical,'SCALE');
 assert.equal(host.part.absoluteGeometryByCombination.rows[1].geometry.box.constraints.vertical,'CENTER');
 assert.equal(host.part.tokens?.width,undefined);assert.equal(host.part.tokens?.height,undefined);
 assert.equal(host.part.slot!.defaultContent!.length,1);
 const deps=(proposal.childStubs??[]).map(stub=>ContractSchema.parse(stub)),scope=new Map([c,...deps].map(contract=>[contract.id,contract]));
 const tokens={primitives:{...f.primitives,...proposal.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 for(const variant of native.variants){
  const spec=variant.spec.children!.find(child=>child.capturedAbsoluteGeometry);assert(spec);
  assert.equal(spec.capturedAbsoluteGeometry!.box.height,225);
  assert.deepEqual(spec.capturedAbsoluteGeometry!.parent,{width:12,height:300});
 }
 assert(!proposal.notes.some(note=>note.includes('absolute placement captured')&&note.includes('NOT carried')),JSON.stringify(proposal.notes));
 // Missing/inconsistent parent geometry must not authorize the new carrier.
 f.set.variants[0].bbox={width:13,height:300};
 const bad=ContractSchema.parse(f.read().contract);
 assert(!walkAnatomy(bad).some(({part})=>part.absoluteGeometry || part.absoluteGeometryByCombination));
});

test('actual React slot hosts keep SCALE on resize and caller replacements retain the same placement',async()=>{
 const raw=placementContract(table());raw.anatomy.root={declared:{position:'relative'},literals:{width:'12px',height:'300px'},parts:{range:{element:'div',slot:{name:'children'},absoluteGeometryByCombination:table()}}} as never;
 const c=ContractSchema.parse(raw),scope=new Map([[c.id,c]]),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();
 try{const page=await browser.newPage();for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,{contracts:scope,icons:new Map(),tokens:new Set()}):{...emitReactInline(c,{contracts:scope,icons:new Map(),tokens}),css:''};
  assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);const render=await mountGenerated(page,c.name,out.tsx,out.css);
  for(const scale of [1,2])for(const children of [undefined,'Caller replacement']){
   await render({children});await page.locator('#root > *').evaluate((root,scale)=>{(root as HTMLElement).style.width=`${12*scale}px`;(root as HTMLElement).style.height=`${300*scale}px`;},scale);
   const measured=await page.locator('#root > *').evaluate(root=>{const p=root.getBoundingClientRect(),child=root.children[0],r=child.getBoundingClientRect();return{x:r.x-p.x,y:r.y-p.y,width:r.width,height:r.height,text:child.textContent};});
   for(const key of ['x','y','width','height'] as const)assert(Math.abs(measured[key]-({x:0,y:37*scale,width:12*scale,height:225*scale})[key])<=.05,JSON.stringify({surface,scale,measured}));
   assert.equal(measured.text,children??'');
  }
 }}finally{await browser.close()}
});

const foldedSizeFixture=()=>{
 const variants:DumpSet['variants']=[];
 const horizontal={mode:'HORIZONTAL' as const,primary:'MIN' as const,counter:'MIN' as const,spacing:0,padding:[0,0,0,0] as [number,number,number,number],primarySizing:'FIXED' as const,counterSizing:'FIXED' as const};
 for(const kind of ['Nested','Flat'])for(const size of ['Small','Large']){
  const height=size==='Small'?24:40;
  const control={name:'Control',type:'FRAME' as const,layout:horizontal,fillWidth:true,fixedSize:{height},children:[{name:'Text',type:'TEXT' as const,text:{characters:'Content',fontStyle:'Regular',fontFamily:'Arial',fontSize:12,lineHeight:16,fontWeight:400}}]};
  variants.push({name:`Kind=${kind}, Size=${size}`,type:'COMPONENT',variantProperties:{Kind:kind,Size:size},bbox:{width:200,height},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'FIXED'},children:kind==='Flat'?[control]:[{name:'Holder',type:'FRAME',layout:horizontal,fillWidth:true,fixedSize:{height},children:[control]}]});
 }
 const set:DumpSet={setName:'Folded Sizing',type:'COMPONENT_SET',propertyDefinitions:{Kind:{type:'VARIANT',defaultValue:'Nested',variantOptions:['Nested','Flat']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']}},variants};
 const proposal=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),fileKey:'fixture',projectionMode:'exact'});
 const c=ContractSchema.parse(proposal.contract),tokens={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 return{set,proposal,c,tokens,scope:new Map([[c.id,c]])};
};
test('wrapper-union identity folds never import a real plane fixed box into a flat plane',()=>{
 const f=foldedSizeFixture(),before=JSON.stringify(f.set),holder=f.c.anatomy.root.parts!.Holder??f.c.anatomy.root.parts!.holder;
 assert(holder,JSON.stringify(f.c.anatomy));assert(holder.parts);assert(!holder.tokens?.height,'height cannot be uniform over synthetic planes');
 const compiled=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.c,f.scope);
 for(const v of compiled.variants){
  const host=v.spec.children![0];
  const flat=v.name.includes('Flat'),height=v.name.includes('Large')?40:24;
  if(flat)assert.equal(host.lits?.height,undefined,'synthetic host must hug its real children');
  else assert.equal(host.lits?.height,height,'observed nested host keeps its own height');
 }
 assert.equal(JSON.stringify(f.set),before);
 assert(f.proposal.notes.some(note=>note.includes('wrapper-union identity')));
});
test('actual React preserves flat and nested source dimensions through variant switches after wrapper folding',async()=>{
 const f=foldedSizeFixture(),browser=await chromium.launch();
 try{const page=await browser.newPage();for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(f.c,{contracts:f.scope,icons:new Map(),tokens:new Set(flattenTokens(f.tokens.primitives).keys()),tokenValues:f.tokens}):{...emitReactInline(f.c,{contracts:f.scope,icons:new Map(),tokens:f.tokens}),css:''};
  assert.deepEqual(generatedTypeErrors(f.c.name,out.tsx),[]);
  const rootVars=`:root {${[...flattenTokens(f.tokens.primitives)].map(([key,token])=>`--${key.replaceAll('.', '-')}: ${token.value};`).join('\n')}}`;
  const render=await mountGenerated(page,f.c.name,out.tsx,rootVars+out.css);
  for(const [kind,size] of [['flat','large'],['nested','small'],['nested','large'],['flat','small'],['flat','large']]){
   const props=Object.fromEntries(f.c.props.filter(prop=>prop.bindings.figma.kind==='VARIANT').map(prop=>{const label=prop.bindings.figma.property==='Kind'?kind:size;const value=Object.entries(prop.bindings.figma.values??{}).find(([,v])=>v.toLowerCase()===label)?.[0];assert(value,JSON.stringify(prop));return[prop.bindings.code.prop,value]}));
   await render(props);const box=await page.locator('#root > *').boundingBox();assert(box);
   assert(Math.abs(box.height-(size==='large'?40:24))<.05,JSON.stringify({surface,kind,size,box}));
   assert.equal(await page.locator('#root').textContent(),'Content','one source child must render once');
  }
 }}finally{await browser.close()}
});
