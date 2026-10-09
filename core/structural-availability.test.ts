import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {ContractSchema, resolveAvailability, assertAvailableVisibilityTarget, walkAnatomy, type Contract} from '../scripts/contract-schema.js';
import {qualifyDirectPartAvailability, qualifyOwnedComponentAvailability} from './source-part-availability.js';
import {proposeDeclaredDrawnCandidate} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {visibilityBindingMatches} from './source-visibility-control.js';
import {emitHtml} from './emit-html.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
import type {DumpSet} from '../extract/figma/types.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
const domain=[{A:'X',B:'P'},{A:'X',B:'Q'},{A:'Y',B:'Q'}];
const axes:Array<{property:string;prop:string;values:string[];map:Record<string,string>}>=[{property:'A',prop:'a',values:['X','Y'],map:{X:'x',Y:'y'}},{property:'B',prop:'b',values:['P','Q'],map:{P:'p',Q:'q'}}];
const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
function source():DumpSet{return {setName:'Source membership',type:'COMPONENT_SET',nodeId:'set',key:'owned-set',propertyDefinitions:{A:{type:'VARIANT',defaultValue:'X',variantOptions:['X','Y']},B:{type:'VARIANT',defaultValue:'P',variantOptions:['P','Q']}},variants:domain.map((tuple,i)=>({name:`A=${tuple.A}, B=${tuple.B}`,nodeId:'main'+i,type:'COMPONENT',variantProperties:{...tuple},layout:layout as any,children:i===1?[]:[{name:'Mark',type:'TEXT',nodeId:'mark'+i,text:{characters:'Original',fontSize:12,fontStyle:'Regular',lineHeight:16}}]}))};}
function occurrences(s=source()){return s.variants.flatMap(v=>(v.children??[]).filter(n=>n.name==='Mark').map(node=>({variant:v.name,node})));}
const rawDomain=()=>domain.map(t=>[axes[0].map[t.A as 'X'],axes[1].map[t.B as 'P']]);
function fixture():Contract{return ContractSchema.parse({id:'test.availability',name:'Availability',version:'0.1.0',status:'draft',description:'Structural source membership fixture; no fidelity claim',semantics:{element:'div'},states:[],props:[
 {name:'a',type:{enum:['x','y']},default:'x',bindings:{code:{prop:'kind'},figma:{kind:'VARIANT',property:'A',values:{x:'X',y:'Y'}}}},
 {name:'b',type:{enum:['p','q']},default:'p',bindings:{code:{prop:'plane'},figma:{kind:'VARIANT',property:'B',values:{p:'P',q:'Q'}}}},
 {name:'show',type:'boolean',bindings:{code:{prop:'showMark'},figma:{kind:'NONE'}}}],
 anatomy:{root:{layout:{display:'flex'},parts:{mark:{text:'Original',visibilityOverrideProp:'show',availabilityByCombination:{props:['a','b'],rows:[{values:['x','p'],present:true},{values:['x','q'],present:false},{values:['y','q'],present:true}]}}}}},
 bindings:{code:{anchors:{importPath:'./Availability',export:'Availability'}},figma:{anchors:{fileKey:'file',componentSetKey:'owned-set'},drawnVariants:[{a:'x',b:'p'},{a:'x',b:'q'},{a:'y',b:'q'}]}}});}
const load=(tsx:string,exportName='Availability',dependencies:Record<string,unknown>={})=>{const module={exports:{} as any},req=createRequire(import.meta.url);vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>p.endsWith('.css')?{default:new Proxy({},{get:(_,k)=>String(k)})}:dependencies[p]??req(p)});const C=module.exports[exportName];assert(C,JSON.stringify(Object.keys(module.exports)));return typeof C==='function'?C:(props:any)=>C.render(props,null);};
const words=(node:any):string=>node==null||typeof node==='boolean'?'':typeof node==='string'?node:Array.isArray(node)?node.map(words).join(''):words(node.props?.children);
function reactCalls(c=fixture()){const scope=new Map([[c.id,c]]);return [emitReact(c,{tokens:new Set(),icons:new Map(),contracts:scope}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts:scope}).tsx].map(tsx=>load(tsx));}
function host(child:Contract,props:any):Contract{return ContractSchema.parse({id:'test.host',name:'Host',version:'0.1.0',status:'draft',description:'Native source composition proof',semantics:{element:'div'},states:[],props:[],anatomy:{root:{parts:{child:{component:{id:child.id,props}}}}},bindings:{code:{anchors:{importPath:'./Host',export:'Host'}},figma:{anchors:{fileKey:'file',componentSetKey:'host'}}}});}
const native=(c:Contract,extra:Contract[]=[])=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([c,...extra].map(x=>[x.id,x])));

test('physical source rows cover exact three declared planes before projection',()=>{const s=source(),before=JSON.stringify(s),table=qualifyDirectPartAvailability(s,occurrences(s),axes,rawDomain(),true)!;assert(table);assert.equal(JSON.stringify(s),before);assert.equal(table.rows.length,3);for(const [i,t]of domain.entries())assert.equal(resolveAvailability({availabilityByCombination:table},{a:axes[0].map[t.A as 'X'],b:axes[1].map[t.B as 'P']}),i!==1);assert.throws(()=>resolveAvailability({availabilityByCombination:table},{a:'y',b:'p'}),/combination-unavailable/);});

test('original-node ownership, hidden state and synthetic or duplicate membership cannot grant admission',()=>{for(const mutate of [
 (s:any)=>{s.variants[0].nodeId=s.variants[2].nodeId;},(s:any)=>{s.variants[2].children[0].nodeId=s.variants[0].children[0].nodeId;},
 (s:any)=>{s.variants[2].children.push(structuredClone(s.variants[2].children[0]));},(s:any)=>{s.variants[2].children[0].hidden=true;},
 (s:any)=>{s.variants[2].children[0].propRefs={visible:'Other'};},(s:any)=>{s.variants[2].children[0].children=[{name:'Nested',type:'TEXT'}];},
 (s:any)=>{s.variants[2].children[0].type='INSTANCE';},(s:any)=>{s.variants[2].children[0].hidden='unknown';},(s:any)=>{delete s.variants[0].nodeId;},(s:any)=>{delete s.key;},(s:any)=>{delete s.nodeId;},
 ]){const s=source();mutate(s);assert.equal(qualifyDirectPartAvailability(s,occurrences(s),axes,rawDomain(),true),undefined);}
 const s=source(),occ=occurrences(s);occ[0]={...occ[0],node:{...occ[0].node,nodeId:'synthetic'}};assert.equal(qualifyDirectPartAvailability(s,occ,axes,rawDomain(),true),undefined);
 assert.equal(qualifyDirectPartAvailability(s,occurrences(s),axes,rawDomain(),false),undefined);assert.equal(qualifyDirectPartAvailability(s,occurrences(s),axes,undefined,true),undefined);
});

test('incomplete/unknown/omitted/null/sparse raw domains retain refusal, not false membership',()=>{const s=source();assert.throws(()=>qualifyDirectPartAvailability(s,occurrences(s),axes,rawDomain().slice(1),true),/incomplete/);
 for(const row of [[null,'p'],[undefined,'p'],['unknown','p'],[, 'p']]){const d=rawDomain() as any;d[0]=row;assert.throws(()=>{const r=qualifyDirectPartAvailability(s,occurrences(s),axes,d,true);if(!r)throw Error('source-unqualified');},/unqualified|incomplete/);}
 const sparse=source();delete sparse.variants[1];assert(!qualifyDirectPartAvailability(sparse,occurrences(s),axes,rawDomain(),true));
 const changed=source();delete changed.variants[0].variantProperties!.A;assert(!qualifyDirectPartAvailability(changed,occurrences(changed),axes,rawDomain(),true));
});

test('real proposer authors a source-owned control only after independent full-domain validation',()=>{const s=source(),before=JSON.stringify(s),target={instanceId:'usage',componentId:'main0',nodeId:'Iusage;mark0',instancePath:[],childPath:[0],visible:true};
 const result=proposeDeclaredDrawnCandidate(s,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'file',projectionMode:'exact',stampsObservable:true,hiddenCaptured:true,visibilityDemands:[{fileKey:'file',target}]},domain);
 assert.equal(result.acceptedContract,null);const c=ContractSchema.parse(result.proposal.contract),part=walkAnatomy(c).find(w=>w.part.availabilityByCombination)!.part;
 assert(part.visibilityOverrideProp);assert.equal(c.bindings.figma.drawnVariants!.length,3);assert.equal(part.availabilityByCombination!.rows.length,3);assert.equal(JSON.stringify(s),before);
 const binding=result.proposal.visibilityBindings![0];assert(visibilityBindingMatches(binding,c,'file',target));for(const bad of [{...binding,fileKey:'other'},{...binding,setKey:'other'},{...binding,contractRevision:'other'},{...binding,componentId:'other'}])assert(!visibilityBindingMatches(bad,c,'file',target));
 for(const bad of [{...target,childPath:[9]},{...target,nodeId:'Iusage;wrong'},{...target,instancePath:[0]}])assert.throws(()=>proposeDeclaredDrawnCandidate(s,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'file',projectionMode:'exact',stampsObservable:true,hiddenCaptured:true,visibilityDemands:[{fileKey:'file',target:bad}]},domain),/visibility-demand/);
});

test('schema cannot grant availability without complete positive domain and unique owned control',()=>{for(const mutate of [
 (c:any)=>{delete c.bindings.figma.drawnVariants;},(c:any)=>{c.bindings.figma.drawnVariants.push({a:'y',b:'p'});},
 (c:any)=>{c.anatomy.root.parts.mark.availabilityByCombination.rows.pop();},(c:any)=>{c.anatomy.root.parts.mark.availabilityByCombination.rows.push(c.anatomy.root.parts.mark.availabilityByCombination.rows[0]);},
 (c:any)=>{c.anatomy.root.parts.mark.availabilityByCombination.rows[0].values[0]=null;},(c:any)=>{delete c.anatomy.root.parts.mark.visibilityOverrideProp;},
 (c:any)=>{c.anatomy.root.parts.mark.component={id:'test.other'};},(c:any)=>{c.anatomy.root.availabilityByCombination=c.anatomy.root.parts.mark.availabilityByCombination;},
 (c:any)=>{c.anatomy.root.parts.mark.parts={child:{text:'Unowned'}};},(c:any)=>{c.anatomy.root.parts.other=structuredClone(c.anatomy.root.parts.mark);},
 ]){const c=fixture();mutate(c);assert.equal(ContractSchema.safeParse(c).success,false);}
 const hole=fixture();delete hole.anatomy.root.parts!.mark.availabilityByCombination!.rows[0].values[0];assert.equal(ContractSchema.safeParse(hole).success,false);
});

test('both actual React functions guard structural membership before explicit Boolean controls',()=>{for(const C of reactCalls()){
 for(const state of [{kind:'x',plane:'p'},{kind:'y',plane:'q'}]){assert.equal(words(C(state)),'Original');assert.equal(words(C({...state,showMark:true})),'Original');assert.equal(words(C({...state,showMark:false})), '');for(const value of [null,'false',0])assert.throws(()=>C({...state,showMark:value}),/value-not-boolean/);}
 assert.equal(words(C({kind:'x',plane:'q'})),'');for(const showMark of [true,false,null])assert.throws(()=>C({kind:'x',plane:'q',showMark}),/structural-availability-target-unavailable/);
 for(const state of [{kind:'y',plane:'p'},{kind:'unknown',plane:'p'},{kind:null,plane:'p'}])assert.throws(()=>C({...state,showMark:true}),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
 }});

test('native compile omits absent physical nodes and retains exact present defaults',()=>{const c=fixture(),data=native(c);assert.equal(data.variants.length,3);for(const v of data.variants){const mark=v.spec.children?.find(n=>n.name==='mark');assert.equal(!!mark,v.name!=='A=X, B=Q');if(mark)assert.deepEqual(mark.visibilityTarget,{key:c.id+':show',visible:true});}});

test('native composed caller omission/false/true matches React unavailable-target refusal',()=>{const c=fixture();for(const [a,b]of [['x','p'],['y','q']])for(const show of [undefined,false,true]){const h=host(c,{a,b,...(show===undefined?{}:{show})});const instance=native(h,[c]).variants[0].spec.children![0];assert.equal(instance.instanceVisibility?.[c.id+':show'],show);}
 for(const show of [true,false])assert.throws(()=>native(host(c,{a:'x',b:'q',show}),[c]),/structural-availability-target-unavailable/);
 assert.doesNotThrow(()=>native(host(c,{a:'x',b:'q'}),[c]));for(const props of [{a:'y',b:'p',show:true},{a:'unknown',b:'p',show:true}])assert.throws(()=>native(host(c,props),[c]),/UN(DRAWN|DECLARED)|UNDRAWN|variant|VARIANT/);
});

test('legacy fully observed hidden-node explicit true remains unchanged without structural opt-in',()=>{const c=fixture();delete c.anatomy.root.parts!.mark.availabilityByCombination;delete c.bindings.figma.drawnVariants;c.anatomy.root.parts!.mark.visibilityOverrideDefault=false;
 for(const C of reactCalls(c)){assert.equal(words(C({})),'');assert.equal(words(C({showMark:false})),'');assert.equal(words(C({showMark:true})),'Original');}
 const data=native(c);assert.equal(data.variants.length,4);for(const v of data.variants)assert.equal(v.spec.children?.find(n=>n.name==='mark')?.visibilityTarget?.visible,false);
});

test('HTML and Web Components retain explicitly named unqualified structural capability',()=>{const c=fixture(),contracts=new Map([[c.id,c]]);assert.throws(()=>emitHtml(c,{tokens:new Set(),icons:new Map(),contracts}),/HTML_STRUCTURAL_AVAILABILITY_UNSUPPORTED/);assert.throws(()=>emitWebComponent(c,{tokens:new Set(),icons:new Map(),contracts}),/WEB_COMPONENT_STRUCTURAL_AVAILABILITY_UNSUPPORTED/);});

test('shared resolver keeps true/false/null/omission and missing rows distinct',()=>{const p=fixture().anatomy.root.parts!.mark;assert.equal(assertAvailableVisibilityTarget(p,{a:'x',b:'p'},false,undefined),true);assert.equal(assertAvailableVisibilityTarget(p,{a:'x',b:'q'},false,undefined),false);for(const value of [true,false,null])assert.throws(()=>assertAvailableVisibilityTarget(p,{a:'x',b:'q'},true,value),/target-unavailable/);assert.throws(()=>resolveAvailability(p,{a:'x'}),/combination-unavailable/);assert.throws(()=>resolveAvailability(p,{a:null,b:'p'}),/combination-unavailable/);});


test('all three public receivers reject an unparsed incomplete availability opt-in',()=>{for(const corrupt of [(c:any)=>c.anatomy.root.parts.mark.availabilityByCombination.rows.pop(),(c:any)=>delete c.bindings.figma.drawnVariants]){
 const c=fixture();corrupt(c);const contracts=new Map([[c.id,c]]);
 for(const emit of [()=>emitReact(c,{tokens:new Set(),icons:new Map(),contracts}),()=>emitReactInline(c,{tokens,icons:new Map(),contracts}),()=>native(c),()=>native(host(c,{a:'x',b:'p'}),[c])])assert.throws(emit,/STRUCTURAL_AVAILABILITY_INVALID/);
}});


test('typed Boolean variant availability preserves canonical false and refuses unknown/null values',()=>{
 const c:any=fixture();c.props[0]={name:'a',type:'boolean',default:false,bindings:{code:{prop:'kind'},figma:{kind:'VARIANT',property:'A',values:{false:'X',true:'Y'}}}};
 c.bindings.figma.drawnVariants=[{a:false,b:'p'},{a:false,b:'q'},{a:true,b:'q'}];
 c.anatomy.root.parts.mark.availabilityByCombination.rows=[{values:['false','p'],present:true},{values:['false','q'],present:false},{values:['true','q'],present:true}];const parsed=ContractSchema.parse(c);
 for(const C of reactCalls(parsed)){assert.equal(words(C({kind:false,plane:'p',showMark:true})),'Original');assert.equal(words(C({kind:true,plane:'q'})),'Original');assert.throws(()=>C({kind:false,plane:'q',showMark:false}),/target-unavailable/);for(const kind of [null,'false',0])assert.throws(()=>C({kind,plane:'p'}),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');}
 assert.equal(native(parsed).variants.length,3);assert.doesNotThrow(()=>native(host(parsed,{a:false,b:'p',show:true}),[parsed]));assert.throws(()=>native(host(parsed,{a:false,b:'q',show:false}),[parsed]),/target-unavailable/);
});


test('finite Boolean argument maps preserve explicit false on both React functions and native selection',()=>{
 const c=fixture(),h=host(c,{a:'x',b:'p',show:{prop:'toggle',map:{false:'false',true:'true'}}});h.props=[{name:'toggle',type:'boolean',default:false,bindings:{code:{prop:'toggle'},figma:{kind:'VARIANT',property:'Toggle',values:{false:'Off',true:'On'}}}}];const contracts=new Map([[h.id,h],[c.id,c]]);
 for(const inline of [false,true]){const childSource=inline?emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx:emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx;const ParentSource=inline?emitReactInline(h,{tokens,icons:new Map(),contracts}).tsx:emitReact(h,{tokens:new Set(),icons:new Map(),contracts}).tsx;const Child=load(childSource),deps:Record<string,unknown>={};for(const match of ParentSource.matchAll(/import \{[^}]*Availability[^}]*\} from ['"]([^'"]+)['"]/g))deps[match[1]]={Availability:Child};const Parent=load(ParentSource,'Host',deps);
  const elements=(n:any):any[]=>n==null?[]:Array.isArray(n)?n.flatMap(elements):typeof n==='object'?[n,...elements(n.props?.children)]:[];
  for(const toggle of [false,true]){const child=elements(Parent({toggle})).find(n=>n.props?.showMark!==undefined);assert(child,ParentSource);assert.equal(child.props.showMark,toggle);assert.equal(words(Child(child.props)),toggle?'Original':'');}
 }
 const data=native(h,[c]);assert.equal(data.variants.length,2);for(const v of data.variants)assert.equal(v.spec.children![0].instanceVisibility![c.id+':show'],v.name==='Toggle=On');
});

function componentSource():DumpSet {
 const s=source();
 for(const [i,main]of s.variants.entries())main.children=[{name:'Connector',type:'FRAME',nodeId:'connector'+i,children:[
  {name:'Group',type:'GROUP',nodeId:'group'+i,children:i===1?[]:[{name:'Separator',type:'INSTANCE',nodeId:'separator'+i,instanceOf:'Separator',instanceKey:'separator-main',instanceSetKey:'separator-key'}]},
 ]}];
 return s;
}
function componentOccurrences(s=componentSource()) {
 return s.variants.flatMap(v=>(v.children?.[0].children?.[0].children??[]).map(node=>({variant:v.name,node})));
}
function separatorFixture():Contract {
 const leaf=fixture();leaf.id='test.separator';leaf.name='Separator';leaf.props=[];
 leaf.anatomy.root={parts:{label:{text:'Separator'}}};
 leaf.bindings.code.anchors={importPath:'./Separator',export:'Separator'};
 leaf.bindings.figma.anchors.componentSetKey='separator-key';delete leaf.bindings.figma.drawnVariants;
 return ContractSchema.parse(leaf);
}
function componentFixture():Contract {
 const c=fixture();delete c.anatomy.root.parts!.mark.text;
 c.anatomy.root.parts!.mark.component={id:separatorFixture().id};return ContractSchema.parse(c);
}

test('nested instance membership uses complete original paths without owning child internals',()=>{
 const s=componentSource(),before=JSON.stringify(s),table=qualifyOwnedComponentAvailability(s,componentOccurrences(s),axes,rawDomain(),true)!;
 assert(table);assert.equal(JSON.stringify(s),before);
 for(const [i,t]of domain.entries())assert.equal(resolveAvailability({availabilityByCombination:table},{a:axes[0].map[t.A as 'X'],b:axes[1].map[t.B as 'P']}),i!==1);
 assert.throws(()=>resolveAvailability({availabilityByCombination:table},{a:'y',b:'p'}),/combination-unavailable/);
 assert(!qualifyOwnedComponentAvailability(s,componentOccurrences(s),axes,rawDomain(),false));
 assert.throws(()=>qualifyOwnedComponentAvailability(s,componentOccurrences(s),axes,rawDomain().slice(1),true),/incomplete/);
 const forged=componentOccurrences(s);forged[0]={...forged[0],node:{...forged[0].node,instanceKey:'forged'}};
 assert(!qualifyOwnedComponentAvailability(s,forged,axes,rawDomain(),true));
});

test('nested ownership refuses ambiguous, relocated, hidden, bound and malformed original paths',()=>{
 for(const mutate of [
  (s:any)=>{s.variants[0].children.push({...s.variants[0].children[0],nodeId:'duplicate-ancestor'});},
  (s:any)=>{s.variants[2].children[0].name='Relocated';},
  (s:any)=>{s.variants[2].children[0].type='GROUP';},
  (s:any)=>{s.variants[2].children[0].type='INSTANCE';},
  (s:any)=>{s.variants[2].children[0].hidden=true;},
  (s:any)=>{s.variants[2].children[0].bound={visible:'variable'};},
  (s:any)=>{s.variants[1].children[0].bound={visible:'variable'};},
  (s:any)=>{s.variants[0].bound={visible:'variable'};},
  (s:any)=>{s.variants[2].children[0].children[0].children[0].propRefs={visible:'Control'};},
  (s:any)=>{s.variants[2].children[0].children[0].children[0].bound={visible:'variable'};},
  (s:any)=>{s.variants[2].children[0].children[0].children[0].propRefs={mainComponent:'Swap'};},
  (s:any)=>{s.variants[2].children[0].children[0].children[0].nodeId='separator0';},
  (s:any)=>{s.variants[2].children[0].nodeId=s.nodeId;},
  (s:any)=>{s.variants[2].children[0].children=null;},
  (s:any)=>{delete s.variants[2].children[0].children[0].children[0];},
  (s:any)=>{s.variants[2].variantProperties={...s.variants[0].variantProperties};},
  (s:any)=>{s.variants[2].variantProperties.A='Unknown';},
 ]){
  const s=componentSource(),occ=componentOccurrences(s);mutate(s);
  assert.equal(qualifyOwnedComponentAvailability(s,occ,axes,rawDomain(),true),undefined);
 }
 const missing=componentSource(),occ=componentOccurrences(missing);missing.variants.splice(1,1);
 assert(!qualifyOwnedComponentAvailability(missing,occ,axes,rawDomain(),true));
});

test('availability schema allows a plain component leaf and rejects hybrid visibility owners',()=>{
 assert(ContractSchema.safeParse(componentFixture()).success);
 for(const extra of [{text:''},{textByProp:{prop:'a',map:{x:'Declared text'}}},{content:{prop:'label'}},{icon:{asset:'unknown'}},{meter:{valueProp:'a',maxProp:'b'}},
  {mask:{type:'ALPHA'}},{instanceAffine:{localSize:{width:10,height:10},transform:[[1,0,0],[0,1,0]]}},
  {instanceAffineByProp:{prop:'a',map:{x:{localSize:{width:10,height:10},transform:[[1,0,0],[0,1,0]]}}}},
  {instanceAffineLayout:{props:['a'],rows:[{values:['x'],geometry:{localSize:{width:10,height:10},transform:[[1,0,0],[0,1,0]]},fill:{width:false,height:false}}]}},
  {parts:{label:{text:'Nested'}}},{slot:{name:'label'}},{repeat:{itemsProp:'rows',sample:[{id:'one'}]}},
 ]){const c=componentFixture();Object.assign(c.anatomy.root.parts!.mark,extra);const parsed=ContractSchema.safeParse(c);assert(!parsed.success);assert(parsed.error.issues.some(i=>i.message==='structural-availability-requires-owned-visibility-leaf'),JSON.stringify(extra));}
});

test('real proposer carries a nested component target after exact drawn-domain admission',()=>{
 const s=componentSource();for(const main of s.variants){const owner=main.children![0];owner.layout=layout as any;owner.children=owner.children![0].children;}
 const leaf=separatorFixture(),before=JSON.stringify(s),target={instanceId:'usage',componentId:'main0',nodeId:'Iusage;separator0',instancePath:[],childPath:[0,0],visible:false};
 const result=proposeDeclaredDrawnCandidate(s,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map([['Separator',leaf.id]]),contractsById:new Map([[leaf.id,leaf]]),mintUnbound:true,fileKey:'file',projectionMode:'exact',stampsObservable:true,hiddenCaptured:true,visibilityDemands:[{fileKey:'file',target}]},domain);
 const c=ContractSchema.parse(result.proposal.contract),part=walkAnatomy(c).find(w=>w.part.availabilityByCombination)!.part;
 assert.equal(part.component?.id,leaf.id);assert(part.visibilityOverrideProp);assert.equal(c.bindings.figma.drawnVariants!.length,3);assert.equal(part.availabilityByCombination!.rows.length,3);
 assert(visibilityBindingMatches(result.proposal.visibilityBindings![0],c,'file',target));assert.equal(JSON.stringify(s),before);
});

test('both React emitters preserve a real child reference and availability before caller visibility',()=>{
 const leaf=separatorFixture(),c=componentFixture(),contracts=new Map([leaf,c].map(c=>[c.id,c]));
 const render=(n:any):string=>n==null||typeof n==='boolean'?'':typeof n==='string'?n:Array.isArray(n)?n.map(render).join(''):
  typeof n.type==='function'?render(n.type(n.props)):render(n.props?.children);
 for(const inline of [false,true]){
  const emit=(c:Contract)=>inline?emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx:emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx;
  const Leaf=load(emit(leaf),'Separator'),tsx=emit(c),deps:Record<string,unknown>={};
  for(const match of tsx.matchAll(/import \{[^}]*Separator[^}]*\} from ['"]([^'"]+)['"]/g))deps[match[1]]={Separator:Leaf};
  const C=load(tsx,'Availability',deps);
  for(const state of [{kind:'x',plane:'p'},{kind:'y',plane:'q'}])for(const showMark of [undefined,false,true])
   assert.equal(render(C({...state,...(showMark===undefined?{}:{showMark})})),showMark===false?'':'Separator');
  assert.equal(render(C({kind:'x',plane:'q'})), '');
  for(const showMark of [true,false])assert.throws(()=>C({kind:'x',plane:'q',showMark}),/structural-availability-target-unavailable/);
  assert.throws(()=>C({kind:'y',plane:'p'}),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
 }
});

test('nullable Boolean argument omission cannot become an explicit control on an absent component',()=>{
 const leaf=separatorFixture(),c=componentFixture();
 const parent=(values:[boolean|null,boolean|null])=>{
  const h=host(c,{a:'x',b:'q'});
  h.props=[{name:'toggle',type:'boolean',default:false,bindings:{code:{prop:'toggle'},figma:{kind:'VARIANT',property:'Toggle',values:{false:'Off',true:'On'}}}}];
  h.anatomy.root.parts!.child.component!.booleanPropsByCombination={show:{props:['toggle'],rows:[{values:['false'],value:values[0]},{values:['true'],value:values[1]}]}};
  return ContractSchema.parse(h);
 };
 assert.equal(native(parent([null,null]),[leaf,c]).variants.length,2);
 assert.throws(()=>native(parent([null,false]),[leaf,c]),/structural-availability-target-unavailable/);
 const h=parent([null,false]),contracts=new Map([leaf,c,h].map(c=>[c.id,c]));
 for(const inline of [false,true]){
  const emit=(x:Contract)=>inline?emitReactInline(x,{tokens,icons:new Map(),contracts}).tsx:emitReact(x,{tokens:new Set(),icons:new Map(),contracts}).tsx;
  const Leaf=load(emit(leaf),'Separator'),childText=emit(c),deps:Record<string,unknown>={};
  for(const match of childText.matchAll(/import \{[^}]*Separator[^}]*\} from ['"]([^'"]+)['"]/g))deps[match[1]]={Separator:Leaf};
  const Child=load(childText,'Availability',deps),parentText=emit(h),imports:Record<string,unknown>={};
  for(const match of parentText.matchAll(/import \{[^}]*Availability[^}]*\} from ['"]([^'"]+)['"]/g))imports[match[1]]={Availability:Child};
  const Parent=load(parentText,'Host',imports),elements=(n:any):any[]=>n==null?[]:Array.isArray(n)?n.flatMap(elements):typeof n==='object'?[n,...elements(n.props?.children)]:[];
  const omitted=elements(Parent({toggle:false})).find(n=>n.type===Child)!;assert(omitted);assert.equal(omitted.props.showMark,undefined);assert.equal(words(Child(omitted.props)),'');
  const supplied=elements(Parent({toggle:true})).find(n=>n.type===Child)!;assert(supplied);assert.equal(supplied.props.showMark,false);assert.throws(()=>Child(supplied.props),/structural-availability-target-unavailable/);
 }
});

test('native component membership keeps dependency identity and one visibility target per present plane',async()=>{
 const leaf=separatorFixture(),c=componentFixture(),data=native(c,[leaf]);
 for(const v of data.variants){const target=v.spec.children?.find(n=>n.name==='mark');assert.equal(!!target,v.name!=='A=X, B=Q');if(target){assert.equal(target.type,'instance');assert.equal(target.visibilityTarget?.key,c.id+':show');}}
 for(const show of [true,false])assert.throws(()=>native(host(c,{a:'x',b:'q',show}),[leaf,c]),/structural-availability-target-unavailable/);
 assert.doesNotThrow(()=>native(host(c,{a:'x',b:'q'}),[leaf,c]));
 const mock=createFigmaMock({instanceVariantSelection:true}),engine=createFigmaEngine({tokens,icons:new Map()}),context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext('(async()=>{'+script+'\n})()',context),contracts=new Map([leaf,c].map(c=>[c.id,c]));
 await run(engine.buildTokensScript(null));for(const contract of [leaf,c])await run(engine.buildComponentScript(contract,contracts));
 for(const [i,props]of [{a:'x',b:'p'},{a:'x',b:'p',show:false},{a:'x',b:'p',show:true},{a:'x',b:'q'}].entries()){
  const h=host(c,props);h.id='test.host'+i;h.name='Host'+i;const scope=new Map([...contracts,[h.id,h] as const]);
  await run(engine.buildComponentScript(h,scope));
  const owner=mock.root.findOne(n=>['COMPONENT_SET','COMPONENT'].includes(n.type)&&n.getSharedPluginData('ds_contracts','contractId')===h.id)!;assert(owner);
  const variant=owner.type==='COMPONENT_SET'?owner.children![0]:owner;
  const child=variant.findOne(n=>n.type==='INSTANCE'&&n.name==='child')!;assert(child);
  assert.equal((await (child as any).getMainComponentAsync()).name,props.b==='q'?'A=X, B=Q':'A=X, B=P');
  const targets=variant.findAll(n=>n.getSharedPluginData('ds_contracts','visibilityOverride')===c.id+':show');
  assert.equal(targets.length,props.b==='q'?0:1);
  if(targets.length){assert.equal(targets[0].type,'INSTANCE');assert.equal(targets[0].visible,'show'in props?props.show:true);assert.equal((await (targets[0] as any).getMainComponentAsync()).getSharedPluginData('ds_contracts','contractId'),leaf.id);}
 }
});
