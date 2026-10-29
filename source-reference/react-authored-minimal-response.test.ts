import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {buildReactReference,createReactReferenceService} from './react-reference.js';
import {readReactSourceProgram} from './react-source-program.js';
import {inventoryEvidence} from './react-validation-evidence.js';
import {beginReactOwnershipSelection,sealReactOwnershipSelection} from './react-ownership-selection.js';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
test('minimal authored preparation returns one authenticated row without the unrelated61-case listing',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'authored-selected-source-')),repo=mkdtempSync(path.join(tmpdir(),'authored-selected-store-'));
 t.after(()=>{rmSync(root,{recursive:true,force:true});rmSync(repo,{recursive:true,force:true});});
 const put=(name:string,text:string)=>{mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),text);};
 const source="import React from 'react'; export function Surface(){ return React.createElement('span', null, 'Surface'); }";
 put('package.json','{"type":"module"}');put('package-lock.json','{}');put('tsconfig.json','{}');put('surface.tsx',source);put('styles.css',':root{--original:red}');
 mkdirSync(path.join(root,'node_modules'));
 for(const name of ['react','react-dom','scheduler'])symlinkSync(path.resolve('node_modules',name),path.join(root,'node_modules',name),'dir');
 const ids=Array.from({length:61},(_,i)=>'case-'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26));
 put('ds-contracts.react.json',JSON.stringify({version:1,source:'61-case route fixture',theme:'light',fontFamily:'Inter',sideEffectImports:['./styles.css'],requiredTokens:{'--original':'red'},witnessFiles:{'surface.tsx':hash(source)},cases:ids.map((id,i)=>({id,subject:'Surface',label:id,negativeControl:i===0,mount:{module:'./surface.tsx',export:'Surface'},witness:{path:['#root'],requiredStyles:{display:'block'}}}))}));
 const ref=await buildReactReference(root);assert.equal(ref.cohort.cases.length,61);
 const owner='10000000-0000-4000-8000-000000000009',id='10000000-0000-4000-8000-000000000008';
 const report:any={id:owner,referenceId:ref.id,state:'complete',acceptedContract:null,denominator:61,matched:1,sourceUnchanged:true,rows:ids.map((caseId,i)=>({id:caseId,matched:i===0,problems:i===0?[]:['react-ownership-case-not-observed'],...(i===0?{authoredTrees:[{helper:0,draft:{status:'native-compiled'}}]}:{})}))};
 const dir=path.join(repo,'private/react-source-ownership',ref.id,owner);mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'program.json'),JSON.stringify(readReactSourceProgram(root,['surface.tsx'])));writeFileSync(path.join(dir,'report.json'),JSON.stringify(report));writeFileSync(path.join(dir,'integrity.json'),JSON.stringify({version:1,files:inventoryEvidence(dir)}));beginReactOwnershipSelection(repo,ref.id,owner);sealReactOwnershipSelection(repo,ref,report);
 const row={kind:'authored',caseId:ids[0],ownershipId:owner,fileKey:'file',operation:{id,phase:'prepared',sourceCurrent:true,problems:[],acceptedContract:null,nativeQualification:'unqualified'}};
 const publicRow={...row,recordedMeasurement:false,updates:[],connection:{finished:false}};
 const calls:string[]=[];let failure='',ambiguous=false,preparedRequest:any;
 const handle=createReactReferenceService(repo,root,()=>({jobs:{
  withReadSnapshot:(fn:()=>unknown)=>fn(),
  prepare:(request:any)=>{calls.push('prepare');if(failure)throw Error(failure);assert.equal(request.caseId,ids[0]);assert.equal(request.ownership.id,owner);if(preparedRequest)assert.deepEqual(request,preparedRequest);preparedRequest=request;return row.operation;},
  listReact:(referenceId:string,kind?:string,query?:unknown,inspection?:unknown)=>{assert.equal(referenceId,ref.id);if(inspection){assert.equal(kind,undefined);assert.equal(query,undefined);assert.deepEqual(inspection,{operationId:id});calls.push('selected');return ambiguous?[row,row]:[row];}if(kind){calls.push('cohort-inspection');return [];}calls.push('full');return [row];},
  listReactMoved:()=>{calls.push('moved');return [];},
  reactEffectiveAuthoredRequest:()=>{calls.push('selected-source-identity');return preparedRequest;},
 },transport:{status:()=>({finished:false})},updates:{list:()=>[]}} as any));t.after(()=>handle.close());
 const call=async(route:string,prefer?:string,body?:string)=>{const req=Readable.from(body===undefined?[]:[body]);Object.assign(req,{method:'POST',url:'/'+route,headers:{host:'localhost:5181',...(prefer?{prefer}:{}),...(body===undefined?{}:{'content-length':String(Buffer.byteLength(body))})}});let status=0,text='';const headers:Record<string,unknown>={};await handle(req as any,{set statusCode(v:number){status=v;},setHeader(k:string,v:unknown){headers[k.toLowerCase()]=v;},end(v:string){text=v;}} as any,route);return {status,headers,value:JSON.parse(text)};};
 assert.equal((await call('react')).status,200);calls.length=0;
 const route=`react/${ref.id}/native-authored/${ids[0]}`;
 for(let attempt=0;attempt<2;attempt++){
  const minimal=await call(route,'return=minimal');assert.equal(minimal.status,200);assert.equal(minimal.headers['preference-applied'],'return=minimal');assert.equal(minimal.headers['cache-control'],'no-store');assert.deepEqual(minimal.value.operations,[publicRow]);assert.deepEqual(calls,['prepare','selected','selected-source-identity']);calls.length=0;
 }
 const full=await call(route);assert.equal(full.status,200);assert.equal(full.headers['preference-applied'],undefined);assert.deepEqual(full.value.operations,[publicRow]);assert(calls.includes('moved')&&calls.includes('full'));assert(calls.filter(x=>x==='cohort-inspection').length>=61);calls.length=0;
 failure='native-operation-source-plan-stale';const refused=await call(route,'return=minimal');assert.equal(refused.status,409);assert.equal(refused.value.reason,failure);assert.equal(refused.headers['preference-applied'],undefined);assert.deepEqual(calls,['prepare']);calls.length=0;failure='';
 ambiguous=true;assert.equal((await call(route,'return=minimal')).value.reason,'react-native-inspection-ambiguous');assert.deepEqual(calls,['prepare','selected']);calls.length=0;ambiguous=false;
 assert.equal((await call(route,'return=minimal','{}')).status,409);assert.deepEqual(calls,[]);
 assert.equal((await call(route.replace(ref.id,'f'.repeat(64)),'return=minimal')).status,409);assert.deepEqual(calls,[]);
 put('surface.tsx',source+'\n// changed source');assert.equal((await call(route,'return=minimal')).status,409);assert.deepEqual(calls,[],'source change refuses before native preparation');
});
