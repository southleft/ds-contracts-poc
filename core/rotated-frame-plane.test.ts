import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';

// Read-only native observation of Radix Spinner, 2026-10-06. The frame is
// 1.5x12 locally, not its rotated 9.5459 square; its ink remains 1.5x4.
const observed=JSON.parse(readFileSync(new URL('./fixtures/rotated-spinner-local-plane-966.json',import.meta.url),'utf8'));
test('positioned owned affine frame retains child-local ink at independently captured native bounds',async t=>{
 const [sourceRoot,,frame,ink]=observed;
 const c=ContractSchema.parse({id:'test.rotated-frame',name:'RotatedFrame',version:'1.0.0',status:'draft',description:'Native rotated frame qualification',semantics:{element:'div'},props:[],states:[],
  bindings:{code:{anchors:{importPath:'./RotatedFrame',export:'RotatedFrame'}},figma:{anchors:{fileKey:null,componentSetKey:null}}},
  anatomy:{root:{layout:{display:'flex'},literals:{width:'12px',height:'12px'},declared:{position:'relative'},parts:{allocation:{layout:{display:'flex'},declared:{position:'absolute'},
   literals:{left:`${frame.bounds.x-sourceRoot.bounds.x}px`,top:`${frame.bounds.y-sourceRoot.bounds.y}px`,width:`${frame.bounds.width}px`,height:`${frame.bounds.height}px`},parts:{local:{
    literals:{width:`${frame.width}px`,height:`${frame.height}px`},declared:{position:'relative','overflow-x':'hidden','overflow-y':'hidden'},instanceAffine:{localSize:{width:frame.width,height:frame.height},transform:frame.relativeTransform},
    parts:{ink:{declared:{position:'absolute'},literals:{left:'0px',top:'0px',width:`${ink.width}px`,height:`${ink.height}px`,'background-color':'#000714','border-radius':'3px'}}}
   }}}}}}});
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c]]),ctx={tokens,contracts,icons:new Map<string,string>()};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();try{
   await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   const actual=await page.evaluate(()=>{const root=document.querySelector('#root > *')!.getBoundingClientRect(),ink=Array.from(document.querySelectorAll('div')).find(n=>getComputedStyle(n).backgroundColor==='rgb(0, 7, 20)')!.getBoundingClientRect();return{x:ink.x-root.x,y:ink.y-root.y,width:ink.width,height:ink.height};});
   const expected={x:ink.bounds.x-sourceRoot.bounds.x,y:ink.bounds.y-sourceRoot.bounds.y,width:ink.bounds.width,height:ink.bounds.height};
   for(const key of ['x','y','width','height'] as const)assert(Math.abs(actual[key]-expected[key])<=1/64,`${key}: ${actual[key]} vs ${expected[key]}`);
  }finally{await page.close();}
 }
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 const allocation=native.variants[0].spec.children![0].children![0];
 assert(allocation.affineViewport);assert.equal(allocation.children![0].children!.length,1,'native keeps the ink child');
 assert.equal(allocation.children![0].instanceAffineAllocation!.localSize.width,1.5);
 assert.equal(allocation.children![0].instanceAffineAllocation!.localSize.height,12);
});

import {mapRestToDump} from '../extract/figma/rest/map.js';
import type {DumpSet} from '../extract/figma/types.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {mintedTokenCss} from './mint-tokens.js';
import {walkAnatomy} from '../scripts/contract-schema.js';

function localPlaneFixture(scales=[1]) {
 const [root,,frame,ink]=observed;
 const variants=scales.map((scale,i)=>{
  const rest=(n:any)=>({id:`${n.id}-${i}`,name:n.name,type:n.type,size:{x:n.width*scale,y:n.height*scale},
   relativeTransform:n.relativeTransform.map((row:number[])=>row.map((v,j)=>j===2?v*scale:v)),
   absoluteBoundingBox:{x:n.bounds.x*scale,y:n.bounds.y*scale,width:n.bounds.width*scale,height:n.bounds.height*scale},
   rotation:-n.rotation*Math.PI/180,clipsContent:true,constraints:{horizontal:'CENTER',vertical:'CENTER'}});
  const child={...rest(ink),cornerRadius:3,constraints:{horizontal:'LEFT_RIGHT',vertical:'TOP'},fills:[{type:'SOLID',color:{r:0,g:7/255,b:20/255}}]};
  const owner={...rest(frame),layoutPositioning:'ABSOLUTE',children:[child]};
  return {...rest(root),name:`Size=S${i+1}`,variantProperties:{Size:`S${i+1}`},layoutMode:'VERTICAL',primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED',children:[owner]};
 });
 const document={id:'set',name:'LocalGeometryProbe',type:'COMPONENT_SET',componentPropertyDefinitions:{Size:{type:'VARIANT',defaultValue:'S1',variantOptions:scales.map((_,i)=>`S${i+1}`)}},children:variants};
 const response:any={nodes:{set:{document}}};
 const dump=()=>mapRestToDump(response).dump.LocalGeometryProbe as DumpSet;
 const propose=(set=dump())=>proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,fileKey:'fixture',contractIdByName:new Map()});
 return {response,variants,dump,propose};
}

test('REST to contract to both React emitters retains native local ink across source sizes',async t=>{
 const f=localPlaneFixture([1,2]),before=JSON.stringify(f.response),result=f.propose(),c=ContractSchema.parse(result.contract);
 assert.equal(JSON.stringify(f.response),before,'reader and proposer do not mutate captured evidence');
 const frames=walkAnatomy(c).filter(p=>p.part.instanceAffine);
 assert.equal(frames.length,2,'each local size has its own affine frame');
 assert.deepEqual(frames.map(f=>f.part.instanceAffine!.localSize.height).sort((a,b)=>a-b),[12,24]);
 const tokens={primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c]]),ctx={tokens,contracts,icons:new Map<string,string>()};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const [i,scale] of [1,2,1].entries()){
    await render({size:`s${scale===1?1:2}`});
    const actual=await page.evaluate(()=>{const root=document.querySelector('#root > *')!.getBoundingClientRect(),ink=Array.from(document.querySelectorAll('div')).filter(n=>getComputedStyle(n).backgroundColor==='rgb(0, 7, 20)'&&n.getBoundingClientRect().width>0);return{count:ink.length,...(ink.length?(()=>{const b=ink[0].getBoundingClientRect();return{x:b.x-root.x,y:b.y-root.y,width:b.width,height:b.height};})():{})};});
    assert.equal(actual.count,1,`only the selected size paints (${i})`);
    const expected={x:(observed[3].bounds.x-observed[0].bounds.x)*scale,y:(observed[3].bounds.y-observed[0].bounds.y)*scale,width:observed[3].bounds.width*scale,height:observed[3].bounds.height*scale};
    for(const key of ['x','y','width','height'] as const)assert(Math.abs(actual[key]!-expected[key])<=1/64,`${emitter.name} ${scale} ${key}: ${actual[key]} vs ${expected[key]}`);
   }
  }finally{await page.close();}
 }
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,2);
 function affines(node:any):any[]{return [...(node.affineViewport?[node]:[]),...(node.children??[]).flatMap(affines)];}
 for(const [i,variant] of native.variants.entries()){
  const planes=affines(variant.spec);assert.equal(planes.length,1);
  assert.equal(planes[0].children[0].instanceAffineAllocation.localSize.height,12*(i+1));
  assert.equal(planes[0].children[0].children.length,1,'native compilation retains local ink');
 }
});

test('local-plane lowering refuses missing ancestry, skew and unsupported descendants instead of using bounds',()=>{
 for(const mutate of [
  (s:DumpSet)=>{delete s.variants[0].children![0].children![0].localGeometry;},
  (s:DumpSet)=>{s.variants[0].children![0].localGeometry!.parentId='unrelated';},
  (s:DumpSet)=>{s.variants[0].children![0].children![0].localGeometry!.parentSize.width=99;},
  (s:DumpSet)=>{s.variants[0].children![0].localGeometry!.transform[0][0]=2;},
  (s:DumpSet)=>{(s.variants[0].children![0].localGeometry as any).transform=[];},
  (s:DumpSet)=>{(s.variants[0].children![0].localGeometry as any).parentSize=undefined;},
  (s:DumpSet)=>{s.variants[0].children![0].children![0].type='INSTANCE';},
  (s:DumpSet)=>{delete s.variants[0].children![0].abs!.constraints;},
  (s:DumpSet)=>{s.variants[0].children![0].propRefs={visible:'Show leaf'};},
 ]){const f=localPlaneFixture(),s=f.dump();mutate(s);assert.throws(()=>f.propose(s),/local-frame-plane-unqualified/);}
});

test('local-frame projection does not turn in-flow rotated frames into absolute allocations',()=>{
 const f=localPlaneFixture(),set=f.dump(),frame=set.variants[0].children![0];
 delete frame.abs;
 frame.fixedSize={width:9.54594138264656,height:9.54594138264656};
 const c=ContractSchema.parse(f.propose(set).contract);
 assert(!walkAnatomy(c).some(({part})=>part.instanceAffine),'in-flow rotation keeps its existing conversion path');
});
