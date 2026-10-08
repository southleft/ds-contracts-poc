import {PLUGIN_DUMP_VERSION} from '../types.js';
import vm from 'node:vm';
import {PNG} from 'pngjs';
import {readFileSync} from 'node:fs';
import {filledPathIssue, filledPathsIssue} from '../../../scripts/contract-schema.js';
import {createFigmaMock} from '../../../scripts/plugin-engine-mock-figma.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {observeInstanceVector, neutralVectorWrapperPaint} from './observed-vector.js';
import type {RestNode} from './map.js';
const components=new Map([['main',{key:'actual-key'}]]);
const sample=():RestNode=>({id:'use',name:'Instance',type:'INSTANCE',componentId:'main',size:{x:24,y:24},fills:[],strokes:[],effects:[],children:[{
 id:'vector',name:'Vector',type:'VECTOR',size:{x:20,y:19},relativeTransform:[[1,0,2],[0,1,2.5]],
 fills:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}],strokes:[],effects:[],
 fillGeometry:[{path:'M0 0L20 0L10 19Z',windingRule:'NONZERO'}],
}]});
test('preserves exact source identity, geometry and observed paint',()=>{
 const n=sample(),o=observeInstanceVector(n,components)!;
 assert.deepEqual(o.source,[{nodeId:'use',componentId:'main',key:'actual-key'}]);
 assert.equal(o.shape.x,2);assert.equal(o.shape.y,2.5);assert.equal(o.vector,n.children![0]);
 assert.equal(n.type,'INSTANCE');assert.equal(o.shape.paths[0]!.data,'M0 0L20 0L10 19Z');
});
test('refuses missing source authority and mutable API',()=>{
 assert.equal(observeInstanceVector(sample(),new Map()),undefined);
 const n=sample();n.componentProperties={Label:{type:'TEXT',value:'a'}};
 assert.equal(observeInstanceVector(n,components),undefined);
});
test('outer usage visibility does not erase captured geometry; hidden inner ink still refuses',()=>{
 const nativePredicate=vm.runInNewContext(nativeFunctions+';observeInstanceVector',{figma:{},filledPathIssue,filledPathsIssue,Map});
 for(const reader of [observeInstanceVector,nativePredicate]){
  const shown=sample(),hidden=structuredClone(shown);hidden.visible=false;
  const before=structuredClone(hidden),observed=reader(hidden,components);
  assert.ok(observed);
  assert.deepEqual(JSON.parse(JSON.stringify(observed.shape)),JSON.parse(JSON.stringify(reader(shown,components).shape)));
  assert.deepEqual(hidden,before,'capturing an observation must never make its source visible');
  hidden.children![0].visible=false;
  assert.equal(reader(hidden,components),undefined,'a hidden descendant is not visible ink');
 }
});
test('refuses transforms, clipping loss, external paths and extra content',()=>{
 const mutations:Array<(n:RestNode)=>void>=[
  n=>{n.children![0]!.relativeTransform=[[2,0,2],[0,1,2.5]];},
  n=>{n.children![0]!.relativeTransform=[[1,0,8],[0,1,2.5]];},
  n=>{n.children![0]!.fillGeometry![0]!.path='M0 0L25 0L10 19Z';},
  n=>{n.children!.push(structuredClone(n.children![0]!));},
  n=>{n.children![0]!.fills!.push({type:'SOLID',color:{r:0,g:0,b:0,a:1}});},
  n=>{n.opacity=.5;},n=>{n.cornerRadius=4;},n=>{n.isMask=true;},
 ];
 for(const mutate of mutations){const n=sample();mutate(n);assert.equal(observeInstanceVector(n,components),undefined);}
});

test('white multiply wrappers flatten only at exact zero alpha, without an epsilon',()=>{
 for(const [opacity,alpha] of [[0,1],[.5,0],[1,0]]) {
  const n=sample();n.fills=[{type:'SOLID',blendMode:'MULTIPLY',opacity,color:{r:1,g:1,b:1,a:alpha}}];
  const before=structuredClone(n),observed=observeInstanceVector(n,components);
  assert.ok(observed);assert.deepEqual(observed.shape.paths,n.children![0]!.fillGeometry!.map(p=>({data:p.path,windingRule:p.windingRule})));
  assert.deepEqual(n,before,'the source facts are retained verbatim');
 }
});
test('positive white multiply is not identity on transparent backing',()=>{
 const nativePredicate=vm.runInNewContext(nativeFunctions+';neutralVectorWrapperPaint',{figma:{},filledPathIssue,filledPathsIssue,Map});
 for(const opacity of [0,9.999999747378752e-6,.5,1])for(const alpha of [0,.5,1]){
  const paint={type:'SOLID' as const,blendMode:'MULTIPLY',opacity,color:{r:1,g:1,b:1,a:alpha}};
  assert.equal(nativePredicate(paint),opacity===0||alpha===0);assert.equal(neutralVectorWrapperPaint(paint),nativePredicate(paint));
 }
 const baseline=PNG.sync.read(readFileSync(new URL('./white-multiply-native/402-3.png',import.meta.url)));
 for(const [id,alpha] of [['402-5',0],['402-7',128],['402-9',255]] as const){
  const png=PNG.sync.read(readFileSync(new URL(`./white-multiply-native/${id}.png`,import.meta.url)));
  assert.equal(png.width,20);assert.equal(png.height,20);
  assert.deepEqual([...png.data.subarray(0,4)],alpha===0?[0,0,0,0]:[255,255,255,alpha]);
  let changed=0;for(let i=0;i<png.data.length;i+=4)if(!png.data.subarray(i,i+4).equals(baseline.data.subarray(i,i+4)))changed++;
  assert.equal(changed,alpha===0?0:336);
 }
 for(const opacity of [9.999999747378752e-6,.5,1]){
  const n=sample();n.fills=[{type:'SOLID',blendMode:'MULTIPLY',opacity,color:{r:1,g:1,b:1,a:1}}];
  const before=structuredClone(n);assert.equal(observeInstanceVector(n,components),undefined);assert.deepEqual(n,before);
 }
});
test('non-neutral or malformed paint remains a refusal regardless of tiny opacity',()=>{
 const white=()=>({type:'SOLID' as const,blendMode:'MULTIPLY',opacity:9.999999747378752e-6,color:{r:1,g:1,b:1,a:1}});
 const changes=[(p:ReturnType<typeof white>)=>{p.color.r=.999999;},
  (p:ReturnType<typeof white>)=>{p.blendMode='NORMAL';},
  (p:ReturnType<typeof white>)=>{p.opacity=NaN;},
  (p:ReturnType<typeof white>)=>{p.opacity=-1;},
  (p:ReturnType<typeof white>)=>{p.opacity=1.00001;},
  (p:ReturnType<typeof white>)=>{p.color.a=Infinity;}];
 for(const change of changes){const paint=white();change(paint);assert.equal(neutralVectorWrapperPaint(paint),false);const n=sample();n.fills=[paint];assert.equal(observeInstanceVector(n,components),undefined);}
 const n=sample();n.fills=[white(),{type:'SOLID',color:{r:0,g:0,b:0,a:1}}];assert.equal(observeInstanceVector(n,components),undefined);
});

test('all observed vector regions are carried verbatim and one invalid region refuses the observation',()=>{
 const n=sample();n.children![0]!.fillGeometry!.push({path:'M1 1L3 1L3 3L1 3Z',windingRule:'EVENODD'});
 const observation=observeInstanceVector(n,components)!;assert.equal(observation.shape.paths.length,2);
 assert.deepEqual(observation.shape.paths,n.children![0]!.fillGeometry!.map(p=>({data:p.path,windingRule:p.windingRule})));
 n.children![0]!.fillGeometry![1]!.path='M0 0Z';assert.equal(observeInstanceVector(n,components),undefined);
});

 test('translated control hull is checked against every captured wrapper, preserving negative local coordinates',()=>{
 const n=sample(),path='M0 0C-1 -1 20 0 10 19Z';
 n.children![0]!.fillGeometry![0]!.path=path;
 const before=structuredClone(n);assert.equal(observeInstanceVector(n,components)!.shape.paths[0].data,path);
 assert.deepEqual(n,before);
 n.children![0]!.fillGeometry![0]!.path='M0 0C-3 -1 20 0 10 19Z';
 assert.equal(observeInstanceVector(n,components),undefined);
 });

// Exercise the canonical native reader, not a second hand-written observer.
const nativeSource = readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8');
const nativeFunctions = nativeSource.slice(nativeSource.indexOf('function filledPathIssue'),nativeSource.indexOf('function strokedPathIssue')) + nativeSource.slice(nativeSource.indexOf('async function captureNativeInstanceVectorInput'),nativeSource.indexOf('async function dumpNode'));

test('native capture and REST observation agree on all twenty actual source drawings, retaining ancestor visibility',async()=>{
 const p=JSON.parse(readFileSync(new URL('./native-instance-source.fixture.json',import.meta.url),'utf8'));
 const figma={skipInvisibleInstanceChildren:false};
 const reader=vm.runInNewContext(nativeFunctions+';({captureNativeInstanceVectorInput,observeInstanceVector})',{figma,filledPathIssue,filledPathsIssue,Map});
 for(const [,group,ids,transform,ancestry,visible]of p.uses){
  const template=p.groups[group],expected=structuredClone(template.root);let at=0;
  const restore=(n:any)=>{n.id=ids[at++];for(const c of n.children??[])restore(c);};restore(expected);expected.relativeTransform=transform;
  const keys=new Map<string,any>(template.components);
  const native=(n:any,parent:any):any=>{
   const node={...n,width:n.size.x,height:n.size.y,parent};delete node.size;delete node.fillGeometry;
   if(n.type==='INSTANCE')node.getMainComponentAsync=async()=>({id:n.componentId,...keys.get(n.componentId)});
   if(n.type==='VECTOR')node.vectorPaths=n.fillGeometry.map((p:any)=>({data:p.path,windingRule:p.windingRule}));
   if(n.children)node.children=n.children.map((c:any)=>native(c,node));return node;
  };
  let parent:any={type:'PAGE',id:'page'};for(const [id,type,isVisible]of [...ancestry].reverse())parent={id,type,visible:isVisible,parent};
  const root=native(expected,parent),captured=await reader.captureNativeInstanceVectorInput(root);
  assert.equal(captured.status,'captured');assert.deepEqual(JSON.parse(JSON.stringify(captured.root)),expected);
  assert.equal(captured.effectiveVisible,visible);
  assert.equal(reader.observeInstanceVector(captured.root,new Map(captured.components)),undefined,'captured positive-alpha wrapper paint must not be erased');
  assert.equal(observeInstanceVector(expected,new Map(template.components)),undefined,'REST must preserve the same refusal');
  figma.skipInvisibleInstanceChildren=true;assert.equal((await reader.captureNativeInstanceVectorInput(root)).reason,'native-instance-children-elided');figma.skipInvisibleInstanceChildren=false;
 }
 assert.equal(p.uses.length,20);assert.equal(p.uses.filter((u:any)=>!u[5]).length,10);
});

test('canonical native reader restores child inspection flag after capture success and thrown failure',async()=>{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const {figma}=createFigmaMock();figma.skipInvisibleInstanceChildren=true;
 const run=new AsyncFunction('figma','console',nativeSource);
 await run(figma,{log(){},warn(){},error(){}});assert.equal(figma.skipInvisibleInstanceChildren,true);
 for(const previous of [true,false]){
  const failed={skipInvisibleInstanceChildren:previous,loadAllPagesAsync:async()=>{throw Error('capture-test-stop');}};
  await assert.rejects(()=>run(failed,{log(){}}),/capture-test-stop/);
  assert.equal(failed.skipInvisibleInstanceChildren,previous);
 }
});

test('complete canonical capture attaches the actual usage drawing and hidden ancestor provenance',async()=>{
 const {figma}=createFigmaMock();const f:any=figma;
 const main=f.createComponent();main.name='Remote drawing';main.resize(24,24);main.fills=[];
 Object.defineProperty(main,'key',{value:'actual-native-key',configurable:true});
 // This mock has no vector factory; supply a vector-shaped fixture node.
 const ink=f.createFrame();ink.type='VECTOR';main.appendChild(ink);ink.resize(20,19);ink.x=2;ink.y=2.5;
 ink.vectorPaths=[{data:'M0 0L20 0L10 19Z',windingRule:'NONZERO'}];ink.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}];ink.strokes=[];
 const variant=f.createComponent();variant.name='Case=A';variant.resize(24,24);variant.visible=false;
 const use=main.createInstance();variant.appendChild(use);
 // Mock instance cloning predates vector path capture. Preserve this observed
 // fixture channel explicitly instead of changing production mock semantics.
 use.children[0].vectorPaths=structuredClone(ink.vectorPaths);
 use.children[0].relativeTransform=[[1,0,2],[0,1,2.5]];
 const set=f.combineAsVariants([variant],f.currentPage);set.name='NativeReaderProbe';
 f.skipInvisibleInstanceChildren=true;
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const source=nativeSource.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['NativeReaderProbe'];");
 const dump=JSON.parse(JSON.stringify(await new AsyncFunction('figma','console',source)(f,{log(){},warn(){},error(){}})));
 const observed=dump.NativeReaderProbe.variants[0].children[0].instanceVectorContent;
 assert.ok(observed,JSON.stringify(dump._degradations));assert.deepEqual(observed.source,[{nodeId:use.id,componentId:main.id,key:'actual-native-key'}]);
 assert.equal(observed.shape.paths[0].data,'M0 0L20 0L10 19Z');assert.equal(observed.paint.hex,'ff0000');
 assert.equal(dump.NativeReaderProbe.variants[0].hidden,true);
 assert.equal(dump._provenance.nativeInstanceVisibility.find((r:any)=>r.nodeId===use.id).effectiveVisible,false);
 assert.equal(f.skipInvisibleInstanceChildren,true);
});


test('native instance observation retains proven NONE contours and names rejected path and paint facts',()=>{
 const observe=vm.runInNewContext(nativeFunctions+';observeInstanceVector',{figma:{},Map});
 const proof=JSON.parse(readFileSync(new URL('../../../core/fixtures/closed-none-rectangle-native.json',import.meta.url),'utf8'));
 const n:any=sample();n.size={x:proof.width,y:proof.height};n.children[0].size={...n.size};n.children[0].relativeTransform=[[1,0,0],[0,1,0]];
 n.children[0].fillGeometry=proof.paths.map((p:any)=>({path:p.data,windingRule:p.windingRule}));
 const before=structuredClone(n),reasons:string[]=[];
 const result=observe(n,components,(r:string)=>{reasons.push(r);});
 assert.ok(result);assert.deepEqual(JSON.parse(JSON.stringify(result.shape.paths)),proof.paths);
 assert.deepEqual(n,before);assert.deepEqual(reasons,[]);
 const rejected=[
  ['M0 0C1 1 10 1 10 0L0 0Z','native-instance-filled-path-none-contour-unqualified'],
  ['M0 0L10 10L0 10L10 0Z','native-instance-filled-path-none-convexity-unqualified'],
  ['M0 0L10 0L5 5L10 10L0 10Z','native-instance-filled-path-none-convexity-unqualified'],
  ['M0 0L10.1 0L0 10Z','native-instance-filled-path-none-coordinate-unqualified'],
 ];
 for(const [path,reason] of rejected){const changed=structuredClone(before);changed.children[0].fillGeometry[0].path=path;const failures:string[]=[];assert.equal(observe(changed,components,(r:string)=>{failures.push(r);}),undefined);assert.deepEqual(failures,[reason]);}
 const painted=structuredClone(before);painted.fills=[{type:'SOLID',blendMode:'MULTIPLY',opacity:9.999999747378752e-6,color:{r:1,g:1,b:1,a:1}}];
 const failures:string[]=[];assert.equal(observe(painted,components,(r:string)=>{failures.push(r);}),undefined);assert.deepEqual(failures,['native-instance-wrapper-paint-unqualified']);
 assert.equal(observe(before,new Map()),undefined,'source identity remains required');
 const extra=structuredClone(before);extra.children.push(structuredClone(extra.children[0]));assert.equal(observe(extra,components),undefined,'extra content is never flattened');
});

test('complete native dump carries NONE through an actual keyed instance and retains positive wrapper refusal',async()=>{
 for(const withPaint of [false,true]){
  const {figma}=createFigmaMock();const f:any=figma;
  const proof=JSON.parse(readFileSync(new URL('../../../core/fixtures/closed-none-rectangle-native.json',import.meta.url),'utf8'));
  const main=f.createComponent();main.name='Observed drawing';main.resize(proof.width,proof.height);main.fills=[];
  Object.defineProperty(main,'key',{value:'closed-none-observed-key',configurable:true});
  const ink=f.createFrame();ink.type='VECTOR';main.appendChild(ink);ink.resize(proof.width,proof.height);ink.vectorPaths=proof.paths;ink.fills=[{type:'SOLID',color:{r:.25,g:.5,b:.75}}];ink.strokes=[];
  const variant=f.createComponent();variant.name='Case=A';variant.resize(proof.width,proof.height);const use=main.createInstance();variant.appendChild(use);
  use.children[0].vectorPaths=structuredClone(proof.paths);use.children[0].relativeTransform=[[1,0,0],[0,1,0]];
  if(withPaint)use.fills=[{type:'SOLID',blendMode:'MULTIPLY',opacity:9.999999747378752e-6,color:{r:1,g:1,b:1}}];
  const set=f.combineAsVariants([variant],f.currentPage);set.name='NativeNoneUsage';
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const source=nativeSource.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['NativeNoneUsage'];");
  const dump=JSON.parse(JSON.stringify(await new AsyncFunction('figma','console',source)(f,{log(){},warn(){},error(){}})));
  const observed=dump.NativeNoneUsage.variants[0].children[0].instanceVectorContent;
  if(withPaint){assert.equal(observed,undefined);assert.ok(dump._degradations.some((d:any)=>d.code==='instance-vector-content-unobserved'&&d.message==='native-instance-wrapper-paint-unqualified'));}
  else{assert.ok(observed,JSON.stringify(dump._degradations));assert.deepEqual(observed.shape.paths,proof.paths);assert.deepEqual(observed.source,[{nodeId:use.id,componentId:main.id,key:'closed-none-observed-key'}]);assert.equal(dump._provenance.dumpVersion,PLUGIN_DUMP_VERSION);}
 }
});
