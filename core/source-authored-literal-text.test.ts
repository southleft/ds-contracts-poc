import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema,walkAnatomy,resolveTextByCombination,ownedLiteralTextDomain,textByCombinationIssues,type Contract} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
import {flattenTokens} from './tokens.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {qualifyAuthoredLiteralTextTable,qualifyScopedAuthoredLiteralTextTable,type AuthoredTextAppearanceAxis} from './source-authored-text-appearance.js';
import {observeTextAppearance} from '../extract/figma/text-appearance-observation.js';
import {defaultFontFamilyParts} from '../packages/core/src/anatomy.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';

const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(styled=false,optional=false){
 const axes:AuthoredTextAppearanceAxis[]=[{property:'Mode',prop:'mode',values:['First','Second'],map:{First:'first',Second:'second'}},
  {property:'State',prop:'state',values:['Cold','Warm'],map:{Cold:'cold',Warm:'warm'}},
  ...(optional?[{property:'Shown',prop:'shown',values:['false','true'],map:{false:'false',true:'true'},boolean:true}]:[])];
 const layout={mode:'HORIZONTAL' as const,primary:'MIN' as const,counter:'MIN' as const,spacing:0,padding:[0,0,0,0] as [number,number,number,number],primarySizing:'AUTO' as const,counterSizing:'AUTO' as const};
 const rows=axes.reduce<string[][]>((rows,a)=>rows.flatMap(row=>a.values.map(v=>[...row,v])),[[]]);
 const source:DumpSet={setName:'Literal tuple',type:'COMPONENT_SET',nodeId:'tuple-set',key:'tuple-key',
  propertyDefinitions:Object.fromEntries(axes.map(a=>[a.property,{type:'VARIANT',defaultValue:a.values[0],variantOptions:[...a.values]}])),
  variants:rows.map((values,i)=>{
   const characters=values[0]+':'+values[1];
   const appearance=styled?observeTextAppearance(characters,[{start:0,end:characters.indexOf(':')+1,characters:characters.slice(0,characters.indexOf(':')+1),fontName:{family:'Inter',style:'Bold'},fontSize:14,fontWeight:700,lineHeight:{unit:'PIXELS',value:20},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:{r:0,g:0,b:0}}]},
    {start:characters.indexOf(':')+1,end:characters.length,characters:characters.slice(characters.indexOf(':')+1),fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'PIXELS',value:20},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:{r:0,g:0,b:1}}]}] as any):undefined;
   return {name:axes.map((a,j)=>a.property+'='+values[j]).join(','),type:'COMPONENT' as const,nodeId:'main-'+i,componentKey:'key-'+i,variantProperties:Object.fromEntries(axes.map((a,j)=>[a.property,values[j]])),layout,
    children:[...(!optional||values[2]==='true'?[{name:'Label',type:'TEXT' as const,nodeId:'text-'+i,text:{characters,fontSize:14,fontStyle:'Regular',...(appearance?{sourceAppearance:appearance}:{})}}]:[]),
     {name:'Stable',type:'TEXT' as const,nodeId:'stable-'+i,text:{characters:'Keep',fontSize:14,fontStyle:'Regular'}}]};
  })};
 const occurrences=()=>source.variants.flatMap(main=>(main.children??[]).filter(n=>n.name==='Label').map(node=>({variant:main.name,node})));
 const domain=rows.map(row=>row.map((raw,i)=>axes[i].map[raw as keyof typeof axes[typeof i]['map']] as string));
 const propose=()=>proposeFromDump(source,{fileKey:'file',corpus,contractIdByName:new Map(),mintUnbound:true});
 return{axes,source,occurrences,domain,propose};
}
function compiled(f:ReturnType<typeof fixture>){const proposal=f.propose(),contract=ContractSchema.parse(proposal.contract);
 const found=walkAnatomy(contract).find(w=>w.part.textByCombination);assert(found,JSON.stringify({contract,notes:proposal.notes.filter(n=>n.includes('Label'))}));const part=found.part;
 return {proposal,contract,part};
}
function render(contract:Contract,tree:Record<string,unknown>,props:Record<string,unknown>,inline=false){
 const context={contracts:new Map([[contract.id,contract]]),icons:new Map(),tokens:new Set(flattenTokens(tree).keys()),tokenValues:tree};
 const {tsx}=inline?emitReactInline(contract,{contracts:context.contracts,icons:context.icons,tokens:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}}}):emitReact(contract,context);
 const js=transformSync(tsx.replace(/import styles from '[^']+';/,"const styles = new Proxy({}, {get: (_, key) => String(key)});"),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
 const module={exports:{} as any};vm.runInNewContext(js,{module,exports:module.exports,require:createRequire(import.meta.url),console});
 return renderToStaticMarkup(React.createElement(module.exports[contract.name],props));
}

function hierarchyFixture(kind:'varying'|'constant'|'bound'='varying'){
 const f=fixture(), originals=structuredClone(f.source.variants);
 f.source.propertyDefinitions!.Topology={type:'VARIANT',defaultValue:'Nested',variantOptions:['Nested','Flat','Absent']};
 if(kind==='bound')f.source.propertyDefinitions!.Title={type:'TEXT',defaultValue:'Caller'};
 f.source.variants=['Nested','Flat','Absent'].flatMap(topology=>originals.map((original,index)=>{
  const main=structuredClone(original),prefix=topology+'-'+index;
  main.name+=',Topology='+topology;main.componentKey='key-'+prefix;main.variantProperties={...main.variantProperties,Topology:topology};
  const label=main.children![0];
  if(kind==='constant')label.text!.characters='Unchanged';
  if(kind==='bound')label.propRefs={characters:'Title'};
  if(topology==='Nested')main.children![0]={name:'Body',type:'FRAME',layout:structuredClone(main.layout),children:[label]};
  if(topology==='Absent')main.children!.shift();
  let serial=0;const identify=(node:DumpNode)=>{node.nodeId=prefix+'-'+serial++;for(const child of node.children??[])identify(child);};identify(main);
  return main;
 }));
 return f;
}

test('varying literal text keeps original nested and flat lineages with exact tuple ownership',()=>{
 const f=hierarchyFixture(),original=JSON.stringify(f.source),proposal=f.propose(),contract=ContractSchema.parse(proposal.contract);
 assert(proposal.notes.some(note=>note.includes('wrapper "Body" would merge varying literal text across original source paths')));
 const tables=walkAnatomy(contract).flatMap(({part})=>part.textByCombination?[part.textByCombination]:[]);
 assert.equal(tables.length,2,'each original path retains its own authenticated text table');
 for(const table of tables){assert.equal(table.rows.length,4);assert.equal(new Set(table.rows.map(row=>row.values[table.props.indexOf('topology')])).size,1);}
 for(const topology of ['nested','flat','absent'])for(const mode of ['first','second'])for(const state of ['cold','warm']){
  const text=mode[0].toUpperCase()+mode.slice(1)+':'+state[0].toUpperCase()+state.slice(1);
  for(const inline of [false,true]){
   const html=render(contract,proposal.mintedTokens!.tree,{topology,mode,state},inline);
   assert.equal(html.split(text).length-1,topology==='absent'?0:1,topology+'/'+mode+'/'+state);
   assert(html.includes('Keep'),'unrelated source sibling remains present');
  }
 }
 assert.equal(JSON.stringify(f.source),original,'source IDs, paths, characters and tuples are not rewritten');
});

test('constant literals and explicit text controls retain the existing wrapper fold',()=>{
 for(const kind of ['constant','bound'] as const){
  const f=hierarchyFixture(kind),before=JSON.stringify(f.source),proposal=f.propose();
  assert(proposal.notes.some(note=>note.includes('wrapper-union identity')),kind);
  assert(!proposal.notes.some(note=>note.includes('would merge varying literal text across original source paths')),kind);
  assert.equal(JSON.stringify(f.source),before,kind);
 }
});

test('lineage separation retains mixed-path and ambiguous-membership refusals',()=>{
 const f=hierarchyFixture(),axes:AuthoredTextAppearanceAxis[]=[...f.axes,{property:'Topology',prop:'topology',values:['Nested','Flat','Absent'],map:{Nested:'nested',Flat:'flat',Absent:'absent'}}];
 const domain=f.source.variants.map(main=>axes.map(axis=>axis.map[main.variantProperties![axis.property]]));
 const occurrences=f.source.variants.flatMap(main=>{
  const texts:DumpNode[]=[];const visit=(node:DumpNode)=>{if(node.name==='Label')texts.push(node);for(const child of node.children??[])visit(child);};visit(main);
  return texts.map(node=>({variant:main.name,node}));
 });
 assert.equal(qualifyAuthoredLiteralTextTable(f.source,'file',occurrences,axes,domain,true,{}),undefined,'combining original paths remains unauthorized');
 const flat=occurrences.filter(row=>row.variant.endsWith('Topology=Flat')),part={visibleWhen:{prop:'topology',equals:'flat'}};
 assert(qualifyAuthoredLiteralTextTable(f.source,'file',flat,axes,domain,true,part),'an exact original branch qualifies independently');
 f.source.variants.find(main=>main.variantProperties!.Topology==='Absent')!.children!.push({name:'Label',type:'RECTANGLE',nodeId:'ambiguous-kind'});
 assert.equal(qualifyAuthoredLiteralTextTable(f.source,'file',flat,axes,domain,true,part),undefined,'a conflicting original member kind is not absence');
});

test('source-authenticated tuple literals render unchanged in React and native without style evidence',()=>{
 const f=fixture(),before=JSON.stringify(f.source),{proposal,contract,part}=compiled(f);
 assert(part.textByCombination);assert.equal(part.textAppearanceByCombination,undefined);
 const engine=createFigmaEngine({tokens:{primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const native=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
 for(const row of part.textByCombination.rows){
  const props:Record<string,unknown>=Object.fromEntries(part.textByCombination.props.map((p,i)=>[p,row.values[i]]));
  for(const inline of [false,true])assert(render(contract,proposal.mintedTokens!.tree,props,inline).includes(row.text));
  assert.equal(resolveTextByCombination(part.textByCombination,props),row.text);
 }
 const allText=(n:any):string[]=>[...(n.type==='text'?[n.characters]:[]),...(n.children??[]).flatMap(allText)];
 for(const text of ['First:Cold','First:Warm','Second:Cold','Second:Warm'])assert(native.variants.some(v=>allText(v.spec).includes(text)));
 assert.throws(()=>emitWebComponent(contract,{contracts:new Map([[contract.id,contract]]),icons:new Map(),tokens:new Set()}),/literal-text-combination-web-components-unsupported/);
 assert.equal(JSON.stringify(f.source),before);
 assert.throws(()=>resolveTextByCombination(part.textByCombination!,{mode:'unknown',state:'cold'}),/combination-unavailable/);
});

test('the same tuple characters retain authored range appearance without replacing their text',()=>{
 const f=fixture(true),{proposal,contract,part}=compiled(f);assert(part.textAppearanceByCombination);
 for(const row of part.textAppearanceByCombination.rows){
  const props:Record<string,unknown>=Object.fromEntries(part.textAppearanceByCombination.props.map((p,i)=>[p,row.values[i]]));
  assert.equal(resolveTextByCombination(part.textByCombination!,props),row.appearance.characters);
  const html=render(contract,proposal.mintedTokens!.tree,props);
  assert(html.includes('font-weight:700'));assert(html.includes('font-weight:400'));
 }
});

test('physical absence remains separate from complete text tuples',()=>{
 const f=fixture(false,true),{proposal,contract,part}=compiled(f);
 assert(part.textByCombination?.rows.every(row=>row.values.at(-1)==='true'));
 assert(part.visibleWhen||part.presenceByCombination);
 assert(!render(contract,proposal.mintedTokens!.tree,{mode:'first',state:'cold',shown:false}).includes('First:Cold'));
 assert(render(contract,proposal.mintedTokens!.tree,{mode:'first',state:'cold',shown:true}).includes('First:Cold'));
});

test('an intentionally empty row stays empty while other tuples retain normal text styling',()=>{
 const f=fixture();f.source.variants[0].children![0].text!.characters='';
 const {proposal,contract,part}=compiled(f);assert.equal(part.text,'');
 assert(defaultFontFamilyParts(contract).has(part));
 const first=part.textByCombination!.rows.find(row=>row.text==='')!;
 const props=Object.fromEntries(part.textByCombination!.props.map((p,i)=>[p,first.values[i]]));
 assert.equal(resolveTextByCombination(part.textByCombination!,props),'');
 for(const inline of [false,true])assert.equal(render(contract,proposal.mintedTokens!.tree,props,inline).replace(/<[^>]*>/g,''),'Keep');
 const another=part.textByCombination!.rows.find(row=>row.text)!;
 for(const inline of [false,true])assert(render(contract,proposal.mintedTokens!.tree,Object.fromEntries(part.textByCombination!.props.map((p,i)=>[p,another.values[i]])),inline).includes(another.text));
});

test('explicit TEXT binding retains priority and never becomes a tuple default',()=>{
 const f=fixture();for(const main of f.source.variants)main.children![0].propRefs={characters:'Label'};
 f.source.propertyDefinitions!.Label={type:'TEXT',defaultValue:'Caller'};
 const proposal=f.propose(),contract=ContractSchema.parse(proposal.contract);
 assert(!walkAnatomy(contract).some(w=>w.part.textByCombination));
 const binding=walkAnatomy(contract).find(w=>w.part.content)!.part.content!;
 assert(render(contract,proposal.mintedTokens!.tree,{[binding.prop]:'Explicit caller text'}).includes('Explicit caller text'));
});

test('original identity, exact membership and tuples fail closed before carrying literal text',()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.domain.pop();},
  (f:ReturnType<typeof fixture>)=>{f.domain.push([...f.domain[0]]);},
  (f:ReturnType<typeof fixture>)=>{f.source.variants[0].children![0].nodeId='foreign';},
  (f:ReturnType<typeof fixture>)=>{f.source.variants[0].children![0].propRefs={characters:'Caller'};},
  (f:ReturnType<typeof fixture>)=>{f.source.variants[0].children![0].hidden=true;},
 ]){
  const f=fixture(),occurrences=structuredClone(f.occurrences());change(f);
  assert.equal(qualifyAuthoredLiteralTextTable(f.source,'file',occurrences,f.axes,f.domain,true,{}),undefined);
 }
 const f=fixture();assert.equal(qualifyAuthoredLiteralTextTable(f.source,'file',f.occurrences().slice(1),f.axes,f.domain,true,{}),undefined);
});

test('contract grammar refuses missing, duplicate, unknown and explicit-input hybrid tables',()=>{
 const {contract,part}=compiled(fixture());
 for(const mutate of [(p:any)=>p.textByCombination.rows.pop(),(p:any)=>p.textByCombination.rows.push(p.textByCombination.rows[0]),
  (p:any)=>p.textByCombination.rows[0].values[0]='unknown',(p:any)=>p.content={prop:'caller'},(p:any)=>p.textByProp={prop:'mode',map:{first:'Wrong'}},(p:any)=>p.visibilityOverrideProp='show']){
  const c=structuredClone(contract),p=walkAnatomy(c).find(w=>w.part.textByCombination)!.part;mutate(p);assert.equal(ContractSchema.safeParse(c).success,false);
 }
 assert(part.textByCombination);
});

function ancestorFixture(hiddenCaptured=true){
 const f=fixture(),original=structuredClone(f.source.variants);
 f.source.propertyDefinitions!.Shown={type:'VARIANT',defaultValue:'false',variantOptions:['false','true']};
 f.source.propertyDefinitions!.Location={type:'VARIANT',defaultValue:'Outer',variantOptions:['Outer','Inner']};
 f.source.variants=['Outer','Inner'].flatMap(location=>['false','true'].flatMap(shown=>original.map((row,i)=>{
  const main=structuredClone(row),label=main.children![0],stable=main.children![1];
  main.name+=',Shown='+shown+',Location='+location;main.variantProperties={...main.variantProperties,Shown:shown,Location:location};
  main.children=location==='Inner'?[{name:'Body',type:'FRAME',layout:structuredClone(main.layout),hidden:shown==='false',children:[label]},stable]:[stable];
  let count=0;const ids=(n:DumpNode)=>{n.nodeId=location+'-'+shown+'-'+i+'-'+count++;for(const ch of n.children??[])ids(ch);};ids(main);return main;
 })));
 return {...f,propose:()=>proposeFromDump(f.source,{fileKey:'file',corpus,contractIdByName:new Map(),mintUnbound:true,hiddenCaptured})};
}

test('owned ancestor Boolean and structural gates preserve joint literal text in React and native',()=>{
 const f=ancestorFixture(),before=JSON.stringify(f.source),{proposal,contract,part}=compiled(f);
 assert.equal(part.textByCombination!.rows.length,4);
 assert(proposal.notes.some(n=>n.includes('authenticated ancestor gates')));
 const native=createFigmaEngine({tokens:{primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(contract,new Map([[contract.id,contract]]));
 const texts=(n:any):string[]=>[...(n.type==='text'?[n.characters]:[]),...(n.children??[]).flatMap(texts)];
 for(const location of ['outer','inner'])for(const shown of [false,true])for(const mode of ['first','second'])for(const state of ['cold','warm']){
  const expected=mode[0].toUpperCase()+mode.slice(1)+':'+state[0].toUpperCase()+state.slice(1),present=location==='inner'&&shown;
  for(const inline of [false,true]){const html=render(contract,proposal.mintedTokens!.tree,{location,shown,mode,state},inline);assert.equal(html.includes(expected),present,JSON.stringify({location,shown,mode,state,inline}));assert(html.includes('Keep'));}
 }
 for(const v of native.variants){const present=v.name.includes('Location=Inner')&&v.name.includes('Shown=true');assert.equal(texts(v.spec).some(t=>t.includes(':')),present,v.name);}
 assert.equal(JSON.stringify(f.source),before);
});

test('scoped literal tables refuse incomplete, extra and independently mutable ancestor domains',()=>{
 const {contract}=compiled(ancestorFixture());
 for(const mutate of [(c:Contract,p:any)=>p.textByCombination.rows.pop(),(c:Contract,p:any)=>{const row=structuredClone(p.textByCombination.rows[0]);row.values[p.textByCombination.props.indexOf('shown')]='false';p.textByCombination.rows.push(row);},
  (c:Contract,p:any)=>{c.props.push({name:'independent',type:'boolean',default:false,bindings:{code:{prop:'independent'},figma:{kind:'BOOLEAN',property:'Independent'}}});const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.visibleWhen={prop:'independent'};},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;delete body.visibleWhen;delete body.presenceByCombination;},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.component={id:'external'};},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.slot={name:'children'};},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.repeat={itemsProp:'items',sample:[]};},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.declared={display:'none'};},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.statesByProp=[{prop:'mode',state:'hover',map:{first:{opacity:'{fade}'},second:{opacity:'{fade}'}}}];},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;body.visibleWhen={prop:'shown',equals:'true'};},
  (c:Contract,p:any)=>{const body=walkAnatomy(c).find(w=>w.part.parts&&Object.values(w.part.parts).includes(p))!.part;const shown=c.props.find(x=>x.name==='shown')!;shown.type={enum:['false','true']};shown.default='false';body.visibleWhen={prop:'shown',equals:true};},

 ]){const c=structuredClone(contract),p=walkAnatomy(c).find(w=>w.part.textByCombination)!.part;mutate(c,p);assert.equal(ContractSchema.safeParse(c).success,false);}
});

test('scoped literal proof refuses hidden source disagreement and broken original ownership',()=>{
 for(const mutate of [
  (f:ReturnType<typeof ancestorFixture>)=>{f.propose=()=>proposeFromDump(f.source,{fileKey:'file',corpus,contractIdByName:new Map(),mintUnbound:true,hiddenCaptured:false});},
  (f:ReturnType<typeof ancestorFixture>)=>{f.source.variants.find(v=>v.variantProperties!.Location==='Inner')!.children![0].propRefs={visible:'Independent'};},
  (f:ReturnType<typeof ancestorFixture>)=>{f.source.variants.find(v=>v.variantProperties!.Location==='Inner')!.children![0].type='INSTANCE';},
 ]){const f=ancestorFixture();mutate(f);const p=f.propose();assert(!walkAnatomy(p.contract as Contract).some(w=>w.part.textByCombination),'unqualified ancestor must not grant a table');}
});


test('state-dependent roots and mounted selection panels cannot authorize sparse literal rows',()=>{
 const f=ancestorFixture(),{contract}=compiled(f);
 for(const stateful of [true,false]){
  const c=structuredClone(contract),part=walkAnatomy(c).find(w=>w.part.textByCombination)!.part;
  if(stateful){c.states=['hover'];c.anatomy.root.statesByProp=[{prop:'mode',state:'hover',map:{first:{opacity:'{fade}'},second:{opacity:'{fade}'}}}];}
  else c.selection={pattern:'tabs',valueProp:'mode',listPart:'Stable',itemPart:'Stable',selected:{prop:'selected',on:'true',off:'false'},panels:[{value:'first',part:'Body',focusable:false}],orientation:'horizontal',direction:'ltr',activation:'automatic',bindings:{code:{prop:'onSelect'}}};
  assert.equal(ownedLiteralTextDomain(c,part),undefined);
  assert(textByCombinationIssues(c,part,true).includes('literal-text-combination-source-domain-incomplete'));
  const axes:AuthoredTextAppearanceAxis[]=c.props.filter(p=>p.bindings.figma.kind==='VARIANT').map(p=>{const values=p.bindings.figma.values!;return{property:p.bindings.figma.property!,prop:p.name,boolean:p.type==='boolean',values:Object.values(values),map:Object.fromEntries(Object.entries(values).map(([k,v])=>[v,k]))};});
  const domain=f.source.variants.map(v=>axes.map(a=>a.map[v.variantProperties![a.property]]));
  const occurrences=f.source.variants.flatMap(v=>v.children?.find(n=>n.name==='Body')?.children?.map(node=>({variant:v.name,node}))??[]);
  assert.equal(qualifyScopedAuthoredLiteralTextTable(f.source,'file',occurrences,axes,domain,true,part,c),undefined,'proposer carrier shares the runtime reachability refusal');
 }
});
