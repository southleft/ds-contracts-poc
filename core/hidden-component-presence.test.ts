import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHiddenComponentPresence} from './hidden-component-presence.js';
const f=JSON.parse(readFileSync(new URL('./fixtures/hidden-tile-instances.json',import.meta.url),'utf8'));
const observed=f.axes[0].values.map((value:string)=>({values:[value],present:false}));
const contract=(part:any):any=>({anatomy:{root:{parts:{usage:part}}}});
test('all six actual Tile owners retain child identity and permanent absence after linking',()=>{
 assert.equal(f.rows.length,6);
 for(const row of f.rows){const part=structuredClone(row.part),child=structuredClone(part.component);
  assert.equal(normalizeHiddenComponentPresence(contract(part),f.axes,observed).length,1,row.path.join('/'));
  assert.deepEqual(part.component,child);assert.equal(part.declared?.display,undefined);
  assert.equal(part.absoluteGeometryByCombination,undefined);
  assert.deepEqual(part.presenceByCombination.rows.map((r:any)=>r.present),observed.map(()=>false));
  assert.equal(normalizeHiddenComponentPresence(contract(part),f.axes,observed).length,0);
 }
});
test('visibility controls and conditional display are never replaced with permanent absence',()=>{
 for(const extra of [{visibilityOverrideProp:'show'},{declaredStates:{hover:{display:'block'}}},{stylesWhen:[{prop:'type',equals:'base',styles:{display:'block'}}]},{tokensByProp:{prop:'type',map:{base:{display:'block'}}}}]){
  const part={...structuredClone(f.rows[0].part),...extra},before=JSON.stringify(part);
  assert.deepEqual(normalizeHiddenComponentPresence(contract(part),f.axes,observed),[]);assert.equal(JSON.stringify(part),before);
 }
 const part=structuredClone(f.rows[0].part);assert.throws(()=>normalizeHiddenComponentPresence(contract(part),f.axes,[]),/presence-domain-unqualified/);
});

import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {resolvePresence} from '../scripts/contract-schema.js';
test('structural Boolean presence does not erase an independent captured hidden condition',()=>{
 const set:any={setName:'IndependentVisibility',type:'COMPONENT_SET',propertyDefinitions:Object.fromEntries(['Flush','Expanded'].map(name=>[name,{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']}]))};
 set.variants=['False','True'].flatMap(Flush=>['False','True'].map(Expanded=>({name:`Flush=${Flush}, Expanded=${Expanded}`,type:'COMPONENT',variantProperties:{Flush,Expanded},bbox:{width:100,height:20},children:Flush==='False'?[{name:'Content',type:'FRAME',hidden:Expanded==='False',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},fixedSize:{width:100,height:20},fill:{hex:'ff0000'},children:[{name:'Ink',type:'RECTANGLE',shape:{kind:'rect',width:8,height:8}}]}]:[]})));
 const c=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map()}).contract as any;
 const part=Object.values(c.anatomy.root.parts)[0] as any;
 assert.deepEqual(part.visibleWhen,{prop:'flush',equals:false});
 assert(part.presenceByCombination,'captured hidden states need a separate complete gate');
 for(const flush of [false,true])for(const expanded of [false,true])assert.equal(resolvePresence(part,{flush,expanded}),!flush&&expanded);
});
test('inferred Style API leaves React host style available and avoids existing code names',()=>{
 const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
 const set:any={setName:'StyleBinding',type:'COMPONENT_SET',propertyDefinitions:{Style:{type:'VARIANT',defaultValue:'Ghost',variantOptions:['Ghost','Primary']},styleProp:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']}},variants:['Ghost','Primary'].flatMap(style=>['One','Two'].map(other=>({name:`Style=${style}, styleProp=${other}`,variantProperties:{Style:style,styleProp:other},type:'COMPONENT',bbox:{width:16,height:16},fill:{hex:style==='Ghost'?'ffffff':'000000'}})))};
 const c=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()}).contract as any;
 const style=c.props.find((p:any)=>p.name==='style');assert.equal(style.bindings.figma.property,'Style');assert.equal(style.bindings.code.prop,'styleProp2');
 assert.equal(c.props.find((p:any)=>p.name==='styleProp').bindings.code.prop,'styleProp');
});
