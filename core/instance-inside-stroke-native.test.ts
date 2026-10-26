import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback,type NativePreparedLibraryObservationInput} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';
const base=(name:string):Contract=>ContractSchema.parse({id:'test.'+name.toLowerCase(),name,version:'1.0.0',status:'draft',description:'Synthetic native observer; no live application claim',props:[],states:[],semantics:{element:'div'},anatomy:{root:{literals:{width:'24px',height:'24px','border-radius':'12px'}}},bindings:{figma:{anchors:{fileKey:'source',componentSetKey:name+'-key'}},code:{anchors:{importPath:'./'+name,export:name}}}});
async function fixture(){
 const host=nativeFixtureHost({instanceVariantSelection:true,consumerVariableModes:true});host.figma.fileKey='InsideStrokeObserverFixture';
 Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'\n})()',{figma:host.figma,console},{timeout:5000})));
 const child=base('InsideChild');child.anatomy.root.instanceRootInputs=['border-color','border-width'];
 const parent=base('InsideParent');parent.anatomy.root.parts={Supplied:{component:{id:child.id,rootOverrides:{'border-color':'{usage.ink}','border-width':'{usage.width}'}}},Omitted:{component:{id:child.id}}};
 const tokens={primitives:{usage:{ink:{$type:'color',$value:'rgba(32,96,160,0.4)'},width:{$type:'dimension',$value:'3.5px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const byId=new Map([child,parent].map(c=>[c.id,c])),engine=createFigmaEngine({tokens,icons:new Map()});
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)};
 const operation={id:'60000000-0000-4000-8000-000000000008',fileKey:host.figma.fileKey},compiled=engine.compileNativePreparedLibrary(parent,byId,source,operation.id);
 const routed=layeredNativeTokenModes(tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate');
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await run(engine.buildNativePreparedLibraryScript(parent,byId,source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input:NativePreparedLibraryObservationInput={operation,planRevision:revisionOf(compiled),component:compiled.component,graphComponents:compiled.components,graphVerification:2,projection:compiled.projection,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const script=emitNativePreparedLibraryReadbackScript(input),receipt=await run(script),instances=receipt.nodes.filter((n:any)=>n.type==='INSTANCE');
 const supplied=instances.find((n:any)=>n.values.strokes?.length===1),omitted=instances.find((n:any)=>n.values.strokes?.length===0);assert(supplied);assert(omitted);
 return{receipt,supplied,omitted,script,compiled,verify:(r=receipt)=>verifyNativePreparedLibraryReadback(input,r)};
}
test('public native prepared-library path writes and independently observes exact unbound inside stroke and omitted default',async()=>{
 const f=await fixture();assert.equal(f.verify().status,'supported-structure-observed',JSON.stringify(f.verify()));
 assert.equal(f.supplied.values.strokeWeight,3.5);assert.equal(f.supplied.values.strokeAlign,'INSIDE');assert.equal(f.supplied.values.strokesIncludedInLayout,false);
 assert.deepEqual(f.supplied.values.strokes,[{type:'SOLID',color:{r:32/255,g:96/255,b:160/255},opacity:.4,blendMode:'NORMAL'}]);
 assert.equal(f.omitted.values.strokes.length,0);
 const changedDefault=structuredClone(f.receipt);changedDefault.nodes.find((n:any)=>n.id===f.omitted.id).values.strokes=[structuredClone(f.supplied.values.strokes[0])];assert(f.verify(changedDefault).problems.some(p=>p.startsWith('native-instance-inside-stroke-omitted-default')));
 for(const [label,change]of [
 ['color',(n:any)=>n.values.strokes[0].color.r=.5],['alpha',(n:any)=>n.values.strokes[0].opacity=.5],['missing',(n:any)=>n.values.strokes=[]],['extra',(n:any)=>n.values.strokes.push(n.values.strokes[0])],
 ['pattern',(n:any)=>n.values.dashPattern=[2,2]],['missing pattern',(n:any)=>delete n.values.dashPattern],['width',(n:any)=>n.values.strokeWeight=2],['alignment',(n:any)=>n.values.strokeAlign='OUTSIDE'],['layout',(n:any)=>n.values.strokesIncludedInLayout=true],['paint alias',(n:any)=>n.values.strokes[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'forged'}}],['weight alias',(n:any)=>n.values.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:'forged'}],
 ]as const){const r=structuredClone(f.receipt);change(r.nodes.find((n:any)=>n.id===f.supplied.id));const out=f.verify(r);assert.equal(out.status,'refused',label);assert(out.problems.some(p=>p.startsWith('native-instance-inside-stroke-observation')),label+JSON.stringify(out));}
});
