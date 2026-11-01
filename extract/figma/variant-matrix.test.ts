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
