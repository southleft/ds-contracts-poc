import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema,ShapeSchema} from '../scripts/contract-schema.js';
import {mapRestToDump} from '../extract/figma/rest/map.js';
import {proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact,validateContract} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';import {mountGenerated} from './react-test-runtime.js';import {tokenInventoryFromJson} from './tokens.js';import {mintedTokenCss} from './mint-tokens.js';
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

test('profile convention stretched-line-paints-bar: a vertically stretched quarter-turn LINE is the bar it paints; off, it stays refused',async()=>{
 const make=():any=>({setName:'BarProof',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}},variants:[48,68].map((height,i)=>({name:'Mode='+['A','B'][i],variantProperties:{Mode:['A','B'][i]},type:'COMPONENT',nodeId:'p'+i,bbox:{width:120,height},
  layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,16]},children:[{name:'Body',type:'FRAME',nodeId:'b'+i,fixedSize:{width:40,height}},
  {name:'Bar',type:'LINE',nodeId:'n'+i,stroke:{hex:['42be65','da1e28'][i]},strokeWeight:3,strokeAlign:'CENTER',shape:{kind:'line',width:height,height:0,constraints:{horizontal:'LEFT',vertical:'STRETCH'},
   line:{length:height,transform:[[-4.371139183945161e-8,-1,height*4e-8],[1,-4.371139183945161e-8,0]],cap:'NONE',align:'CENTER',source:{nodeId:'n'+i,parentId:'p'+i}}}}]}))});
 const read=(conventions:string[],d=make())=>{const p=proposeFromDump(d,{corpus:tokenCorpusFromJson({...tokens,brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),conventions});return {p,c:ContractSchema.parse(p.contract)};};
 const off=read([]).c.anatomy.root.parts!.Bar;assert.equal(off.declared?.position,undefined);assert.equal(off.shape,undefined);
 const {p,c}=read(['stretched-line-paints-bar']),bar=c.anatomy.root.parts!.Bar;
 assert.equal(bar.declared?.position,'absolute');assert.deepEqual([bar.literals?.left,bar.literals?.top,bar.literals?.bottom],['0px','0px','0px']);
 assert(JSON.stringify(bar).includes('background-color')&&!JSON.stringify(bar).includes('border-'));
 const tree=p.mintedTokens!.tree,out=emitReact(c,{contracts:new Map([[c.id,c]]),icons:new Map(),tokens:tokenInventoryFromJson([tree])}),browser=await chromium.launch();
 try{const page=await browser.newPage(),render=await mountGenerated(page,c.name,out.tsx,mintedTokenCss(tree)+out.css);
  for(const [mode,height,color] of [['a',48,'rgb(66, 190, 101)'],['b',68,'rgb(218, 30, 40)']] as const){await render({mode});
   assert.deepEqual(await page.locator('#root [class$=_Bar]').evaluate(el=>{const r=el.getBoundingClientRect(),o=el.parentElement!.getBoundingClientRect();return [r.x-o.x,r.y-o.y,r.width,r.height,getComputedStyle(el).backgroundColor];}),[0,0,3,height,color],mode);}
 }finally{await browser.close();}
 const shifted=make();shifted.variants[1].children[1].shape.line.transform[1][2]=1;assert.equal(read(['stretched-line-paints-bar'],shifted).c.anatomy.root.parts!.Bar.declared?.position,undefined,'off the top edge stays refused');
});

test('profile convention vertical-fill-line-in-row: a quarter-turn LINE stretched across its row takes no width and paints its bar; off, it is named',async()=>{
 const make=():any=>({setName:'RowBar',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}},variants:[48,68].map((height,i)=>({name:'Mode='+['A','B'][i],variantProperties:{Mode:['A','B'][i]},type:'COMPONENT',nodeId:'p'+i,bbox:{width:54,height},
  layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:14,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[
  {name:'Bar',type:'LINE',nodeId:'n'+i,fillHeight:true,stroke:{hex:['42be65','da1e28'][i]},strokeWeight:3,strokeAlign:'CENTER',shape:{kind:'line',width:height,height:0,constraints:{horizontal:'LEFT',vertical:'TOP'},
   line:{length:height,transform:[[-4.371139183945161e-8,-1,0.000004764541699842084],[1,-4.371139183945161e-8,0]],cap:'NONE',align:'CENTER',source:{nodeId:'n'+i,parentId:'p'+i}}}},
  {name:'Body',type:'FRAME',nodeId:'b'+i,fixedSize:{width:40,height}}]}))});
 const read=(conventions:string[],d=make())=>{const p=proposeFromDump(d,{corpus:tokenCorpusFromJson({...tokens,brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),conventions});return {p,c:ContractSchema.parse(p.contract)};};
 const off=read([]);assert.equal(off.c.anatomy.root.parts!.Bar.shape,undefined);assert(off.p.notes.some(n=>n.includes('vertical-fill-line-not-carried')),JSON.stringify(off.p.notes));
 const {p,c}=read(['vertical-fill-line-in-row']),shape=c.anatomy.root.parts!.Bar.shape;assert(shape?.kind==='line');assert.equal(shape.line.fillHeight,true);
 const contracts=new Map([[c.id,c]]),errors:string[]=[];validateContract(c,contracts,errors,new Map());assert.deepEqual(errors,[]);
 const tree=p.mintedTokens!.tree,browser=await chromium.launch();
 try{for(const inline of [false,true]){const out=inline?{...emitReactInline(c,{contracts,icons:new Map(),tokens:{...tokens,primitives:tree}}),css:''}:emitReact(c,{contracts,icons:new Map(),tokens:tokenInventoryFromJson([tree])});
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,out.tsx,mintedTokenCss(tree)+out.css);
  for(const [mode,height,color] of [['a',48,'rgb(66, 190, 101)'],['b',68,'rgb(218, 30, 40)']] as const){await render({mode});
   assert.deepEqual(await page.evaluate(()=>{const root=document.querySelector('#root > *')!.getBoundingClientRect(),line=document.querySelector('line')!,l=line.getBoundingClientRect(),bar=line.closest('svg')!.parentElement!.getBoundingClientRect(),
    body=[...document.querySelectorAll('#root > * > *')].at(-1)!.getBoundingClientRect(),s=getComputedStyle(line);return [bar.width,bar.height,l.x-root.x,l.height,s.strokeWidth,s.stroke,body.x-root.x];}),[0,height,1.5,height,'3px',color,14],JSON.stringify({mode,inline}));}
 }}finally{await browser.close();}
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).buildComponentScript(c,contracts),/native-vertical-fill-line-unqualified/);
 const column=structuredClone(c) as any;column.anatomy.root.layout.direction='column';const bad:string[]=[];validateContract(ContractSchema.parse(column),new Map([[c.id,column]]),bad,new Map());assert(bad.some(x=>x.includes('vertical-fill-line-parent-unqualified')),JSON.stringify(bad));
 const absolute=make();absolute.variants[1].children[0].abs={x:0,y:0};assert.equal(read(['vertical-fill-line-in-row'],absolute).c.anatomy.root.parts!.Bar.shape,undefined,'an absolutely placed line is not in the row');
});
