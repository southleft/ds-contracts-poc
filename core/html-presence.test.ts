import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {ContractSchema, type Contract} from '../scripts/contract-schema.js';
import {emitHtml} from './emit-html.js';
import {emitReactInline} from './emit-react-inline.js';

const tokens = {primitives:{}, semantic:{}, light:{}, dark:{}, brands:{default:{}}};
function specimen(): Contract {
  return ContractSchema.parse({id:'test.presence-html',name:'PresenceHtml',version:'0.1.0',status:'draft',
    description:'Finite HTML presence specimen; no live library fidelity claim.',archetype:'none',semantics:{element:'div'},states:[],
    props:[
      {name:'checked',type:'boolean',default:false,bindings:{code:{prop:'isChecked'},figma:{kind:'VARIANT',property:'Checked'}}},
      {name:'style',type:{enum:['solid','raised']},default:'solid',bindings:{code:{prop:'appearance'},figma:{kind:'VARIANT',property:'Style'}}},
      {name:'show',type:'boolean',default:true,bindings:{code:{prop:'showMark'},figma:{kind:'BOOLEAN',property:'Show mark'}}},
    ],anatomy:{root:{layout:{display:'flex'},parts:{mark:{text:'Moon',visibleWhen:{prop:'show'},presenceByCombination:{props:['checked','style'],rows:[
      {values:['false','solid'],present:true},{values:['false','raised'],present:false},
      {values:['true','solid'],present:false},{values:['true','raised'],present:false},
    ]}}}}},bindings:{code:{anchors:{importPath:'./PresenceHtml',export:'PresenceHtml'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
}
const context = (c:Contract, dependencies:Contract[] = []) => ({tokens:new Set<string>(),icons:new Map<string,string>(),
  contracts:new Map<string,Contract>([...dependencies.map(c=>[c.id,c] as const),[c.id,c]])});
const defaultItem = (html:string):string => {
  const found=html.match(/showcase__label">default<\/p>\n([\s\S]*?)\n  <\/div>/);
  assert(found,'the actual public HTML emitter includes its default showcase item');return found[1];
};
const items = (html:string) => [...html.matchAll(/class="showcase__item">\n    <p class="showcase__label">([^<]*)<\/p>\n([\s\S]*?)\n  <\/div>/g)]
  .map(match=>({label:match[1],html:match[2]}));
function reactSubject(c:Contract):React.ComponentType<any> {
  const output=emitReactInline(c,{...context(c),tokens}).tsx,module={exports:{} as any},require=createRequire(import.meta.url);
  vm.runInNewContext(transformSync(output,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require});
  return module.exports.PresenceHtml;
}

test('actual HTML snapshots and generated React conjoin finite Boolean/enum presence with independent visibility',()=>{
  const original=specimen(),before=JSON.stringify(original),Subject=reactSubject(original);
  for(const checked of [false,true])for(const style of ['solid','raised'])for(const show of [false,true]){
    const c=structuredClone(original);
    c.props.find(p=>p.name==='checked')!.default=checked;
    c.props.find(p=>p.name==='style')!.default=style;
    c.props.find(p=>p.name==='show')!.default=show;
    const expected=!checked&&style==='solid'&&show;
    assert.equal(defaultItem(emitHtml(c,context(c)).html).includes('>Moon<'),expected,JSON.stringify({checked,style,show}));
    assert.equal(renderToStaticMarkup(React.createElement(Subject,{isChecked:checked,appearance:style,showMark:show})).includes('>Moon<'),expected);
  }
  assert.equal(JSON.stringify(original),before,'emission does not amend source definitions');
});

test('defaultless finite inputs preserve omitted, false and explicit enum planes without choosing the first option',()=>{
  const c=specimen();c.props=c.props.filter(p=>p.name!=='style');
  const checked=c.props.find(p=>p.name==='checked')!;delete checked.default;checked.bindings.figma.unsetValue='Omitted';
  const mark=c.anatomy.root.parts!.mark;mark.presenceByCombination={props:['checked'],rows:[
    {values:[null],present:true},{values:['false'],present:false},{values:['true'],present:false},
  ]};
  assert(ContractSchema.safeParse(c).success);
  const out=emitHtml(c,context(c)),rows=items(out.html);
  assert.equal(rows.length,3);assert(rows[0].html.includes('>Moon<'));
  assert.equal(rows.filter(row=>row.label==='checked=false').length,1);
  assert(rows.slice(1).every(row=>!row.html.includes('>Moon<')));
  const enumCase=specimen();enumCase.props=enumCase.props.filter(p=>p.name!=='checked');
  const style=enumCase.props.find(p=>p.name==='style')!;delete style.default;style.bindings.figma.unsetValue='Omitted';
  enumCase.anatomy.root.parts!.mark.presenceByCombination={props:['style'],rows:[
    {values:[null],present:false},{values:['solid'],present:true},{values:['raised'],present:false},
  ]};
  const enumRows=items(emitHtml(enumCase,context(enumCase)).html);
  assert.equal(enumRows.length,3);assert(!enumRows[0].html.includes('>Moon<'));
  assert(enumRows.find(row=>row.label==='style=solid')!.html.includes('>Moon<'));
});

test('declared sparse and absence-qualified domains showcase only reachable complete tuples',()=>{
  for(const positive of [true,false]){
    const c=specimen();
    if(positive)c.bindings.figma.drawnVariants=[{checked:false,style:'solid'},{checked:false,style:'raised'},{checked:true,style:'solid'}];
    else c.bindings.figma.absentVariants=[{checked:true,style:'raised'}];
    c.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
    assert(ContractSchema.safeParse(c).success);
    const rows=items(emitHtml(c,context(c)).html);
    assert.deepEqual(rows.map(row=>row.label),['default','checked=false, style=raised','checked=true, style=solid']);
    assert.equal(rows.filter(row=>row.html.includes('>Moon<')).length,1);
  }
});

function parentOf(child:Contract,props:Record<string,string|boolean> = {}):Contract {
  return ContractSchema.parse({id:'test.html-parent',name:'HtmlParent',version:'0.1.0',status:'draft',description:'Composed HTML specimen',
    archetype:'none',semantics:{element:'div'},states:[],props:[],anatomy:{root:{parts:{child:{component:{id:child.id,props}}}}},
    bindings:{code:{anchors:{importPath:'./HtmlParent',export:'HtmlParent'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
}

test('composed children preserve omission and refuse undeclared or absent tuples before returning HTML',()=>{
  const child=specimen();child.props=child.props.filter(p=>p.name!=='checked');
  const style=child.props.find(p=>p.name==='style')!;delete style.default;style.bindings.figma.unsetValue='Omitted';
  child.anatomy.root.parts!.mark.presenceByCombination={props:['style'],rows:[
    {values:[null],present:true},{values:['solid'],present:false},{values:['raised'],present:false},
  ]};
  const parent=parentOf(child);
  assert(defaultItem(emitHtml(parent,context(parent,[child])).html).includes('>Moon<'));
  const explicit=parentOf(child,{style:'solid'});
  assert(!defaultItem(emitHtml(explicit,context(explicit,[child])).html).includes('>Moon<'));
  const missing=structuredClone(child);delete missing.props.find(p=>p.name==='style')!.bindings.figma.unsetValue;
  missing.anatomy.root.parts!.mark.presenceByCombination!.rows.shift();
  assert(ContractSchema.safeParse(missing).success);
  assert.throws(()=>emitHtml(parentOf(missing),context(parentOf(missing),[missing])),/presence-combination-unavailable/);
  for(const positive of [true,false]){
    const sparse=specimen();sparse.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
    if(positive)sparse.bindings.figma.drawnVariants=[{checked:false,style:'solid'},{checked:false,style:'raised'},{checked:true,style:'solid'}];
    else sparse.bindings.figma.absentVariants=[{checked:true,style:'raised'}];
    const badParent=parentOf(sparse,{checked:true,style:'raised',show:false});
    assert.throws(()=>emitHtml(badParent,context(badParent,[sparse])),positive?/HTML_DRAWN_VARIANT_UNDECLARED/:/HTML_ABSENT_VARIANT_UNAVAILABLE/);
  }
});

test('invalid presence tables refuse even when independent visibility hides their content',()=>{
  for(const change of [
    (c:Contract)=>{c.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();},
    (c:Contract)=>{const p=c.anatomy.root.parts!.mark.presenceByCombination!;p.rows.push(p.rows[0]);},
    (c:Contract)=>{c.anatomy.root.parts!.mark.presenceByCombination!.props[0]='show';},
    (c:Contract)=>{c.anatomy.root.parts!.mark.presenceByCombination!.rows[0].values[0]='unknown';},
  ]){
    const c=specimen();c.props.find(p=>p.name==='show')!.default=false;change(c);
    assert.throws(()=>emitHtml(c,context(c)),/HTML_PRESENCE_COMBINATION_UNQUALIFIED/);
  }
});


test('a root showcase lists qualified planes without inventing a default while composed omission still refuses',()=>{
  for (const sparse of [false,true]) {
    const c=specimen();delete c.props.find(p=>p.name==='checked')!.default;
    delete c.props.find(p=>p.name==='style')!.default;
    c.props.find(p=>p.name==='show')!.default=false;
    if(sparse) {
      c.bindings.figma.absentVariants=[{checked:true,style:'raised'}];
      c.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
    }
    assert(ContractSchema.safeParse(c).success,'defaultless complete/absence-qualified tables are valid source contracts');
    const before=JSON.stringify(c),output=emitHtml(c,context(c)),rows=items(output.html);
    assert(output.html.includes('default-snapshot-unavailable'));
    assert(rows.every(row=>row.label!=='default'));
    const qualified=sparse?3:4;
    assert.equal(rows.length,qualified*2,'reachable tuples and each explicit live Show=true snapshot remain addressable');
    assert.equal(rows.filter(row=>row.html.includes('>Moon<')).length,1);
    assert(rows.find(row=>row.label==='checked=false, style=solid, show=true')!.html.includes('>Moon<'));
    assert.equal(JSON.stringify(c),before);
    const parent=parentOf(c);
    assert.throws(()=>emitHtml(parent,context(parent,[c])),/presence-combination-unavailable/);
  }
  const invalidDrawn=specimen();delete invalidDrawn.props.find(p=>p.name==='style')!.default;
  invalidDrawn.bindings.figma.drawnVariants=[{checked:false,style:'solid'},{checked:false,style:'raised'},{checked:true,style:'solid'}];
  invalidDrawn.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
  assert(!ContractSchema.safeParse(invalidDrawn).success,'positive domains still require explicit defaults');
  assert.throws(()=>emitHtml(invalidDrawn,context(invalidDrawn)),/drawn-variants-explicit-default-required/);
});

test('an ancestor hidden by live visibility preserves omitted defaults and showcases activation only on qualified planes',()=>{
  const c=specimen();c.props=c.props.filter(p=>p.name!=='checked');
  delete c.props.find(p=>p.name==='style')!.default;
  c.props.find(p=>p.name==='show')!.default=false;
  const mark={text:'Moon',presenceByCombination:{props:['style'],rows:[
    {values:['solid'],present:true},{values:['raised'],present:false},
  ]}};
  c.anatomy.root.parts={wrapper:{visibleWhen:{prop:'show'},parts:{mark}}};
  assert(ContractSchema.safeParse(c).success);
  const before=JSON.stringify(c),Subject=reactSubject(c),rows=items(emitHtml(c,context(c)).html);
  assert.deepEqual(rows.map(row=>row.label),['default','style=solid','style=raised','style=solid, show=true','style=raised, show=true']);
  assert(!rows[0].html.includes('>Moon<'));
  assert(!rows[0].html.includes('presence-html--style-'),'default omission does not invent an enum class');
  assert(!renderToStaticMarkup(React.createElement(Subject)).includes('>Moon<'));
  assert(rows.find(row=>row.label==='style=solid, show=true')!.html.includes('>Moon<'));
  assert(!rows.find(row=>row.label==='style=raised, show=true')!.html.includes('>Moon<'));
  assert.equal(rows.filter(row=>row.html.includes('>Moon<')).length,1);
  assert.throws(()=>renderToStaticMarkup(React.createElement(Subject,{showMark:true})),/presence-combination-unavailable/,
    'a real caller activating the ancestor without the required plane still refuses');
  assert.equal(JSON.stringify(c),before);
  const own=structuredClone(c);own.anatomy.root.parts={mark:{...mark,visibleWhen:{prop:'show'}}};
  assert(ContractSchema.safeParse(own).success);
  assert(items(emitHtml(own,context(own)).html).every(row=>row.label!=='default'));
  const parent=parentOf(own);
  assert.throws(()=>emitHtml(parent,context(parent,[own])),/presence-combination-unavailable/,
    'a reached part checks its own missing presence before its own false live visibility');
});

test('an ancestor absent in the finite source plane skips defaultless descendant presence without weakening composed omission',()=>{
  const c=specimen();c.props=c.props.filter(p=>p.name!=='show');
  delete c.props.find(p=>p.name==='style')!.default;
  c.anatomy.root.parts={wrapper:{presenceByCombination:{props:['checked'],rows:[
    {values:['false'],present:false},{values:['true'],present:true},
  ]},parts:{mark:{text:'Moon',presenceByCombination:{props:['style'],rows:[
    {values:['solid'],present:true},{values:['raised'],present:false},
  ]}}}}};
  assert(ContractSchema.safeParse(c).success);
  const rows=items(emitHtml(c,context(c)).html),Subject=reactSubject(c);
  assert.deepEqual(rows.map(row=>row.label),['default','checked=false, style=solid','checked=false, style=raised',
    'checked=true, style=solid','checked=true, style=raised']);
  assert(!rows[0].html.includes('>Moon<'));
  assert(!rows[0].html.includes('presence-html--style-'));
  assert(!renderToStaticMarkup(React.createElement(Subject)).includes('>Moon<'));
  assert.equal(rows.filter(row=>row.html.includes('>Moon<')).length,1);
  const parent=parentOf(c);
  assert(!defaultItem(emitHtml(parent,context(parent,[c])).html).includes('>Moon<'));
  const activeParent=parentOf(c,{checked:true});
  assert.throws(()=>emitHtml(activeParent,context(activeParent,[c])),/presence-combination-unavailable/,
    'a composed caller reaching the descendant still needs its exact style plane');
});
