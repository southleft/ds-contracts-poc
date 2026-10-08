import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact, validateContract } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { nativeFilledPathResizeMatches, nativeFilledPathMatches } from './native-filled-path.js';

const tokens = {primitives:{base:{$type:'dimension',$value:'24px'},small:{$type:'dimension',$value:'12px'},
  large:{$type:'dimension',$value:'18px'},ink:{$type:'color',$value:'#123456'}},semantic:{},light:{},dark:{},brands:{default:{}}};
const shape = () => ({kind:'path' as const,width:12,height:8,paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO' as const}],
  parentViewport:{width:24,height:24,x:3,y:4}});
function fixture() {
  const glyph = ContractSchema.parse({id:'test.scalable-mark',name:'ScalableMark',version:'1.0.0',archetype:'none',description:'A reusable proportional drawing',
    props:[],states:[],semantics:{element:'div'},anatomy:{root:{declared:{position:'relative'},tokens:{width:'{base}',height:'{base}'},overridable:['size'],
      parts:{ink:{shape:shape(),tokens:{'background-color':'{ink}'}}}}},
    bindings:{code:{anchors:{importPath:'./ScalableMark',export:'ScalableMark'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  const parent = ContractSchema.parse({...glyph,id:'test.scalable-caller',name:'ScalableCaller',
    props:[{name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}],
    anatomy:{root:{layout:{display:'flex'},parts:{selected:{component:{id:glyph.id,overrides:{size:'{{size}}'}}}}}},
    bindings:{code:{anchors:{importPath:'./ScalableCaller',export:'ScalableCaller'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  return {glyph,parent,contracts:new Map([[glyph.id,glyph],[parent.id,parent]])};
}
const errors = (c:Contract) => {const out:string[]=[];validateContract(c,new Map([[c.id,c]]),out,new Map());return out;};

test('scalable paths require a coherent free parent and reject competing geometry',()=>{
  const {glyph}=fixture(); assert.deepEqual(errors(glyph),[]);
  const changes:Array<(c:Contract)=>void>=[
    c=>{c.anatomy.root.layout={display:'flex'};},
    c=>{c.anatomy.root.literals={padding:'2px'};},
    c=>{c.anatomy.root.parts!.other={text:'x'};},
    c=>{c.anatomy.root.parts!.ink!.shape!.kind='ellipse';},
    c=>{c.anatomy.root.parts!.ink!.literals={left:'3px'};},
    c=>{c.anatomy.root.parts!.ink!.literalsByProp=[{prop:'size',map:{small:{width:'4px'}}}];},
    c=>{c.anatomy.root.parts!.ink!.shape!.rotation=5;},
  ];
  for(const change of changes){const c=structuredClone(glyph);change(c);assert(errors(c).some(e=>/filled-path/.test(e)),JSON.stringify(c));}
  const wrong=structuredClone(glyph);wrong.anatomy.root.parts!.ink!.shape!.parentViewport!.width=25;
  assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(wrong,new Map([[wrong.id,wrong]])),/filled-path-parent-basis-mismatch/);
});

test('native compilation keeps the main basis and draws a bound caller size',()=>{
  const {glyph,parent,contracts}=fixture(),engine=createFigmaEngine({tokens,icons:new Map()});
  const main=engine.compileComponentData(glyph,contracts).variants[0].spec;
  assert.equal(main.fixedWidth!.px,24);assert.equal(main.scalablePathParent,true);
  const viewport=main.children![0];assert.deepEqual(viewport.pathParentViewport,shape().parentViewport);
  assert.equal(viewport.nativePathViewport,true);assert.equal(viewport.children![0].nativePathScale,true);
  const callers=engine.compileComponentData(parent,contracts).variants;
  assert.deepEqual(callers.map(v=>v.spec.children![0].instanceSize),[{px:12,varName:'small'},{px:18,varName:'large'}]);
  assert.equal(callers[0].spec.children![0].channelMiss,undefined);
  const script=engine.buildComponentScript(parent,contracts);
  assert.match(script,/node\.resize\(spec\.instanceSize\.px, spec\.instanceSize\.px\)/);
  assert.match(script,/node\.setBoundVariable\('height', need\(spec\.instanceSize\.varName\)\)/);
});

test('native resized path comparison retains topology, winding and exact float32 handles',()=>{
  const paths=(data:string,windingRule='NONZERO')=>[{data,windingRule}];
  assert(nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths('M0 0L6 0L3 4L0 0Z'),.5,.5));
  assert(nativeFilledPathResizeMatches(paths('M0 0C4 6.666666507720947 8 6.666666507720947 12 0L0 0Z'),
    paths('M0 0C2 3.3333332538604736 4 3.3333332538604736 6 0L0 0Z'),.5,.5));
  for(const actual of ['M0 0L6.01 0L3 4Z','M0 0L6 0L3 3.99Z','M0 0L3 4L6 0Z','M0 0L6 0L3 4'])
    assert(!nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths(actual),.5,.5));
  assert(!nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths('M0 0L6 0L3 4Z','EVENODD'),.5,.5));
  for(const n of [0,-1,Infinity,NaN]) assert(!nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths('M0 0L6 0L3 4Z'),n,.5));
});

test('installed-style React projections resize the drawing with its caller and preserve a separate main',async()=>{
  const browser=await chromium.launch();
  try {
    const {glyph,parent,contracts}=fixture();
    for(const surface of ['module','inline']){
      const ctx={tokens,icons:new Map<string,string>(),contracts};
      const emit=(c:Contract)=>surface==='inline'?{...emitReactInline(c,ctx),css:''}:emitReact(c,{...ctx,tokens:new Set(['base','small','large','ink'])});
      const parentOut=emit(parent),childOut=emit(glyph),page=await browser.newPage();
      try{
        const render=await mountGenerated(page,parent.name,parentOut.tsx,parentOut.css,{[glyph.name]:childOut});
        await page.addStyleTag({content:':root{--base:24px;--small:12px;--large:18px;--ink:#123456}'});
        const read=()=>page.evaluate(()=>{
          const all=[...document.querySelectorAll('#root *')];
          const path=all.find(el=>getComputedStyle(el).clipPath.startsWith('url('))!;
          const p=path.parentElement!,a=path.getBoundingClientRect(),b=p.getBoundingClientRect();
          return {parent:[b.width,b.height],ink:[a.width,a.height],offset:[a.x-b.x,a.y-b.y]};
        });
        await render({size:'small'});assert.deepEqual(await read(),{parent:[12,12],ink:[12,12],offset:[0,0]},surface);
        await render({size:'large'});assert.deepEqual(await read(),{parent:[18,18],ink:[18,18],offset:[0,0]},surface);
        await render({size:'small'});assert.deepEqual(await read(),{parent:[12,12],ink:[12,12],offset:[0,0]},surface);
        const separate=await browser.newPage();
        try{await mountGenerated(separate,glyph.name,childOut.tsx,childOut.css);await separate.addStyleTag({content:':root{--base:24px;--ink:#123456}'});
          const rect=await separate.locator('#root > *').boundingBox();assert.equal(rect!.width,24);assert.equal(rect!.height,24);
        }finally{await separate.close();}
      }finally{await page.close();}
    }
  }finally{await browser.close();}
});

test('single-ink path callers recolor through both React surfaces while their main stays unchanged',async()=>{
  const {glyph,parent,contracts}=fixture();
  glyph.anatomy.root.tokens!.color='{ink}';glyph.anatomy.root.overridable!.push('color');
  delete glyph.anatomy.root.parts!.ink!.tokens!['background-color'];
  glyph.anatomy.root.parts!.ink!.literals={'background-color':'currentColor'};
  parent.anatomy.root.parts!.selected!.component!.overrides!.color='{tones.{size}}';
  const inkTokens={...tokens,primitives:{...tokens.primitives,tones:{small:{$type:'color',$value:'#b51833'},large:{$type:'color',$value:'#0055aa'}}}};
  const native=createFigmaEngine({tokens:inkTokens,icons:new Map()});
  const main=native.compileComponentData(glyph,contracts).variants[0].spec;
  assert.equal(main.children![0].children![0].fill,'ink');assert.equal(main.fill,undefined);
  const callers=native.compileComponentData(parent,contracts).variants;
  assert.deepEqual(callers.map(v=>v.spec.children![0].instanceInk),[{varName:'tones/small',writeProtocol:'attached-v1'},{varName:'tones/large',writeProtocol:'attached-v1'}]);
  const browser=await chromium.launch();
  try{for(const surface of ['module','inline']){
    const ctx={tokens:inkTokens,icons:new Map<string,string>(),contracts};
    const emit=(c:Contract)=>surface==='inline'?{...emitReactInline(c,ctx),css:''}:emitReact(c,{...ctx,tokens:new Set(['base','small','large','ink','tones.small','tones.large'])});
    const child=emit(glyph),output=emit(parent),page=await browser.newPage();
    try{
      const render=await mountGenerated(page,parent.name,output.tsx,output.css,{[glyph.name]:child});
      await page.addStyleTag({content:':root{--base:24px;--small:12px;--large:18px;--ink:#123456;--tones-small:#b51833;--tones-large:#0055aa}'});
      const ink=()=>page.evaluate(()=>((e:Element)=>e.localName==='path'?getComputedStyle(e).fill:getComputedStyle(e).backgroundColor)([...document.querySelectorAll('#root *')].find(e=>(getComputedStyle(e).clipPath.startsWith('url(')||(e.localName==='path'&&e.closest('svg[viewBox]'))))!));
      await render({size:'small'});assert.equal(await ink(),'rgb(181, 24, 51)',surface);
      await render({size:'large'});assert.equal(await ink(),'rgb(0, 85, 170)',surface);
      await render({size:'small'});assert.equal(await ink(),'rgb(181, 24, 51)',surface);
      const own=await browser.newPage();try{await mountGenerated(own,glyph.name,child.tsx,child.css);await own.addStyleTag({content:':root{--base:24px;--ink:#123456}'});
        assert.equal(await own.evaluate(()=>((e:Element)=>e.localName==='path'?getComputedStyle(e).fill:getComputedStyle(e).backgroundColor)([...document.querySelectorAll('#root *')].find(e=>(getComputedStyle(e).clipPath.startsWith('url(')||(e.localName==='path'&&e.closest('svg[viewBox]'))))!)),'rgb(18, 52, 86)');
      }finally{await own.close();}
    }finally{await page.close();}
  }}finally{await browser.close();}
});


test('clipped free-parent viewport preserves SCALE geometry without admitting scrolling or layout', async () => {
  const {proposeFromDump} = await import('./propose-figma.js');
  const {tokenCorpusFromJson} = await import('./token-corpus.js');
  const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
  const dump:any={setName:'ClippedGlyph',type:'COMPONENT',nodeId:'1:1',key:'glyph-key',variants:[{name:'ClippedGlyph',type:'COMPONENT',bbox:{width:24,height:24},clipsContent:true,children:[{name:'ink',type:'VECTOR',fill:{hex:'123456'},shape:{kind:'path',width:12,height:8,x:3,y:4,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO'}]}}]}]};
  const read=(d:any,projectionMode:'exact'|'reviewable-inversion'='reviewable-inversion')=>proposeFromDump(d,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode});
  const result=read(dump),c=ContractSchema.parse(result.contract);
  assert.deepEqual(c.anatomy.root.parts!.ink.shape!.parentViewport,{width:24,height:24,x:3,y:4});
  assert.equal(c.anatomy.root.declared!['overflow-x'],'hidden');
  assert.equal(c.anatomy.root.declared!['overflow-y'],'hidden');
  assert.deepEqual(errors(c),[]);
  assert(c.anatomy.root.overridable?.includes('size'));
  const metadata=structuredClone(dump);
  metadata.variants[0].targetAspectRatio={x:24,y:24};metadata.variants[0].sourceEmptyFill=true;
  metadata.variants[0].componentKey='glyph-key'; // REST identity metadata must not erase SCALE geometry.
  const withMetadata=ContractSchema.parse(read(metadata).contract);
  assert.deepEqual(withMetadata.anatomy.root.parts!.ink.shape,c.anatomy.root.parts!.ink.shape);
  assert(withMetadata.anatomy.root.overridable?.includes('size'));
  assert.deepEqual(errors(withMetadata),[]);
  const wrongRatio=structuredClone(withMetadata);wrongRatio.anatomy.root.declared!['aspect-ratio']='2 / 1';
  assert(errors(wrongRatio).some(e=>e.includes('filled-path-parent-channel-unsupported:aspect-ratio')));
  for(const ratio of [{x:2,y:1},{x:0,y:0}]){
    const incompatible=structuredClone(metadata);incompatible.variants[0].targetAspectRatio=ratio;
    assert.equal(ContractSchema.parse(read(incompatible).contract).anatomy.root.parts!.ink.shape!.parentViewport,undefined);
  }

  const engine=createFigmaEngine({tokens:{primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const spec=engine.compileComponentData(c,new Map([[c.id,c]])).variants[0].spec;
  assert.equal(spec.scalablePathParent,true);assert.equal(spec.clipsContent,true);
  for(const value of ['hidden','clip','visible']){const f=fixture().glyph;f.anatomy.root.declared!['overflow-x']=value;assert.deepEqual(errors(f),[]);}
  for(const value of ['auto','scroll']){const f=fixture().glyph;f.anatomy.root.declared!['overflow-y']=value;assert(errors(f).some(e=>e.includes('filled-path-parent-channel-unsupported:overflow-y')));}
  const filledDump=structuredClone(dump);filledDump.variants[0].fill={hex:'abcdef'};
  const filledResult=read(filledDump),filled=ContractSchema.parse(filledResult.contract);
  assert.deepEqual(filled.anatomy.root.parts!.ink.shape!.parentViewport,{width:24,height:24,x:3,y:4});
  assert.deepEqual(errors(filled),[]);
  assert.equal(filled.anatomy.root.declared!['overflow-x'],'hidden');
  assert.equal(filled.anatomy.root.declared!['overflow-y'],'hidden');
  const fillRef=filled.anatomy.root.tokens!['background-color'] as string;
  const fillPath=fillRef.slice(1,-1).split('.');
  assert.equal(fillPath.reduce((value:any,key:string)=>value[key],filledResult.mintedTokens!.tree).$value,'#abcdef');
  const filledEngine=createFigmaEngine({tokens:{primitives:filledResult.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const filledSpec=filledEngine.compileComponentData(filled,new Map([[filled.id,filled]])).variants[0].spec;
  assert.equal(filledSpec.fill,fillPath.join('/'));
  assert.equal(filledSpec.clipsContent,true);
  assert.equal(filledSpec.scalablePathParent,true);
  assert.deepEqual(filledSpec.children![0].pathParentViewport,{width:24,height:24,x:3,y:4});
  const exact=ContractSchema.parse(read(dump,'exact').contract);
  assert.deepEqual(exact.anatomy.root.parts!.ink.shape!.parentViewport,{width:24,height:24,x:3,y:4});
  assert.equal(exact.anatomy.root.declared!['overflow-x'],'hidden','pure viewport clip is an observed drawing fact in exact projection');
  for(const change of [(d:any)=>{d.variants[0].layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]};},(d:any)=>{d.variants[0].children[0].shape.constraints.horizontal='CENTER';}]){
    const d=structuredClone(dump);change(d);assert.equal(ContractSchema.parse(read(d).contract).anatomy.root.parts!.ink.shape!.parentViewport,undefined);
  }
});

test('every resized path region retains exact topology and winding',()=>{
 const main=[{data:'M0 0L4 0L4 4L0 4Z',windingRule:'NONZERO'},{data:'M8 4L12 4L12 8L8 8Z',windingRule:'EVENODD'}];
 const resized=[{data:'M0 0L2 0L2 2L0 2Z',windingRule:'NONZERO'},{data:'M4 2L6 2L6 4L4 4Z',windingRule:'EVENODD'}];
 assert(nativeFilledPathResizeMatches(main,resized,.5,.5));
 assert(!nativeFilledPathResizeMatches(main,resized.slice(0,1),.5,.5));
 assert(!nativeFilledPathResizeMatches(main,[resized[1],resized[0]],.5,.5));
 assert(!nativeFilledPathResizeMatches(main,[resized[0],{...resized[1],data:'M4 2L6 2L6 4.01L4 4Z'}],.5,.5));
});

test('actual editable native capture preserves both path regions before and after resizing',()=>{
 const capture=JSON.parse(readFileSync(new URL('./fixtures/multiple-path-native-control-2026-10-01.json',import.meta.url),'utf8'));
 assert.equal(capture.initial.width,12);assert.equal(capture.initial.height,10);
 assert.equal(capture.resized.width,6);assert.equal(capture.resized.height,5);
 // The control's 3,4 placement was set independently; compare paths in their
 // intrinsic local frame, then check that native resize retained placement.
 assert.deepEqual([capture.resized.x,capture.resized.y],[3,4]);
 assert(nativeFilledPathMatches({kind:'path',width:12,height:10,paths:capture.sourcePaths},capture.initial.vectorPaths,0,0));
 assert(nativeFilledPathResizeMatches(capture.initial.vectorPaths,capture.resized.vectorPaths,.5,.5));
 const missing=capture.resized.vectorPaths.slice(0,1);assert(!nativeFilledPathResizeMatches(capture.initial.vectorPaths,missing,.5,.5));
});

 test('both React projections retain ink beyond an intrinsic path box on the captured parent plane',async()=>{
 const {glyph,contracts}=fixture();
 // The captured parent contains this complete translated path; the local
 // vector viewport deliberately does not. This detects the former crop.
 glyph.anatomy.root.parts!.ink!.shape!.paths![0].data='M-2 0L12 0L12 8L-2 8Z';
 const engine=createFigmaEngine({tokens,icons:new Map()});
 const compiled=engine.compileComponentData(glyph,contracts).variants[0].spec;
 assert.equal(compiled.children![0].clipsContent,undefined);
 assert.equal(compiled.children![0].lits!.width,12);
 const browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
 const out=surface==='inline'?{...emitReactInline(glyph,{tokens,icons:new Map(),contracts}),css:''}:emitReact(glyph,{tokens:new Set(['base','ink']),icons:new Map(),contracts});
 const page=await browser.newPage();
 try{await mountGenerated(page,glyph.name,out.tsx,out.css);
 await page.addStyleTag({content:':root{--base:24px;--ink:#123456}'});
 const root=page.locator('#root > *'),png=PNG.sync.read(await root.screenshot());
 const pixel=(x:number,y:number)=>Array.from(png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4));
 assert.deepEqual(pixel(2,6),[18,52,86,255],surface+': parent-relative ink outside intrinsic box survives');
 assert.deepEqual(pixel(0,6),[255,255,255,255],surface+': translation remains exact');
 assert.deepEqual(pixel(16,6),[255,255,255,255],surface+': no invented width expansion');
 }finally{await page.close();}
 }}finally{await browser.close();}
 });

test('captured source node identity cannot disable an otherwise qualified SCALE viewport',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js'),{tokenCorpusFromJson}=await import('./token-corpus.js');
 const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
 const set:any={setName:'Arbitrary drawing',type:'COMPONENT',nodeId:'10:1',key:'source-key',variants:[{name:'Arbitrary drawing',nodeId:'10:1',type:'COMPONENT',bbox:{width:24,height:24},clipsContent:true,children:[{name:'paint',type:'VECTOR',fill:{hex:'123456'},shape:{kind:'path',width:18,height:18,x:3,y:3,right:3,bottom:3,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:'M0 0L18 0L18 18L0 18Z',windingRule:'NONZERO'}]}}]}]};
 const read=(s:any)=>ContractSchema.parse(proposeFromDump(s,{corpus,mintUnbound:true,contractIdByName:new Map()}).contract);
 const before=JSON.stringify(set),identified=read(set),without=structuredClone(set);delete without.variants[0].nodeId;
 const baseline=read(without),part=Object.values(identified.anatomy.root.parts!)[0];
 assert.deepEqual(part.shape?.parentViewport,{width:24,height:24,x:3,y:3});assert.deepEqual(part.shape, Object.values(baseline.anatomy.root.parts!)[0].shape);assert(identified.anatomy.root.overridable?.includes('size'));assert.equal(JSON.stringify(set),before);
 const drawing=structuredClone(set);drawing.variants[0].layout={mode:'HORIZONTAL',spacing:0,padding:[0,0,0,0],primary:'MIN',counter:'MIN'};assert.equal(Object.values(read(drawing).anatomy.root.parts!)[0].shape?.parentViewport,undefined);
});
test('a separately painted scalable parent retains its viewport under rectangular size inputs',async t=>{
 const {glyph}=fixture();glyph.anatomy.root.instanceRootInputs=['opacity','width','height'];
 glyph.anatomy.root.parts!.ink.declared={position:'absolute'};
 glyph.anatomy.root.solidFillComposition={color:{r:1,g:1,b:1},opacity:0.5,blendMode:'MULTIPLY'};
 assert.deepEqual(errors(glyph),[]);
 const contracts=new Map([[glyph.id,glyph]]),engine=createFigmaEngine({tokens,icons:new Map()});
 const native=engine.compileComponentData(glyph,contracts).variants[0].spec;
 assert.equal(native.solidFillComposition?.blendMode,'MULTIPLY');
 assert.equal(native.scalablePathParent,true);assert.deepEqual(native.children![0].pathParentViewport,shape().parentViewport);
 const bad=structuredClone(glyph);bad.anatomy.root.instanceRootInputs!.push('background-color');assert(errors(bad).some(e=>e.includes('filled-path-parent-basis-unsupported')));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const output=surface==='module'?emitReact(glyph,{tokens:new Set(['base','small','large','ink']),tokenValues:tokens,icons:new Map(),contracts}):{...emitReactInline(glyph,{tokens,icons:new Map(),contracts}),css:''};
  const page=await browser.newPage();const render=await mountGenerated(page,glyph.name,output.tsx,output.css);
  await page.addStyleTag({content:':root{--base:24px;--ink:#123456}'});
  for(const [width,height]of [[24,24],[40,18],[12,32]]){
   await render({style:{width,height}});
   const box=await page.locator('#root').evaluate(root=>{const path=[...root.querySelectorAll('*')].find(n=>getComputedStyle(n).clipPath.startsWith('url('))!;const b=path.getBoundingClientRect();return[b.width,b.height]});
   assert.deepEqual(box,[width,height],surface);
   const pixels=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
   assert.deepEqual([...pixels.data.subarray(0,4)],[255,255,255,128],surface+' parent paint');
  }
  await page.close();
 }
});
