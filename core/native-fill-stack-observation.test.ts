import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {ContractSchema,FillStackSchema,type Contract} from '../scripts/contract-schema.js';
import {qualifySolidFillColorBinding} from '../packages/schema/src/solid-fill-binding.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {planSolidFillBindingTokens} from './solid-fill-binding-tokens.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback,type NativePreparedLibraryObservationInput} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';

const encoded='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image={index:1,type:'IMAGE' as const,visible:true,opacity:.5,blendMode:'NORMAL' as const,imageHash:'source-image',image:`url('data:image/png;base64,${encoded}')`,scaleMode:'FILL' as const};
const solid={index:0,type:'SOLID' as const,visible:true,opacity:1,blendMode:'NORMAL' as const,color:{r:.25,g:.5,b:.75}};
const stack={version:1 as const,order:'bottom-to-top' as const,paints:[solid,image]};
const contract=(id:string,name:string):Contract=>ContractSchema.parse({id,name,version:'1.0.0',status:'draft',description:'Synthetic native observer test; no source-fidelity claim',states:[],props:[],semantics:{element:'div'},anatomy:{root:{literals:{width:'24px',height:'24px'}}},bindings:{code:{anchors:{importPath:'./'+name,export:name}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:name+'-key'}}}});

async function fixture(){
 const host=nativeFixtureHost({instanceVariantSelection:true,consumerVariableModes:true});host.figma.fileKey='PaintStackObserverFixture';
 Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
 const assets=new Map<string,Uint8Array>();
 host.figma.base64Decode=(s:string)=>new Uint8Array(Buffer.from(s,'base64'));
 host.figma.createImage=(bytes:Uint8Array)=>{const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,Uint8Array.from(bytes));return{hash};};
 host.figma.getImageByHash=(hash:string)=>assets.has(hash)?{getBytesAsync:async()=>Uint8Array.from(assets.get(hash)!)}:null;
 // The base mock records aliases only. Model Figma's paint normalization from
 // the actual independently allocated one-mode variable, never source expectations.
 const setPaint=host.figma.variables.setBoundVariableForPaint;
 host.figma.variables.setBoundVariableForPaint=(paint:any,field:string,variable:any)=>{
  const out=setPaint(paint,field,variable),selected=variable.resolveForConsumer().value;
  return field==='color'?{...out,color:{r:selected.r,g:selected.g,b:selected.b},opacity:selected.a??1}:out;
 };
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'\n})()',{figma:host.figma,console},{timeout:5000})));
 const sourcePaint={color:solid.color,opacity:.5,blendMode:'NORMAL' as const},value={...solid.color,a:.5};
 const binding=qualifySolidFillColorBinding({variableId:'source-color',paint:sourcePaint},{'source-color':{name:'Paint',collectionId:'source-paint',modeId:'source-base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}});
 const plan=planSolidFillBindingTokens([binding]);
 const rootStack=FillStackSchema.parse({...stack,paints:[{...solid,opacity:.5,token:plan.requestedTokenPaths[0],sourceBinding:{owner:'root',nodeName:'Root',variantName:'Default',binding}},image]});
 const child=contract('test.paint-root-child','PaintRootChild');child.anatomy.root.literals!['background-color']='#ffffff';
 const controlled=contract('test.paint-controlled-child','PaintControlledChild');controlled.props=[{name:'color',type:{enum:['rgba(0,0,255,0.5)']},bindings:{figma:{kind:'NONE'},code:{prop:'color'}}}];controlled.anatomy.root.parts={Surface:{fillStack:rootStack,shapeFillOverrideProp:'color'},Plain:{literals:{width:'2px',height:'2px'}}};
 const parent=contract('test.paint-observer-parent','PaintObserverParent');parent.anatomy.root.parts={
  RootInput:{component:{id:child.id},fillStack:rootStack,fillStackSource:{fileKey:'OriginalSourceFile',setKey:'PaintRootChild-key',contractRevision:revisionOf(child)}},
  Omitted:{component:{id:controlled.id}},Supplied:{component:{id:controlled.id,props:{color:'rgba(0,0,255,0.5)'}}},
 };
 const tokens={primitives:plan.tokens,semantic:{},light:{},dark:{},brands:{default:{}}};
 const byId=new Map([child,controlled,parent].map(c=>[c.id,c])),engine=createFigmaEngine({tokens,icons:new Map()});
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)};
 const operation={id:'60000000-0000-4000-8000-000000000001',fileKey:host.figma.fileKey};
 const compiled=engine.compileNativePreparedLibrary(parent,byId,source,operation.id);
 const routed=layeredNativeTokenModes(tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate');
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await run(engine.buildNativePreparedLibraryScript(parent,byId,source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input:NativePreparedLibraryObservationInput={operation,planRevision:revisionOf(compiled),component:compiled.component,graphComponents:compiled.components,graphVerification:2,projection:compiled.projection,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const readbackScript=emitNativePreparedLibraryReadbackScript(input),receipt=await run(readbackScript);
 const instances=receipt.nodes.filter((n:any)=>n.type==='INSTANCE');
 const rootInput=instances.find((n:any)=>n.values.fills?.some((p:any)=>p.type==='IMAGE'));
 const supplied=receipt.nodes.find((n:any)=>n.metadata.shapeFillOverride===controlled.id+':color'&&n.values.fills?.length===1&&n.values.fills[0].color.b===1);
 const omitted=receipt.nodes.find((n:any)=>n.metadata.shapeFillOverride===controlled.id+':color'&&n.parentId!==supplied?.parentId&&instances.some((i:any)=>i.id===n.parentId));
 assert(rootInput);assert(supplied);assert(omitted);
 return{host,run,input,receipt,readbackScript,rootInput,supplied,omitted,controlled,assets,verify:(r=receipt)=>verifyNativePreparedLibraryReadback(input,r)};
}

test('public prepared-library observer verifies supplied root stack and authored whole-fill override with omitted defaults',async()=>{
 const f=await fixture();assert.equal(f.verify().status,'supported-structure-observed',JSON.stringify(f.verify()));
 assert.equal(f.rootInput.values.fills.length,2);assert.equal(f.supplied.values.fills.length,1);assert.equal(f.omitted.values.fills.length,2);assert.equal(f.omitted.values.fills[0].boundVariables.color.type,'VARIABLE_ALIAS');
 const image=f.rootInput.values.fills.find((p:any)=>p.type==='IMAGE');assert.equal(f.rootInput.imageAssets[image.imageHash],encoded,'image bytes are reconstructed independently through native getBytesAsync');
 assert.match(f.readbackScript,/shapeFillOverride/);
});

test('supplied instance stack rejects changed order, bytes, layer count and binding identity before inheritance exemption',async()=>{
 const f=await fixture();assert.equal(f.verify().status,'supported-structure-observed',JSON.stringify(f.verify()));
 for(const [label,change]of [
  ['order',(n:any)=>n.values.fills.reverse()],['missing',(n:any)=>n.values.fills.pop()],['extra',(n:any)=>n.values.fills.push({...n.values.fills[0]})],
  ['bytes',(n:any)=>n.imageAssets[n.values.fills[1].imageHash]=Buffer.from('wrong bytes').toString('base64')],
  ['binding',(n:any)=>n.values.fills[0].boundVariables.color.id='foreign'],['aggregate binding',(n:any)=>n.values.boundVariables.fills=[{type:'VARIABLE_ALIAS',id:'foreign'}]],
 ]as const){const r=structuredClone(f.receipt);change(r.nodes.find((n:any)=>n.id===f.rootInput.id));const report=f.verify(r);assert.equal(report.status,'refused',label);assert(report.problems.some(p=>p.startsWith('native-fill-stack-observation')),label+':'+JSON.stringify(report));}
});

test('whole-fill override requires unique intended marker, exact one paint, alpha and removed aliases; omission stays inherited',async()=>{
 const f=await fixture();assert.equal(f.verify().status,'supported-structure-observed',JSON.stringify(f.verify()));
 for(const [label,change]of [
  ['missing marker',(n:any)=>delete n.metadata.shapeFillOverride],['wrong marker',(n:any)=>n.metadata.shapeFillOverride='foreign'],
  ['extra paint',(n:any)=>n.values.fills.push({...n.values.fills[0]})],['wrong color',(n:any)=>n.values.fills[0].color.r=.5],['wrong alpha',(n:any)=>n.values.fills[0].opacity=1],
  ['paint binding',(n:any)=>n.values.fills[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'foreign'}}],
  ['aggregate binding',(n:any)=>n.values.boundVariables.fills=[{type:'VARIABLE_ALIAS',id:'foreign'}]],
 ]as const){const r=structuredClone(f.receipt);change(r.nodes.find((n:any)=>n.id===f.supplied.id));assert.equal(f.verify(r).status,'refused',label);}
 const omitted=structuredClone(f.receipt);omitted.nodes.find((n:any)=>n.id===f.omitted.id).values.fills=[structuredClone(f.supplied.values.fills[0])];assert.equal(f.verify(omitted).status,'refused','omitted defaults remain exact');
 const duplicate=structuredClone(f.receipt);const sibling=duplicate.nodes.find((n:any)=>n.parentId===f.supplied.parentId&&n.id!==f.supplied.id);assert(sibling);sibling.metadata.shapeFillOverride=f.controlled.id+':color';assert(f.verify(duplicate).problems.some(p=>p.includes('native-shape-fill-observation-target')),'duplicate marker within the same owner must fail exact target count');
 const missing=structuredClone(f.receipt);missing.nodes.find((n:any)=>n.id===f.supplied.id).metadata.shapeFillOverride='';assert(f.verify(missing).problems.some(p=>p.includes('native-shape-fill-observation')));
});
