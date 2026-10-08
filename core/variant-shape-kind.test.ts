import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {mintedTokenCss} from './mint-tokens.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture():any {
 return {setName:'ChangingOutline',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Plain',variantOptions:['Plain','Curved']}},variants:['Plain','Curved'].map((mode,i)=>({name:`Mode=${mode}`,variantProperties:{Mode:mode},type:'COMPONENT',bbox:{width:100,height:20},children:[{name:'Ink',type:i?'VECTOR':'RECTANGLE',fill:{hex:'171717'},...(i?{}:{cornerRadii:[2,0,0,2]}),localGeometry:{nodeId:`ink${i}`,parentId:`root${i}`,transform:[[1,0,0],[0,1,8]],localSize:{width:50,height:4},parentSize:{width:100,height:20}},shape:{kind:i?'path':'rect',width:50,height:4,x:0,y:8,right:50,bottom:8,constraints:{horizontal:'SCALE',vertical:'SCALE'},...(i?{paths:[{data:'M0 2C0 1 1 0 2 0L50 0L50 4L2 4C1 4 0 3 0 2Z',windingRule:'NONZERO'}]}:{})}}]}))};
}
const propose=(set:any)=>proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
test('captured rectangle and path preserve exclusive outline owners in both React emitters',async t=>{
 const set=fixture(),before=JSON.stringify(set),r=propose(set),c=ContractSchema.parse(r.contract);
 assert.equal(JSON.stringify(set),before);assert(r.notes.some(n=>n.includes('source-shape-kind-partition')));
 assert.equal(Object.keys(c.anatomy.root.parts??{}).length,2);
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();
  const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)});
  for(const mode of ['plain','curved','plain']){
   await render({mode});
   const boxes=await page.locator('#root > * > *').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none' && n.getBoundingClientRect().width>0).map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
   assert.equal(boxes.length,1,await page.locator('#root').innerHTML());assert.equal(boxes[0].width,50);assert.equal(boxes[0].height,4);
  }
  await page.close();
 }
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const native=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts);
 for(const v of native.variants)assert.equal(v.spec.children?.length,1);
});
test('missing capture does not invent a shape-kind branch',()=>{
 const set=fixture();delete set.variants[1].children[0].shape;
 assert(!propose(set).notes.some(n=>n.includes('source-shape-kind-partition')));
});
