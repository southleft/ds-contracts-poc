import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {buildReactLibrary,parseLibraryRequest} from './react-library.js';
import {retainPreparedReactLibrary} from './react-library-artifact.js';
import {prepareReactLibraryNativePlan,buildReactLibraryNativeWrite} from './react-library-native.js';
import {nativeFixtureHost} from '../../source-reference/native-operation-test-fixture.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from '../../core/token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from '../../core/native-source-observation.js';

test('a retained installed-library archive reopens for native preparation and writes only its pinned plan',async()=>{
  const work=mkdtempSync(path.join(tmpdir(),'retained-library-native-'));
  try {
    const contract={id:'test.library',name:'Library',version:'0.1.0',status:'draft',description:'Host integration fixture',
      props:[],states:[],semantics:{element:'div'},anatomy:{root:{layout:{display:'flex'},parts:{
        label:{text:'Retained library',declared:{'font-family':'Inter'},tokens:{color:'{label}'}}}}},
      bindings:{code:{anchors:{importPath:'test/Library',export:'Library'}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:'retained-original'}}}};
    const input=parseLibraryRequest({rootId:contract.id,contracts:[contract],icons:[],tokens:{
      primitives:{ink:{$type:'color',$value:'#123456'},unused:{$value:'28px'},twin:{$type:'color',$value:'#123456'}},
      semantic:{label:{$type:'color',$value:'{ink}'},unusedCycle:{$type:'dimension',$value:'{unusedCycle}'}},light:{},dark:{},brands:{default:{}}}});
    const output=await buildReactLibrary(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),input);
    const saved=retainPreparedReactLibrary(work,input,output),dir=path.join(work,'private/react-library-artifacts',saved.id);
    const original=readFileSync(path.join(dir,'input.json'));
    const request={artifactId:saved.id,mode:'light' as const,brand:'default',operation:{id:'70000000-0000-4000-8000-000000000001',fileKey:'RetainedLibraryFixture'}};
    const prepared=prepareReactLibraryNativePlan(work,request),{plan}=prepared;
    assert.equal(plan.projection.source.kind,'prepared-contract-library');
    assert.equal(plan.projection.source.tarballSha256,output.tarballSha256);
    assert.equal('programSha256' in plan.projection.source,false);
    assert.deepEqual(plan.tokenInput.tokenPaths,['label']);
    assert.deepEqual(plan.tokenPreparation.variables.map(v=>v.tokenPath),['ink','label'],
      'only graph bindings and exact alias dependencies allocate; equal-valued peers and unused tokens remain in retained source');
    assert.deepEqual(prepareReactLibraryNativePlan(work,request),prepared,'reopening produces the identical plan');
    assert.ok(readFileSync(path.join(dir,'input.json')).equals(original));
    const host=nativeFixtureHost();host.figma.fileKey=request.operation.fileKey;
    Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
    const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console})));
    const born=await run(emitNativeTokenContextScript(plan.tokenInput).script);
    const read=await run(emitNativeTokenContextReadbackScript(plan.tokenInput,born.creationIdentity));
    const tokens={input:plan.tokenInput,identity:born.creationIdentity,receipt:read.receipt};
    const write=buildReactLibraryNativeWrite(work,request,prepared.revision,tokens),creation=await run(write.script);
    assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
    const observation={operation:plan.operation,planRevision:prepared.revision,projection:plan.projection,
      component:plan.component,graphComponents:plan.graphComponents,graphVerification:plan.graphVerification,
      tokenInput:plan.tokenInput,tokenIdentity:born.creationIdentity,creation};
    const receipt=await run(emitNativePreparedLibraryReadbackScript(observation));
    assert.equal(verifyNativePreparedLibraryReadback(observation,receipt).status,'supported-structure-observed');
    assert.throws(()=>buildReactLibraryNativeWrite(work,request,'sha256:'+'0'.repeat(64),tokens),/plan-stale/);
    assert.throws(()=>buildReactLibraryNativeWrite(work,{...request,mode:'dark'},prepared.revision,tokens),/plan-stale/);
    writeFileSync(path.join(dir,'input.json'),Buffer.concat([original,Buffer.from('\n')]));
    assert.throws(()=>buildReactLibraryNativeWrite(work,request,prepared.revision,tokens),/input-changed/);
    assert.throws(()=>prepareReactLibraryNativePlan(work,request),/input-changed/);
    assert.ok(readFileSync(path.join(dir,'input.json')).equals(Buffer.concat([original,Buffer.from('\n')])),'reopen never repairs changed evidence');
  } finally {rmSync(work,{recursive:true,force:true});}
});

test('literal-only libraries retain an empty owned token scope and used untyped bindings still refuse',async()=>{
  const work=mkdtempSync(path.join(tmpdir(),'retained-library-token-scope-'));
  try {
    const contract={id:'test.literal',name:'Literal',version:'0.1.0',status:'draft',description:'No token binding fixture',
      props:[],states:[],semantics:{element:'div'},anatomy:{root:{layout:{display:'flex'},parts:{
        label:{text:'Literal',declared:{'font-family':'Inter'},literals:{color:'#123456'}}}}},
      bindings:{code:{anchors:{importPath:'test/Literal',export:'Literal'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
    const input=parseLibraryRequest({rootId:contract.id,contracts:[contract],icons:[],tokens:{
      primitives:{unused:{$value:'28px'}},semantic:{},light:{},dark:{},brands:{default:{}}}});
    const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    const saved=retainPreparedReactLibrary(work,input,await buildReactLibrary(repo,input));
    const request={artifactId:saved.id,mode:'light' as const,brand:'default',operation:{id:'70000000-0000-4000-8000-000000000002',fileKey:'RetainedLibraryFixture'}};
    const {plan,revision}=prepareReactLibraryNativePlan(work,request);
    assert.deepEqual(plan.tokenInput.tokenPaths,[]);assert.deepEqual(plan.tokenPreparation.variables,[]);
    const host=nativeFixtureHost();host.figma.fileKey=request.operation.fileKey;
    Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
    const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console})));
    const born=await run(emitNativeTokenContextScript(plan.tokenInput).script);
    assert.equal(born.status,'created-candidate');assert.deepEqual(born.creationIdentity.variables,[]);
    const read=await run(emitNativeTokenContextReadbackScript(plan.tokenInput,born.creationIdentity));
    const tokens={input:plan.tokenInput,identity:born.creationIdentity,receipt:read.receipt};
    const creation=await run(buildReactLibraryNativeWrite(work,request,revision,tokens).script);
    assert.equal(creation.status,'created-candidate',JSON.stringify(creation.problems));
    const observation={operation:plan.operation,planRevision:revision,projection:plan.projection,component:plan.component,
      graphComponents:plan.graphComponents,graphVerification:plan.graphVerification,tokenInput:plan.tokenInput,tokenIdentity:born.creationIdentity,creation};
    assert.equal(verifyNativePreparedLibraryReadback(observation,await run(emitNativePreparedLibraryReadbackScript(observation))).status,'supported-structure-observed');
    const repeated=await run(emitNativeTokenContextScript(plan.tokenInput).script);
    assert.equal(repeated.status,'refused','even an empty owned collection cannot be allocated twice');
    const changed=structuredClone(contract);
    delete (changed.anatomy.root.parts.label as any).literals;
    (changed.anatomy.root.parts.label as any).tokens={color:'{untyped}'};
    const invalid=parseLibraryRequest({rootId:changed.id,contracts:[changed],icons:input.icons,
      tokens:{...input.tokens,primitives:{untyped:{$value:'#123456'}}}});
    const bad=retainPreparedReactLibrary(work,invalid,await buildReactLibrary(repo,invalid));
    assert.throws(()=>prepareReactLibraryNativePlan(work,{...request,artifactId:bad.id}),/token-type-missing/);
  } finally {rmSync(work,{recursive:true,force:true});}
});
