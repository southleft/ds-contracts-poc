import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {nativeTokenTextBox} from './native-text-box.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {flattenTokens} from './tokens.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';

function fixture(both:boolean){
 const tokens={primitives:{width:{$type:'dimension',$value:both?'32px':'2px'},height:{$type:'dimension',$value:'32px'},font:{$type:'dimension',$value:both?'10px':'14px'},line:{$type:'dimension',$value:both?'10px':'22px'},weight:{$type:'number',$value:400},ink:{$type:'color',$value:'#4e5969'}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const contract=ContractSchema.parse({id:'fixture.token-text',name:'TokenText',version:'0.1.0',status:'draft',description:'Fixed token text box',semantics:{element:'div'},states:[],props:[],anatomy:{root:{layout:{display:'flex',direction:'row'},parts:{label:{text:both?'◇    交换':':',tokens:{width:'{width}',...(both?{height:'{height}'}:{}),'font-size':'{font}','line-height':'{line}','font-weight':'{weight}',color:'{ink}'},declared:{'font-family':'PingFang SC','text-align':both?'center':'right',...(both?{'white-space':'pre-wrap','overflow-y':'hidden'}:{})}}}}},bindings:{code:{anchors:{importPath:'./TokenText',export:'TokenText'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 return {tokens,contract,byId:new Map([[contract.id,contract]])};
}
async function prepared(both:boolean,nested=false){
 const f=fixture(both),host=nativeFixtureHost();host.figma.fileKey='FixedTextFixture';
 const proto=Object.getPrototypeOf(host.figma.currentPage);proto.setExplicitVariableModeForCollection=function(c:any,m:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:m};};
 const clone=proto._cloneForInstance;proto._cloneForInstance=function(){const n=clone.call(this);if(this.type==='TEXT')for(const k of ['textAutoResize','textAlignVertical'])if(this[k]!==undefined)n[k]=this[k];return n;};
 if(nested){const parent=ContractSchema.parse({...f.contract,id:'fixture.caller',name:'Caller',anatomy:{root:{layout:{display:'flex'},parts:{body:{component:{id:f.contract.id}}}}}});f.byId.set(parent.id,parent);f.contract=parent;}
 const run=async(s:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+s+'})()',{figma:host.figma,console},{timeout:5000})));
 const engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(f.tokens).slice(7)};
 const operation={id:'60000000-0000-4000-8000-000000000001',fileKey:host.figma.fileKey},compiled=engine.compileNativePreparedLibrary(f.contract,f.byId,source,operation.id);
 const routed=layeredNativeTokenModes(f.tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const creation=await run(engine.buildNativePreparedLibraryScript(f.contract,f.byId,source,{operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}}));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,projection:compiled.projection,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await run(emitNativePreparedLibraryReadbackScript(input));proto._cloneForInstance=clone;return {input,receipt,engine,...f};
}
test('prepared token text keeps exact dimensions, alignments, aliases and an owned TEXT node',async()=>{
 for(const both of [false,true])for(const nested of [false,true]){
  const {input,receipt}=await prepared(both,nested),verified=verifyNativePreparedLibraryReadback(input,receipt);assert.equal(verified.status,'supported-structure-observed',JSON.stringify(verified));
  const text=receipt.nodes.filter((n:any)=>n.type==='TEXT').at(-1);assert(text);assert.equal(text.values.width,both?32:2);assert.equal(text.values.height,both?32:22);assert.equal(text.values.textAutoResize,both?'NONE':'HEIGHT');assert.equal(text.values.textAlignVertical,'TOP');assert.equal(text.values.textAlignHorizontal,both?'CENTER':'RIGHT');
  assert.equal(receipt.nodes.filter((n:any)=>n.type==='FRAME').length,0,'no unowned generated wrapper');
  for(const mutate of [
   (v:any)=>{v.width+=1;},(v:any)=>{v.height+=1;},(v:any)=>{v.textAutoResize='WIDTH_AND_HEIGHT';},
   (v:any)=>{v.textAlignVertical='CENTER';},(v:any)=>{v.textAlignHorizontal='LEFT';},
   (v:any)=>{delete v.boundVariables.width;},(v:any)=>{v.boundVariables.width={type:'VARIABLE_ALIAS',id:'foreign'};},
   ...(both?[(v:any)=>{delete v.boundVariables.height;},(v:any)=>{v.boundVariables.height={type:'VARIABLE_ALIAS',id:'foreign'};}]:[]),
   (v:any)=>{v.fontSize+=1;},(v:any)=>{v.characters='foreign';}
  ]){const bad=structuredClone(receipt);mutate(bad.nodes.find((n:any)=>n.id===text.id).values);assert.equal(verifyNativePreparedLibraryReadback(input,bad).status,'refused',String(mutate));}
 }
});
test('token text ownership refuses ambiguous dimensions and other styled or positioned channels',()=>{
 const f=fixture(false),data=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.contract,f.byId),original=data.variants[0].spec.children![0];assert.deepEqual(nativeTokenTextBox(original),{width:2,lineHeight:22});
 for(const mutate of [
  (s:any)=>{s.fixedWidth.px=0;},(s:any)=>{s.fixedWidth.px=NaN;},(s:any)=>{s.fixedWidth.varName='';},
  (s:any)=>{s.fixedHeight={px:-1};},(s:any)=>{s.fixedHeight={px:22,varName:''};},
  (s:any)=>{s.textAutoResize='WIDTH_AND_HEIGHT';},(s:any)=>{s.absolute={h:'MAX',v:'MAX',right:0,bottom:0};},
  (s:any)=>{s.bindings={minWidth:'width'};},(s:any)=>{s.fill='ink';},(s:any)=>{s.lits={width:2};},
  (s:any)=>{s.characters='two glyphs';},(s:any)=>{s.lineHeight={unit:'AUTO'};},(s:any)=>{s.fillW=true;}
 ]){const s=structuredClone(original);mutate(s);assert.throws(()=>nativeTokenTextBox(s),/native-token-text-box-unqualified/,String(mutate));}
});
test('ordinary legacy writer keeps its historical styled-text wrapper',async()=>{
 const {tokens,contract,byId}=fixture(true),host=nativeFixtureHost({modeLimit:4}),engine=createFigmaEngine({tokens,icons:new Map()});
 await vm.runInNewContext('(async()=>{'+engine.buildTokensScript(null)+'})()',{figma:host.figma,console:{log(){},warn(){},error(){}}});
 await vm.runInNewContext('(async()=>{'+engine.buildComponentScript(contract,byId)+'})()',{figma:host.figma,console:{log(){},warn(){},error(){}}});
 const text=host.figma.root.findOne((n:any)=>n.type==='TEXT');assert(text);assert.equal(text.parent.type,'FRAME');assert.equal(text.parent.width,32);assert.equal(text.parent.height,32);
});
