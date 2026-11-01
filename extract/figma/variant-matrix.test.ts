import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesMatrix,variantMatrix,VARIANT_CAP,type VariantMatrix} from './variant-matrix.js';
import type {DumpSet} from './types.js';

const ok = (r:ReturnType<typeof variantMatrix>):VariantMatrix => { assert.equal(r.status,'ok'); return (r as {matrix:VariantMatrix}).matrix; };

test('option-list arguments are the axes and their product is the variants; true/false, text and actions are not axes', () => {
  const m = ok(variantMatrix({
    tone:{control:'radio',options:['neutral','critical','positive']},size:{type:{name:'enum',value:['sm','md']}},
    disabled:{type:{name:'boolean'}},label:{control:'text'},onClick:{type:{name:'function'}},
  }));
  assert.deepEqual(m.axes,[{name:'size',options:['sm','md']},{name:'tone',options:['neutral','critical','positive']}]);
  assert.equal(m.variants.length,6);
  assert.deepEqual(m.variants[0],{size:'sm',tone:'neutral'});
  assert.deepEqual(m.variants.at(-1),{size:'md',tone:'positive'});
  assert.deepEqual(ok(variantMatrix({label:{control:'text'}})),{axes:[],variants:[{}]});
});

test('a product over the cap, or a repeated option, is refused by name instead of cut', () => {
  const four = ['a','b','c','d'];
  assert.deepEqual(variantMatrix({a:{options:four},b:{options:four},c:{options:[...four,'e']}}),{status:'refused',reason:`variant-matrix-over-cap:80>${VARIANT_CAP}`,count:80});
  assert.equal(ok(variantMatrix({a:{options:four},b:{options:four},c:{options:four}})).variants.length,64);
  assert.deepEqual(variantMatrix({tone:{options:['a','a']}}),{status:'refused',reason:'variant-matrix-repeated-option:tone',count:2});
});

test('a set read back from Figma matches only when every axis, option and variant is there and nothing extra', () => {
  const m = ok(variantMatrix({size:{options:['sm','md']},tone:{options:['a','b']}}));
  const variants = m.variants.map(variantProperties => ({name:'v',type:'COMPONENT',variantProperties}));
  const set = (over:Partial<DumpSet> = {}):DumpSet => ({setName:'Badge',type:'COMPONENT_SET',variants,propertyDefinitions:{
    size:{type:'VARIANT',defaultValue:'sm',variantOptions:['md','sm']},tone:{type:'VARIANT',defaultValue:'a',variantOptions:['a','b']},Icon:{type:'BOOLEAN',defaultValue:true}},...over});
  assert.deepEqual(matchesMatrix(set(),m),[]);
  assert.deepEqual(matchesMatrix(set({variants:[...variants.slice(1),variants[1]!]}),m),['variant-duplicate:size=sm, tone=b','variant-missing:size=sm, tone=a']);
  assert.deepEqual(matchesMatrix(set({propertyDefinitions:{size:{type:'VARIANT',defaultValue:'sm',variantOptions:['sm','md','lg']},Shape:{type:'VARIANT',defaultValue:'x',variantOptions:['x']}}}),m),
    ['axis-extra:Shape','axis-missing:tone','options-differ:size']);
  assert.deepEqual(matchesMatrix(set({variants:[...variants,{name:'v',type:'COMPONENT',variantProperties:{size:'lg',tone:'a'}}]}),m),['variant-extra:size=lg, tone=a']);
});

import {storyVariantMatrix, type StoryInput} from './variant-matrix.js';
const s = (id:string, args:Record<string,unknown>, over:Partial<StoryInput> = {}):StoryInput => ({id, args, argTypes:{}, ownRender:false, ...over});

test('variants shown as stories: each story is one variant, its varying arguments are the axes, nothing is combined', () => {
  const r = storyVariantMatrix([s('a',{tone:'info',label:'Hi'}),s('b',{tone:'error',label:'Hi'}),s('c',{tone:'error',label:'Hi',dense:true}),s('grid',{},{ownRender:true})]);
  assert.equal(r.status,'ok');
  const m = (r as {matrix:VariantMatrix}).matrix;
  assert.deepEqual(m.axes,[{name:'dense',options:['(default)','true']},{name:'tone',options:['info','error']}]);
  assert.deepEqual(m.variants,[{dense:'(default)',tone:'info'},{dense:'(default)',tone:'error'},{dense:'true',tone:'error'}]);
  assert.deepEqual(r.ownRender,['grid']);
});

test('an option list spans its whole list inside each story; stories that differ only in it add nothing', () => {
  const argTypes = {size:{control:'select',options:['sm','md']}};
  const r = storyVariantMatrix([s('a',{size:'sm',tone:'info'},{argTypes}),s('b',{size:'md',tone:'info'},{argTypes}),s('c',{size:'sm',tone:'error'},{argTypes})]);
  assert.deepEqual((r as {matrix:VariantMatrix}).matrix.variants,[{tone:'info',size:'sm'},{tone:'info',size:'md'},{tone:'error',size:'sm'},{tone:'error',size:'md'}]);
  // Each variant is drawn from the first story showing its story axes, with the listed option set to its own value.
  assert.deepEqual(r.renders,[{storyId:'a',args:{size:'sm'}},{storyId:'a',args:{size:'md'}},{storyId:'c',args:{size:'sm'}},{storyId:'c',args:{size:'md'}}]);
  const n = storyVariantMatrix([s('a',{n:1},{argTypes:{n:{options:[1,2]}}})]);
  assert.deepEqual(n.renders.map(x=>x.args.n),[1,2],'option values stay as the story declares them, not as text');
});

test('each story spans its own option list; stories listing different option arguments are refused by name', () => {
  const r = storyVariantMatrix([s('ok',{tone:'okHigh'},{argTypes:{tone:{options:['okHigh','okLow']}}}),s('bad',{tone:'badHigh'},{argTypes:{tone:{options:['badHigh']}}})]);
  assert.deepEqual((r as {matrix:VariantMatrix}).matrix,{axes:[{name:'tone',options:['okHigh','okLow','badHigh']}],variants:[{tone:'okHigh'},{tone:'okLow'},{tone:'badHigh'}]});
  assert.deepEqual(r.renders,[{storyId:'ok',args:{tone:'okHigh'}},{storyId:'ok',args:{tone:'okLow'}},{storyId:'bad',args:{tone:'badHigh'}}]);
  const differ = storyVariantMatrix([s('a',{k:1},{argTypes:{tone:{options:['x']}}}),s('b',{k:2},{argTypes:{size:{options:['y']}}})]);
  assert.equal((differ as {reason:string}).reason,'variant-matrix-option-axes-differ');
});

test('a repeat counts once and is named; only own-render or unrendered stories, or more than 64 variants, are refused', () => {
  const r = storyVariantMatrix([s('a',{tone:'x'}),s('b',{tone:'x'}),s('c',{tone:'y'}),s('broken',{tone:'z'},{renderFailed:true})]);
  assert.deepEqual([r.status,(r as {matrix:VariantMatrix}).matrix.variants.length,r.repeats,r.renderFailed],['ok',2,['b'],['broken']]);
  assert.deepEqual(storyVariantMatrix([s('grid',{},{ownRender:true})]),{status:'refused',reason:'variant-matrix-no-story-variants',count:0,ownRender:['grid'],repeats:[],renderFailed:[],renders:[]});
  const many = Array.from({length:65},(_,i)=>s(`v${i}`,{tone:`t${i}`}));
  assert.equal((storyVariantMatrix(many) as {reason:string}).reason,'variant-matrix-over-cap:65>64');
});

import {rendersOneInstance} from './variant-matrix.js';
test('own render from the rendered page: exactly one instance, wrappers allowed, nothing beside it', () => {
  const one = {i: true as const, c: [{h: true as const}]};
  assert.equal(rendersOneInstance({h: true, c: [{h: true, c: [one]}]}), true, 'decorator and theme wrappers around the instance');
  assert.equal(rendersOneInstance({h: true, c: [one, {...one}]}), false, 'a grid of two instances');
  assert.equal(rendersOneInstance({h: true, c: [one, {h: true}]}), false, 'other content beside the instance');
  assert.equal(rendersOneInstance({h: true, c: [{h: true}]}), false, 'no instance at all');
  assert.equal(rendersOneInstance({c: [{i: true, c: [{i: true}]}]}), true, 'the component nested inside its own instance is its content');
});
