import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReactLibrary,parseLibraryRequest} from '../playground/server/react-library.js';
import {retainPreparedReactLibrary} from '../playground/server/react-library-artifact.js';
import {createReactLibraryNativePlanPreparer,prepareReactLibraryNativePlan,type PreparedLibraryNativeRequest} from '../playground/server/react-library-native.js';
import {preparedLibraryNativeAdapter} from './prepared-library-native.js';

async function fixture(t:test.TestContext){
 const store=mkdtempSync(path.join(tmpdir(),'native-plan-cache-'));
 t.after(()=>rmSync(store,{recursive:true,force:true}));
 const contract={id:'test.plan-cache',name:'PlanCache',version:'0.1.0',status:'draft',description:'Verified plan cache fixture',
  props:[],states:[],semantics:{element:'div'},anatomy:{root:{layout:{display:'flex'},parts:{
   label:{text:'Pinned label',declared:{'font-family':'Inter'},tokens:{color:'{label}'}}}}},
  bindings:{code:{anchors:{importPath:'test/PlanCache',export:'PlanCache'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
 const input=parseLibraryRequest({rootId:contract.id,contracts:[contract],icons:[],tokens:{
  primitives:{ink:{$type:'color',$value:'#123456'}},semantic:{label:{$type:'color',$value:'{ink}'}},
  light:{},dark:{label:{$type:'color',$value:'#abcdef'}},brands:{default:{},other:{}}}});
 const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const output=await buildReactLibrary(repo,input),saved=retainPreparedReactLibrary(store,input,output);
 const request:PreparedLibraryNativeRequest={artifactId:saved.id,mode:'light',brand:'default',
  operation:{id:'80000000-0000-4000-8000-000000000001',fileKey:'NativePlanCacheFixture'}};
 return {store,request,artifact:path.join(store,'private/react-library-artifacts',saved.id)};
}

test('repeated verified preparation equals uncached output and cannot share mutable plan objects',async t=>{
 const f=await fixture(t),prepare=createReactLibraryNativePlanPreparer(f.store);
 const expected=prepareReactLibraryNativePlan(f.store,f.request),first=prepare(f.request),second=prepare(f.request);
 assert.deepEqual(first,expected);assert.deepEqual(second,expected);
 assert.notStrictEqual(first,second);assert.notStrictEqual(first.plan,second.plan);
 first.plan.component.variants[0].spec.name='caller mutation';
 first.plan.tokenPreparation.variables.length=0;
 second.plan.graphComponents.length=0;
 assert.deepEqual(prepare(f.request),expected,'cached value must remain private and isolated');
});

test('every cache hit reopens all receipt, input and archive bytes; failures never survive restoration',async t=>{
 const f=await fixture(t),prepare=createReactLibraryNativePlanPreparer(f.store),expected=prepare(f.request);
 for(const [name,pattern] of [['receipt.json',/receipt-changed/],['input.json',/input-changed/],['library.tgz',/archive-changed/]] as const){
  const file=path.join(f.artifact,name),original=readFileSync(file);
  writeFileSync(file,Buffer.concat([original,Buffer.from(' ')]));
  try{assert.throws(()=>prepare(f.request),pattern);assert.throws(()=>prepare(f.request),pattern);}
  finally{writeFileSync(file,original);}
  assert.deepEqual(prepare(f.request),expected);
 }
});

test('operation, file, mode, brand and adapter lifetime never share an unqualified plan',async t=>{
 const f=await fixture(t),prepare=createReactLibraryNativePlanPreparer(f.store);
 for(const request of [f.request,{...f.request,operation:{...f.request.operation,id:'80000000-0000-4000-8000-000000000002'}},
  {...f.request,operation:{...f.request.operation,fileKey:'AnotherPlanCacheFile'}},
  {...f.request,mode:'dark' as const},{...f.request,brand:'other'}]){
  assert.deepEqual(prepare(request),prepareReactLibraryNativePlan(f.store,request));
 }
 const {operation,...fields}=f.request,request={version:1 as const,kind:'prepared-library-native' as const,...fields};
 const a=preparedLibraryNativeAdapter(f.store),b=preparedLibraryNativeAdapter(f.store);
 const first=a.prepare(request,operation),expected=b.prepare(request,operation);
 first.plan.plan.component.variants[0].spec.name='adapter caller mutation';
 assert.deepEqual(a.prepare(request,operation),expected);
 assert.deepEqual(b.prepare(request,operation),expected);
});
