import {unpackNativeReadback} from './native-readback-transport.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
const tokens={primitives:{floor:{$type:'dimension',$value:'60px'},height:{hug:{$type:'string',$value:'fit-content'},fixed:{$type:'dimension',$value:'20px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(){return ContractSchema.parse({id:'test.minimum',name:'Minimum',version:'0.1.0',status:'draft',description:'A minimum survives token-resolved HUG sizing',semantics:{element:'div'},states:[],props:[{name:'size',type:{enum:['hug','fixed']},default:'hug',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size'}}}],anatomy:{root:{layout:{display:'flex',direction:'row'},tokens:{height:'{height.{size}}','min-height':'{floor}'},parts:{mark:{shape:{kind:'rect',width:10,height:10}}}}},bindings:{code:{anchors:{importPath:'./Minimum',export:'Minimum'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});}
test('token-resolved HUG keeps its minimum while fixed-height precedence remains unchanged',()=>{
 const c=fixture(),contracts=new Map([[c.id,c]]),engine=createFigmaEngine({tokens,icons:new Map()});
 for(const reversed of [false,true]){
  if(reversed)c.anatomy.root.tokens={'min-height':'{floor}',height:'{height.{size}}'};
  const data=engine.compileComponentData(c,contracts),hug=data.variants.find(v=>v.name==='Size=hug')!.spec,fixed=data.variants.find(v=>v.name==='Size=fixed')!.spec;
  assert.equal(hug.bindings?.minHeight,'floor');assert.equal(hug.fixedHeight,undefined);
  assert.equal(fixed.bindings?.minHeight,undefined);assert.equal(fixed.fixedHeight?.px,20);
  assert(!JSON.stringify(data).includes('resolvedMinHeight'));
 }
});

import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativePreparedLibraryReadbackScript,emitNativePreparedLibraryPackedReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';
test('native prepared writer and readback retain a token-resolved HUG minimum',async()=>{
 const f=await nativeComparisonFixture(),c=fixture(),contracts=new Map([[c.id,c]]);
 const tokenTree={primitives:{...f.tokens,...tokens.primitives},semantic:{},light:{},dark:{},brands:{default:{}}};
 const engine=createFigmaEngine({tokens:tokenTree,icons:new Map()});
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokenTree).slice(7)};
 const operation={id:'40000000-0000-4000-8000-000000000254',fileKey:f.figma.fileKey};
 const compiled=engine.compileNativePreparedLibrary(c,contracts,source,operation.id);
 const routed=layeredNativeTokenModes(tokenTree,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await f.run(emitNativeTokenContextScript(tokenInput).script);
 assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await f.run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await f.run(engine.buildNativePreparedLibraryScript(c,contracts,source,context));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await f.run(emitNativePreparedLibraryReadbackScript(input));
 assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(input,receipt)));
 const decoded=unpackNativeReadback(await f.run(emitNativePreparedLibraryPackedReadbackScript(input)));
 assert.deepEqual(decoded,receipt);
 assert.equal(verifyNativePreparedLibraryReadback(input,decoded).status,'supported-structure-observed');
 const hug=receipt.nodes.find((n:any)=>n.name==='Size=hug');assert(hug);
 assert.equal(hug.values.minHeight,60);
 const changed=structuredClone(receipt),lost=changed.nodes.find((n:any)=>n.id===hug.id).values;
 lost.minHeight=0;
 assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused');
 delete lost.boundVariables.minHeight;
 assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused');
 const live=await f.figma.getNodeByIdAsync(hug.id);live.name='x'.repeat(4*1024*1024);
 const oversized=await f.run(emitNativePreparedLibraryPackedReadbackScript(input));
 assert.equal(oversized.status,'refused');assert.deepEqual(oversized.problems,['native-source-readback-result-byte-limit']);
 assert.equal(oversized.nodes,undefined);assert.equal(oversized.tokens,undefined);
});

import {nativeBoundNumber} from './native-bound-number.js';
test('bound minimum resolves aliases using each collection consumer mode and refuses unknown or cyclic values',()=>{
 const vars=[{id:'a',name:'floor',variableCollectionId:'c1',resolvedType:'FLOAT',valuesByMode:{one:{type:'VARIABLE_ALIAS',id:'b'}}},
 {id:'b',name:'base',variableCollectionId:'c2',resolvedType:'FLOAT',valuesByMode:{light:60,dark:80}}];
 assert.equal(nativeBoundNumber('floor',vars,{c1:'one',c2:'light'}),60);
 assert.equal(nativeBoundNumber('floor',vars,{c1:'one',c2:'dark'}),80);
 assert.equal(nativeBoundNumber('floor',vars,{c1:'one'}),undefined);
 assert.equal(nativeBoundNumber('floor',vars,{c1:'unknown',c2:'light'}),undefined);
 const cycle=structuredClone(vars);cycle[0].valuesByMode.one!.id='a';
 assert.equal(nativeBoundNumber('floor',cycle,{c1:'one',c2:'light'}),undefined);
 assert.equal(nativeBoundNumber('missing',vars,{c1:'one',c2:'light'}),undefined);
});
