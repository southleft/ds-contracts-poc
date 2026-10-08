import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';
function fixture(bound=false){
 const primitives={locked:{width:{$type:'dimension',$value:'40px'}}};
 const set:any={setName:'StretchTrack',type:'COMPONENT_SET',variants:[{name:'Track',type:'COMPONENT',bbox:{width:40,height:12},children:[{name:'ink',type:'RECTANGLE',fill:{hex:'6750a4'},...(bound?{bound:{width:'locked.width'}}:{}),shape:{kind:'rect',width:40,height:4,x:0,y:4,right:0,bottom:4,constraints:{horizontal:'STRETCH',vertical:'TOP'}}}]}]};
 const p=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,projectionMode:'reviewable-inversion'});
 const c=ContractSchema.parse(p.contract),tokens={primitives:{...primitives,...p.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};return {c,tokens,p};
}
test('plain rectangle stretching never gains a queued fixed width and follows root resizing in both React emitters',async()=>{
 const {c,tokens,p}=fixture(),part=c.anatomy.root.parts!.ink!;
 assert.equal(part.tokens?.width,undefined);assert(part.tokens?.left);assert(part.tokens?.right);
 const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts).variants[0]!.spec.children![0]!;
 assert.equal(native.absolute?.h,'STRETCH');
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const code=inline?{...emitReactInline(c,{tokens,contracts,icons}),css:''}:emitReact(c,{tokens:new Set(p.mintedTokens!.entries.map(e=>e.ref.slice(1,-1))),contracts,icons});
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,code.tsx,code.css);
  await page.addStyleTag({content:':root{'+p.mintedTokens!.entries.map(e=>'--'+e.ref.slice(1,-1).replaceAll('.','-')+':'+e.value).join(';')+'}'});
  for(const width of [40,120,64]){await render({style:{width}});const root=page.locator('#root > *'),ink=root.locator(':scope > *');assert.equal((await root.boundingBox())!.width,width);assert.equal((await ink.boundingBox())!.width,width);}
  }finally{await page.close();}
 }}finally{await browser.close();}
});
test('an explicit source width binding still wins over a contradictory stretch',()=>{
 const {c}=fixture(true),part=c.anatomy.root.parts!.ink!;assert.equal(part.tokens?.width,'{locked.width}');assert.equal(part.tokens?.right,undefined);
});
