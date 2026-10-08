import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {asMinimalChildContract,proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {validateContract} from '../packages/core/src/validate.js';
import {reactEmitter,htmlEmitter} from './emitter.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';

const child=ContractSchema.parse({id:'probe.entry',name:'Entry',version:'0.1.0',status:'draft',description:'A child whose true default exposes omitted false inputs',semantics:{element:'span'},
  props:[{name:'selected',type:'boolean',default:true,bindings:{figma:{kind:'VARIANT',property:'Selected ?',values:{true:'True',false:'False'}},code:{prop:'active'}}},
    {name:'text',type:'text',default:'Item',bindings:{figma:{kind:'TEXT',property:'Text'},code:{prop:'children'}}}],
  states:[],anatomy:{root:{parts:{mark:{text:'Selected',visibleWhen:{prop:'selected'}},label:{content:{prop:'children'}}}}},
  bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'entry-key'}},code:{anchors:{importPath:'./Entry',export:'Entry'}}}});
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function source():DumpSet {
  const variant=(name:string):DumpNode=>({name,type:'COMPONENT',variantProperties:{Density:name.split('=')[1]},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
    children:['One','Two','Three'].map((text,index)=>({type:'INSTANCE',name:'entry',instanceOf:'Entry',instanceSetKey:'entry-key',componentProperties:{'Selected ?':index===0?'True':'False','Text#1:0':text}}))});
  return {setName:'Menu',type:'COMPONENT_SET',propertyDefinitions:{Density:{type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Wide']}},variants:[variant('Density=Compact'),variant('Density=Wide')]};
}
function propose(set=source(),dep:typeof child=structuredClone(child),projectionMode:'exact'|'reviewable-inversion'='exact') {
  const result=proposeFromDump(set,{corpus,mintUnbound:true,stampsObservable:true,projectionMode,contractIdByName:new Map([['Entry',dep.id]]),contractIdByKey:new Map([['entry-key',dep.id]]),contractsById:new Map([[dep.id,asMinimalChildContract(dep)]])});
  return {...result,contract:ContractSchema.parse(result.contract),child:dep};
}
const repeat=(contract:Contract)=>walkAnatomy(contract).find(row=>row.part.repeat)?.part;
function fixed(set:DumpSet,code:string,dep=structuredClone(child)) {
  const result=propose(set,dep);assert.equal(repeat(result.contract),undefined,code);
  assert.equal(walkAnatomy(result.contract).filter(row=>row.part.component?.id===dep.id).length,3,code);
  assert(result.notes.some(note=>note.includes('repeat-boolean-'+code)),result.notes.join('\n'));
  return result;
}
function rendered(tsx:string,props:Record<string,unknown>={}) {
  const out:{exports:Record<string,React.ComponentType<any>>}={exports:{}};
  const js=ts.transpileModule(tsx,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  vm.runInNewContext(js,{exports:out.exports,React,require:(name:string)=>{
    if(name==='react')return React;
    if(name==='../Entry'||name==='./Entry')return {Entry:({active=true,children}:any)=>React.createElement('span',{'data-active':String(active)},children)};
    if(name.endsWith('.module.css'))return {root:'menu'};
    throw Error('Unexpected dependency '+name);
  }});
  return renderToStaticMarkup(React.createElement(out.exports.Menu,props));
}
test('child-owned Boolean spellings become typed ordered repeat fields; live and inline false override true defaults',()=>{
  const {contract}=propose();const part=repeat(contract)!;
  assert.deepEqual(part.repeat!.sample,[{selected:true,text:'One'},{selected:false,text:'Two'},{selected:false,text:'Three'}]);
  assert.deepEqual(contract.props.find(p=>p.name===part.repeat!.itemsProp)!.type,{arrayOf:{selected:'boolean',text:'text'}});
  const errors:string[]=[];validateContract(contract,new Map([[contract.id,contract],[child.id,child]]),errors,new Map());assert.deepEqual(errors,[]);
  const ctx={contracts:new Map([[child.id,child],[contract.id,contract]]),tokens,icons:new Map<string,string>(),mode:'light' as const};
  const react=reactEmitter.emit(contract,ctx).find(f=>f.path.endsWith('.tsx'))!.contents;
  assert.match(rendered(react,{items:part.repeat!.sample}),/<span data-active="true">One<\/span><span data-active="false">Two<\/span><span data-active="false">Three<\/span>/);
  assert.match(rendered(react,{items:[{selected:false,text:'Changed'},{selected:true,text:'Moved'}]}),/<span data-active="false">Changed<\/span><span data-active="true">Moved<\/span>/);
  const inline=emitReactInline(contract,{...ctx,tokens:tokens});assert.match(inline.tsx,/active=\{false\}/);
  assert.match(rendered(inline.tsx),/<span data-active="true">One<\/span>\s*<span data-active="false">Two<\/span>\s*<span data-active="false">Three<\/span>/);
  const html=htmlEmitter.emit(contract,ctx).find(f=>f.path.endsWith('.html'))!.contents;
  assert.equal((html.match(/Selected/g)??[]).length,2); // default plus Compact/Wide showcase once each
  assert.equal((html.match(/>Two</g)??[]).length,2);
  const spec=createFigmaEngine({tokens,icons:ctx.icons}).compileComponentData(contract,ctx.contracts);
  const instances=(node:any):any[]=>[...(node.depContractId===child.id?[node]:[]),...(node.children??[]).flatMap(instances)];
  assert.equal(spec.variants.length,2);
  for(const v of spec.variants)assert.deepEqual(instances(v.spec).map(n=>n.depProps['Selected ?']),['True','False','False']);
});
test('recognized native/string Booleans mix without sorting, deduplicating or freezing differently spelled keys',()=>{
  const set=source();
  set.variants[0].children![0].componentProperties!['Selected ?']=true;
  set.variants[1].children![0].componentProperties!['Selected ?']=' TRUE ';
  set.variants[1].children![1].componentProperties!['Selected ?']=false;
  set.variants[1].children![2].componentProperties!['Selected ?']=' false ';
  for(const v of set.variants)v.children!.reverse();
  const out=propose(set);assert.deepEqual(repeat(out.contract)!.repeat!.sample,[{selected:false,text:'Three'},{selected:false,text:'Two'},{selected:true,text:'One'}]);
  for(const v of set.variants)for(const n of v.children!){n.componentProperties!['Selected ?']=false;}
  const n=set.variants[1].children![0];n.componentProperties!['Selected ?#2:0']=n.componentProperties!['Selected ?'];delete n.componentProperties!['Selected ?'];
  const constant=repeat(propose(set).contract)!;assert.equal(constant.component!.props!.selected,false);assert(!Object.hasOwn(constant.repeat!.sample[0],'selected'));
});
test('parent-dependent, later-only and missing Boolean evidence retain individual instances',()=>{
  const changed=source();for(const n of changed.variants[0].children!)n.componentProperties!['Selected ?']='False';fixed(changed,'not-uniform');
  const late=source();for(const n of late.variants[0].children!)delete n.componentProperties!['Selected ?'];fixed(late,'missing');
  const missing=source();delete missing.variants[1].children![1].componentProperties!['Selected ?'];fixed(missing,'missing');
});
test('invalid and ambiguous source spellings or child bindings cannot authorize a Boolean repeat',()=>{
  const invalid=source();invalid.variants[1].children![1].componentProperties!['Selected ?']='yes';fixed(invalid,'invalid');
  const duplicate=source();duplicate.variants[1].children![1].componentProperties!['Selected ?#2:0']='False';fixed(duplicate,'ambiguous-source');
  const ambiguous=structuredClone(child);ambiguous.props.push({...structuredClone(ambiguous.props[0]),name:'other',bindings:{figma:ambiguous.props[0].bindings.figma,code:{prop:'other'}}});fixed(source(),'ambiguous-binding',ambiguous);
  const malformed=structuredClone(child);malformed.props[0].bindings.figma.values={true:'True',no:'False'};fixed(source(),'ambiguous-values',malformed);
  const collision=structuredClone(child);collision.props[0].bindings.figma.values={true:'Same',false:'Same'};fixed(source(),'ambiguous-values',collision);
});
test('positive unset, missing and mixed raw null remain distinct',()=>{
  const dep=structuredClone(child);delete dep.props[0].default;dep.props[0].bindings.figma.unsetValue='Unset';
  const unset=source();unset.variants[1].children![1].componentProperties!['Selected ?']='Unset';fixed(unset,'omitted',dep);
  {
    const set=source();(set.variants[1].children![1].componentProperties as any)['Selected ?']=null;
    const before=JSON.stringify(set);const out=fixed(set,'non-scalar');assert.equal(JSON.stringify(set),before);assert(out.notes.some(n=>n.includes('non-scalar value (null)')&&n.includes('dropped BY NAME')));
  }
  const absent=source();for(const v of absent.variants)for(const n of v.children!)delete n.componentProperties!['Selected ?'];
  const sample=repeat(propose(absent).contract)!.repeat!.sample;assert(sample.every(s=>!Object.hasOwn(s,'selected'))); // no evidence means no inferred field
});
test('all-null Boolean evidence cannot disappear into a label-only repeat after sanitation',()=>{
  const set=source();for(const v of set.variants)for(const n of v.children!)(n.componentProperties as any)['Selected ?']=null;
  const before=JSON.stringify(set),out=fixed(set,'non-scalar');assert.equal(JSON.stringify(set),before);
  assert.equal(out.notes.filter(n=>n.includes('non-scalar value (null)')&&n.includes('dropped BY NAME')).length,6);
});
test('original all-undefined, Symbol and NaN Boolean keys survive JSON sanitation as invalid evidence',()=>{
  for(const value of [undefined,Symbol('invalid-source'),NaN]){
    const set=source();for(const v of set.variants)for(const n of v.children!)(n.componentProperties as any)['Selected ?']=value;
    const out=fixed(set,'non-scalar');assert.equal(out.notes.filter(n=>n.includes('non-scalar value')&&n.includes('dropped BY NAME')).length,6);
    for(const v of set.variants)for(const n of v.children!){assert(Object.hasOwn(n.componentProperties!,'Selected ?'));assert(Object.is(n.componentProperties!['Selected ?'],value));}
  }
});
test('enum/text Boolean-looking values retain their declared type and explicit code-null mapping',()=>{
  for(const type of ['text',{enum:['false','true']}] as const){
    const dep=structuredClone(child);dep.props[0].type=type as any;dep.props[0].default=typeof type==='string'?'True':'true';
    if(typeof type==='string'){delete dep.props[0].bindings.figma.values;dep.props[0].bindings.figma.kind='TEXT';}
    else {dep.props[0].bindings.figma.values={false:'False',true:'True'};dep.props[0].bindings.code.values={false:null,true:'chosen'};}
    const out=propose(source(),dep),sample=repeat(out.contract)!.repeat!.sample;
    assert.deepEqual(sample.map(s=>s.selected),typeof type==='string'?['True','False','False']:['true','false','false']);
    if(typeof type!=='string')assert.equal(dep.props[0].bindings.code.values!.false,null);
  }
});
test('non-scalar evidence stays scoped to child Boolean owners and survives state-plane clones',()=>{
  const unrelated=source();for(const v of unrelated.variants)for(const n of v.children!)(n.componentProperties as any).Payload={guid:'slot-content'};
  const out=propose(unrelated);assert.deepEqual(repeat(out.contract)!.repeat!.sample.map(s=>s.selected),[true,false,false]);
  assert(out.notes.some(n=>n.includes('SLOT-typed value')&&n.includes('dropped BY NAME')));
  const states=source();states.propertyDefinitions={State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']}};
  for(const [i,v] of states.variants.entries()){
    v.name='State='+(i===0?'Default':'Hover');v.variantProperties={State:i===0?'Default':'Hover'};
    v.fill={hex:i===0?'#000000':'#ff0000'};
    for(const n of v.children!)(n.componentProperties as any)['Selected ?']=null;
  }
  fixed(states,'non-scalar');
});
test('unresolved Boolean-looking strings gain no declaration authority',()=>{
  const input=source();const out=proposeFromDump(input,{corpus,mintUnbound:true,contractIdByName:new Map()});
  const contract=ContractSchema.parse(out.contract),part=repeat(contract)!;
  assert(part.repeat!.sample.every(s=>!Object.hasOwn(s,'selected')));
  assert(out.notes.some(n=>n.includes('Selected ?')&&n.includes('VARIANT/TEXT-ambiguous')));
});
test('actual Light/Dark token-mode promotion preserves all-null and all-undefined Boolean evidence',()=>{
  for(const value of [null,undefined]){
    const set=source();set.propertyDefinitions={Theme:{type:'VARIANT',defaultValue:'Light',variantOptions:['Light','Dark']}};
    for(const [i,v] of set.variants.entries()){
      v.name='Theme='+(i===0?'Light':'Dark');v.variantProperties={Theme:i===0?'Light':'Dark'};
      for(const n of v.children!)(n.componentProperties as any)['Selected ?']=value;
    }
    const out=propose(set,structuredClone(child),'reviewable-inversion');
    assert(out.notes.some(n=>n.includes('variant axis "Theme"')&&n.includes('IS a token-mode axis')));
    assert.equal(repeat(out.contract),undefined);
    assert.equal(walkAnatomy(out.contract).filter(row=>row.part.component?.id===child.id).length,3);
    assert(out.notes.some(n=>n.includes('repeat-boolean-non-scalar')));
    assert(!out.contract.props.some(p=>p.bindings.figma.property==='Theme'));
    assert.equal(out.notes.filter(n=>n.includes('non-scalar value')&&n.includes('dropped BY NAME')).length,6);
    assert.throws(()=>propose(set),/EXACT_SEMANTIC_PROJECTION|Exact proposal cannot promote/);
  }
});
