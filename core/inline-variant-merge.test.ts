import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';import {emitReactInline} from './emit-react-inline.js';import {reactEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';
const tokens={primitives:{size:{horizontal:{$type:'dimension',$value:'124px'},vertical:{$type:'dimension',$value:'20px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(){
 const ink={
  layoutByProp:{prop:'orientation',map:{vertical:{grow:true,growBasis:'zero'}}},
  literals:{'background-color':'#000000'},
  literalsByProp:[{prop:'orientation',map:{horizontal:{width:'100%'}}}],
  literalsByCombination:[{props:['orientation'],rows:[
   {values:['horizontal'],literals:{height:'2px'}},
   {values:['vertical'],literals:{width:'2px'}},
  ]}],
 };
 return ContractSchema.parse({
  id:'test.variant-merge',name:'VariantMerge',version:'0.1.0',status:'draft',
  description:'Independent variant styles and exact literal rows share an axis',semantics:{element:'div'},states:[],
  props:[{name:'orientation',type:{enum:['horizontal','vertical']},default:'horizontal',bindings:{code:{prop:'orientation'},figma:{kind:'VARIANT',property:'Orientation',values:{horizontal:'Horizontal',vertical:'Vertical'}}}}],
  anatomy:{root:{layout:{display:'flex',direction:'column',align:'start'},layoutByProp:{prop:'orientation',map:{vertical:{align:'center'}}},tokens:{width:'{size.{orientation}}'},literals:{height:'20px'},parts:{ink}}},
  bindings:{code:{anchors:{importPath:'./VariantMerge',export:'VariantMerge'}},figma:{anchors:{fileKey:null,componentSetKey:null}}},
 });
}
test('single-axis literal tuples preserve other parts and same-part layout on both actual React surfaces',async t=>{
 const c=fixture(),contracts=new Map([[c.id,c]]),browser=await chromium.launch();t.after(()=>browser.close());
 const inline=emitReactInline(c,{tokens,contracts,icons:new Map()}),files=reactEmitter.emit(c,{tokens,contracts,icons:new Map(),mode:'light'});
 for(const output of [{tsx:inline.tsx,css:''},{tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]){
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,output.tsx,output.css);
  await page.addStyleTag({content:':root{--size-horizontal:124px;--size-vertical:20px}'});
  for(const orientation of ['horizontal','vertical']){await render({orientation});const measured=await page.locator('#root > :first-child').evaluate(root=>{const ink=root.firstElementChild!,r=root.getBoundingClientRect(),i=ink.getBoundingClientRect();return{rootWidth:r.width,rootHeight:r.height,inkWidth:i.width,inkHeight:i.height,align:getComputedStyle(root).alignItems};});
   assert.deepEqual(measured,orientation==='horizontal'?{rootWidth:124,rootHeight:20,inkWidth:124,inkHeight:2,align:'flex-start'}:{rootWidth:20,rootHeight:20,inkWidth:2,inkHeight:20,align:'center'});
  }await page.close();
 }
});
test('compound literals retain precedence over an ordinary variant on the same channel',async t=>{
 const c=fixture();c.anatomy.root.parts!.ink.literalsByProp![0].map.vertical={width:'9px'};
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();
 const render=await mountGenerated(page,c.name,emitReactInline(c,{tokens,contracts:new Map([[c.id,c]]),icons:new Map()}).tsx);await render({orientation:'vertical'});
 assert.equal(await page.locator('#root > * > :first-child').evaluate(n=>n.getBoundingClientRect().width),2);
});
