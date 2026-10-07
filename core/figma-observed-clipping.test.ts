import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function propose(mode:'exact'|'reviewable-inversion',mixed=true){
 const v=(variant:string,clip:boolean)=>({name:'variant='+variant,variantProperties:{variant},type:'COMPONENT',clipsContent:clip,bbox:{width:100,height:20},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[]});
 return proposeFromDump({setName:'ObservedClip',type:'COMPONENT_SET',propertyDefinitions:{variant:{type:'VARIANT',defaultValue:'outline',variantOptions:['outline','subtle']}},variants:[v('outline',true),v('subtle',!mixed)]} as any,{corpus,contractIdByName:new Map(),projectionMode:mode,mintUnbound:true});
}
test('reviewable observed mixed clipping carries both planes without claiming authored intent',()=>{
 const p=propose('reviewable-inversion');const c=ContractSchema.parse(p.contract);
 assert.deepEqual(c.anatomy.root.stylesWhen,[{prop:'variant',equals:'outline',styles:{overflow:'hidden'}},{prop:'variant',equals:'subtle',styles:{overflow:'visible'}}]);
 assert.ok(p.notes.some(n=>n.includes('does not assert authored intent')));
});
test('uniform and conditional clipping preserve observed pixels without claiming authored intent',()=>{
 const c=ContractSchema.parse(propose('reviewable-inversion',false).contract);
 assert.equal(c.anatomy.root.declared?.['overflow-x'],'hidden');
 assert.equal(c.anatomy.root.declared?.['overflow-y'],'hidden');
 const exact=propose('exact');assert.deepEqual(ContractSchema.parse(exact.contract).anatomy.root.stylesWhen,[{prop:'variant',equals:'outline',styles:{overflow:'hidden'}},{prop:'variant',equals:'subtle',styles:{overflow:'visible'}}]);
 assert.ok(exact.notes.some(n=>n.includes('does not assert authored intent')));
});
