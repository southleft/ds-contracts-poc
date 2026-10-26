import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema} from '../scripts/contract-schema.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import vm from 'node:vm';
import {revisionOf} from './contract-provenance.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {flattenTokens} from './tokens.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback,nativeTextSizeOwnsIntrinsicGeometry} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';

async function fixture(supplied=true,slot=false){
 const host=nativeFixtureHost({consumerVariableModes:true});
 // TEXT has no clipsContent property in the native API; the shared mock's
 // frame defaults otherwise remain on a newly created text main.
 const createText=host.figma.createText.bind(host.figma);host.figma.createText=()=>{const node=createText();delete node.clipsContent;return node;};
 const f={...host,tokens:{ink:{$type:'color',$value:'#fafafa'}},run:async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'\n})()',{figma:host.figma,console},{timeout:5000}))),contract:(id:string,anatomy:unknown)=>ContractSchema.parse({id,name:id.endsWith('child')?'ScalarChild':'ScalarRoot',version:'0.1.0',status:'draft',description:'Synthetic scalar writer to independent reader fixture, not visual fidelity',semantics:{element:'div'},props:[],states:[],anatomy,bindings:{code:{anchors:{importPath:'./fixture',export:'Fixture'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}})};
 // The shared mock estimates text height from font size. For this fixture,
 // model Figma's explicit single-line pixel line-height API instead.
 const prototype=Object.getPrototypeOf(f.figma.currentPage),measure=prototype._measureText;
 prototype._measureText=function(axis:string){return axis==='h'&&!this._resized&&this.lineHeight?.unit==='PIXELS'&&!/[\r\n]/.test(this.characters??'')?this.lineHeight.value:measure.call(this,axis);};
 const child=f.contract('fixture.scalar-child',{root:{layout:{display:'flex',direction:'row'},parts:{label:{text:'Label',textAutoResize:'WIDTH_AND_HEIGHT',literals:{'font-size':'14px','line-height':'22px'},declared:{'font-family':'Inter'},tokens:{color:'{ink}'},literalsByProp:[{prop:'textSize',map:{small:{'font-size':'12px','line-height':'20px'}}}]}}}});
 child.name='ScalarChild';child.props=[{name:'textSize',type:{enum:['small']},bindings:{code:{prop:'textSize'},figma:{kind:'NONE'}}}];ContractSchema.parse(child);
 const ref={id:child.id,...(supplied?{props:{textSize:'small'}}:{})};
 const root=f.contract('fixture.scalar-root',{root:{layout:{display:'flex',direction:'row'},parts:{body:slot?{slot:{name:'body',defaultContent:[ref],renderDefault:true}}:{component:ref}}}});root.name='ScalarRoot';
 const contracts=new Map([[child.id,child],[root.id,root]]),tokens={primitives:f.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},engine=createFigmaEngine({tokens,icons:new Map()});
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)},operation={id:'40000000-0000-4000-8000-000000000269',fileKey:f.figma.fileKey};
 const compiled=engine.compileNativePreparedLibrary(root,contracts,source,operation.id),routed=layeredNativeTokenModes(tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await f.run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await f.run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await f.run(engine.buildNativePreparedLibraryScript(root,contracts,source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await f.run(emitNativePreparedLibraryReadbackScript(input));return {input,receipt};
}

test('prepared scalar writer is independently read back with exact target, value and inherited typography',async()=>{
 const {input,receipt}=await fixture();const verify=(r=receipt)=>verifyNativePreparedLibraryReadback(input,r);
 assert.equal(verify().status,'supported-structure-observed',JSON.stringify(verify()));
 const targets=receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.metadata.textSizeOverride&&n.values.fontSize===12);assert.equal(targets.length,1);
 const target=targets[0];assert.deepEqual(target.values.lineHeight,{unit:'PIXELS',value:20});
 for(const mutate of [
  (n:any)=>{n.values.fontSize=13;},(n:any)=>{n.values.lineHeight.value=21;},
  (n:any)=>{n.metadata.textSizeOverride='wrong-owner';},(n:any)=>{n.values.fontName.style='Bold';},
  (n:any)=>{n.values.fontWeight=700;},(n:any)=>{n.values.letterSpacing={unit:'PIXELS',value:1};},
  (n:any)=>{n.values.fills=[];},(n:any)=>{n.values.characters='Other';},
  (n:any)=>{n.values.textStyleId='unexpected-style';},(n:any)=>{n.values.textCase='UPPER';},(n:any)=>{n.values.textDecoration='UNDERLINE';},(n:any)=>{n.values.paragraphSpacing=3;},
  (n:any)=>{n.values.boundVariables.fontSize={type:'VARIABLE_ALIAS',id:'stale-size'};},
  (n:any)=>{n.values.boundVariables.other={type:'VARIABLE_ALIAS',id:'injected'};},
  (n:any)=>{n.values.textAutoResize='HEIGHT';},(n:any)=>{n.values.layoutSizingHorizontal='FILL';},
  (n:any)=>{n.values.boundVariables.width={type:'VARIABLE_ALIAS',id:'fixed-width'};},(n:any)=>{n.values.height+=1;},
 ]){const changed=structuredClone(receipt);mutate(changed.nodes.find((n:any)=>n.id===target.id));assert.equal(verify(changed).status,'refused',String(mutate));}
});

test('omitted scalar input preserves native main size and independent readback',async()=>{
 const {input,receipt}=await fixture(false);const result=verifyNativePreparedLibraryReadback(input,receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 assert(receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.metadata.textSizeOverride).every((n:any)=>n.values.fontSize===14&&n.values.lineHeight.value===22));
});

test('intrinsic scalar geometry never authorizes fixed, bound, Fill or multiline text',()=>{
 const key='owned',spec:any={type:'text',name:'label',textSizeTarget:key},size={characters:'Label',fontSize:12,lineHeight:20};
 const node=()=>({type:'TEXT',metadata:{textSizeOverride:key},values:{characters:'Label',fontSize:12,lineHeight:{unit:'PIXELS',value:20},width:36,height:20,textAutoResize:'WIDTH_AND_HEIGHT',layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',boundVariables:{},fontName:{family:'Inter',style:'Regular'},fontWeight:400}});
 assert(nativeTextSizeOwnsIntrinsicGeometry(spec,node(),node(),size));
 for(const mutate of [
  (s:any,a:any,b:any)=>{s.fixedWidth={px:36,varName:'width'};},
  (s:any,a:any,b:any)=>{s.bindings={height:'bound'};},
  (s:any,a:any,b:any)=>{b.values.boundVariables.width={id:'source-bound'};},
  (s:any,a:any,b:any)=>{a.values.layoutSizingVertical='FILL';},
  (s:any,a:any,b:any)=>{a.values.textAutoResize='HEIGHT';},
  (s:any,a:any,b:any)=>{a.values.width=0;},
 ]){const s=structuredClone(spec),a=node(),b=node();mutate(s,a,b);assert.equal(nativeTextSizeOwnsIntrinsicGeometry(s,a,b,size),false,String(mutate));}
 const a=node(),b=node(),multiline={...size,characters:'A\nB'};a.values.characters=b.values.characters=multiline.characters;
 assert.equal(nativeTextSizeOwnsIntrinsicGeometry(spec,a,b,multiline),false);
});

test('ordinary slot-default scalar values and omission reach independent prepared-library readback',async()=>{
 for(const supplied of [true,false]){
  const {input,receipt}=await fixture(supplied,true);const result=verifyNativePreparedLibraryReadback(input,receipt);
  assert.equal(result.status,'supported-structure-observed',JSON.stringify({supplied,result}));
  const marked=receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.metadata.textSizeOverride);
  assert(marked.length>=2);assert.equal(marked.filter((n:any)=>n.values.fontSize===12).length,supplied?1:0);
  if(supplied){const target=marked.find((n:any)=>n.values.fontSize===12);assert.equal(target.values.lineHeight.value,20);
   const bad=structuredClone(receipt);bad.nodes.find((n:any)=>n.id===target.id).values.fontSize=13;
   assert.equal(verifyNativePreparedLibraryReadback(input,bad).status,'refused');
  }else assert(marked.every((n:any)=>n.values.fontSize===14&&n.values.lineHeight.value===22));
 }
});
