import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
import {mapRestToDump} from './rest/map.js';
test('canonical native and REST readers preserve local variant main keys independently of set identity',async()=>{
 const {figma:mock}=createFigmaMock();const figma:any=mock;
 const variants=['One','Two'].map((value,i)=>{const n=figma.createComponent();n.name='State='+value;(n as any).key=String(i+1).repeat(40);return n;});
 const set=figma.combineAsVariants(variants,figma.currentPage);set.name='MainKeyCapture';(set as any).key='a'.repeat(40);
 const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["MainKeyCapture"];');
 const native=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}\n})()`,{figma,console:{log(){},warn(){},error(){}}})));
 const document={id:set.id,name:set.name,type:'COMPONENT_SET',children:variants.map(n=>({id:n.id,name:n.name,type:'COMPONENT',children:[]}))};
 const rest=mapRestToDump({name:'main identities',nodes:{set:{document,components:Object.fromEntries(variants.map(n=>[n.id,{name:n.name,key:(n as any).key,componentSetId:set.id}])),componentSets:{[set.id]:{key:(set as any).key,name:set.name}}}}}).dump as any;
 for(const dump of [native,rest])assert.deepEqual(dump.MainKeyCapture.variants.map((n:any)=>n.componentKey),variants.map(n=>(n as any).key));
 const missing=mapRestToDump({name:'missing identity',nodes:{set:{document}}}).dump as any;
 assert(missing.MainKeyCapture.variants.every((n:any)=>n.componentKey===undefined));
});
