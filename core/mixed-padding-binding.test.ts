import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function read(bound:Record<string,string>){
 const set:any={setName:'Mixed padding',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'S0',variantOptions:['S0','S1','S2','S3']}},variants:[3,7,11,15].map((pad,i)=>({
  name:`Size=S${i}`,type:'COMPONENT',variantProperties:{Size:`S${i}`},
  layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},
  children:[{name:'Content',type:'FRAME',bound,layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[pad,16,pad,16]}}]
 }))};
 return proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});
}
test('horizontal padding bindings preserve independent vertical size observations',()=>{
 const r=read({paddingLeft:'horizontal',paddingRight:'horizontal'}),c:any=r.contract;
 const p=c.anatomy.root.parts.Content;
 assert.equal(p.tokens['padding-inline'],'{horizontal}');
 assert(p.tokens['padding-block'].includes('{size}'));
 const entries=r.mintedTokens!.entries.filter(e=>e.usageSites.some(s=>s.includes('padding-block')));
 assert.deepEqual(entries.map(e=>e.value).sort(),['11px','15px','3px','7px']);
 assert.equal(p.tokens['padding-left'],undefined);assert.equal(p.tokens['padding-right'],undefined);
});
test('a binding on one side leaves the opposite measured side intact',()=>{
 const r=read({paddingLeft:'horizontal'}),c:any=r.contract,p=c.anatomy.root.parts.Content;
 assert.equal(p.tokens['padding-left'],'{horizontal}');
 assert(p.tokens['padding-right']);assert(p.tokens['padding-block']);
 assert.equal(p.tokens['padding-inline'],undefined);
});
