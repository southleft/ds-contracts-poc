import {tokenInventoryFromJson} from '../packages/core/src/tokens.js';
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {createRequire} from 'node:module';import * as React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {transformSync} from 'esbuild';
import {ContractSchema,resolvePresence,type Contract} from '../scripts/contract-schema.js';
import {inferPresenceByCombination} from './infer-presence.js';
import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';import {createFigmaEngine} from './emit-figma-script.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture():Contract{return ContractSchema.parse({id:'test.presence',name:'Presence',version:'0.1.0',status:'draft',description:'Synthetic presence conformance; no live fidelity claim',semantics:{element:'div'},states:[],props:[
 {name:'checked',type:'boolean',default:false,bindings:{code:{prop:'isChecked'},figma:{kind:'VARIANT',property:'Checked',values:{true:'true',false:'false'}}}},
 {name:'style',type:{enum:['solid','raised']},default:'solid',bindings:{code:{prop:'appearance'},figma:{kind:'VARIANT',property:'Style',values:{solid:'Solid',raised:'Raised'}}}},
 {name:'show',type:'boolean',default:true,bindings:{code:{prop:'showMark'},figma:{kind:'BOOLEAN',property:'Show mark'}}},
 ],anatomy:{root:{layout:{display:'flex'},parts:{mark:{text:'Moon',visibleWhen:{prop:'show'},presenceByCombination:{props:['checked','style'],rows:[
 {values:['false','solid'],present:true},{values:['true','solid'],present:false},{values:['false','raised'],present:false},{values:['true','raised'],present:false}]}}}}},bindings:{code:{anchors:{importPath:'./Presence',export:'Presence'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});}
const load=(tsx:string)=>{const module={exports:{} as any},req=createRequire(import.meta.url);
 vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>p.endsWith('.css')?{default:new Proxy({},{get:(_,k)=>String(k)})}:req(p)});return module.exports.Presence;};

test('both actual React emitters conjoin exact finite presence and independent Boolean visibility',()=>{
 const c=fixture(),contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  for(const isChecked of [false,true])for(const appearance of ['solid','raised'])for(const showMark of [false,true]){
   const html=renderToStaticMarkup(React.createElement(C,{isChecked,appearance,showMark}));
   assert.equal(html.includes('Moon'),!isChecked&&appearance==='solid'&&showMark,html);
  }
  assert.throws(()=>renderToStaticMarkup(React.createElement(C,{appearance:'unknown'})),/presence-combination-unavailable/);
 }
});
test('native variant generation removes only explicit absence planes and retains the live Boolean property',()=>{
 const c=fixture(),engine=createFigmaEngine({tokens,icons:new Map()}),data=engine.compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(data.variants.length,4);
 for(const v of data.variants){const expected=v.name==='Checked=false, Style=Solid';
  const mark=v.spec.children?.find(n=>n.name==='mark');assert.equal(!!mark,expected,v.name);
  if(mark){assert.equal(mark.visibleProp,'Show mark');assert.equal(mark.visibleDefault,true);}
 }
});
test('presence validation refuses duplicate, incomplete, unknown, nonvariant and root conditions',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.parts.mark.presenceByCombination.rows.pop(),
  (c:any)=>c.anatomy.root.parts.mark.presenceByCombination.rows.push(c.anatomy.root.parts.mark.presenceByCombination.rows[0]),
  (c:any)=>{c.anatomy.root.parts.mark.presenceByCombination.rows[0].values[0]='maybe';},
  (c:any)=>{c.anatomy.root.parts.mark.presenceByCombination.props[0]='show';},
  (c:any)=>{c.anatomy.root.presenceByCombination=c.anatomy.root.parts.mark.presenceByCombination;},
 ]){const c=fixture();change(c);assert.equal(ContractSchema.safeParse(c).success,false);}
 const p=fixture().anatomy.root.parts!.mark;
 assert.equal(resolvePresence(p,{checked:false,style:'solid'}),true);
 assert.throws(()=>resolvePresence(p,{checked:false}),/presence-combination-unavailable/);
});
test('inference keeps every observed truth and refuses conflicting or unseen projected tuples',()=>{
 const axes=[{prop:'checked',values:['false','true']},{prop:'style',values:['solid','raised']}];
 const observed=fixture().anatomy.root.parts!.mark.presenceByCombination!.rows;
 const inferred=inferPresenceByCombination(axes,observed)!;assert(inferred);
 for(const o of observed)assert.equal(resolvePresence({presenceByCombination:inferred},{checked:o.values[0],style:o.values[1]}),o.present);
 assert.equal(inferPresenceByCombination(axes,observed.slice(1)),undefined);
 assert.equal(inferPresenceByCombination(axes,[...observed,{...observed[0],present:false}]),undefined);
});

import {proposeFromDump,proposeDeclaredDrawnCandidate} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {walkAnatomy} from '../scripts/contract-schema.js';
import type {DumpSet} from '../extract/figma/types.js';
test('the real proposer retains minority content dependent on two axes and a separate Boolean binding',()=>{
 const set:DumpSet={setName:'Presence specimen',type:'COMPONENT_SET',propertyDefinitions:{
  Checked:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']},
  Style:{type:'VARIANT',defaultValue:'Solid',variantOptions:['Solid','Raised']},
  'Show mark':{type:'BOOLEAN',defaultValue:true},
 },variants:['False','True'].flatMap(checked=>['Solid','Raised'].map(style=>({
  name:`Checked=${checked}, Style=${style}`,type:'COMPONENT' as const,variantProperties:{Checked:checked,Style:style},
  layout:{mode:'HORIZONTAL' as const,primary:'MIN' as const,counter:'MIN' as const,spacing:0,padding:[0,0,0,0] as [number,number,number,number],primarySizing:'AUTO' as const,counterSizing:'AUTO' as const},
  children:checked==='False'&&style==='Solid'?[{name:'Moon',type:'TEXT' as const,propRefs:{visible:'Show mark'},text:{characters:'Moon',fontSize:12,fontStyle:'Regular',lineHeight:16}}]:[],
 })))};
 const result=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'exact'});
 const c=ContractSchema.parse(result.contract),mark=walkAnatomy(c).find(w=>w.part.presenceByCombination)?.part;
 assert(mark,'minority content must survive proposal');assert(mark.visibleWhen,'native Boolean gate must remain independent');
 assert.equal(mark.presenceByCombination!.rows.filter(r=>r.present).length,1);
 assert.equal(mark.presenceByCombination!.rows.length,4);
});

test('geometry completeness counts only explicit present planes and invalid presence stays a schema refusal',()=>{
 const c=fixture(),p=c.anatomy.root.parts!.mark;
 const geometry={box:{x:0,y:0,width:8,height:8,right:8,bottom:8,constraints:{horizontal:'LEFT' as const,vertical:'TOP' as const}},parent:{width:16,height:16},border:{left:0,right:0,top:0,bottom:0}};
 p.absoluteGeometryByCombination={props:['checked','style'],rows:[{values:['false','solid'],geometry}]};
 assert(ContractSchema.safeParse(c).success);
 for(const mutate of [
  (x:Contract)=>{x.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();},
  (x:Contract)=>{x.anatomy.root.parts!.mark.absoluteGeometryByCombination!.rows[0].values=['true','solid'];},
 ]){const bad=structuredClone(c);mutate(bad);assert.equal(ContractSchema.safeParse(bad).success,false);}
});

import {emitHtml} from './emit-html.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
test('HTML renders finite presence while an unqualified Web Components table still refuses',()=>{
 const c=fixture(),contracts=new Map([[c.id,c]]);
 const html=emitHtml(c,{tokens:new Set(),icons:new Map(),contracts}).html;
 assert.equal((html.match(/>Moon</g)??[]).length,1,'only the default tuple contains the observed content');
 assert.throws(()=>emitWebComponent(c,{tokens:new Set(),icons:new Map(),contracts}),/WEB_COMPONENT_PRESENCE_COMBINATION_UNSUPPORTED/);
});

import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';
test('native writer and independent readback retain finite presence and reject topology or Boolean binding corruption',async()=>{
 const f=await nativeComparisonFixture(),c=fixture(),contracts=new Map([[c.id,c]]);
 c.anatomy.root.parts!.mark.tokens={color:'{ink}'};
 const tokenTree={primitives:f.tokens,semantic:{},light:{},dark:{},brands:{default:{}}};
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokenTree).slice(7)};
 const operation={id:'40000000-0000-4000-8000-000000000241',fileKey:f.figma.fileKey};
 const compiled=f.engine.compileNativePreparedLibrary(c,contracts,source,operation.id);
 const routed=layeredNativeTokenModes(tokenTree,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await f.run(emitNativeTokenContextScript(tokenInput).script);
 assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await f.run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await f.run(f.engine.buildNativePreparedLibraryScript(c,contracts,source,context));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await f.run(emitNativePreparedLibraryReadbackScript(input));
 assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(input,receipt)));
 const marks=receipt.nodes.filter((n:any)=>n.name==='mark');assert.equal(marks.length,1,'only one of four variants owns this part');
 const mark=marks[0],parent=receipt.nodes.find((n:any)=>n.id===mark.parentId);
 assert.equal(parent.name,'Checked=false, Style=Solid');
 assert(Object.values(mark.values.componentPropertyReferences??{}).some(v=>String(v).startsWith('Show mark')),'independent native Boolean binding survives');
 for(const corruption of ['missing-child','missing-binding']){
  const changed=structuredClone(receipt),node=changed.nodes.find((n:any)=>n.id===mark.id);
  if(corruption==='missing-child')changed.nodes=changed.nodes.filter((n:any)=>n.id!==mark.id);
  else node.values.componentPropertyReferences={};
  assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused',corruption);
 }
});


test('generated presence lookup cannot shadow legal public prop aliases',()=>{
 const c=fixture();c.props[0].bindings.code.prop='values';c.props[1].bindings.code.prop='row';
 const contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  assert(renderToStaticMarkup(React.createElement(C,{values:false,row:'solid'})).includes('Moon'));
  assert(!renderToStaticMarkup(React.createElement(C,{values:true,row:'solid'})).includes('Moon'));
 }
});


test('optional slots conjoin caller content with presence and independent visibility',()=>{
 const c=fixture(),p=c.anatomy.root.parts!.mark;delete p.text;p.slot={name:'children'};p.optional=true;
 const contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  for(const isChecked of [false,true])for(const appearance of ['solid','raised'])for(const showMark of [false,true]){
   const props={isChecked,appearance,showMark};
   assert.equal(renderToStaticMarkup(React.createElement(C,props,'Caller')).includes('Caller'),!isChecked&&appearance==='solid'&&showMark);
   assert(!renderToStaticMarkup(React.createElement(C,props)).includes('Caller'));
  }
 }
});

import {defaultSlotFamilyIssue} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
function routedSlots(){
 const c=fixture();c.props=c.props.filter(p=>p.name!=='show');
 const first=c.anatomy.root.parts!.mark;delete first.text;delete first.visibleWhen;first.slot={name:'children',bindings:{figma:{property:'Payload'}}};
 const second=structuredClone(first);second.presenceByCombination!.rows.forEach(r=>r.present=r.values[0]==='true'&&r.values[1]==='solid');
 c.anatomy.root.parts!.alternate=second;return c;
}
test('shared caller input occupies exactly its observed slot plane and native callers follow the same choice',()=>{
 const c=routedSlots();assert.equal(defaultSlotFamilyIssue(c),undefined);
 const contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  for(const isChecked of [false,true])for(const appearance of ['solid','raised']){
   const html=renderToStaticMarkup(React.createElement(C,{isChecked,appearance},'Caller payload'));
   assert.equal((html.match(/Caller payload/g)??[]).length,appearance==='solid'?1:0,html);
  }
 }
 const parent=ContractSchema.parse({...structuredClone(c),id:'test.presence-parent',name:'PresenceParent',anatomy:{root:{layout:{display:'flex'},parts:{child:{component:{id:c.id,props:{checked:'{checked}',style:'{style}'}},parts:{payload:{text:'Caller payload'}}}}}}});
 contracts.set(parent.id,parent);const errors:string[]=[];validateContract(parent,contracts,errors,new Map());assert.deepEqual(errors,[]);
 const compiled=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,contracts);
 for(const variant of compiled.variants){const instance=variant.spec.children![0];
  assert.equal(instance.children?.length,variant.name.includes('Style=Solid')?1:0,variant.name);
  if(instance.children?.length)assert.equal(instance.children[0].children![0].characters,'Caller payload');
 }
 for(const fault of ['overlap','missing','different-property']){
  const bad=structuredClone(c);
  if(fault==='overlap')bad.anatomy.root.parts!.alternate.presenceByCombination=structuredClone(bad.anatomy.root.parts!.mark.presenceByCombination);
  if(fault==='missing')delete bad.anatomy.root.parts!.alternate.presenceByCombination;
  if(fault==='different-property')bad.anatomy.root.parts!.alternate.slot!.bindings!.figma!.property='Other';
  assert(defaultSlotFamilyIssue(bad),fault);
  const badErrors:string[]=[];validateContract(parent,new Map([[parent.id,parent],[bad.id,bad]]),badErrors,new Map());assert(badErrors.some(e=>e.includes('children slot')),fault);
  assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,new Map([[parent.id,parent],[bad.id,bad]])),/qualified children slot family|unique children slot/,fault);
 }
});

import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
test('prepared native library writes and independently reads caller content in alternate slot placements',async()=>{
 const host=nativeFixtureHost({instanceVariantSelection:true}),{figma}=host;
 Object.getPrototypeOf(figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma,console},{timeout:5000})));
 const child=routedSlots(),parent=ContractSchema.parse({...structuredClone(child),id:'test.slot-caller',name:'SlotCaller',anatomy:{root:{layout:{display:'flex'},parts:{child:{component:{id:child.id,props:{checked:'{checked}',style:'{style}'}},parts:{payload:{text:'Caller payload',tokens:{color:'{ink}'}}}}}}}});
 const contracts=new Map([[child.id,child],[parent.id,parent]]),tree={...tokens,primitives:{ink:{$type:'color',$value:'#123456'}}};
 const engine=createFigmaEngine({tokens:tree,icons:new Map()});
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tree).slice(7)};
 const operation={id:'40000000-0000-4000-8000-000000000244',fileKey:figma.fileKey},compiled=engine.compileNativePreparedLibrary(parent,contracts,source,operation.id);
 const routed=layeredNativeTokenModes(tree,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await run(engine.buildNativePreparedLibraryScript(parent,contracts,source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await run(emitNativePreparedLibraryReadbackScript(input));
 assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(input,receipt)));
 const payloads=receipt.nodes.filter((n:any)=>n.values.characters==='Caller payload');assert.equal(payloads.length,2);
 const bad=structuredClone(receipt);bad.nodes=bad.nodes.filter((n:any)=>n.id!==payloads[0].id);
 assert.equal(verifyNativePreparedLibraryReadback(input,bad).status,'refused');
});

test('declared sparse domains require exactly the reachable presence tuples on React and native surfaces',()=>{
 const raw=fixture();
 raw.bindings.figma.drawnVariants=[{checked:false,style:'solid'},{checked:false,style:'raised'},{checked:true,style:'solid'}];
 raw.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
 const parsed=ContractSchema.safeParse(raw);assert(parsed.success,JSON.stringify(parsed.error?.issues));
 const c=parsed.data,contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  for(const tuple of c.bindings.figma.drawnVariants!)for(const showMark of [false,true]){
   const html=renderToStaticMarkup(React.createElement(C,{isChecked:tuple.checked,appearance:tuple.style,showMark}));
   assert.equal(html.includes('Moon'),tuple.checked===false&&tuple.style==='solid'&&showMark);
  }
  assert.throws(()=>renderToStaticMarkup(React.createElement(C,{isChecked:true,appearance:'raised'})),(error:any)=>error.code==='DRAWN_VARIANT_UNDECLARED');
 }
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 assert.equal(data.variants.length,3);
 for(const v of data.variants)assert.equal(!!v.spec.children?.find(n=>n.name==='mark'),v.name==='Checked=false, Style=Solid');
 for(const change of [
  (d:Contract)=>{d.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();},
  (d:Contract)=>{d.anatomy.root.parts!.mark.presenceByCombination!.rows.push({values:['true','raised'],present:false});},
  (d:Contract)=>{delete d.bindings.figma.drawnVariants;},
  (d:Contract)=>{d.bindings.figma.drawnVariants![0].style='unknown';},
 ]){const d=structuredClone(c);change(d);assert.equal(ContractSchema.safeParse(d).success,false);}
});

test('sparse presence inference needs independent complete domain observations and never invents a missing row',()=>{
 const axes=[{prop:'a',values:['x','y']},{prop:'b',values:['p','q']}];
 const observed=[{values:['x','p'],present:true},{values:['x','q'],present:false},{values:['y','p'],present:false}];
 const domain=observed.map(row=>row.values);
 assert.equal(inferPresenceByCombination(axes,observed),undefined);
 const table=inferPresenceByCombination(axes,observed,2,domain)!;
 assert.equal(table.rows.length,3);
 assert.throws(()=>resolvePresence({presenceByCombination:table},{a:'y',b:'q'}),/presence-combination-unavailable/);
 assert.throws(()=>inferPresenceByCombination(axes,observed.slice(1),2,domain),/observations-incomplete/);
 assert.throws(()=>inferPresenceByCombination(axes,observed,2,[...domain,domain[0]]),/observations-incomplete/);
 assert.throws(()=>inferPresenceByCombination(axes,observed,2,[...domain,['y','q']]),/observations-incomplete/);
 assert.equal(inferPresenceByCombination(axes,[...observed,{...observed[0],present:false}],2,domain),undefined);
});


test('a high-axis finite domain projects exact presence without relaxing completeness or the table limit',()=>{
 const axes=[{prop:'layout',values:['row','column']},...Array.from({length:9},(_,i)=>({prop:'count'+(i+2),values:['false','true']}))];
 const observed=['row','column'].flatMap(layout=>Array.from({length:9},(_,i)=>({values:[layout,...Array.from({length:9},(_,j)=>String(i===j))],present:i+2>=4})));
 const domain=observed.map(row=>row.values);
 assert.equal(inferPresenceByCombination(axes,observed),undefined,'observations alone never declare a sparse domain');
 const table=inferPresenceByCombination(axes,observed,2,domain)!;
 assert(table && table.props.length<=8);
 for(const row of observed)assert.equal(resolvePresence({presenceByCombination:table},Object.fromEntries(axes.map((a,i)=>[a.prop,row.values[i]]))),row.present);
 assert.throws(()=>inferPresenceByCombination(axes,observed.slice(1),2,domain),/observations-incomplete/);
 assert.equal(inferPresenceByCombination(axes,[...observed,{...observed[0],present:!observed[0].present}],2,domain),undefined);
});

test('the real declared-domain proposer preserves sparse XOR presence without extending the source domain',()=>{
 const domain=[{A:'X',B:'P'},{A:'X',B:'Q'},{A:'Y',B:'Q'}];
 const set:DumpSet={setName:'Sparse presence specimen',type:'COMPONENT_SET',propertyDefinitions:{
  A:{type:'VARIANT',defaultValue:'X',variantOptions:['X','Y']},B:{type:'VARIANT',defaultValue:'P',variantOptions:['P','Q']},
 },variants:domain.map(tuple=>({name:`A=${tuple.A}, B=${tuple.B}`,type:'COMPONENT',variantProperties:tuple,
  layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
  children:tuple.A==='X'&&tuple.B==='Q'?[]:[{name:'Label',type:'TEXT',text:{characters:'Observed',fontSize:12,fontStyle:'Regular',lineHeight:16}}],
 }))};
 const before=JSON.stringify(set);
 const result=proposeDeclaredDrawnCandidate(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'exact',stampsObservable:true},domain);
 assert.equal(result.acceptedContract,null);assert.equal(JSON.stringify(set),before);
 const c=ContractSchema.parse(result.proposal.contract),part=walkAnatomy(c).find(p=>p.part.text==='Observed')!.part;
 assert.equal(part.presenceByCombination!.rows.length,3);
 assert.equal(resolvePresence(part,{a:'x',b:'p'}),true);assert.equal(resolvePresence(part,{a:'x',b:'q'}),false);
 assert.equal(resolvePresence(part,{a:'y',b:'q'}),true);assert.throws(()=>resolvePresence(part,{a:'y',b:'p'}),/unavailable/);
});


test('shared slot exclusivity checks only valid declared tuples and still refuses overlapping or missing placements',()=>{
 const c=fixture();c.bindings.figma.drawnVariants=[{checked:false,style:'solid'},{checked:false,style:'raised'},{checked:true,style:'solid'}];
 const table=structuredClone(c.anatomy.root.parts!.mark.presenceByCombination!);table.rows.pop();
 c.anatomy.root.parts={left:{slot:{name:'children',bindings:{figma:{property:'Content'}}},presenceByCombination:table},
  right:{slot:{name:'children',bindings:{figma:{property:'Content'}}},presenceByCombination:{...structuredClone(table),rows:table.rows.map(r=>({...r,present:!r.present}))}}};
 assert.equal(defaultSlotFamilyIssue(c),undefined);
 c.anatomy.root.parts.right.presenceByCombination!.rows[0].present=true;
 assert.equal(defaultSlotFamilyIssue(c),'children-slot-placements-overlap');
 c.anatomy.root.parts.right.presenceByCombination!.rows[0].present=false;
 c.anatomy.root.parts.right.presenceByCombination!.rows.pop();
 assert.equal(defaultSlotFamilyIssue(c),'children-slot-presence-incomplete');
});

test('captured compound hidden flags become exact presence on both React surfaces and native variants',()=>{
 const set:DumpSet={setName:'Hidden specimen',type:'COMPONENT_SET',propertyDefinitions:{
  Tone:{type:'VARIANT',defaultValue:'Soft',variantOptions:['Soft','Bold']},
  Shape:{type:'VARIANT',defaultValue:'Round',variantOptions:['Round','Square']},
 },variants:['Soft','Bold'].flatMap(tone=>['Round','Square'].map(shape=>({name:`Tone=${tone}, Shape=${shape}`,type:'COMPONENT' as const,variantProperties:{Tone:tone,Shape:shape},layout:{mode:'HORIZONTAL' as const,primary:'MIN' as const,counter:'MIN' as const,spacing:0,padding:[0,0,0,0] as [number,number,number,number],primarySizing:'AUTO' as const,counterSizing:'AUTO' as const},children:[{name:'Caption',type:'TEXT' as const,hidden:(tone==='Soft')===(shape==='Round'),text:{characters:'Moon',fontSize:12,fontStyle:'Regular',lineHeight:16}}]})))};
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,hiddenCaptured:true};
 const proposed=proposeFromDump(set,opts),c=ContractSchema.parse(proposed.contract);c.name='Presence';
 const part=c.anatomy.root.parts!.Caption;assert(part.presenceByCombination);assert.equal(part.presenceByCombination.rows.length,4);
 const values={...tokens,primitives:proposed.mintedTokens!.tree},contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:tokenInventoryFromJson([values.primitives]),tokenValues:values,icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens:values,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);for(const tone of ['soft','bold'])for(const shape of ['round','square'])assert.equal(renderToStaticMarkup(React.createElement(C,{tone,shape})).includes('Moon'),(tone==='soft')!==(shape==='round'));
 }
 const native=createFigmaEngine({tokens:values,icons:new Map()}).compileComponentData(c,contracts);
 for(const variant of native.variants)assert.equal(!!variant.spec.children?.length,variant.name.includes('Tone=Soft')!==variant.name.includes('Shape=Round'));
 const legacy=ContractSchema.parse(proposeFromDump(set,{...opts,hiddenCaptured:false}).contract);
 assert.equal(legacy.anatomy.root.parts!.Caption.presenceByCombination,undefined,'missing capture authority cannot invent a compound gate');
});

test('React library packaging enforces declared tuples through the production generator',async t=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {generateComponents}=await import('../scripts/generate-components.js');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'declared-react-package-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const c=fixture();c.bindings.figma.drawnVariants=[{checked:false,style:'solid'},{checked:false,style:'raised'},{checked:true,style:'solid'}];c.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
 const file=path.join(dir,'presence.contract.json');fs.writeFileSync(file,JSON.stringify(c));
 const tokenFiles=['primitives','semantic','light','dark'].map(slot=>{const f=path.join(dir,slot+'.json');fs.writeFileSync(f,'{}');return slot+'='+f;});
 const options={contractFiles:[file],tokenFiles,iconsDir:path.join(dir,'icons'),outDir:path.join(dir,'out'),stories:true};
 const result=await generateComponents(options);assert.deepEqual(result.refused,[]);assert.deepEqual(result.generated,['Presence']);
 const C=load(fs.readFileSync(path.join(dir,'out/Presence/Presence.tsx'),'utf8'));
 for(const tuple of c.bindings.figma.drawnVariants)assert.doesNotThrow(()=>renderToStaticMarkup(React.createElement(C,{isChecked:tuple.checked,appearance:tuple.style})));
 assert.throws(()=>renderToStaticMarkup(React.createElement(C,{isChecked:true,appearance:'raised'})),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
 const stories=fs.readFileSync(path.join(dir,'out/Presence/Presence.stories.tsx'),'utf8'),module={exports:{} as any},req=createRequire(import.meta.url);
 vm.runInNewContext(transformSync(stories,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(name:string)=>name.endsWith('.css')?{}:name==='./Presence'?{Presence:C}:req(name)});
 const matrix=module.exports.Matrix.render();assert.equal(matrix.props.children.length,3);
 assert.deepEqual(Array.from(matrix.props.children,(c:any)=>[c.props.isChecked,c.props.appearance]),[[false,'solid'],[false,'raised'],[true,'solid']]);
 assert.doesNotThrow(()=>renderToStaticMarkup(matrix));
 c.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();fs.writeFileSync(file,JSON.stringify(c));
 const bad=await generateComponents({...options,outDir:path.join(dir,'bad')});assert.equal(bad.generated.length,0);assert.equal(bad.refused.length,1);
});


test('partial component occurrence tables exclude explicitly hidden instances without filling absent cells',()=>{
 const child=fixture();child.id='test.child';child.name='Child';child.props=[];
 child.anatomy={root:{text:'Child content'}};
 const set:DumpSet={setName:'Partial visibility',type:'COMPONENT_SET',propertyDefinitions:{
  Tone:{type:'VARIANT',defaultValue:'Soft',variantOptions:['Soft','Bold']},
  Shape:{type:'VARIANT',defaultValue:'Round',variantOptions:['Round','Square']},
 },variants:['Soft','Bold'].flatMap(tone=>['Round','Square'].map(shape=>({
  name:`Tone=${tone}, Shape=${shape}`,type:'COMPONENT' as const,variantProperties:{Tone:tone,Shape:shape},
  children:tone==='Bold'&&shape==='Square'?[]:[{name:'Content',type:'INSTANCE' as const,instanceOf:'Child',hidden:tone==='Soft'&&shape==='Round'}],
 })))};
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),
  contractIdByName:new Map([['Child',child.id]]),contractsById:new Map([[child.id,child]]),mintUnbound:true,hiddenCaptured:true};
 const result=proposeFromDump(set,opts),c=ContractSchema.parse(result.contract);
 const part=walkAnatomy(c).find(p=>p.part.component?.id===child.id)!.part;
 assert(part.presenceByCombination);assert.equal(part.visibleWhen,undefined);
 for(const tone of ['soft','bold'])for(const shape of ['round','square'])
  assert.equal(resolvePresence(part,{tone,shape}), (tone==='soft')!==(shape==='round'),`${tone}/${shape}`);
 const legacy=ContractSchema.parse(proposeFromDump(set,{...opts,hiddenCaptured:false}).contract);
 const legacyPart=walkAnatomy(legacy).find(p=>p.part.component?.id===child.id)!.part;
 assert.equal(resolvePresence(legacyPart,{tone:'soft',shape:'round'}),true,'without captured hidden authority preserve the existing structural table');
});

test('single Boolean presence preserves independent live visibility on both true and false planes',()=>{
 const set:any={setName:'Presence',type:'COMPONENT_SET',propertyDefinitions:{
  Expanded:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']},
  Required:{type:'BOOLEAN',defaultValue:false}},boolDefaults:{Required:false},
  variants:['False','True'].map(value=>({name:'Expanded='+value,variantProperties:{Expanded:value},type:'COMPONENT',
   layout:{mode:'HORIZONTAL',primary:'MIN',counter:'CENTER',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
   children:[{name:value==='True'?'Large':'Small',type:'TEXT',hidden:true,propRefs:{visible:'Required'},
    text:{characters:value==='True'?'Large mark':'Small mark',fontFamily:'Inter',fontStyle:'Regular',fontSize:12,lineHeight:16,textAutoResize:'WIDTH_AND_HEIGHT'}}]}))};
 const result=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,hiddenCaptured:true,projectionMode:'exact'});
 const c=ContractSchema.parse(result.contract),tree={...tokens,primitives:result.mintedTokens!.tree},contracts=new Map([[c.id,c]]);
 for(const p of Object.values(c.anatomy.root.parts!)){
  assert.deepEqual(p.visibleWhen,{prop:'required'});
  assert.deepEqual(p.presenceByCombination?.props,['expanded']);
 }
 for(const tsx of [emitReact(c,{tokens:tokenInventoryFromJson([tree.primitives]),icons:new Map(),contracts}).tsx,
  emitReactInline(c,{tokens:tree,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  for(const expanded of [false,true])for(const required of [false,true]){
   const html=renderToStaticMarkup(React.createElement(C,{expanded,required}));
   assert.equal(html.includes('Small mark'),required&&!expanded,html);
   assert.equal(html.includes('Large mark'),required&&expanded,html);
  }
 }
 const data=createFigmaEngine({tokens:tree,icons:new Map()}).compileComponentData(c,contracts);
 for(const v of data.variants){assert.equal(v.spec.children?.length,1);const mark=v.spec.children![0];
  assert.equal(mark.visibleProp,'Required');assert.equal(mark.visibleDefault,false);
  assert.equal(mark.characters,v.name==='Expanded=True'?'Large mark':'Small mark');
 }
 const missing=structuredClone(set);delete missing.variants[0].children[0].propRefs;
 const dropped=proposeFromDump(missing,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,hiddenCaptured:true});
 const unbound=Object.values((dropped.contract as any).anatomy.root.parts??{}).find((p:any)=>p.text==='Small mark') as any;
 assert.equal(unbound?.visibleWhen?.prop==='required',false,'a missing reading must not borrow another part visibility binding');
});

test('validated absent variants bound minority presence without inventing missing observations',()=>{
 const domain=['X','Y'].flatMap(a=>['P','Q'].flatMap(b=>['M','N'].map(c=>({A:a,B:b,C:c}))))
   .filter(t=>!(t.A==='Y'&&t.B==='Q'&&t.C==='N'));
 const set:DumpSet={setName:'Absent presence specimen',type:'COMPONENT_SET',propertyDefinitions:{
  A:{type:'VARIANT',defaultValue:'X',variantOptions:['X','Y']},
  B:{type:'VARIANT',defaultValue:'P',variantOptions:['P','Q']},
  C:{type:'VARIANT',defaultValue:'M',variantOptions:['M','N']},
 },variants:domain.map(tuple=>({name:`A=${tuple.A}, B=${tuple.B}, C=${tuple.C}`,type:'COMPONENT',variantProperties:tuple,
  layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
  children:tuple.A==='X'&&tuple.B==='P'&&tuple.C==='M'?[{name:'Label',type:'TEXT',text:{characters:'Observed',fontSize:12,fontStyle:'Regular',lineHeight:16}}]:[],
 }))};
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'exact' as const,stampsObservable:true};
 const c=ContractSchema.parse(proposeFromDump(set,opts).contract);
 assert.equal(c.bindings.figma.absentVariants?.length,1);
 const part=walkAnatomy(c).find(p=>p.part.text==='Observed')?.part;assert(part);
 assert.equal(part.presenceByCombination?.rows.length,7);
 for(const tuple of domain)assert.equal(resolvePresence(part,{a:tuple.A.toLowerCase(),b:tuple.B.toLowerCase(),c:tuple.C.toLowerCase()}),tuple.A==='X'&&tuple.B==='P'&&tuple.C==='M');
 assert.throws(()=>resolvePresence(part,{a:'y',b:'q',c:'n'}),/unavailable/);
 assert.throws(()=>proposeFromDump(set,{...opts,stampsObservable:false}),/Source matrix has 7 rows/);
 const duplicate=structuredClone(set);duplicate.variants.push(duplicate.variants[0]);
 assert.throws(()=>proposeFromDump(duplicate,opts),/duplicate/i);
});


test('absence-qualified presence retains React content and native structure on every reachable cell',()=>{
 const c=fixture();
 c.bindings.figma.absentVariants=[{checked:true,style:'raised'}];
 c.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
 assert(ContractSchema.safeParse(c).success);
 const contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  const C=load(tsx);
  for(const isChecked of [false,true])for(const appearance of ['solid','raised']){
   if(isChecked&&appearance==='raised')continue;
   for(const showMark of [false,true])assert.equal(renderToStaticMarkup(React.createElement(C,{isChecked,appearance,showMark})).includes('Moon'),!isChecked&&appearance==='solid'&&showMark);
  }
 }
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,3);
 for(const variant of native.variants)assert.equal(!!variant.spec.children?.find(n=>n.name==='mark'),variant.name==='Checked=false, Style=Solid');
 const positioned=structuredClone(c);
 positioned.anatomy.root.parts!.mark.absoluteGeometryByCombination={props:['checked','style'],rows:[{values:['false','solid'],geometry:{box:{x:0,y:0,width:8,height:8,right:8,bottom:8,constraints:{horizontal:'LEFT',vertical:'TOP'}},parent:{width:16,height:16},border:{left:0,right:0,top:0,bottom:0}}}]};
 assert(ContractSchema.safeParse(positioned).success);
 const missing=structuredClone(c);missing.anatomy.root.parts!.mark.presenceByCombination!.rows.pop();
 assert.equal(ContractSchema.safeParse(missing).success,false);
 const invalid=structuredClone(c);invalid.bindings.figma.absentVariants=[{checked:true}];
 assert.equal(ContractSchema.safeParse(invalid).success,false);
});

test('missing hover cells do not remove drawn rest cells from the presence domain',()=>{
 const variants=['Default','Hover'].flatMap(state=>['X','Y'].flatMap(a=>['P','Q'].flatMap(b=>['M','N'].map(c=>({State:state,A:a,B:b,C:c})))))
  .filter(t=>!(t.State==='Hover'&&t.A==='Y'&&t.B==='Q'&&t.C==='N'));
 const set:DumpSet={setName:'Presence',type:'COMPONENT_SET',propertyDefinitions:{
  State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']},
  A:{type:'VARIANT',defaultValue:'X',variantOptions:['X','Y']},
  B:{type:'VARIANT',defaultValue:'P',variantOptions:['P','Q']},
  C:{type:'VARIANT',defaultValue:'M',variantOptions:['M','N']},
 },variants:variants.map(t=>({name:`State=${t.State}, A=${t.A}, B=${t.B}, C=${t.C}`,type:'COMPONENT',variantProperties:t,opacity:t.State==='Hover'?0.5:1,
  layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
  children:t.A==='X'&&t.B==='P'&&t.C==='M'?[{name:'Label',type:'TEXT',text:{characters:'Observed',fontSize:12,fontStyle:'Regular',lineHeight:16}}]:[],
 }))};
 const result=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'exact',stampsObservable:true});
 const c=ContractSchema.parse(result.contract);
 assert.equal(c.bindings.figma.absentVariants?.length??0,0);
 assert.equal(result.stateAxisProjection?.undrawnStateCells.length,1);
 const part=walkAnatomy(c).find(p=>p.part.text==='Observed')?.part;assert(part);
 assert.equal(part.presenceByCombination?.rows.length,8);
 for(const t of variants.filter(t=>t.State==='Default'))assert.equal(resolvePresence(part,{a:t.A.toLowerCase(),b:t.B.toLowerCase(),c:t.C.toLowerCase()}),t.A==='X'&&t.B==='P'&&t.C==='M');
 const absentRest=structuredClone(set);absentRest.variants=absentRest.variants.filter(v=>v.name!=='State=Default, A=Y, B=Q, C=N');
 const missing=ContractSchema.parse(proposeFromDump(absentRest,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'exact',stampsObservable:true}).contract);
 assert.equal(missing.bindings.figma.absentVariants?.length,1);
 const missingPart=walkAnatomy(missing).find(p=>p.part.text==='Observed')?.part;assert(missingPart);
 assert.equal(missingPart.presenceByCombination?.rows.length,7);
 assert.throws(()=>resolvePresence(missingPart,{a:'y',b:'q',c:'n'}),/unavailable/);
});

test('Web Components conjoin a complete Boolean presence table with independent visibility',async()=>{
 const {chromium}=await import('playwright-core'),fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {build}=await import('esbuild');const {tagOf}=await import('../packages/emitter-web-components/src/emit-wc.js');
 const c=fixture();c.anatomy.root.parts!.mark.presenceByCombination={props:['checked'],rows:[{values:['false'],present:true},{values:['true'],present:false}]};
 const ctx={tokens:new Set<string>(),icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 for(const mutate of [(p:any)=>p.rows.pop(),(p:any)=>p.rows[1].values[0]='false',(p:any)=>p.props[0]='style']){
  const bad=structuredClone(c);mutate(bad.anatomy.root.parts!.mark.presenceByCombination);
  assert.throws(()=>emitWebComponent(bad,{...ctx,contracts:new Map([[bad.id,bad]])}),/WEB_COMPONENT_PRESENCE_COMBINATION_UNSUPPORTED/);
 }
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wc-boolean-presence-')),browser=await chromium.launch();
 try{
  const out=emitWebComponent(c,ctx),tag=tagOf(c);
  fs.writeFileSync(path.join(dir,tag+'.ts'),out.element);fs.writeFileSync(path.join(dir,tag+'.css.ts'),out.stylesheet);
  const built=await build({entryPoints:[path.join(dir,tag+'.ts')],bundle:true,write:false,format:'iife',target:'es2022'});
  const page=await browser.newPage();await page.setContent(`<${tag}></${tag}>`);await page.addScriptTag({content:built.outputFiles[0].text});
  for(const [checked,show] of [[false,true],[true,true],[false,false],[true,false],[false,true]]){
   const content=await page.locator(tag).evaluate(async(el,values)=>{(el as any).checked=values[0];(el as any).show=values[1];await new Promise(requestAnimationFrame);return el.shadowRoot!.textContent;},[checked,show]);
   assert.equal(content!.includes('Moon'),!checked&&show);
  }
 }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
});
