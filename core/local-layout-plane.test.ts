import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {chromium} from 'playwright-core';
import type {DumpNode} from '../extract/figma/types.js';
import {projectLocalFramePlane} from './local-frame-plane.js';
import {projectedLocalLayoutPlane} from './local-layout-plane.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/reflected-layout-menu.json',import.meta.url),'utf8')) as {parentId:string;parentSize:{width:number;height:number};node:DumpNode};
test('retained reflected menu geometry preserves flow, layout and exact keyed ownership without inventing vector ink',()=>{
 const f=fixture(),before=JSON.stringify(f),plane=projectLocalFramePlane(f.node,f.parentId,f.parentSize);
 const submenu=plane.node.children![0],arrow= submenu.children![0].children![0],item=submenu.children![1].children![0];
 assert.deepEqual(plane.affine.transform,[[-1,0,0.0010000000474974513],[0,1,0]]);
 assert.deepEqual(submenu.layout,f.node.children![0].layout);
 assert(arrow.fillHeight);assert.equal(arrow.abs,undefined,'in-flow FILL stays in flow');
 assert.deepEqual(projectedLocalLayoutPlane(arrow)!.fill,{width:false,height:true});
 assert.deepEqual(projectedLocalLayoutPlane(arrow)!.affine.transform,[[-1,0,8],[0,-1,40]]);
 assert.equal(item.instanceKey,f.node.children![0].children![1].children![0].instanceKey);
 assert.deepEqual(item.componentProperties,f.node.children![0].children![1].children![0].componentProperties);
 assert.equal(arrow.children![0].shape,undefined,'missing source paths remain missing');
 assert.equal(JSON.stringify(f),before);
});
test('mixed local layout rejects changed ancestry, unsupported transforms and incomplete ownership',()=>{
 const edits:Array<(f:ReturnType<typeof fixture>)=>void>=[
 f=>{delete f.node.children![0].localGeometry;},
 f=>{f.node.children![0].localGeometry!.parentId='other';},
 f=>{f.node.children![0].localGeometry!.parentSize.width=1;},
 f=>{f.node.children![0].localGeometry!.transform[0][0]=2;},
 f=>{f.node.children![0].layout!.wrap=true;},
 f=>{f.node.children![0].bound={width:'size.dynamic'};},
 f=>{delete f.node.children![0].children![1].children![0].instanceKey;},
 f=>{f.node.children![0].children![1].children![0].instanceGeometry!.localSize.width=207;},
 f=>{f.node.children![0].fillHeight=true;},
 f=>{const n=f.node.children![0].children![0].children![0].children![0];n.shape={kind:'path',width:n.localGeometry!.localSize.width,height:n.localGeometry!.localSize.height,paths:[{d:'M0 0 L2 0 L0 2 Z',windingRule:'NONZERO'}]} as any;},
 ];
 for(const edit of edits){const f=fixture();edit(f);assert.throws(()=>projectLocalFramePlane(f.node,f.parentId,f.parentSize),/local-frame-plane-unqualified/);}
});
test('owned FILL refuses paint and opacity on the duplicated flow class',()=>{
 for(const key of ['background-color','opacity','box-shadow']){
  const c=ownedFill();c.anatomy.root.parts!.reflected.literals![key]=key==='opacity'?'0.5':key==='box-shadow'?'0 0 2px #000':'#123456';
  assert.throws(()=>emitReact(c,{contracts:new Map([[c.id,c]]),icons:new Map(),tokens:new Set()}),/owned-affine-fill-paint-unqualified/);
 }
 const c=ownedFill();c.anatomy.root.parts!.reflected.solidFillComposition={color:{r:1,g:0,b:0},opacity:0.5,blendMode:'NORMAL'};
 assert.throws(()=>emitReact(c,{contracts:new Map([[c.id,c]]),icons:new Map(),tokens:new Set()}),/owned-affine-fill-paint-unqualified/);
});
test('rotated source paths cannot lose their angle or claim a reflected rotation',()=>{
 for(const rotation of [undefined,0,90]){
  const f=fixture(),n=f.node.children![0].children![0].children![0].children![0],g=n.localGeometry!;
  n.shape={kind:'path',width:g.localSize.width,height:g.localSize.height,paths:[{data:'M0 0 L2 0 L0 2 Z',windingRule:'NONZERO'}],...(rotation===undefined?{}:{rotation})};
  if(rotation===90)g.transform=[[-1,0,0],[0,1,0]];
  assert.throws(()=>projectLocalFramePlane(f.node,f.parentId,f.parentSize),/path-rotation-source/);
 }
});
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function ownedFill(){return ContractSchema.parse({id:'test.owned-affine-fill',name:'OwnedAffineFill',version:'1.0.0',description:'Owned reflected layout test',status:'draft',semantics:{element:'div'},props:[],states:[],
 bindings:{code:{anchors:{importPath:'./OwnedAffineFill',export:'OwnedAffineFill'}},figma:{anchors:{fileKey:null,componentSetKey:null}}},
 anatomy:{root:{layout:{display:'flex',direction:'row',align:'stretch'},literals:{width:'20px',height:'40px'},parts:{reflected:{
 layout:{display:'flex',direction:'column',alignSelf:'stretch'},literals:{width:'8px',height:'40px'},
 instanceAffine:{localSize:{width:8,height:40},transform:[[-1,0,8],[0,-1,40]]},instanceAffineFill:{width:false,height:true},
 parts:{ink:{literals:{width:'8px',height:'8px','background-color':'#102030'}}}}}}}});}
test('owned reflected FILL uses both actual React emitters and follows parent height without scaling ink',async()=>{
 const c=ownedFill(),contracts=new Map([[c.id,c]]),browser=await chromium.launch();
 try{for(const inline of [false,true]){
  const code=inline?{...emitReactInline(c,{contracts,icons:new Map(),tokens}),css:''}:emitReact(c,{contracts,icons:new Map(),tokens:new Set(),tokenValues:tokens});
  assert.deepEqual(generatedTypeErrors(c.name,code.tsx),[]);
  const page=await browser.newPage();try{
   await mountGenerated(page,c.name,code.tsx,code.css);
   for(const height of [40,80,24]){
    await page.locator('#root > *').evaluate((e,h)=>(e as HTMLElement).style.height=h+'px',height);
    const actual=await page.evaluate(()=>{const root=document.querySelector('#root > *')!,ink=Array.from(root.querySelectorAll('*')).filter(e=>getComputedStyle(e).backgroundColor==='rgb(16, 32, 48)');const row=ink.find(e=>e.getBoundingClientRect().width===8)!;const r=root.getBoundingClientRect(),b=row.getBoundingClientRect();return{count:ink.length,width:b.width,height:b.height,y:b.y-r.y};});
    assert.deepEqual(actual,{count:1,width:8,height:8,y:height-8});
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts),host=native.variants[0].spec.children![0];
 assert.equal(host.affineViewport,true);assert.equal(host.fillH,true);assert.deepEqual(host.children![0].instanceAffineFill,{width:false,height:true});
 assert.deepEqual(host.children![0].instanceAffineAllocation!.normalizedTransform,[[-1,0,8],[0,-1,40]]);
 const mock=createFigmaMock(),context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}}),engine=createFigmaEngine({tokens,icons:new Map()});
 await vm.runInContext(`(async()=>{${engine.buildTokensScript(null)}})()`,context);
 await vm.runInContext(`(async()=>{${engine.buildComponentScript(c,contracts)}})()`,context);
 const component:any=mock.root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert(component);const allocation=component.children[0],local=allocation.children[0];
 assert.equal(allocation.layoutSizingVertical,'FILL');assert.equal(local.constraints.vertical,'STRETCH');
 assert.deepEqual(JSON.parse(JSON.stringify(local.relativeTransform)),[[-1,0,8],[0,-1,40]]);
});
test('owned-frame affine FILL cannot be attached to an unrelated, skewed, component or path carrier',()=>{
 for(const edit of [(p:any)=>delete p.instanceAffine,(p:any)=>p.instanceAffine.transform=[[1,0.2,0],[0,1,0]],(p:any)=>p.component={id:'other'},(p:any)=>p.shape={kind:'rect',width:8,height:40},(p:any)=>p.instanceAffineFill={width:false,height:false}]){
  const c=ownedFill();edit(c.anatomy.root.parts!.reflected);assert.equal(ContractSchema.safeParse(c).success,false);
 }
});
