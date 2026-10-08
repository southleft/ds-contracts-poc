import test from 'node:test';
import assert from 'node:assert/strict';
import {observeInstanceComposition} from './observed-composition.js';
import type {RestNode} from './map.js';

const identities=new Map([['remote',{key:'exact-key'}]]);
const fixture=():RestNode=>({id:'usage',name:'Indicator',type:'INSTANCE',componentId:'remote',size:{x:16,y:16},
 relativeTransform:[[1,0,2],[0,1,5]],clipsContent:false,componentPropertyReferences:{visible:'Loading Start'},
 componentProperties:{Label:{type:'BOOLEAN',value:true},Color:{type:'VARIANT',value:'Inherit'}},
 children:[{id:'ring',name:'Ring',type:'FRAME',size:{x:16,y:16},relativeTransform:[[1,0,0],[0,1,0]],clipsContent:false,
 children:[{id:'ink',name:'Line',type:'VECTOR',size:{x:16,y:16},relativeTransform:[[1,0,0],[0,1,0]],
 strokes:[{type:'SOLID',color:{r:0,g:0,b:0,a:1},opacity:.26}],
 strokeGeometry:[{path:'M-0.75 0L16.75 0L16 1Z',windingRule:'NONZERO'}]} as RestNode]}]});

test('retains caller visibility, typed inputs, overflow and original stroke authority without mutation',()=>{
 for(const visible of [true,false]){
  const n=fixture();n.visible=visible;const before=structuredClone(n),out=observeInstanceComposition(n,identities)!;
  assert(out);assert.deepEqual(n,before);assert.deepEqual(out.root,n);
  assert.deepEqual(out.source,{nodeId:'usage',componentId:'remote',key:'exact-key'});
  assert.equal(out.appliedProperties.Label.value,true);assert.equal(out.callerBindings.visible,'Loading Start');
  assert.equal(out.strokeOutlines.ink[0].path,'M-0.75 0L16.75 0L16 1Z');
  out.root.name='Independent';out.strokeOutlines.ink[0].path='M0 0Z';assert.deepEqual(n,before);
 }
});
test('cannot substitute another identity, a mutable swap, nested main, mask or unsupported paint',()=>{
 assert.equal(observeInstanceComposition(fixture(),new Map()),undefined);
 const mutations:Array<(n:any)=>void>=[
  n=>n.componentPropertyReferences.mainComponent='Icon',
  n=>n.componentProperties.Label={type:'TEXT',value:'Title'},
  n=>n.children[0].type='INSTANCE',
  n=>n.children[0].children[0].isMask=true,
  n=>n.children[0].children[0].strokes[0].type='IMAGE',
  n=>n.children[0].children[0].componentPropertyReferences={visible:'Label'},
  n=>n.children[0].relativeTransform=[[0,-1,0],[1,0,0]],
  n=>n.children[0].children.push(structuredClone(n.children[0].children[0])),
  n=>n.children[0].children[0].strokeGeometry[0].path='M0 0CNaN 0 0 0 1 1',
 ];
 for(const mutate of mutations){const n=fixture();mutate(n);assert.equal(observeInstanceComposition(n,identities),undefined);}
});

// A filled vector inside painted component chrome is not a simple icon snapshot.
test('retains solid filled paths inside painted caller chrome without changing path or paint',()=>{
 const n=fixture();n.fills=[{type:'SOLID',color:{r:0,g:.4,b:.8,a:1}}];n.cornerRadius=3;
 const ink=n.children![0].children![0];ink.strokes=[];
 ink.fills=[{type:'SOLID',color:{r:1,g:1,b:1,a:1},opacity:.7}];
 ink.fillGeometry=[{path:'M-1 0L17 0L8 16Z',windingRule:'EVENODD'}];
 const before=structuredClone(n),out=observeInstanceComposition(n,identities);assert(out);
 assert.deepEqual(out.root,before);assert.deepEqual(out.strokeOutlines,{});assert.deepEqual(n,before);
 for(const mutate of [
  (v:RestNode)=>{v.fillGeometry=undefined;},
  (v:RestNode)=>{v.fillGeometry![0].path='MNaN 0Z';},
  (v:RestNode)=>{v.strokes=[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}];},
  (v:RestNode)=>{v.fills!.push(v.fills![0]);},
 ]){const bad=structuredClone(n);mutate(bad.children![0].children![0]);assert.equal(observeInstanceComposition(bad,identities),undefined);}
});


test('root rigid matrix is retained exactly while scale and transformed descendants remain refused',()=>{
 const n=fixture();n.relativeTransform=[[1,5.551115123125783e-17,2],[-5.551115123125783e-17,1,5]];
 const before=structuredClone(n);assert.deepEqual(observeInstanceComposition(n,identities)?.root,before);
 for(const matrix of [[[2,0,2],[0,1,5]],[[1,.1,2],[0,1,5]]]){
  const bad=structuredClone(n);bad.relativeTransform=matrix;
  assert.equal(observeInstanceComposition(bad,identities),undefined);
 }
});
