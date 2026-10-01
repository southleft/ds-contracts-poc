import assert from 'node:assert/strict';
import test from 'node:test';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';

const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
function compile(rules:unknown[],declared?:Record<string,string>){
 const c=ContractSchema.parse({id:'fixture.clipping',name:'Clipping',version:'1.0.0',description:'Conditional clipping compiler regression',states:[],semantics:{element:'div'},
 props:[{name:'variant',type:{enum:['outline','subtle']},default:'outline',bindings:{code:{prop:'variant'},figma:{kind:'VARIANT',property:'Variant',values:{outline:'Outline',subtle:'Subtle'}}}}],
 anatomy:{root:{layout:{display:'flex',direction:'row'},literals:{width:'100px',height:'20px'},declared,stylesWhen:rules}},
 bindings:{code:{anchors:{importPath:'./Clipping',export:'Clipping'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 return engine.compileComponentData(c,new Map([[c.id,c]])).variants;
}
test('conditional overflow preserves distinct clipped and visible native variants',()=>{
 const variants=compile([{prop:'variant',equals:'outline',styles:{overflow:'hidden'}},{prop:'variant',equals:'subtle',styles:{overflow:'visible'}}]);
 assert.equal(variants.length,2);
 assert.equal(variants.find(v=>v.name.includes('Outline'))?.spec.clipsContent,true);
 assert.equal(variants.find(v=>v.name.includes('Subtle'))?.spec.clipsContent,undefined);
});
test('matching visible overrides base clipping and later matching clip wins',()=>{
 const visible=[{prop:'variant',equals:'subtle',styles:{overflow:'visible'}}];
 const base={'overflow-x':'hidden','overflow-y':'hidden'};
 assert.equal(compile(visible,base).find(v=>v.name.includes('Subtle'))?.spec.clipsContent,undefined);
 assert.equal(compile([...visible,{prop:'variant',equals:'subtle',styles:{overflow:'clip'}}],base).find(v=>v.name.includes('Subtle'))?.spec.clipsContent,true);
 assert.equal(compile(visible,base).find(v=>v.name.includes('Outline'))?.spec.clipsContent,true);
});
