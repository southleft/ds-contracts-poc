import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
const base={version:'0.1.0',status:'draft',description:'Small joint registry/yield fixture',props:[],states:[],semantics:{element:'div'},bindings:{code:{anchors:{importPath:'./Fixture',export:'Fixture'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
type Change='none'|'duplicate'|'retag'|'file';
async function run(change:Change){
 const leaf=ContractSchema.parse({...base,id:'joint.leaf',name:'JointLeaf',anatomy:{root:{layout:{display:'flex'},literals:{width:'4px',height:'4px'}}}});
 const parent=ContractSchema.parse({...base,id:'joint.parent',name:'JointParent',anatomy:{root:{layout:{display:'flex'},literals:{width:'320px',height:'40px'},parts:Object.fromEntries(Array.from({length:40},(_,i)=>['instance'+i,{component:{id:leaf.id}}]))}}});
 const byId=new Map([[leaf.id,leaf],[parent.id,parent]]),host=nativeFixtureHost({instanceVariantSelection:true}),figma=host.figma as any;figma.fileKey='JointFixtureFile';
 const foreign=figma.currentPage,proto=Object.getPrototypeOf(foreign);proto.setExplicitVariableModeForCollection=function(c:any,m:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:m};};
 const created:any[]=[],originals=new Map<string,any>();
 for(const name of ['createPage','createComponent','createFrame','createRectangle']){const fn=figma[name].bind(figma);originals.set(name,fn);figma[name]=(...args:any[])=>{const n=fn(...args);created.push(n);return n;};}
 const instance=proto.createInstance,find=proto.findAllWithCriteria;let queries=0;
 proto.createInstance=function(...args:any[]){const n=instance.apply(this,args);created.push(n);return n;};
 proto.findAllWithCriteria=function(...args:any[]){queries++;return find.apply(this,args);};
 const execute=(s:string,extra:Record<string,unknown>={})=>vm.runInNewContext('(async()=>{'+s+'\n})()',{figma,console,...extra},{timeout:10000});
 try{
  const operation={id:'62000000-0000-4000-8000-000000000040',fileKey:figma.fileKey},source={kind:'prepared-contract-library' as const,revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)};
  const engine=createFigmaEngine({tokens,icons:new Map()}),compiled=engine.compileNativePreparedLibrary(parent,byId,source,operation.id),routed=layeredNativeTokenModes(tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
  const tokenInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[],modes:routed.modes,writeProtocol:'explicit-modes-v1' as const};
  const allocated=await execute(emitNativeTokenContextScript(tokenInput).script),read=await execute(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
  created.length=0;queries=0;let pauses=0;const snapshots:number[]=[];
  const timer=(callback:()=>void,delay:number)=>{assert.equal(delay,0);assert(created.every(n=>n.getSharedPluginData('ds_contracts','nativeSourceAllocation')===n.id),'every returned allocation must be retained before yield');snapshots.push(created.length);return setTimeout(()=>{pauses++;if(pauses===1){
   const target=created.find(n=>n.getSharedPluginData('ds_contracts','contractId')==='source-native:'+operation.id+':joint.leaf');assert(target,'dependency must be complete before the parent yields');
   if(change==='duplicate'){const n=originals.get('createComponent')();foreign.appendChild(n);n.setSharedPluginData('ds_contracts','contractId','source-native:'+operation.id+':joint.leaf');}
   if(change==='retag')target.setSharedPluginData('ds_contracts','contractId','changed');
   if(change==='file')figma.fileKey='ChangedDestination';
  }callback();},0);};
  const creation=JSON.parse(JSON.stringify(await execute(engine.buildNativePreparedLibraryScript(parent,byId,source,{operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:read.receipt}}),{setTimeout:timer})));
  const writerQueries=queries;assert(pauses>=1);assert(snapshots[0]<created.length || change==='file'||change==='retag');
  assert.equal(new Set(creation.nodes.map((n:any)=>n.id)).size,creation.nodes.length,'retained receipt must not duplicate IDs');
  assert.deepEqual(creation.nodes.map((n:any)=>n.id),created.map(n=>n.id));
  if(change==='none'){
   assert.equal(creation.status,'created-candidate',JSON.stringify(creation));assert(writerQueries<20,'40 instances must not cause40 full-file scans');
   const input={operation,planRevision:revisionOf(compiled),component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,projection:compiled.projection,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
   const receipt=await execute(emitNativePreparedLibraryReadbackScript(input));assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed');
  }else {assert.equal(creation.status,'partial-or-unknown-allocation');assert(creation.nodes.length>0);const expected=change==='duplicate'?'prepared-target-collision':change==='retag'?'prepared-target-changed':'file-mismatch';assert(creation.problems.some((s:string)=>s.includes(expected)),JSON.stringify(creation.problems));}
  return {pauses,writerQueries,retained:creation.nodes.length};
 }finally{proto.createInstance=instance;proto.findAllWithCriteria=find;}
}
test('more than32 builds yield while exact registered dependencies and final readback remain valid',async()=>{await run('none');});
test('a foreign duplicate introduced during a yield is refused by the final audit',async()=>{await run('duplicate');});
test('a dependency retagged during a yield refuses the next registry hit',async()=>{await run('retag');});
test('a file change during a yield stops before another allocation',async()=>{await run('file');});
