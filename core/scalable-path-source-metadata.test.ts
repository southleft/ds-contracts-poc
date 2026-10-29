import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const fixture=():any=>({setName:'Independent drawing',type:'COMPONENT',nodeId:'10:1',key:'key',variants:[{name:'Independent drawing',nodeId:'10:1',type:'COMPONENT',componentKey:'key',bbox:{width:30,height:20},clipsContent:true,sourceEmptyFill:true,sourceFillStack:{version:1,order:'bottom-to-top',complete:true,paints:[]},sourceStrokeStack:{version:1,order:'bottom-to-top',complete:true,paints:[]},sourceStrokePattern:{version:1,complete:true,dashes:[],defaulted:true},children:[{name:'ink',type:'VECTOR',fill:{hex:'224466'},shape:{kind:'path',width:18,height:12,x:6,y:4,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:'M0 0L18 0L18 12L0 12Z',windingRule:'NONZERO'}]}}]}]});
const read=(d:any)=>ContractSchema.parse(proposeFromDump(d,{corpus,mintUnbound:true,contractIdByName:new Map()}).contract);
test('empty complete paint captures preserve the source SCALE coordinate basis without changing source',()=>{
 const d=fixture(),before=JSON.stringify(d),c=read(d),part=c.anatomy.root.parts!.ink;
 assert.deepEqual(part.shape?.parentViewport,{width:30,height:20,x:6,y:4});
 assert.deepEqual(part.shape?.paths,d.variants[0].children[0].shape.paths);
 assert(c.anatomy.root.overridable?.includes('size'));assert(c.anatomy.root.overridable?.includes('color'));
 assert.equal(JSON.stringify(d),before);
 const noMetadata=fixture();for(const key of ['sourceFillStack','sourceStrokeStack','sourceStrokePattern'])delete noMetadata.variants[0][key];
 assert.deepEqual(read(noMetadata).anatomy.root.parts!.ink.shape,part.shape);
});
test('painted, incomplete, dashed and unknown source metadata cannot qualify a SCALE plane',()=>{
 const mutations=[
 (n:any)=>{n.sourceFillStack.paints=[{kind:'SOLID'}];},
 (n:any)=>{n.sourceFillStack.complete=false;},
 (n:any)=>{n.sourceStrokeStack.paints=[{kind:'SOLID'}];},
 (n:any)=>{n.sourceStrokeStack.order='top-to-bottom';},
 (n:any)=>{n.sourceStrokePattern.dashes=[1,1];},
 (n:any)=>{n.sourceStrokePattern.defaulted=false;},
 (n:any)=>{n.sourceStrokePattern.complete=false;},
 (n:any)=>{n.sourceStrokePattern.extra=true;},
 (n:any)=>{n.layout={mode:'HORIZONTAL',spacing:0,padding:[0,0,0,0],primary:'MIN',counter:'MIN'};},
 ];
 for(const mutate of mutations){const d=fixture();mutate(d.variants[0]);assert.equal(read(d).anatomy.root.parts!.ink.shape?.parentViewport,undefined);}
});
