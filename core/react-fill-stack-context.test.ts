import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {ContractSchema, FillStackSchema, type Contract, type Part} from '../scripts/contract-schema.js';
import {revisionOf} from './contract-provenance.js';
import {receivedFillContextProof} from './react-fill-stack-context.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {generatedTypeErrors} from './react-test-runtime.js';

const stack = FillStackSchema.parse({version:1,order:'bottom-to-top',paints:[
  {index:0,type:'SOLID',color:{r:1,g:0,b:0},visible:true,opacity:1,blendMode:'NORMAL'},
  {index:1,type:'SOLID',color:{r:0,g:0,b:1},visible:true,opacity:.5,blendMode:'NORMAL'},
]});
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
const axis=(name:string,options:string[],value?:string)=>({name,type:{enum:options},...(value===undefined?{}:{default:value}),bindings:{figma:{kind:'VARIANT' as const,property:name,values:Object.fromEntries(options.map(v=>[v,v]))},code:{prop:name}}});
function base(name:string):Contract {
  return ContractSchema.parse({id:'test.'+name.toLowerCase(),name,version:'1.0.0',status:'draft',description:'Context-pinned receiving fixture',props:[],states:[],semantics:{element:'div'},anatomy:{root:{literals:{width:'24px',height:'24px'},parts:{Label:{text:'Safe'}}}},bindings:{figma:{anchors:{fileKey:'source-file',componentSetKey:name+'-key'}},code:{anchors:{importPath:'./'+name,export:name}}}});
}
function fixture(){
 const child=base('ContextChild');child.props=[axis('shape',['circle','square'],'square'),axis('kind',['image','icon'],'icon'),axis('size',['one','two','three','four'],'one'),axis('action',['none','edit'],'none')];
 child.anatomy.root.parts={Label:{text:'Safe'},Nested:{visibleWhen:{prop:'action',equals:'edit'},component:{id:'test.unsafe'}},Content:{slot:{name:'children',renderDefault:true,collapseWhenEmpty:true,defaultContent:[{id:'test.unsafe'}]},parts:{Default:{component:{id:'test.unsafe'},visibleWhen:{prop:'kind',equals:'icon'}}}}};
 const dep=base('Unsafe');dep.anatomy.root.parts={Ink:{text:'Nested'}};
 const parent=base('ContextParent');parent.props=[axis('extent',['one','two','three','four'],'one'),axis('unused',['off','on'],'off')];
 parent.bindings.figma.drawnVariants= ['one','two','three','four'].flatMap(extent=>['off','on'].map(unused=>({extent,unused})));
 parent.anatomy.root.parts={Only:{component:{id:child.id,props:{shape:'circle',kind:'image',size:'{extent}'}},fillStack:stack,fillStackSource:{fileKey:'source-file',setKey:child.bindings.figma.anchors.componentSetKey!,contractRevision:revisionOf(child)}}};
 const repin=()=>{parent.anatomy.root.parts!.Only.fillStackSource!.contractRevision=revisionOf(child);};
 const scope=new Map([[parent.id,parent],[child.id,child],[dep.id,dep]]);
 return{parent,child,dep,scope,part:parent.anatomy.root.parts.Only,repin};
}
const emit=(kind:'module'|'inline',c:Contract,scope:Map<string,Contract>)=>kind==='module'?emitReact(c,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:scope}):emitReactInline(c,{tokens,icons:new Map(),contracts:scope});
async function runtime(name:string,tsx:string,dependencies:Record<string,string>={}){
 const output=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {${name}} from 'subject';exports.render=(props)=>renderToStaticMarkup(React.createElement(${name},props));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom/server'],plugins:[{name:'memory',setup(b){
  b.onResolve({filter:/^(subject|\.\.?\/)/},a=>a.path==='subject'?{path:name,namespace:'memory'}:dependencies[a.path.split('/').pop()!]?{path:a.path.split('/').pop()!,namespace:'memory'}:a.path.endsWith('.css')?{path:'style',namespace:'css'}:undefined);
  b.onLoad({filter:/.*/,namespace:'memory'},a=>({contents:a.path===name?tsx:dependencies[a.path],loader:'tsx',resolveDir:process.cwd()}));
  b.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default new Proxy({}, {get:(_,name)=>String(name)})',loader:'js'}));
 }}]});
 const mod={exports:{} as {render?:(props:Record<string,unknown>)=>string}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return mod.exports.render!;
}
const layers=[{index:0,style:{backgroundColor:'red'}}];

test('complete parent domains derive four contexts from exact args plus real omitted child defaults',()=>{
 const f=fixture(),proof=receivedFillContextProof(f.child,f.scope)!;
 assert.deepEqual(proof.props,['shape','kind','size','action']);
 assert.deepEqual(proof.tuples,['one','two','three','four'].map(size=>['circle','image',size,'none']));
 assert.deepEqual(proof.omittedSlots,['children']);assert.equal(proof.edges.length,1);assert.equal(proof.edges[0].path,'root/Only');
 assert.equal(proof.edges[0].childRevision,revisionOf(f.child));assert.equal(proof.edges[0].parentRevision,revisionOf(f.parent));
});

test('each typed receiving edge contributes every actual context; no first row or first parent shortcut',()=>{
 const f=fixture();const other=structuredClone(f.parent);other.id='test.other';other.name='Other';other.anatomy.root.parts!.Only.component!.props!.shape='square';f.scope.set(other.id,other);
 assert.equal(receivedFillContextProof(f.child,f.scope)!.tuples.length,8);
 other.anatomy.root.parts!.Only.component!.props!.action='edit';assert.throws(()=>receivedFillContextProof(f.child,f.scope),/active-reference/);
});

test('arg, default, revision and active nested-reference mutations refuse',()=>{
 const mutations:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.part.component!.props!.action='edit';},
  f=>{f.child.props.find(p=>p.name==='action')!.default='edit';f.repin();},
  f=>{delete f.part.component!.props!.kind;},
  f=>{f.child.anatomy.root.parts!.Nested.visibleWhen!.equals='none';f.repin();},
  f=>{f.child.description+=' changed';},
  f=>{f.part.fillStackSource!.fileKey='other-file';},
  f=>{f.part.fillStackSource!.setKey='other-key';},
  f=>{f.scope.delete(f.child.id);},
 ];
 for(const [i,change]of mutations.entries()){const f=fixture();change(f);if(i===7)assert.throws(()=>emit('module',f.parent,f.scope),/reference/);else assert.throws(()=>receivedFillContextProof(f.child,f.scope),/fill-stack-react-context/,String(i));}
});

test('authoritative gated slot anatomy wins over unconditional defaultContent; actual fallback refs and caller content refuse',()=>{
 const f=fixture();assert(receivedFillContextProof(f.child,f.scope));
 const variants:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{delete f.child.anatomy.root.parts!.Content.parts;f.repin();},
  f=>{f.part.parts={Supplied:{text:'Caller'}};},
  f=>{f.part.component!.text='Caller';},
  f=>{f.part.component!.contentSlot='children';},
  f=>{f.part.component!.contentSlots={children:['Supplied']};},
 ];
 for(const change of variants){const x=fixture();change(x);assert.throws(()=>receivedFillContextProof(x.child,x.scope),/context-(?:active-slot|caller-content)/);}
});

test('Boolean gates use exact types; explicit visibility overrides bypass defaults but cannot bypass availability',()=>{
 const f=fixture();f.child.props.push({name:'enabled',type:'boolean',default:false,bindings:{figma:{kind:'BOOLEAN',property:'enabled'},code:{prop:'enabled'}}});
 f.child.anatomy.root.parts!.Nested={component:{id:f.dep.id},visibleWhen:{prop:'enabled'}};f.repin();assert(receivedFillContextProof(f.child,f.scope));
 f.part.component!.props!.enabled=true;assert.throws(()=>receivedFillContextProof(f.child,f.scope),/active-reference/);
 f.part.component!.props!.enabled='unknown';assert.throws(()=>receivedFillContextProof(f.child,f.scope),/BOOLEAN_LOOKUP/);
 f.part.component!.props!.enabled=false;f.child.props.at(-1)!.bindings.figma={kind:'NONE'};delete f.child.props.at(-1)!.default;
 f.child.anatomy.root.parts!.Nested={visibilityOverrideProp:'enabled',visibilityOverrideDefault:true,parts:{Dependent:{component:{id:f.dep.id}}}};f.repin();assert(receivedFillContextProof(f.child,f.scope));
 delete f.part.component!.props!.enabled;f.repin();assert.throws(()=>receivedFillContextProof(f.child,f.scope),/active-reference/);
});

test('presence and availability are evaluated in the same lazy order as React',()=>{
 const f=fixture(),part=f.child.anatomy.root.parts!.Nested;
 delete part.visibleWhen;part.presenceByCombination={props:['action'],rows:[{values:['none'],present:false},{values:['edit'],present:true}]};f.repin();assert(receivedFillContextProof(f.child,f.scope));
 part.presenceByCombination.rows[0].present=true;f.repin();assert.throws(()=>receivedFillContextProof(f.child,f.scope),/active-reference/);
 f.child.props.push({name:'shown',type:'boolean',bindings:{figma:{kind:'NONE'},code:{prop:'shown'}}});
 part.visibilityOverrideProp='shown';f.child.bindings.figma.drawnVariants=['circle','square'].flatMap(shape=>['image','icon'].flatMap(kind=>['one','two','three','four'].flatMap(size=>['none','edit'].map(action=>({shape,kind,size,action})))));
 part.availabilityByCombination={props:['action'],rows:[{values:['none'],present:false},{values:['edit'],present:true}]};f.repin();assert(receivedFillContextProof(f.child,f.scope));
});

test('unqualified state, runtime, unbounded parent mappings and ambiguous table rows refuse',()=>{
 const changes:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.child.states=['hover'];f.repin();},
  f=>{f.parent.states=['hover'];},
  f=>{f.child.bindings.code.runtime={version:1,kind:'custom-element',artifactRevision:revisionOf('a'),interfaceRevision:revisionOf('b'),bindingRevision:revisionOf('c')};f.repin();},
  f=>{f.parent.props.push({name:'label',type:'text',default:'one',bindings:{figma:{kind:'TEXT',property:'label'},code:{prop:'label'}}});f.part.component!.props!.size='{label}';},
  f=>{delete f.part.component!.props!.size;f.part.component!.enumPropsByCombination={size:{props:['extent'],rows:[{values:['one'],value:'one'},{values:['one'],value:'one'}]}};},
  f=>{Object.defineProperty(f.part.component!.props!,'constructor',{value:'bad',enumerable:true});},
 ];
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>receivedFillContextProof(f.child,f.scope),/fill-stack-react-context/);}
});

test('fixed lookup and nullable joint arguments retain child defaults; literal brace text stays literal',()=>{
 const f=fixture();delete f.part.component!.props!.size;f.part.component!.enumPropsByCombination={size:{props:['extent'],rows:['one','two','three','four'].map((v,i)=>({values:[v],value:i===0?null:v}))}};
 f.child.props.push({name:'label',type:'text',default:'fallback',bindings:{figma:{kind:'TEXT',property:'label'},code:{prop:'label'}}});
 f.part.component!.textPropsByCombination={label:{props:['extent'],rows:['one','two','three','four'].map(v=>({values:[v],value:'{literal}'}))}};f.repin();
 assert.equal(receivedFillContextProof(f.child,f.scope)!.tuples[0][2],'one');assert(receivedFillContextProof(f.child,f.scope)!.tuples.every(row=>row.at(-1)==='{literal}'));
 delete f.part.component!.enumPropsByCombination;f.part.component!.props!.size={prop:'extent',map:{one:'two',two:'three',three:'four'}};
 assert.deepEqual(receivedFillContextProof(f.child,f.scope)!.tuples.map(row=>row[2]),['two','three','four','one']);
});

test('both generated React runtimes keep one child and reject unapproved tuple, caller content and unknown props for stack OR color',async()=>{
 const f=fixture();const safe={shape:'circle',kind:'image',size:'one',action:'none'};
 for(const kind of ['module','inline'] as const){
  const dep=emit(kind,f.dep,f.scope),child=emit(kind,f.child,f.scope),parent=emit(kind,f.parent,f.scope);
  assert.deepEqual(generatedTypeErrors(f.child.name,child.tsx,{[f.dep.name]:dep.tsx}),[]);
  assert.deepEqual(generatedTypeErrors(f.parent.name,parent.tsx,{[f.child.name]:child.tsx,[f.dep.name]:dep.tsx}),[]);
  const renderChild=await runtime(f.child.name,child.tsx,{[f.dep.name]:dep.tsx});
  const renderParent=await runtime(f.parent.name,parent.tsx,{[f.child.name]:child.tsx,[f.dep.name]:dep.tsx});
  for(const extent of ['one','two','three','four']){const html=renderParent({extent});assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);assert.equal((html.match(/Safe/g)||[]).length,1);assert(!html.includes('Nested'));}
  assert.match(renderChild({children:'Caller',action:'edit'}),/Caller/);assert.match(renderChild({children:'Caller',action:'edit'}),/Nested/);assert(!renderChild({}).includes('data-dsc-stack-active'));
  for(const input of [{__dscFillStack:layers},{__dscFillColor:'red'}]){
   const html=renderChild({...safe,...input});assert.match(html,/data-dsc-stack-active/);assert(!html.includes('Nested'));
   const bad:Array<Record<string,unknown>>=[{action:'edit'},{kind:'icon'},{size:'missing'},{shape:undefined},{size:true},{children:null},{children:false},{children:''},{children:[]},{children:'Caller'},{constructor:'bad'},{prototype:'bad'},{style:{mixBlendMode:'multiply'}},{statePreview:'hover'},{unknown:true}];
   for(const change of bad)assert.throws(()=>renderChild({...safe,...input,...change}),/fill-stack-received-/,kind+JSON.stringify(change));
   assert.doesNotThrow(()=>renderChild({...safe,...input,children:undefined}));
  }
 }
});


test('named-slot-only receivers use only real emitter bindings and strictly reject supplied content',async()=>{
 const f=fixture();f.child.anatomy.root.parts!.Content.slot!.name='leading';f.repin();
 for(const kind of ['module','inline'] as const){
  const dep=emit(kind,f.dep,f.scope),out=emit(kind,f.child,f.scope);
  assert.deepEqual(generatedTypeErrors(f.child.name,out.tsx,{[f.dep.name]:dep.tsx}),[]);
  if(kind==='module')assert(!out.tsx.includes(' || children !== undefined'));
  const render=await runtime(f.child.name,out.tsx,{[f.dep.name]:dep.tsx});
  const props={shape:'circle',kind:'image',size:'one',action:'none',__dscFillStack:layers};
  assert.match(render(props),/data-dsc-stack-active/);
  for(const leading of ['',false,null,[],['text']])assert.throws(()=>render({...props,leading}),/fill-stack-received-slot-content/);
  assert.throws(()=>render({...props,children:'foreign'}),/fill-stack-received-/);
  assert.match(render({leading:'ordinary'}),/ordinary/);
 }
 for(const name of ['bad-slot','constructor','class','style','undefined','globalThis','eval','arguments']){f.child.anatomy.root.parts!.Content.slot!.name=name;f.repin();assert.throws(()=>receivedFillContextProof(f.child,f.scope),/context-slot-/);}
});

test('missing direct dependency, self cycle and incomplete argument row cannot grant context permission',()=>{
 let f=fixture();f.scope.delete(f.dep.id);assert.throws(()=>receivedFillContextProof(f.child,f.scope),/dependency-closure/);
 f=fixture();f.child.anatomy.root.parts!.Nested.component!.id=f.child.id;f.repin();assert.throws(()=>receivedFillContextProof(f.child,f.scope),/dependency-closure/);
 f=fixture();delete f.part.component!.props!.size;f.part.component!.enumPropsByCombination={size:{props:['extent'],rows:[{values:['one'],value:'one'}]}};
 assert.throws(()=>receivedFillContextProof(f.child,f.scope),/component-argument-combination-unqualified/);
});


test('overlapping parent source ranks pass exact inline transport; foreign style and positioned transport refuse',async()=>{
 const f=fixture();f.parent.anatomy.root.layout={display:'flex',direction:'row',overlap:true,reversePaint:true};
 f.parent.anatomy.root.parts!.Before={component:{id:f.dep.id}};
 const proof=receivedFillContextProof(f.child,f.scope)!;
 assert(proof.inlineStyles.every(styles=>JSON.stringify(styles)==='[{"zIndex":2}]'));
 for(const kind of ['module','inline'] as const){
  const dep=emit(kind,f.dep,f.scope),child=emit(kind,f.child,f.scope),parent=emit(kind,f.parent,f.scope);
  assert.deepEqual(generatedTypeErrors(f.parent.name,parent.tsx,{[f.child.name]:child.tsx,[f.dep.name]:dep.tsx}),[]);
  const render=await runtime(f.parent.name,parent.tsx,{[f.child.name]:child.tsx,[f.dep.name]:dep.tsx});
  const html=render({extent:'two'});assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);
  if(kind==='inline'){
   assert.match(html,/z-index:2/);
   const direct=await runtime(f.child.name,child.tsx,{[f.dep.name]:dep.tsx});
   const props={shape:'circle',kind:'image',size:'two',action:'none',__dscFillStack:layers};
   assert.doesNotThrow(()=>direct({...props,style:{zIndex:2}}));
   for(const style of [undefined,{zIndex:3},{zIndex:2,mixBlendMode:'multiply'},{zIndex:2,top:0}])assert.throws(()=>direct({...props,style}),/received-style/);
   let reads=0;const accessor=Object.defineProperty({},'zIndex',{enumerable:true,get(){reads++;return 2;}});
   assert.throws(()=>direct({...props,style:accessor}),/received-style/);assert.equal(reads,0);
   assert.throws(()=>direct({...props,style:Object.defineProperty({},'zIndex',{value:2,enumerable:false})}),/received-style/);
  }
 }
 f.part.absolutePlacement={left:3,top:5};
 for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,f.parent,f.scope),/positioned-transport-unqualified/);
});


test('large finite products use validated small drawn domains and refuse an unbounded expansion',()=>{
 const f=fixture();f.parent.props=Array.from({length:13},(_,i)=>axis('axis'+i,['a','b'],'a'));
 f.parent.bindings.figma.drawnVariants=['a','b'].map(v=>Object.fromEntries(f.parent.props.map(p=>[p.name,v])));
 f.part.component!.props!.size='one';assert.equal(receivedFillContextProof(f.child,f.scope)!.tuples.length,1);
 delete f.parent.bindings.figma.drawnVariants;assert.throws(()=>receivedFillContextProof(f.child,f.scope),/parent-domain-too-large/);
});

test('the same child tuple retains both exact rank transports from two pinned receiving edges',async()=>{
 const f=fixture();f.parent.anatomy.root.layout={display:'flex',direction:'row',reversePaint:true};
 const other=structuredClone(f.parent);other.id='test.other-ranked';other.name='OtherRanked';other.anatomy.root.parts!.Second={component:{id:f.dep.id}};f.scope.set(other.id,other);
 const proof=receivedFillContextProof(f.child,f.scope)!;
 assert.equal(proof.edges.length,2);assert.equal(proof.tuples.length,4);
 assert(proof.inlineStyles.every(styles=>JSON.stringify(styles)==='[{"zIndex":1},{"zIndex":2}]'));
 const dep=emit('inline',f.dep,f.scope),child=emit('inline',f.child,f.scope);
 for(const parent of [f.parent,other]){
  const out=emit('inline',parent,f.scope),render=await runtime(parent.name,out.tsx,{[f.child.name]:child.tsx,[f.dep.name]:dep.tsx});
  assert.equal((render({extent:'four'}).match(/data-dsc-paint-index=/g)||[]).length,2);
 }
});


test('actual null never stands in for a proved omitted scalar input on either React surface',async()=>{
 const f=fixture();f.child.props.push({name:'flag',type:'boolean',bindings:{figma:{kind:'BOOLEAN',property:'Flag'},code:{prop:'flag'}}});f.repin();
 assert(receivedFillContextProof(f.child,f.scope)!.tuples.every(row=>row.at(-1)===null));
 for(const kind of ['module','inline'] as const){
  const out=emit(kind,f.child,f.scope),dep=emit(kind,f.dep,f.scope),render=await runtime(f.child.name,out.tsx,{[f.dep.name]:dep.tsx});
  for(const extra of [{__dscFillStack:layers},{__dscFillColor:'red'}]){
   const props={shape:'circle',kind:'image',size:'one',action:'none',...extra};assert.doesNotThrow(()=>render(props));
   for(const flag of [null,false,'false',true,{}])assert.throws(()=>render({...props,flag}),/received-context/);
  }
 }
 for(const alias of ['undefined','globalThis','eval','arguments','class']){f.child.props.at(-1)!.bindings.code.prop=alias;f.repin();assert.throws(()=>receivedFillContextProof(f.child,f.scope),/input-identity/);}
});

test('authored descendant stacking refuses for own and received paints, including token and conditional channels',()=>{
 const changes:Array<(p:Part)=>void>=[p=>{p.declared={'z-index':'-2',position:'relative'};},p=>{p.tokens={'z-index':'{rank.negative}'};},p=>{p.literalsByProp=[{prop:'action',map:{none:{'z-index':'-2'},edit:{'z-index':'0'}}}];},p=>{p.stylesWhen=[{prop:'action',equals:'none',styles:{'z-index':'-2'}}];}];
 for(const change of changes){
  const f=fixture();change(f.child.anatomy.root.parts!.Label);f.repin();
  for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,f.child,f.scope),/foreground-stacking/);
  const own=base('OwnStack');own.props=[axis('action',['none','edit'],'none')];own.anatomy.root.fillStack=stack;change(own.anatomy.root.parts!.Label);
  for(const kind of ['module','inline'] as const)assert.throws(()=>emit(kind,own,new Map([[own.id,own]])),/foreground-stacking/);
 }
 const f=fixture();f.child.anatomy.root.parts!.Nested.declared={'z-index':'-2'};f.repin();assert(receivedFillContextProof(f.child,f.scope));
});


test('Boolean lookup keys stay canonical so static proof matches emitted typed comparisons',()=>{
 const f=fixture();f.parent.props.push({name:'flag',type:'boolean',default:false,bindings:{figma:{kind:'VARIANT',property:'Flag',values:{true:'True',false:'False'}},code:{prop:'flag'}}});
 f.parent.bindings.figma.drawnVariants=f.parent.bindings.figma.drawnVariants!.flatMap(row=>[false,true].map(flag=>({...row,flag})));
 f.part.component!.props!.size={prop:'flag',map:{false:'one',true:'two'}};
 assert.deepEqual(receivedFillContextProof(f.child,f.scope)!.tuples.map(row=>row[2]),['one','two']);
 for(const map of [{FALSE:'one',true:'two'},{false:'one',TRUE:'two'},{false:'one',true:'two','TRUE':'three'},{' false ':'one',true:'two'}] as Array<Record<string,string>>){
  f.part.component!.props!.size={prop:'flag',map};assert.throws(()=>receivedFillContextProof(f.child,f.scope),/noncanonical-boolean-map/);
 }
});
