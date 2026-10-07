import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {projectNativeGroupPlanes} from './native-group-plane.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {alignRecordedFrames,enclosingFrame,imageSha256} from '../scripts/design-consumer-framing-v2.js';
import {diffPair} from '../extract/figma/visual-parity/img.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const constraints={horizontal:'SCALE',vertical:'SCALE'} as const;
function plane(id:string,parentId:string,x:number,y:number,width:number,height:number,child=false):DumpNode['nativeContainerPlane']{return{nodeId:id,parentId,containerId:'frame',containerType:'FRAME',size:{width,height},containerSize:{width:18,height:18},relativeTransform:[[1,0,x],[0,1,y]],absoluteTransform:[[1,0,32+x],[0,1,848+y]],containerAbsoluteTransform:[[1,0,32],[0,1,848]],...(child?{constraints}: {})};}
function fixture():DumpSet{return{setName:'NativeGroup',type:'COMPONENT',variants:[{name:'NativeGroup',type:'FRAME',bbox:{width:18,height:18},children:[{name:'aperture',type:'ELLIPSE',mask:{type:'ALPHA'},fill:{hex:'000000'},shape:{kind:'ellipse',width:18,height:18,x:0,y:0,right:0,bottom:0,constraints}},{name:'layers',type:'GROUP',abs:{x:-1,y:-1,width:20,height:20,right:-1,bottom:-1},nativeContainerPlane:plane('group','frame',-1,-1,20,20),children:[{name:'ground',type:'RECTANGLE',nativeContainerPlane:plane('ground','group',-1,-1,20,20,true),fill:{hex:'112233'},shape:{kind:'rect',x:0,y:0,right:0,bottom:0,width:20,height:20,constraints}},{name:'detail',type:'RECTANGLE',nativeContainerPlane:plane('detail','group',3,2,12,14,true),fill:{hex:'ff0000'},shape:{kind:'rect',x:4,y:3,right:4,bottom:3,width:12,height:14,constraints}}]}]}]};}
function read(set=fixture()){const r=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(r.contract);return{r,c};}
test('observed native GROUP children use containing-frame coordinates while raw group-local capture remains unchanged',()=>{
 const source=fixture(),before=JSON.stringify(source),{r,c}=read(source),parts=walkAnatomy(c);
 const group=parts.find(p=>p.name==='layers')!.part,detail=parts.find(p=>p.name==='detail')!.part;
 assert.deepEqual(group.absoluteGeometry?.box,{x:0,y:0,width:18,height:18,right:0,bottom:0,constraints:{horizontal:'STRETCH',vertical:'STRETCH'}});
 assert.deepEqual(detail.absoluteGeometry?.parent,{width:18,height:18});assert.equal(detail.absoluteGeometry?.box.x,3);assert.equal(detail.absoluteGeometry?.box.y,2);
 assert.equal(group.shape,undefined);assert.equal(JSON.stringify(source),before);
 assert(r.notes.some(n=>n.includes('synthetic target coordinate owner')&&n.includes('not source GROUP constraints')));
});
test('GROUP projection refuses missing/skewed/inconsistent native bases, competing owners and missing child constraints',()=>{
 for(const fault of ['child-proof','skew','absolute','parent','size','constraints','paint','bound']){
  const set=fixture(),group=set.variants[0].children![1],child=group.children![1];
  if(fault==='child-proof')delete child.nativeContainerPlane;
  if(fault==='skew')child.nativeContainerPlane!.relativeTransform=[[1,.1,3],[0,1,2]];
  if(fault==='absolute')child.nativeContainerPlane!.absoluteTransform=[[1,0,999],[0,1,850]];
  if(fault==='parent')child.nativeContainerPlane!.parentId='other';
  if(fault==='size')child.shape!.width=13;
  if(fault==='constraints')delete child.nativeContainerPlane!.constraints;
  if(fault==='paint')group.opacity=.5;
  if(fault==='bound')child.bound={width:'authored.width'};
  const before=JSON.stringify(set);assert.throws(()=>projectNativeGroupPlanes(set),/native-group-plane-unqualified/,fault);assert.equal(JSON.stringify(set),before);
 }
 const legacy=fixture();delete legacy.variants[0].children![1].nativeContainerPlane;
 assert.equal(projectNativeGroupPlanes(legacy).notes.length,0,'old captures do not acquire synthetic proof');
});
test('both React surfaces match independently observed native GROUP offsets and mask pixels through uniform/nonuniform resize',async t=>{
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js'),{emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const native=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/native-group-plane/NATIVE.json',import.meta.url),'utf8'));
 const {r,c}=read(),tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),contracts=new Map([[c.id,c]]);
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const output=surface==='module'?emitReact(c,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts}):{...emitReactInline(c,{tokens,icons:new Map(),contracts}),css:''};
  const page=await browser.newPage({viewport:{width:80,height:80}});try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);
   await page.addStyleTag({content:'body{margin:0;background:transparent}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
   for(const cell of native.observed){const [width,height]=cell.size;await render({style:{width,height}});
    const actual=await page.evaluate(()=>{const element=[...document.querySelectorAll('div')].find(n=>getComputedStyle(n).backgroundColor==='rgb(255, 0, 0)');if(!element)throw Error('detail missing');return element.getBoundingClientRect().toJSON();});
    const observed=cell.children.find((n:any)=>n.name==='detail');
    // Chromium resolves fractional layout in 1/64 px units; keep the native
    // values and qualify within one representable unit, never a pixel-size guess.
    for(const [key,wanted] of Object.entries({x:observed.relativeTransform[0][2],y:observed.relativeTransform[1][2],width:observed.width,height:observed.height}))assert(Math.abs(actual[key]-Number(wanted))<=1/64+1e-9,`${surface} ${width}x${height} ${key}: browser=${actual[key]} native=${wanted}`);
    const pixels=await page.screenshot({clip:{x:0,y:0,width,height},omitBackground:true}),reference=readFileSync(new URL(`../extract/figma/fixtures/native-group-plane/${width}x${height}.png`,import.meta.url));
    const layout={x:0,y:0,width,height};
    for(const background of [0,255] as const){const pair=alignRecordedFrames(pixels,reference,{layout,capture:enclosingFrame(layout),deviceScaleFactor:1,pngSha256:imageSha256(pixels)},{layout,render:layout,pngSha256:imageSha256(reference)},background);
     assert('aligned' in pair);const score=diffPair(pair.aligned,[]);console.log(JSON.stringify({surface,width,height,background,unmaskedPct:score.unmaskedPct}));
     assert(score.unmaskedPct<=5,`${surface} ${width}x${height} ${background} shared native image difference ${score.unmaskedPct}`);
    }
   }
  }finally{await page.close();}
 }
});
