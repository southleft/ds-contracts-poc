import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,resolveLiterals} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {flattenTokens} from './tokens.js';
import {mountGenerated} from './react-test-runtime.js';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import type {DumpSet} from '../extract/figma/types.js';
function source():DumpSet{
 return {setName:'JointStroke',type:'COMPONENT_SET',propertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']},Checked:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']}},variants:['A','B'].flatMap((tone,i)=>['False','True'].map((checked,j)=>({name:`Tone=${tone}, Checked=${checked}`,variantProperties:{Tone:tone,Checked:checked},type:'COMPONENT' as const,bbox:{width:40,height:20},fixedSize:{width:40,height:20},layout:{mode:'HORIZONTAL' as const,primary:'MIN' as const,counter:'MIN' as const,spacing:0,padding:[0,0,0,0] as [number,number,number,number],primarySizing:'FIXED' as const,counterSizing:'FIXED' as const},...(i&&j?{}:{stroke:{hex:'#ff0000'},strokeWeights:{top:1+i+j,right:2+i,bottom:j,left:0},strokesIncludedInLayout:false})})))};
}
const propose=(set:DumpSet)=>proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,projectionMode:'exact',stampsObservable:true});
test('joint side widths preserve each measured tuple and explicit no-stroke zeros',async()=>{
 const s=source(),p=propose(s),c=ContractSchema.parse(p.contract),tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([[c.id,c]]);
 assert.equal(c.anatomy.root.literalsByCombination?.[0].rows.length,4);
 for(const tone of ['a','b'])for(const checked of ['false','true']){
  const l=resolveLiterals(c.anatomy.root,{tone,checked});const i=tone==='b'?1:0,j=checked==='true'?1:0;
  assert.deepEqual(['top','right','bottom','left'].map(side=>l[`border-${side}-width`]),(i&&j?[0,0,0,0]:[1+i+j,2+i,j,0]).map(n=>n+'px'));
 }
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 assert.equal(native.variants.length,4);
 native.variants.forEach((v,index)=>{const i=Math.floor(index/2),j=index%2;assert.deepEqual(v.spec.lits?.strokeSides,i&&j?{top:0,right:0,bottom:0,left:0}:{top:1+i+j,right:2+i,bottom:j,left:0});});
 const browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
  const generated=surface==='module'?emitReact(c,{contracts:scope,icons:new Map(),tokens:new Set(flattenTokens(tokens.primitives).keys()),tokenValues:tokens}):{...emitReactInline(c,{contracts:scope,icons:new Map(),tokens}),css:''};
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,generated.tsx,generated.css);
  await page.addStyleTag({content:':root{'+[...flattenTokens(tokens.primitives)].map(([k,v])=>'--'+k.replace(/\./g,'-')+':'+v.value+';').join('')+'}'});
  for(const tone of ['a','b'])for(const checked of [false,true]){await render({tone,checked});const box=await page.locator('#root > *').boundingBox();assert(box);assert.equal(box.width,40);assert.equal(box.height,20);
   const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
   const alpha=(x:number,y:number)=>png.data[(y*png.width+x)*4+3];
   assert.equal(alpha(10,0),tone==='b'&&checked?0:255);
   assert.equal(alpha(39,10),tone==='b'&&checked?0:255);
   assert.equal(alpha(10,19),tone==='a'&&checked?255:0);
   assert.equal(alpha(0,10),0);
  }
  await page.close();
 }}finally{await browser.close()}
});
test('partial source bindings and malformed side weights remain named fidelity limits',()=>{
 for(const mutate of [(s:DumpSet)=>{s.variants[0].bound={strokeTopWeight:'weight'}},(s:DumpSet)=>{s.variants[0].strokeWeights!.left=-1}]){
  const s=source();mutate(s);const p=propose(s),c=ContractSchema.parse(p.contract);
  assert(!c.anatomy.root.literalsByCombination?.some(t=>t.rows.some(r=>'border-top-width' in r.literals)));
  assert(p.notes.some(n=>n.includes('NAMED for review')));
 }
});

test('joint side widths on a partially present child never add an absent variant',()=>{
 const s=source();s.variants=s.variants.map((v,index)=>{
  const {stroke,strokeWeights,strokesIncludedInLayout,...root}=v;
  return {...root,children:index===3?[]:[{name:'Panel',type:'FRAME' as const,layout:v.layout,fixedSize:v.fixedSize,bbox:v.bbox,stroke,strokeWeights,strokesIncludedInLayout}]};
 });
 const p=propose(s),c=ContractSchema.parse(p.contract),panel=c.anatomy.root.parts!.Panel ?? c.anatomy.root.parts!.panel;
 assert(panel);assert.equal(panel.literalsByCombination?.[0].rows.length,3);
 assert.equal(panel.presenceByCombination?.rows.filter(row=>row.present).length,3);
 const engine=createFigmaEngine({tokens:{primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(data.variants.find(v=>v.name==='Tone=B, Checked=True')?.spec.children?.length ?? 0,0);
 for(const v of data.variants.filter(v=>v.name!=='Tone=B, Checked=True'))assert.equal(v.spec.children?.length,1);
});

test('partially bound uniform stroke widths render measured values and absent zeros on both React surfaces',async()=>{
 const s=source();
 s.variants.forEach((v,i)=>{delete v.strokeWeights;if(i<3){v.strokeWeight=[1,2,3][i];v.bound={strokeTopWeight:'line/width',strokeRightWeight:'line/width',strokeBottomWeight:'line/width',strokeLeftWeight:'line/width'};}});
 const p=propose(s),c=ContractSchema.parse(p.contract),scope=new Map([[c.id,c]]);
 assert(p.notes.some(n=>n.includes('original width-variable identity is not preserved')));
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
  const generated=surface==='module'?emitReact(c,{contracts:scope,icons:new Map(),tokens:new Set(flattenTokens(tokens.primitives).keys()),tokenValues:tokens}):{...emitReactInline(c,{contracts:scope,icons:new Map(),tokens}),css:''};
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,generated.tsx,generated.css);
  await page.addStyleTag({content:':root{'+[...flattenTokens(tokens.primitives)].map(([k,v])=>'--'+k.replace(/\./g,'-')+':'+v.value+';').join('')+'}'});
  for(const [i,props] of [{tone:'a',checked:false},{tone:'a',checked:true},{tone:'b',checked:false},{tone:'b',checked:true}].entries()){
   await render(props);
   const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
   const width=[1,2,3,0][i];
   for(let y=0;y<4;y++)assert.equal(png.data[(y*png.width+20)*4+3],y<width?255:0,`${surface} tuple ${i} row ${y}`);
  }
  await page.close();
 }}finally{await browser.close();}
});

test('partial width fallback does not invent a width for a stroked variant with missing measurement',()=>{
 const s=source();s.variants.forEach((v,i)=>{delete v.strokeWeights;if(i<3){v.strokeWeight=1;v.bound={strokeWeight:'line/width'};}});delete s.variants[1].strokeWeight;
 const p=propose(s);
 assert(!p.notes.some(n=>n.includes('partially bound uniform stroke widths carried')));
});
