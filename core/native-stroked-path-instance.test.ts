import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback,type NativePreparedLibraryObservationInput} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';

async function fixture(){
 const host=nativeFixtureHost({instanceVariantSelection:true,consumerVariableModes:true});host.figma.fileKey='CenterStrokeFixture';
 const prototype=Object.getPrototypeOf(host.figma.currentPage);
 prototype.setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
 Object.defineProperty(prototype,'relativeTransform',{get(){return [[1,0,this.x],[0,1,this.y]];}});
 const reflect=(n:any)=>{let explicit=n.boundVariables??{};Object.defineProperty(n,'boundVariables',{configurable:true,
  get(){const strokes=(n.strokes??[]).flatMap((p:any)=>p.boundVariables?.color?[p.boundVariables.color]:[]);if(strokes.length)explicit.strokes=strokes;else delete explicit.strokes;return explicit;},set(v){explicit=v;}});};
 const clone=prototype._cloneForInstance;
 prototype._cloneForInstance=function(){const n=clone.call(this);for(const k of ['vectorPaths','isMask','blendMode','constraints','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','strokeAlign'])if(this[k]!==undefined)n[k]=structuredClone(this[k]);if(n.type==='VECTOR')reflect(n);return n;};
 // Synthetic API model for one fixed centerline, not a visual reference.
 host.figma.createVector=()=>{const n=host.figma.createRectangle();n.type='VECTOR';n.isMask=false;n.blendMode='PASS_THROUGH';reflect(n);
  let paths:any;Object.defineProperty(n,'vectorPaths',{get:()=>paths,set(v){assert.equal(v[0].data,'M 0 0 L 4 8 L 12 0');paths=structuredClone(v);n.resize(12,8);}});return n;};
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'\n})()',{figma:host.figma,console},{timeout:5000})));
 const base=(name:string)=>ContractSchema.parse({id:'test.'+name.toLowerCase(),name,version:'1.0.0',status:'draft',description:'Synthetic observer fixture',props:[],states:[],semantics:{element:'span'},anatomy:{root:{}},bindings:{figma:{anchors:{fileKey:'source',componentSetKey:name+'-key'}},code:{anchors:{importPath:'./'+name,export:name}}}});
 const child=base('Stroke'),parent=base('Holder');
 child.anatomy.root={declared:{position:'relative'},tokens:{width:'{size}',height:'{size}',color:'{ink}','stroke-width':'{width}'},overridable:['color','stroke-width'],parts:{path:{declared:{position:'absolute'},literals:{'border-color':'currentColor','border-width':'inherit'},shape:{kind:'stroked-path',width:12,height:8,strokePath:{data:'M0 0L4 8L12 0',cap:'ROUND',join:'ROUND',miterLimit:4,viewport:{width:24,height:24,x:2,y:4}}}}}};
 const callers:Record<string,Record<string,string>>={both:{color:'{callerInk}','stroke-width':'{callerWidth}'},color:{color:'{callerInk}'},weight:{'stroke-width':'{callerWidth}'},omitted:{}};
 parent.anatomy.root={layout:{display:'flex',direction:'row'},parts:Object.fromEntries(Object.entries(callers).map(([name,overrides])=>[name,{component:{id:child.id,overrides}}]))};
 const tokens={primitives:{size:{$type:'dimension',$value:'24px'},ink:{$type:'color',$value:'#123456'},width:{$type:'dimension',$value:'1.5px'},baseInk:{$type:'color',$value:'#336699'},baseWidth:{$type:'dimension',$value:'2.5px'},peerInk:{$type:'color',$value:'#336699'},peerWidth:{$type:'dimension',$value:'2.5px'}},semantic:{callerInk:{$type:'color',$value:'{baseInk}'},callerWidth:{$type:'dimension',$value:'{baseWidth}'}},light:{},dark:{},brands:{default:{}}};
 const byId=new Map([child,parent].map(c=>[c.id,c])),engine=createFigmaEngine({tokens,icons:new Map()});
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)};
 const operation={id:'60000000-0000-4000-8000-000000000019',fileKey:host.figma.fileKey},compiled=engine.compileNativePreparedLibrary(parent,byId,source,operation.id);
 const routed=layeredNativeTokenModes(tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate');
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await run(engine.buildNativePreparedLibraryScript(parent,byId,source,context));assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input:NativePreparedLibraryObservationInput={operation,planRevision:revisionOf(compiled),component:compiled.component,graphComponents:compiled.components,graphVerification:2,projection:compiled.projection,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await run(emitNativePreparedLibraryReadbackScript(input));
 const variable=(name:string)=>observed.receipt.variables.find((v:any)=>v.name===name).id;
 return {receipt,input,variable,verify:(r=receipt)=>verifyNativePreparedLibraryReadback(input,r)};
}

test('declared centerline color-only, width-only and combined overrides preserve the omitted main defaults',async()=>{
 const f=await fixture(),out=f.verify();assert.equal(out.status,'supported-structure-observed',JSON.stringify(out));
 const vectors=f.receipt.nodes.filter((n:any)=>n.type==='VECTOR');assert.equal(vectors.length,5);
 assert.equal(vectors.filter((n:any)=>n.values.strokeWeight===1.5).length,3);
 assert.equal(vectors.filter((n:any)=>n.values.strokeWeight===2.5).length,2);
 assert.equal(vectors.filter((n:any)=>n.values.strokes[0].boundVariables.color.id===f.variable('callerInk')).length,2);
 const target=vectors.find((n:any)=>n.values.strokeWeight===2.5&&n.values.strokes[0].boundVariables.color.id===f.variable('callerInk'));
 for(const [label,change]of [
  ['equal-valued color identity',(n:any)=>{n.values.strokes[0].boundVariables.color.id=f.variable('peerInk');n.values.boundVariables.strokes[0].id=f.variable('peerInk');}],
  ['equal-valued weight identity',(n:any)=>n.values.boundVariables.strokeWeight.id=f.variable('peerWidth')],
  ['paint alias missing',(n:any)=>delete n.values.strokes[0].boundVariables],
  ['aggregate alias missing',(n:any)=>delete n.values.boundVariables.strokes],
  ['weight alias missing',(n:any)=>delete n.values.boundVariables.strokeWeight],
  ['color value',(n:any)=>n.values.strokes[0].color.r=.5],['weight value',(n:any)=>n.values.strokeWeight=2],
  ['extra binding',(n:any)=>n.values.boundVariables.opacity={type:'VARIABLE_ALIAS',id:f.variable('callerWidth')}],
  ...['explicitVariableModes','resolvedVariableModes'].map(field=>[field,(n:any)=>{const key=Object.keys(n.values.resolvedVariableModes)[0];n.values[field]={[key]:'foreign-mode'};}] as const),
  ['cap',(n:any)=>n.values.strokeCap='SQUARE'],['join',(n:any)=>n.values.strokeJoin='BEVEL'],
  ['alignment',(n:any)=>n.values.strokeAlign='OUTSIDE'],['dash',(n:any)=>n.values.dashPattern=[2,2]],
  ['constraints',(n:any)=>n.values.constraints.vertical='MIN'],['position',(n:any)=>n.values.x+=1],
  ['interior vertex',(n:any)=>n.values.vectorPaths[0].data='M 0 0 L 6 8 L 12 0'],
  ['topology',(n:any)=>n.values.vectorPaths[0].data+=' Z'],
 ] as const){const r=structuredClone(f.receipt);change(r.nodes.find((n:any)=>n.id===target.id));assert.equal(f.verify(r).status,'refused',label);}
 const omitted=vectors.find((n:any)=>n.values.strokeWeight===1.5&&n.values.strokes[0].boundVariables.color.id===f.variable('ink')&&f.receipt.nodes.some((p:any)=>p.id===n.parentId&&p.type==='INSTANCE'));
 assert(omitted);const r=structuredClone(f.receipt);r.nodes.find((n:any)=>n.id===omitted.id).values.strokes=structuredClone(target.values.strokes);assert.equal(f.verify(r).status,'refused','undeclared sibling override');
 const visit=(s:any,change:(s:any)=>void)=>{change(s);s.children?.forEach((n:any)=>visit(n,change));};
 for(const [label,change]of [
  ['stale declared weight',(s:any)=>{if(s.instanceStrokeWeight)s.instanceStrokeWeight.px+=1;}],
  ['wrong attachment protocol',(s:any)=>{if(s.instanceInk)s.instanceInk.writeProtocol='unattached';}],
 ] as const){const input=structuredClone(f.input);for(const c of input.graphComponents!)for(const v of c.variants)visit(v.spec,change);
  input.component=input.graphComponents!.at(-1)!;const result=verifyNativePreparedLibraryReadback(input,f.receipt);
  assert.equal(result.status,'refused',label);assert(result.problems.some(p=>p.startsWith('native-stroked-path-observation-caller-paint')),JSON.stringify(result));}
});
