import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema, walkAnatomy, type Contract} from '../scripts/contract-schema.js';
import {asMinimalChildContract, proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {validateContract} from '../packages/core/src/validate.js';
import {reactEmitter, htmlEmitter, reactInlineEmitter} from './emitter.js';
import type {DumpSet, DumpNode} from '../extract/figma/types.js';

const entry = ContractSchema.parse({id:'ds.entry',name:'Entry',version:'0.1.0',status:'draft',description:'Synthetic reusable item fixture',
  semantics:{element:'span'},props:[
    {name:'tone',type:{enum:['quiet','emphasis']},default:'quiet',bindings:{figma:{kind:'VARIANT',property:'Tone',values:{quiet:'Quiet',emphasis:'Emphasis'}},code:{prop:'tone'}}},
    {name:'text',type:'text',default:'Item',bindings:{figma:{kind:'TEXT',property:'Text'},code:{prop:'children'}}},
  ],states:[],anatomy:{root:{parts:{label:{content:{prop:'children'}}}}},
  bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'entry-key'}},code:{anchors:{importPath:'./Entry',export:'Entry'}}}});
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function source(otherVariant=false):DumpSet {
  const variant=(name:string, second=false):DumpNode=>({name,type:'COMPONENT',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
    ...(otherVariant?{variantProperties:{Density:name.split('=')[1]}}:{}),
    children:['One','Two','Three'].map((text,index)=>({type:'INSTANCE',name:'entry',instanceOf:'Entry',instanceSetKey:'entry-key',
      componentProperties:{Tone:index===(second?1:0)?'Emphasis':'Quiet','Text#1:0':text}}))});
  return {setName:'Menu',type:otherVariant?'COMPONENT_SET':'COMPONENT',propertyDefinitions:otherVariant?{Density:{type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Wide']}}:{},
    variants:otherVariant?[variant('Density=Compact'),variant('Density=Wide',true)]:[variant('Menu')]};
}
function propose(set=source()) {
  const result=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map([['Entry',entry.id]]),contractIdByKey:new Map([['entry-key',entry.id]]),contractsById:new Map([[entry.id,asMinimalChildContract(entry)]])});
  return {...result,contract:ContractSchema.parse(result.contract)};
}
const errors=(contract:Contract, child=entry)=>{const output:string[]=[];validateContract(contract,new Map([[contract.id,contract],[child.id,child]]),output,new Map());return output;};

test('repeat proposals retain typed per-item enum choices and canonicalize design labels',()=>{
  const {contract}=propose();
  const part=walkAnatomy(contract).find(row=>row.part.repeat)!.part;
  const items=contract.props.find(p=>p.name===part.repeat!.itemsProp)!;
  assert.deepEqual(items.type,{arrayOf:{tone:{enum:['quiet','emphasis']},text:'text'}});
  assert.deepEqual(part.repeat!.sample,[{tone:'emphasis',text:'One'},{tone:'quiet',text:'Two'},{tone:'quiet',text:'Three'}]);
  assert.deepEqual(errors(contract),[]);
  const ctx={contracts:new Map([[entry.id,entry],[contract.id,contract]]),tokens,icons:new Map<string,string>(),mode:'light' as const};
  const react=reactEmitter.emit(contract,ctx).find(f=>f.path.endsWith('.tsx'))!.contents;
  assert.match(react,/tone: "quiet" \| "emphasis"/);
  assert.match(react,/tone=\{item.tone\}/);
  assert.match(react,/\{item.text\}/);
  const html=htmlEmitter.emit(contract,ctx).find(f=>f.path.endsWith('.html'))!.contents;
  assert.match(html,/entry--tone-emphasis/);
  assert.match(html,/One/); assert.match(html,/Three/);
  assert.ok(reactInlineEmitter.emit(contract,ctx).length);
});

test('invalid enum domains and samples refuse instead of falling back to child defaults',()=>{
  const seed=propose().contract;
  const badDomain=structuredClone(seed);
  (badDomain.props.find(p=>p.name==='items')!.type as {arrayOf:Record<string,{enum:string[]}>}).arrayOf.tone.enum.push('unknown');
  assert.match(errors(badDomain).join('\n'),/must match the child scalar type or name a subset/);
  for(const value of ['unknown',false,1]){
    const malformed=structuredClone(seed);walkAnatomy(malformed).find(row=>row.part.repeat)!.part.repeat!.sample[0].tone=value;
    assert.match(errors(malformed).join('\n'),/outside its declared enum/);
  }
  const wrongChild=structuredClone(entry);wrongChild.props[0].type='text';
  assert.match(errors(seed,wrongChild).join('\n'),/must match the child scalar type or name a subset/);
});

test('a parent-dependent item enum retains separate instances rather than freezing the first sample',()=>{
  const {contract,notes}=propose(source(true));
  assert.ok(notes.some(n=>n.includes('repeat-enum-not-uniform')));
  assert.equal(walkAnatomy(contract).filter(row=>row.part.repeat).length,0);
  assert.equal(walkAnatomy(contract).filter(row=>row.part.component?.id===entry.id).length,3);
  assert.deepEqual(errors(contract),[]);
});

test('mapped child code values use canonical item enum values at the parent boundary',()=>{
  const {contract}=propose();
  const mapped=structuredClone(entry);
  mapped.props[0].bindings.code.values={quiet:'normal',emphasis:'highlighted'};
  const ctx={contracts:new Map([[mapped.id,mapped],[contract.id,contract]]),tokens,icons:new Map<string,string>(),mode:'light' as const};
  assert.deepEqual(errors(contract,mapped),[]);
  const react=reactEmitter.emit(contract,ctx).find(f=>f.path.endsWith('.tsx'))!.contents;
  assert.match(react,/tone: "quiet" \| "emphasis"/);
  assert.match(react,/highlighted/);
  const js=ts.transpileModule(react,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const output:{exports:Record<string,React.ComponentType<any>>}={exports:{}};
  vm.runInNewContext(js,{exports:output.exports,React,require:(name:string)=>{
    if(name==='react')return React;
    if(name==='../Entry')return {Entry:(props:any)=>React.createElement('span',{'data-tone':props.tone},props.children)};
    if(name==='./Menu.module.css')return {root:'menu'};
    throw Error('Unexpected generated dependency: '+name);
  }});
  const rendered=renderToStaticMarkup(React.createElement(output.exports.Menu,{items:[{tone:'emphasis',text:'First'},{tone:'quiet',text:'Second'}]}));
  assert.match(rendered,/<span data-tone="highlighted">First<\/span>/);
  assert.match(rendered,/<span data-tone="normal">Second<\/span>/);
  const changed=renderToStaticMarkup(React.createElement(output.exports.Menu,{items:[{tone:'quiet',text:'First'},{tone:'emphasis',text:'Second'}]}));
  assert.match(changed,/<span data-tone="normal">First<\/span>/);
  assert.match(changed,/<span data-tone="highlighted">Second<\/span>/);
});

test('same-named siblings with different component identities do not collapse into one repeat',()=>{
  const input=source();input.variants[0].children![2].instanceSetKey='other-entry-key';
  const {contract}=propose(input);
  assert.equal(walkAnatomy(contract).filter(row=>row.part.repeat).length,0);
  const references=walkAnatomy(contract).filter(row=>row.part.component);
  assert.equal(references.length,3);
  assert.equal(references.filter(row=>row.part.component!.id===entry.id).length,2);
});

test('unmapped design enum labels do not become fabricated repeat choices',()=>{
  const input=source();input.variants[0].children![1].componentProperties!.Tone='Unlisted';
  const {contract,notes}=propose(input);
  assert.equal(walkAnatomy(contract).filter(row=>row.part.repeat).length,0);
  assert.ok(notes.some(note=>note.includes('repeat-enum-not-uniform')));
});
