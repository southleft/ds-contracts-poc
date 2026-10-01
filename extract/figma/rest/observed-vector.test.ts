import test from 'node:test';
import assert from 'node:assert/strict';
import {observeInstanceVector} from './observed-vector.js';
import type {RestNode} from './map.js';
const components=new Map([['main',{key:'actual-key'}]]);
const sample=():RestNode=>({id:'use',name:'Instance',type:'INSTANCE',componentId:'main',size:{x:24,y:24},fills:[],strokes:[],effects:[],children:[{
 id:'vector',name:'Vector',type:'VECTOR',size:{x:20,y:19},relativeTransform:[[1,0,2],[0,1,2.5]],
 fills:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}],strokes:[],effects:[],
 fillGeometry:[{path:'M0 0L20 0L10 19Z',windingRule:'NONZERO'}],
}]});
test('preserves exact source identity, geometry and observed paint',()=>{
 const n=sample(),o=observeInstanceVector(n,components)!;
 assert.deepEqual(o.source,[{nodeId:'use',componentId:'main',key:'actual-key'}]);
 assert.equal(o.shape.x,2);assert.equal(o.shape.y,2.5);assert.equal(o.vector,n.children![0]);
 assert.equal(n.type,'INSTANCE');assert.equal(o.shape.paths[0]!.data,'M0 0L20 0L10 19Z');
});
test('refuses missing source authority and mutable API',()=>{
 assert.equal(observeInstanceVector(sample(),new Map()),undefined);
 const n=sample();n.componentProperties={Label:{type:'TEXT',value:'a'}};
 assert.equal(observeInstanceVector(n,components),undefined);
});
test('refuses transforms, clipping loss, external paths and extra content',()=>{
 const mutations:Array<(n:RestNode)=>void>=[
  n=>{n.children![0]!.relativeTransform=[[2,0,2],[0,1,2.5]];},
  n=>{n.children![0]!.relativeTransform=[[1,0,8],[0,1,2.5]];},
  n=>{n.children![0]!.fillGeometry![0]!.path='M0 0L25 0L10 19Z';},
  n=>{n.children!.push(structuredClone(n.children![0]!));},
  n=>{n.children![0]!.fills!.push({type:'SOLID',color:{r:0,g:0,b:0,a:1}});},
  n=>{n.opacity=.5;},n=>{n.cornerRadius=4;},n=>{n.isMask=true;},
 ];
 for(const mutate of mutations){const n=sample();mutate(n);assert.equal(observeInstanceVector(n,components),undefined);}
});
