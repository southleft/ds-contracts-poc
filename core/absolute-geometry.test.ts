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
import {emitReact} from './emit-react.js';
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
