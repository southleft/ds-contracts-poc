import assert from 'node:assert/strict';
import test from 'node:test';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const constraints={horizontal:'SCALE',vertical:'SCALE'} as const;
function fixture():DumpSet{return{setName:'Layered',type:'COMPONENT',variants:[{name:'Layered',type:'COMPONENT',bbox:{width:20,height:20},children:[{name:'layers',type:'GROUP',abs:{x:0,y:0,right:0,bottom:0,width:20,height:20,constraints},children:[{name:'ground',type:'RECTANGLE',fill:{hex:'112233'},shape:{kind:'rect',x:0,y:0,right:0,bottom:0,width:20,height:20,constraints}},{name:'detail',type:'RECTANGLE',fill:{hex:'ff0000'},shape:{kind:'rect',x:4,y:3,right:4,bottom:3,width:12,height:14,constraints}}]}]}]};}
function read(set=fixture()){const result=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});const contract=ContractSchema.parse(result.contract);return{result,contract,detail:walkAnatomy(contract).find(x=>x.name==='detail')!.part};}
test('free-group rectangles retain their captured coordinate plane instead of entering flex flow',()=>{
 const source=fixture(),before=JSON.stringify(source),{detail}=read(source);
 assert.deepEqual(detail.absoluteGeometry?.parent,{width:20,height:20});assert.deepEqual(detail.absoluteGeometry?.box,{x:4,y:3,right:4,bottom:3,width:12,height:14,constraints});
 assert.equal(detail.tokens?.width,undefined);assert.equal(detail.tokens?.left,undefined);assert.equal(detail.literals?.width,undefined);assert.equal(JSON.stringify(source),before);
});
test('free-group coordinate carriage cannot infer missing constraints, override authored sizes or repair inconsistent bounds',()=>{
 for(const kind of ['constraints','bound','parent','rotation'] as const){const set=fixture(),group=set.variants[0].children![0],child=group.children![1];
  if(kind==='constraints')delete child.shape!.constraints;
  if(kind==='bound')child.bound={width:'authored.width'};
  if(kind==='parent')group.fixedSize={width:21,height:20};
  if(kind==='rotation')child.shape!.rotation=45;
  const {detail}=read(set);assert.equal(detail.absoluteGeometry,undefined,kind);
 }
});
test('both React surfaces place overlapping group rectangles at source coordinates and preserve proportional resize',async t=>{
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js'),{emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const {result,contract}=read(),tokens={primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),scope=new Map([[contract.id,contract]]);
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 for(const output of [emitReact(contract,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts:scope}),{...emitReactInline(contract,{tokens,icons:new Map(),contracts:scope}),css:''}]){
  const page=await browser.newPage({viewport:{width:80,height:80}});try{
   const render=await mountGenerated(page,contract.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
   for(const size of [20,40,20]){await render({style:{width:size,height:size}});const actual=await page.evaluate(()=>{const element=[...document.querySelectorAll('div')].find(n=>getComputedStyle(n).backgroundColor==='rgb(255, 0, 0)');if(!element)throw Error('drawn red detail missing');return element.getBoundingClientRect().toJSON();});
    assert.equal(actual.x,size*.2);assert.equal(actual.y,size*.15);assert.equal(actual.width,size*.6);assert.equal(actual.height,size*.7);
   }
  }finally{await page.close();}
 }
});
