import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';import {mountGenerated} from './react-test-runtime.js';import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function source():DumpSet{return {setName:'Conditional bound',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}},variants:['Small','Large'].flatMap(size=>['A','B'].map(mode=>({name:`Size=${size}, Mode=${mode}`,type:'COMPONENT',variantProperties:{Size:size,Mode:mode},bbox:{width:20,height:size==='Large'&&mode==='B'?60:20},...(size==='Large'&&mode==='B'?{minHeight:60}:{}),layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Mark',type:'RECTANGLE',shape:{kind:'rect',width:20,height:20}}]}))) };}
function propose(set:DumpSet){const result=proposeFromDump(set,{corpus,contractIdByName:new Map(),mintUnbound:true,projectionMode:'exact',fileKey:'fixture'});const contract=ContractSchema.parse(result.contract),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};return{result,contract,tokens};}
test('partial minimum height survives actual React rendering and native compilation only on its observed tuple',async t=>{
 const set=source(),before=JSON.stringify(set),{contract:c,tokens}=propose(set);assert.equal(JSON.stringify(set),before);
 const rows=c.anatomy.root.literalsByCombination!.flatMap(t=>t.rows);assert.equal(rows.length,1);assert.equal(rows[0].literals['min-height'],'60px');
 const contracts=new Map([[c.id,c]]),tsx=emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx;
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();const render=await mountGenerated(page,c.name,tsx);
 for(const size of ['small','large'])for(const mode of ['a','b']){await render({size,mode});const height=await page.locator('#root > :first-child').evaluate(e=>getComputedStyle(e).minHeight);assert.equal(height,size==='large'&&mode==='b'?'60px':'0px');}
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 for(const v of data.variants)assert.equal(v.spec.lits?.minHeight,v.name==='Size=Large, Mode=B'?60:undefined);
});
test('partial bounds remain exact for nested parts, retain omission and refuse invalid values',()=>{
 const set=source();for(const v of set.variants){v.children![0].minWidth=v.minHeight;delete v.minHeight;}
 const {contract:c}=propose(set);assert.equal(Object.values(c.anatomy.root.parts!)[0].literalsByCombination![0].rows[0].literals['min-width'],'60px');
 const invalid=source();invalid.variants[3].minHeight=-1;assert.equal(propose(invalid).contract.anatomy.root.literalsByCombination,undefined);
});

test('partial minima do not silently add competing authority to zero-basis growing items',()=>{
 const set=source();for(const v of set.variants){const child=v.children![0];v.children=[{name:'Growing',type:'FRAME',fillHeight:true,...(v.minHeight?{minHeight:v.minHeight}:{}),layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'AUTO'},children:[child]}];delete v.minHeight;}
 const {contract:c,result}=propose(set);const part=Object.values(c.anatomy.root.parts!)[0];
 assert.equal(part.layout?.growBasis,'zero');assert.equal(part.literalsByCombination,undefined);
 assert(result.notes.some(n=>n.includes('competes with a growing plane')));
});
test('a linked child keeps its observed minimum and a constrained-growth caller still refuses explicitly',()=>{
 const {contract:child,tokens}=propose(source());
 const parent=ContractSchema.parse({...child,id:'test.bound-parent',name:'BoundParent',props:[],anatomy:{root:{literals:{width:'200px'},layout:{display:'flex'},parts:{child:{component:{id:child.id,props:{size:'large',mode:'b'}},layout:{grow:true,growBasis:'zero'}}}}}});
 const contracts=new Map([[child.id,child],[parent.id,parent]]);
 assert.throws(()=>emitReactInline(parent,{tokens,contracts,icons:new Map()}),/growth-constraint-unproven/);
 assert.equal(child.anatomy.root.literalsByCombination![0].rows[0].literals['min-height'],'60px','a caller refusal must not erase an independently observed child bound');
});
