import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {build} from 'esbuild';
import {ContractSchema,FillStackSchema,FillStackTableSchema,type Contract,type Part} from '../scripts/contract-schema.js';
import {qualifySolidFillColorBinding} from '../packages/schema/src/solid-fill-binding.js';
import {planSolidFillBindingTokens} from './solid-fill-binding-tokens.js';
import {revisionOf} from './contract-provenance.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {fillStackPositionParts} from './react-fill-stack.js';

const stack=FillStackSchema.parse({version:1,order:'bottom-to-top',paints:[
  {index:0,type:'SOLID',color:{r:1,g:0,b:0},visible:true,opacity:1,blendMode:'NORMAL'},
  {index:1,type:'SOLID',color:{r:0,g:0,b:1},visible:true,opacity:.5,blendMode:'NORMAL'},
]});
const tokens={primitives:{position:{static:{$type:'string',$value:'static'}},opacity:{dim:{$type:'number',$value:.5},full:{$type:'number',$value:1}},paint:{test:{$type:'color',$value:'#000000'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
const inventory=new Set(['position.static','opacity.dim','opacity.full','paint.test']);
const mode={name:'mode',type:{enum:['a','b']},default:'a',bindings:{figma:{kind:'VARIANT' as const,property:'Mode',values:{a:'A',b:'B'}},code:{prop:'mode'}}};
function fixture(name='ReviewedPaint'):Contract {
  return ContractSchema.parse({id:'test.'+name.toLowerCase(),name,version:'1.0.0',status:'draft',description:'Reviewed ordered paint guard',props:[],states:[],semantics:{element:'div'},anatomy:{root:{literals:{width:'24px',height:'24px'},fillStack:stack,parts:{Label:{text:'Content'}}}},bindings:{figma:{anchors:{fileKey:'file',componentSetKey:'key'}},code:{anchors:{importPath:'./'+name,export:name}}}});
}
function emit(kind:'module'|'inline',contract:Contract,scope=new Map([[contract.id,contract]])){
  return kind==='module'?emitReact(contract,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts:scope}):emitReactInline(contract,{tokens,icons:new Map(),contracts:scope});
}
async function render(name:string,tsx:string,dependencies:Record<string,string>={}){
  const output=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {${name}} from 'subject';exports.html=()=>renderToStaticMarkup(React.createElement(${name}));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom/server'],plugins:[{name:'memory',setup(b){
    b.onResolve({filter:/^(subject|\.\.?\/)/},a=>a.path==='subject'?{path:name,namespace:'memory'}:dependencies[a.path.split('/').pop()!]?{path:a.path.split('/').pop()!,namespace:'memory'}:a.path.endsWith('.css')?{path:'style',namespace:'css'}:undefined);
    b.onLoad({filter:/.*/,namespace:'memory'},a=>({contents:a.path===name?tsx:dependencies[a.path],loader:'tsx',resolveDir:process.cwd()}));
    b.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default new Proxy({}, {get:(_,name)=>String(name)})',loader:'js'}));
  }}]});
  const mod={exports:{} as {html?:()=>string}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
  return mod.exports.html!();
}
function receiving(child:Contract){
  const parent=fixture('ReviewedParent');delete parent.anatomy.root.fillStack;
  parent.anatomy.root.parts={Child:{component:{id:child.id},fillStack:stack,fillStackSource:{fileKey:'file',setKey:'key',contractRevision:revisionOf(child)}}};
  return{parent,scope:new Map([[child.id,child],[parent.id,parent]])};
}

test('statesByProp background, filter and isolation cannot compete with an ordered stack',()=>{
  for(const channel of ['background-color','filter','isolation']){
    const c=fixture();c.props=[structuredClone(mode)];c.states=['hover'];
    c.anatomy.root.statesByProp=[{prop:'mode',state:'hover',map:{a:{[channel]:'{paint.test}'},b:{}}}];
    const parsed=ContractSchema.safeParse(c);assert.equal(parsed.success,false,channel);
    if(!parsed.success)assert(parsed.error.issues.some(i=>i.message==='fill-stack-competing-paint'),channel);
    for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,c),/fill-stack-(?:competing-paint|react-competing-composition)/,kind+':'+channel);
  }
});

test('non-paint statesByProp stays supported on both React surfaces',async()=>{
  const c=fixture();c.props=[structuredClone(mode)];c.states=['hover'];
  c.anatomy.root.statesByProp=[{prop:'mode',state:'hover',map:{a:{opacity:'{opacity.dim}'},b:{opacity:'{opacity.full}'}}}];
  const parsed=ContractSchema.parse(c);
  for(const kind of ['module','inline'] as const){const out=emit(kind,parsed);const html=await render(c.name,out.tsx);assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);assert.match(html,/Content/);}
  const css=(emit('module',parsed) as ReturnType<typeof emitReact>).css;
  assert.match(css,/:hover/);assert.match(css,/opacity:\s*var\(--opacity-dim\)/);
});

test('unresolved token and conditional position channels never receive an overriding relative position',()=>{
  const changes:Array<(part:Part)=>void>=[
    p=>{p.tokens={position:'{position.static}'};},
    p=>{p.declared={position:'relative'};p.tokens={position:'{position.static}'};},
    p=>{p.tokensByProp=[{prop:'mode',map:{a:{position:'{position.static}'},b:{}}}];},
    p=>{p.states={hover:{position:'{position.static}'}};},
    p=>{p.declared={position:'relative'};p.declaredStates={hover:{position:'static'}};},
    p=>{p.statesByProp=[{prop:'mode',state:'hover',map:{a:{position:'{position.static}'},b:{}}}];},
    p=>{p.tokensByCombination=[{props:['mode','other'],rows:[{values:['a','a'],tokens:{position:'{position.static}'}},{values:['a','b'],tokens:{}},{values:['b','a'],tokens:{}},{values:['b','b'],tokens:{}}]}];},
    p=>{p.stylesWhen=[{prop:'mode',equals:'a',styles:{position:'static'}}];},
  ];
  for(const change of changes){const c=fixture();c.props=[structuredClone(mode),{...structuredClone(mode),name:'other',bindings:{figma:{...mode.bindings.figma,property:'Other'},code:{prop:'other'}}}];c.states=['hover'];change(c.anatomy.root);
    assert.throws(()=>fillStackPositionParts(c),/fill-stack-react-position-unqualified/);
    for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,c),/fill-stack-react-position-unqualified/);
  }
});

test('explicit positions survive while an unpositioned owned box gains its containing block',async()=>{
  for(const position of [undefined,'relative','absolute'] as const){const c=fixture();if(position)c.anatomy.root.declared={position};
    assert.deepEqual(fillStackPositionParts(c),position?[]:['root']);
    for(const kind of ['module','inline'] as const){const out=emit(kind,c),html=await render(c.name,out.tsx);assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);
      if(kind==='inline')assert.match(html,new RegExp('position:'+(position??'relative')));
      else {const css=(out as ReturnType<typeof emitReact>).css;assert(!css.includes('[data-dsc-stack-active]::before'));if(position==='absolute')assert(!css.includes(':where(.root) { position: relative; }'));}
    }
  }
});

test('root minimum hit area is refused for owned and received stacks without weakening ordinary hit areas',()=>{
  const own=fixture();own.a11y={minHitArea:44};
  const parsed=ContractSchema.safeParse(own);assert.equal(parsed.success,false);if(!parsed.success)assert(parsed.error.issues.some(i=>i.message==='fill-stack-min-hit-area-unqualified'));
  for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,own),/fill-stack-react-min-hit-area-unqualified/);
  const child=fixture('ReviewedHitChild');delete child.anatomy.root.fillStack;child.a11y={minHitArea:44};
  const {parent,scope}=receiving(child);
  for(const kind of ['module','inline'] as const){assert.throws(()=>emit(kind,parent,scope),/fill-stack-react-min-hit-area-unqualified/);assert.throws(()=>emit(kind,child,scope),/fill-stack-react-min-hit-area-unqualified/);}
  const ordinary=emitReact(child,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts:new Map([[child.id,child]])});
  assert.match(ordinary.css,/::before/);assert.match(ordinary.css,/44px/);assert(!ordinary.css.includes('[data-dsc-stack-active]::before'));
});

test('a nested stack preserves its unpainted ancestor minimum hit area',async()=>{
  const c=fixture();delete c.anatomy.root.fillStack;c.a11y={minHitArea:44};
  c.anatomy.root.parts={Surface:{fillStack:stack,parts:{Label:{text:'Content'}}}};
  const parsed=ContractSchema.parse(c);
  for(const kind of ['module','inline'] as const){const out=emit(kind,parsed),html=await render(c.name,out.tsx);assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);}
  const css=(emit('module',parsed) as ReturnType<typeof emitReact>).css;
  assert.match(css,/::before/);assert.match(css,/44px/);assert(!css.includes('[data-dsc-stack-active]::before'));
});

function boundPart():Part {
  const paint={color:{r:.25,g:.5,b:.75},opacity:.5,blendMode:'NORMAL' as const},value={...paint.color,a:.5};
  const binding=qualifySolidFillColorBinding({paint,variableId:'source-ink'},{'source-ink':{name:'ink',collectionId:'paint',modeId:'base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}});
  const token=planSolidFillBindingTokens([binding]).requestedTokenPaths[0];
  return{solidFillComposition:paint,solidFillCompositionToken:token,solidFillCompositionSourceBinding:[{owner:'root',nodeName:'Ink',variantName:'Default',binding}]};
}
test('backdrop-dependent descendants and unproved component content cannot cross a new isolation boundary',()=>{
  const descendants:Part[]=[
    {text:'Blend',declared:{'mix-blend-mode':'multiply'}},
    {text:'State blend',statesByProp:[{prop:'mode',state:'hover',map:{a:{'mix-blend-mode':'{paint.test}'},b:{}}}]},
    boundPart(),{component:{id:'external.unproved'}},{slot:{name:'content'}},
  ];
  for(const descendant of descendants){const c=fixture();c.props=[structuredClone(mode)];c.states=['hover'];c.anatomy.root.parts={Dependent:descendant};
    const parsed=ContractSchema.safeParse(c);assert.equal(parsed.success,false);if(!parsed.success)assert(parsed.error.issues.some(i=>i.message==='fill-stack-backdrop-dependent-child'));
    for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,c),/fill-stack-react-backdrop-dependent-child/);
    const child=fixture('ReviewedDependentChild');delete child.anatomy.root.fillStack;child.props=[structuredClone(mode)];child.states=['hover'];child.anatomy.root.parts={Dependent:structuredClone(descendant)};
    const {parent,scope}=receiving(child);
    for(const kind of ['module','inline'] as const){assert.throws(()=>emit(kind,parent,scope),/fill-stack-react-backdrop-dependent-child/);assert.throws(()=>emit(kind,child,scope),/fill-stack-react-backdrop-dependent-child/);}
  }
});

test('plain received root stacks keep child position and content on both React surfaces',async()=>{
  const child=fixture('ReviewedPlainChild');delete child.anatomy.root.fillStack;child.anatomy.root.declared={position:'absolute'};child.anatomy.root.literals!['background-color']='#ffffff';
  const {parent,scope}=receiving(child);
  for(const kind of ['module','inline'] as const){const parentOut=emit(kind,parent,scope),childOut=emit(kind,child,scope),html=await render(parent.name,parentOut.tsx,{[child.name]:childOut.tsx});
    assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);assert.equal((html.match(/Content/g)||[]).length,1);
    if(kind==='inline')assert.match(html,/position:absolute/);else assert(!(childOut as ReturnType<typeof emitReact>).css.includes(':where(.root) { position: relative; }'));
  }
  child.anatomy.root.tokens={position:'{position.static}'};const changed=receiving(child);
  for(const kind of ['module','inline'] as const){assert.throws(()=>emit(kind,changed.parent,changed.scope),/fill-stack-react-position-unqualified/);assert.throws(()=>emit(kind,child,changed.scope),/fill-stack-react-position-unqualified/);}
});

test('legacy composed paint receivers refuse instead of leaving their old pseudo paint beneath a new stack',()=>{
  const child=fixture('ReviewedLegacyChild');delete child.anatomy.root.fillStack;child.anatomy.root.solidFillComposition={color:{r:0,g:0,b:0},opacity:.5,blendMode:'NORMAL'};
  const {parent,scope}=receiving(child);
  for(const kind of ['module','inline'] as const){assert.throws(()=>emit(kind,parent,scope),/fill-stack-react-received-paint-unqualified/);assert.throws(()=>emit(kind,child,scope),/fill-stack-react-received-paint-unqualified/);}
});

test('large Cartesian axes use the complete small drawn domain; no-drawn oversized products refuse',()=>{
  const c=fixture('ReviewedSparse');delete c.anatomy.root.fillStack;
  c.props=Array.from({length:13},(_,i)=>({name:'axis'+i,type:{enum:['a','b']},default:'a',bindings:{figma:{kind:'VARIANT' as const,property:'Axis'+i,values:{a:'A',b:'B'}},code:{prop:'axis'+i}}}));
  const a=Object.fromEntries(c.props.map(p=>[p.name,'a'])),b=Object.fromEntries(c.props.map(p=>[p.name,'b']));
  c.bindings.figma.drawnVariants=[a,b];
  c.anatomy.root.fillStackByCombination={props:c.props.map(p=>p.name),rows:[{values:c.props.map(()=> 'a'),stack},{values:c.props.map(()=> 'b'),stack:{version:1,order:'bottom-to-top',paints:[]}}]};
  const parsed=ContractSchema.parse(c);assert.deepEqual(parsed.anatomy.root.fillStackByCombination?.rows,c.anatomy.root.fillStackByCombination.rows);
  const absent=structuredClone(c);delete absent.bindings.figma.drawnVariants;
  const refused=ContractSchema.safeParse(absent);assert.equal(refused.success,false);if(!refused.success)assert(refused.error.issues.some(i=>i.message==='fill-stack-domain-too-large'));
});

test('serialized stack tables enforce the same 4096-row bound without truncating rows',()=>{
  const rows=Array.from({length:4097},(_,i)=>({values:[String(i)],stack:{version:1 as const,order:'bottom-to-top' as const,paints:[]}}));
  assert.equal(FillStackTableSchema.safeParse({props:['axis'],rows}).success,false);
  const accepted=FillStackTableSchema.parse({props:['axis'],rows:rows.slice(0,4096)});assert.equal(accepted.rows.length,4096);assert.equal(accepted.rows.at(-1)?.values[0],'4095');
});
