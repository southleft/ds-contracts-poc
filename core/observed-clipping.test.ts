import test from 'node:test';import assert from 'node:assert/strict';
import {ContractSchema} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function read(set:any){const result=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map(),projectionMode:'exact',fileKey:'fixture'});return {...result,contract:ContractSchema.parse(result.contract)};}
function fixture(clips:boolean[]){return {setName:'Viewport',type:'COMPONENT_SET',propertyDefinitions:{Kind:{type:'VARIANT',defaultValue:'Clipped',variantOptions:['Clipped','Open']}},variants:['Clipped','Open'].map((kind,i)=>({name:'Kind='+kind,type:'COMPONENT',variantProperties:{Kind:kind},bbox:{width:100,height:20},clipsContent:clips[i]||undefined,children:[{name:'Range',type:'FRAME',bbox:{width:100,height:20},clipsContent:true}]}))};}
test('exact foreign observation carries uniform clipping without claiming authorship',()=>{
 const result=read(fixture([true,true]));const root:any=result.contract.anatomy.root;
 assert.equal(root.declared['overflow-x'],'hidden');assert.equal(root.declared['overflow-y'],'hidden');
 assert(result.notes.some(n=>n.includes('no authorship or design-intent claim')));
});
test('exact foreign enum variants preserve both clipped and visible planes',()=>{
 const root:any=read(fixture([true,false])).contract.anatomy.root;
 assert.deepEqual(root.stylesWhen,[{prop:'kind',equals:'clipped',styles:{overflow:'hidden'}},{prop:'kind',equals:'open',styles:{overflow:'visible'}}]);
 assert.equal(root.declared?.['overflow-x'],undefined);
});
test('absent clipping does not invent an overflow declaration',()=>{
 const root:any=read(fixture([false,false])).contract.anatomy.root;
 assert.equal(root.declared?.['overflow-x'],undefined);assert.equal(root.stylesWhen,undefined);
});
test('conflicting observations within one enum value cannot become conditional clipping',()=>{
 const set:any=fixture([true,false]);set.propertyDefinitions.Size={type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']};set.variants=set.variants.flatMap((v:any,i:number)=>['Small','Large'].map((size,j)=>({...v,name:v.name+', Size='+size,variantProperties:{...v.variantProperties,Size:size},clipsContent:(i===j)||undefined})));
 const result=read(set),root:any=result.contract.anatomy.root;
 assert.equal(root.stylesWhen,undefined);assert(result.notes.some(n=>n.includes('no complete enum-axis clipping correlation')));
});
