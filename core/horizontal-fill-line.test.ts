import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema,ShapeSchema} from '../scripts/contract-schema.js';
import {mapRestToDump} from '../extract/figma/rest/map.js';
import {proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact,validateContract} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';import {mountGenerated} from './react-test-runtime.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function contract(){return ContractSchema.parse({id:'probe.fill-line',name:'FillLine',version:'1.0.0',description:'Source-qualified FILL line',semantics:{element:'div'},props:[],states:[],bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./FillLine',export:'FillLine'}}},anatomy:{root:{layout:{display:'flex',direction:'column'},literals:{width:'100px','padding-inline':'12px'},parts:{ink:{shape:{kind:'line',width:76,height:0,line:{length:76,transform:[[1,0,0],[0,1,0]],cap:'NONE',align:'CENTER',fillWidth:true}},literals:{'border-width':'3px','border-color':'#165dff'}}}}}});}
test('horizontal FILL line keeps zero height, full inner width and upward stroke on both React surfaces',async()=>{
 const c=contract(),contracts=new Map([[c.id,c]]),errors:string[]=[];validateContract(c,contracts,errors,new Map());assert.deepEqual(errors,[]);
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const out=inline?{...emitReactInline(c,{contracts,icons:new Map(),tokens}),css:''}:emitReact(c,{contracts,icons:new Map(),tokens:new Set()});
  const page=await browser.newPage();try{await mountGenerated(page,c.name,out.tsx,out.css);await page.addStyleTag({content:'body{margin:20px}'});
   for(const width of [100,144,80]){
    await page.locator('#root > *').evaluate((el:any,w)=>el.style.width=w+'px',width);
    const v=await page.locator('line').evaluate(el=>{const line=el as SVGLineElement,box=line.getBBox(),root=document.querySelector('#root > *')!.getBoundingClientRect(),span=line.closest('svg')!.parentElement!.getBoundingClientRect(),s=getComputedStyle(line);return{width:box.width,rootHeight:root.height,spanHeight:span.height,stroke:s.strokeWidth,cap:s.strokeLinecap,y:line.parentElement!.getAttribute('style')};});
    assert.equal(v.width,width-24);assert.equal(v.rootHeight,0);assert.equal(v.spanHeight,0);assert.equal(v.stroke,'3px');assert.equal(v.cap,'butt');assert(v.y?.includes('-0.5'));
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).buildComponentScript(c,contracts),/native-horizontal-fill-line-unqualified/);
});
test('FILL line rejects rotated or capped bases and an unrelated parent layout',()=>{
 for(const patch of [{cap:'ROUND'},{transform:[[0,-1,0],[1,0,0]]},{align:'OUTSIDE'}]){const c=contract();const shape=c.anatomy.root.parts!.ink.shape!;assert(shape.kind==='line');Object.assign(shape.line,patch);assert(!ShapeSchema.safeParse(c.anatomy.root.parts!.ink.shape).success);}
 for(const change of [
  (c:any)=>c.anatomy.root.layout.direction='row',
  (c:any)=>c.anatomy.root.layout.display='grid',
  (c:any)=>c.anatomy.root.layoutByProp={prop:'mode',map:{row:{direction:'row'}}},
  (c:any)=>c.anatomy.root.parts.ink.layout={grow:true},
 ]){const c=contract();change(c);const errors:string[]=[];validateContract(c,new Map([[c.id,c]]),errors,new Map());assert(errors.some(x=>x.includes('horizontal-fill-line-parent-unqualified')));} 
});
test('original varying-width parent allocation carries FILL line instead of border fallback',()=>{
 const variants:any[]=[100,80].map((width,i)=>({id:'p'+i,name:'Mode='+['A','B'][i],type:'COMPONENT',size:{x:width,y:30},absoluteBoundingBox:{x:0,y:0,width,height:30},children:[{id:'w'+i,name:'Owner',type:'FRAME',size:{x:width,y:0},absoluteBoundingBox:{x:0,y:30,width,height:0},relativeTransform:[[1,0,0],[0,1,30]],layoutMode:'VERTICAL',paddingLeft:12,paddingRight:12,children:[{id:'n'+i,name:'Ink',type:'LINE',size:{x:width-24,y:0},relativeTransform:[[1,0,12],[0,1,0]],absoluteBoundingBox:{x:12,y:30,width:width-24,height:0},layoutSizingHorizontal:'FILL',strokes:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}],strokeWeight:3,strokeAlign:'CENTER',constraints:{horizontal:'LEFT',vertical:'TOP'}}]}]}));
 const mapped=mapRestToDump({name:'x',nodes:{root:{document:{id:'root',name:'Source',type:'COMPONENT_SET',children:variants,componentPropertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}}}}}}),set=mapped.dump.Source as any;
 assert(set.variants.every((v:any)=>v.children[0].children[0].shape.lineFlow));
 const before=JSON.stringify(set),p=proposeFromDump(set,{corpus:tokenCorpusFromJson({...tokens,brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(p.contract);
 const shape=c.anatomy.root.parts!.Owner.parts!.Ink.shape;assert(shape?.kind==='line');assert.equal(shape.line.fillWidth,true);assert.equal(JSON.stringify(set),before);
});

test('incomplete source FILL allocation cannot bypass the existing varying-line refusal',()=>{
 const make=():any=>({setName:'FlowProof',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}},variants:[100,80].map((width,i)=>({name:'Mode='+['A','B'][i],variantProperties:{Mode:['A','B'][i]},type:'COMPONENT',nodeId:'p'+i,layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,12,0,12]},children:[{name:'Ink',type:'LINE',nodeId:'n'+i,fillWidth:true,stroke:{hex:'123456'},strokeWeight:3,shape:{kind:'line',width:width-24,height:0,line:{length:width-24,transform:[[1,0,12],[0,1,0]],cap:'NONE',align:'CENTER',source:{nodeId:'n'+i,parentId:'p'+i}},lineFlow:{kind:'horizontal-fill-line-v1',nodeId:'n'+i,parentId:'p'+i,parentWidth:width,parentHeight:0,padding:[0,12,0,12],length:width-24,transform:[[1,0,12],[0,1,0]]}}}]}))});
 const read=(d:any)=>ContractSchema.parse(proposeFromDump(d,{corpus:tokenCorpusFromJson({...tokens,brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()}).contract);
 const fill=(c:ReturnType<typeof read>)=>{const shape=c.anatomy.root.parts!.Ink.shape;return shape?.kind==='line'?shape.line.fillWidth:undefined;};
 assert.equal(fill(read(make())),true);
 for(const mutate of [
 (n:any,p:any)=>n.shape.lineFlow.parentId='foreign',
 (n:any,p:any)=>n.shape.lineFlow.length++,
 (n:any,p:any)=>n.shape.lineFlow.transform[0][2]++,
 (n:any,p:any)=>n.shape.lineFlow.padding=[0,-1,0,12],
 (n:any,p:any)=>n.fillWidth=false,
 (n:any,p:any)=>n.mask={type:'ALPHA'},
 (n:any,p:any)=>p.layout.mode='HORIZONTAL',
 ]){const d=make(),parent=d.variants[1];mutate(parent.children[0],parent);const before=JSON.stringify(d);if(parent.children[0].mask)assert.throws(()=>read(d),/figma-mask-composition-unqualified/);else assert.notEqual(fill(read(d)),true);assert.equal(JSON.stringify(d),before);}
});
