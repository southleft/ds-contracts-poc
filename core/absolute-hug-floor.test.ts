import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function proposal(absolute:boolean, mixed=false){
 const variant=(size:string,height:number)=>({name:'size='+size,type:'COMPONENT',bbox:{width:100,height},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:mixed && size==='large'?'FIXED':'AUTO',counterSizing:'FIXED'},children:[{name:'Content',type:'FRAME',fill:{hex:'333333'},fixedSize:{width:100,height},...(absolute?{abs:{x:0,y:0,right:0,bottom:0,width:100,height,constraints:{horizontal:'LEFT',vertical:'TOP'}}}:{})}]});
 return proposeFromDump({setName:'MeasuredTrack',type:'COMPONENT_SET',propertyDefinitions:{size:{type:'VARIANT',defaultValue:'small',variantOptions:['small','large']}},variants:[variant('small',6),variant('large',12)]} as any,{corpus,contractIdByName:new Map(),projectionMode:'reviewable-inversion',mintUnbound:true});
}
test('absolute-only HUG roots retain their measured minimum and keep HUG semantics',()=>{
 const p=proposal(true),c=ContractSchema.parse(p.contract);
 assert.equal(c.anatomy.root.literals?.height,'fit-content');
 assert.ok(c.anatomy.root.tokens?.['min-height']);
 const entries=p.mintedTokens?.entries.filter(e=>e.usageSites.some(site=>site.includes('min-height')));
 assert.ok(entries?.some(e=>e.value==='6px'));
 assert.ok(entries?.some(e=>e.value==='12px'));
});
test('ordinary in-flow HUG content does not acquire a frozen minimum',()=>{
 const c=ContractSchema.parse(proposal(false).contract);
 assert.equal(c.anatomy.root.literals?.height,'fit-content');
 assert.equal(c.anatomy.root.tokens?.['min-height'],undefined);
});

test('mixed FIXED/HUG planes receive a minimum only on the absolute HUG plane',()=>{
 const p=proposal(true,true),c=ContractSchema.parse(p.contract);
 assert.ok(c.anatomy.root.tokens?.height);
 assert.ok(c.anatomy.root.tokens?.['min-height']);
 const entries=p.mintedTokens?.entries.filter(e=>e.usageSites.some(site=>site.includes('min-height')));
 assert.ok(entries?.some(e=>e.value==='6px'));
 assert.ok(entries?.some(e=>e.value==='0px'));
 assert.ok(!entries?.some(e=>e.value==='12px'));
});
