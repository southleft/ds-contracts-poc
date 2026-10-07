import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema,strokedPathGeometryIssue} from '../scripts/contract-schema.js';
import {validateContract} from './emit-react.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';
const shape=(horizontal='MAX',vertical='MAX'):any=>({kind:'stroked-path',width:7,height:7,strokePath:{data:'M 0 7 L 7 0 M 4 7 L 7 4',cap:'NONE',join:'MITER',miterLimit:4,viewport:{width:320,height:76,x:308,y:64},constraints:{horizontal,vertical}}});
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
test('fixed native strokes follow captured anchors without scaling their centerline or weight',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const anchor of ['MIN','MAX','CENTER']){
  const c=ContractSchema.parse({id:'test.anchor',name:'AnchoredStroke',version:'1.0.0',archetype:'none',description:'Native anchored stroke.',semantics:{element:'div'},props:[],states:[],anatomy:{root:{declared:{position:'relative'},literals:{width:'320px',height:'76px'},parts:{ink:{shape:shape(anchor,anchor),literals:{'border-color':'#e5e5e5','border-width':'1px'}}}}},bindings:{code:{anchors:{importPath:'./AnchoredStroke',export:'AnchoredStroke'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  const errors:string[]=[];validateContract(c,new Map([[c.id,c]]),errors,new Map());assert.deepEqual(errors,[]);
  const ctx={contracts:new Map([[c.id,c]]),tokens,icons:new Map()};
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await render({});
   for(const [width,height] of [[320,76],[480,120],[320,76]]){
    await page.locator('#root > div').evaluate((n,size)=>{(n as HTMLElement).style.width=size[0]+'px';(n as HTMLElement).style.height=size[1]+'px';},[width,height]);
    const result=await page.locator('#root path').evaluate(n=>{const b=n.getBoundingClientRect(),r=document.querySelector('#root > div')!.getBoundingClientRect();return {x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height,stroke:getComputedStyle(n).strokeWidth};});
    const factor=anchor==='MAX'?1:anchor==='CENTER'?0.5:0;assert.equal(result.x,308+(width-320)*factor);assert.equal(result.y,64+(height-76)*factor);assert.equal(result.w,7);assert.equal(result.h,7);assert.equal(result.stroke,'1px');
   }
   await page.close();
  }
  const native=createFigmaEngine({tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts);assert.deepEqual(native.variants[0].spec.children?.[0].shape?.strokePath?.constraints,{horizontal:anchor,vertical:anchor});
 }
});
test('mixed fixed and stretch stroke constraints remain refused',()=>{assert.equal(strokedPathGeometryIssue(shape('MAX','SCALE')),'stroked-path-constraints');});

test('native capture and proposal preserve anchored strokes inside a bordered parent',async t=>{
 const {readFileSync}=await import('node:fs');const vm=await import('node:vm');
 const plugin=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8');
 const start=plugin.indexOf('function strokedPathIssue('),end=plugin.indexOf('function dumpShape(',start);
 const reader=vm.runInNewContext(plugin.slice(start,end)+'; dumpStrokedPath');
 const parent={type:'COMPONENT',layoutMode:'NONE',relativeTransform:[[1,0,0],[0,1,0]],width:320,height:76,paddingTop:0,paddingBottom:0,paddingLeft:0,paddingRight:0,strokes:[{type:'SOLID'}],clipsContent:true};
 const node={type:'VECTOR',width:7,height:7,relativeTransform:[[1,0,308],[0,1,64]],fills:[],strokes:[{type:'SOLID',blendMode:'NORMAL'}],effects:[],isMask:false,blendMode:'NORMAL',strokeAlign:'CENTER',strokeWeight:1,strokeCap:'NONE',strokeJoin:'MITER',strokeMiterLimit:4,dashPattern:[],cornerRadius:0,constraints:{horizontal:'MAX',vertical:'MAX'},vectorPaths:[{data:'M 0 7 L 7 0 M 4 7 L 7 4',windingRule:'NONE'}],vectorNetwork:{vertices:[{x:0,y:7},{x:7,y:0},{x:4,y:7},{x:7,y:4}],regions:[]}};
 const captured=JSON.parse(JSON.stringify(reader(node,parent)));assert(captured);assert.deepEqual(captured.strokePath.constraints,node.constraints);
 assert.equal(reader({...node,constraints:{horizontal:'MAX',vertical:'SCALE'}},parent),null);
 const {proposeFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const set:any={setName:'CapturedAnchor',type:'COMPONENT_SET',variants:[{name:'Default',type:'COMPONENT',bbox:{width:320,height:76},stroke:{hex:'888888'},strokeWeight:1,strokeAlign:'INSIDE',children:[{name:'Ink',type:'VECTOR',stroke:{hex:'e5e5e5'},strokeWeight:1,strokeAlign:'CENTER',shape:captured,abs:{x:308,y:64,right:5,bottom:5,width:7,height:7,constraints:{horizontal:'RIGHT',vertical:'BOTTOM'}}}]}]};
 const r=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,projectionMode:'reviewable-inversion'});const c=ContractSchema.parse(r.contract),ctx={contracts:new Map([[c.id,c]]),tokens:{...tokens,primitives:r.mintedTokens?.tree??{}},icons:new Map()};
 const errors:string[]=[];validateContract(c,ctx.contracts,errors,new Map());assert.deepEqual(errors,[]);
 const {mintedTokenCss}=await import('./mint-tokens.js');const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)});await render({});
  for(const [w,h] of [[320,76],[400,100],[320,76]]){
   await page.locator('#root > div').evaluate((n,s)=>{(n as HTMLElement).style.width=s[0]+'px';(n as HTMLElement).style.height=s[1]+'px';},[w,h]);
   const box=await page.locator('#root path').evaluate(n=>{const b=n.getBoundingClientRect(),p=document.querySelector('#root > div')!.getBoundingClientRect();return {right:p.right-b.right,bottom:p.bottom-b.bottom,w:b.width,h:b.height};});
   assert.deepEqual(box,{right:5,bottom:5,w:7,h:7});
  }await page.close();
 }
 const native=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts);assert(native.variants[0].spec.children?.length);
 const conflict=structuredClone(set);conflict.variants[0].children[0].abs.x+=1;assert.throws(()=>proposeFromDump(conflict,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,projectionMode:'reviewable-inversion'}),/anchored-stroke-source-basis-conflict/);
});
