import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync,renameSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {revisionOf} from '../core/contract-provenance.js';
import {builtinReactCohort} from './react-cohort.js';
import {evidenceSha,inventoryEvidence} from './react-validation-evidence.js';
import {cropSourceFrame} from './source-framing.js';
import {authoredSourceReviewReason,createReactAuthoredSourceReviews} from './react-authored-source-review.js';
import type {ReactReference} from './react-reference.js';
import type {ReactAuthoredNativeRequest} from './react-authored-native-request.js';

function fixture(t:test.TestContext) {
 const repo=mkdtempSync(path.join(tmpdir(),'authored-source-review-'));t.after(()=>rmSync(repo,{recursive:true,force:true}));
 const file=path.join(repo,'source.tsx');writeFileSync(file,'export const Original=()=>null;');
 const reference:ReactReference={id:'a'.repeat(64),sourceRoot:repo,files:{[file]:evidenceSha(readFileSync(file))},javascript:'',css:'',cohort:builtinReactCohort};
 const request:ReactAuthoredNativeRequest={version:1,kind:'react-authored-draft',referenceId:reference.id,caseId:'original',helper:0,
  ownership:{id:'10000000-0000-4000-8000-000000000001',sha256:'b'.repeat(64)},inventorySha256:'c'.repeat(64),draftRevision:'sha256:'+'d'.repeat(64)};
 const page=new PNG({width:48,height:40}),transparent=new PNG({width:48,height:40});
 page.data.fill(255);
 for(let y=14;y<22;y++)for(let x=16;x<28;x++)for(const image of [page,transparent]){
  const i=(y*image.width+x)*4;image.data[i]=255;image.data[i+1]=0;image.data[i+2]=0;image.data[i+3]=255;
 }
 const original=PNG.sync.write(page),alpha=PNG.sync.write(transparent),bounds={x:16,y:14,width:12,height:8},derived=cropSourceFrame(alpha,bounds);
 const result={original,withContext:alpha,transparent:alpha,bytes:derived.bytes,receipt:{version:2 as const,kind:'transparent-source-frame' as const,
  originalSha256:evidenceSha(original),contextSha256:evidenceSha(alpha),transparentSha256:evidenceSha(alpha),imageSha256:evidenceSha(derived.bytes),
  bounds,crop:derived.crop,sourceSize:derived.sourceSize,rootOffset:{x:8,y:8},component:{} as any,qualification:'unqualified' as const}};
 const input={reference,request,captured:{treeSha256:'e'.repeat(64),sourcePngSha256:evidenceSha(original)},source:original};
 let captures=0,loads=0,refusal='';
 const load=(ref:string,id:string)=>{loads++;assert.equal(ref,reference.id);assert.equal(id,'operation');if(refusal)throw Error(refusal);return input;};
 const capture=async()=>{captures++;return result;};
 const store=()=>createReactAuthoredSourceReviews(repo,load,capture);
 const dir=()=>path.join(repo,'private/react-authored-source-reviews',readdirSync(path.join(repo,'private/react-authored-source-reviews'))[0]);
 return {repo,file,reference,request,input,result,load,capture,store,dir,captures:()=>captures,loads:()=>loads,setRefusal:(s:string)=>{refusal=s;}};
}

test('authored source review requires fresh capture after restart and pins subsequent reads in memory',async t=>{
 const f=fixture(t),store=f.store();assert.equal(await store.read(f.reference.id,'operation'),null);
 const review=await store.create(f.reference.id,'operation');assert.equal(f.captures(),1);
 assert.equal(review.qualification,'unqualified');assert.equal(review.frame.qualification,'unqualified');
 assert.equal(review.requestRevision,revisionOf(f.request));assert.equal(review.sourceImageSha256,evidenceSha(f.result.original));
 assert.equal(review.treeSha256,f.input.captured.treeSha256);assert.equal(review.frame.imageSha256,evidenceSha(f.result.bytes));
 assert.deepEqual(Buffer.from(review.image.split(',')[1],'base64'),f.result.bytes);
 assert.notDeepEqual(f.result.bytes,cropSourceFrame(f.result.original,f.result.receipt.bounds).bytes,'the strict alpha image is not an opaque original crop');
 let freshCaptures=0;
 const recovered=createReactAuthoredSourceReviews(f.repo,f.load,async()=>{freshCaptures++;return f.result;});
 assert.deepEqual(await recovered.read(f.reference.id,'operation'),review);assert.equal(freshCaptures,1,'disk cannot attest to itself');
 assert.deepEqual(await recovered.create(f.reference.id,'operation'),review);assert.deepEqual(await recovered.read(f.reference.id,'operation'),review);
 assert.equal(freshCaptures,1,'a capture-derived in-memory digest supports later reads');
 assert.deepEqual(store.identity(f.reference.id,'operation'),{requestRevision:review.requestRevision,sourceImageSha256:review.sourceImageSha256,treeSha256:review.treeSha256,frameInputSha256:review.frame.inputSha256});
 assert.deepEqual(readdirSync(f.dir()).sort(),['context.png','integrity.json','original.png','receipt.json','source.png','transparent.png']);
 const stored=JSON.parse(readFileSync(path.join(f.dir(),'receipt.json'),'utf8'));
 assert.deepEqual(stored.receipt,f.result.receipt);assert.equal(stored.pin.request.version,1);
});

test('changed, missing and symlinked strict artifacts refuse rather than recapture or silently accept',async t=>{
 const f=fixture(t),store=f.store();await store.create(f.reference.id,'operation');
 for(const name of ['original.png','context.png','transparent.png','source.png','receipt.json','integrity.json']){
  const p=path.join(f.dir(),name),bytes=readFileSync(p);writeFileSync(p,Buffer.concat([bytes,Buffer.from('changed')]));
  await assert.rejects(store.read(f.reference.id,'operation'),/./,name);await assert.rejects(store.create(f.reference.id,'operation'));writeFileSync(p,bytes);
 }
 const p=path.join(f.dir(),'source.png'),bytes=readFileSync(p);rmSync(p);await assert.rejects(store.read(f.reference.id,'operation'));writeFileSync(p,bytes);
 const outside=path.join(f.repo,'same-pixels.png');writeFileSync(outside,bytes);rmSync(p);symlinkSync(outside,p);
 await assert.rejects(store.read(f.reference.id,'operation'));rmSync(p);writeFileSync(p,bytes);
 const extra=path.join(f.dir(),'unexpected.txt');writeFileSync(extra,'not part of the retained review');
 await assert.rejects(store.read(f.reference.id,'operation'),/record-invalid/);rmSync(extra);
 const dir=f.dir(),moved=path.join(f.repo,'moved');renameSync(dir,moved);symlinkSync(moved,dir,'dir');
 await assert.rejects(store.read(f.reference.id,'operation'),/directory-invalid/);assert.equal(f.captures(),1);
});

test('source, request and authenticated-loader changes cannot reuse an earlier review',async t=>{
 const f=fixture(t),store=f.store();await store.create(f.reference.id,'operation');
 const bytes=readFileSync(f.file);writeFileSync(f.file,Buffer.concat([bytes,Buffer.from('\nchanged')]));
 await assert.rejects(store.read(f.reference.id,'operation'),/input-changed/);writeFileSync(f.file,bytes);
 const old=f.request.draftRevision;f.request.draftRevision='sha256:'+'f'.repeat(64);
 assert.equal(await store.read(f.reference.id,'operation'),null,'a different request does not inherit a previous frame');f.request.draftRevision=old;
 f.setRefusal('react-authored-native-evidence-unavailable');assert.throws(()=>store.identity(f.reference.id,'operation'),/unavailable/);
 await assert.rejects(store.create(f.reference.id,'operation'),/unavailable/);assert.equal(f.captures(),1);
});

test('capture deduplicates one input, refuses concurrent different input and rejects changes before persistence',async t=>{
 const f=fixture(t);let resolve!:(v:typeof f.result)=>void,calls=0;
 const blocked=new Promise<typeof f.result>(r=>{resolve=r;});
 const store=createReactAuthoredSourceReviews(f.repo,f.load,async()=>{calls++;return blocked;});
 const one=store.create(f.reference.id,'operation'),two=store.create(f.reference.id,'operation');
 const old=f.request.draftRevision;f.request.draftRevision='sha256:'+'f'.repeat(64);
 await assert.rejects(store.create(f.reference.id,'operation'),/busy/);f.request.draftRevision=old;
 resolve(f.result);assert.deepEqual(await one,await two);assert.equal(calls,1);
 const fresh=fixture(t);let release!:(v:typeof fresh.result)=>void;
 const pending=createReactAuthoredSourceReviews(fresh.repo,fresh.load,()=>new Promise(r=>{release=r;}));
 const attempt=pending.create(fresh.reference.id,'operation');fresh.request.draftRevision='sha256:'+'f'.repeat(64);release(fresh.result);
 await assert.rejects(attempt,/input-changed/);assert.equal(await pending.read(fresh.reference.id,'operation'),null);
});

test('malformed capture bytes or promoted qualification cannot be stored',async t=>{
 for(const bad of ['original','bytes','qualification']as const){
  const f=fixture(t),result={...f.result,receipt:{...f.result.receipt}};
  if(bad==='qualification')(result.receipt as any).qualification='qualified';else result[bad]=Buffer.from('wrong');
  const store=createReactAuthoredSourceReviews(f.repo,f.load,async()=>result);
  await assert.rejects(store.create(f.reference.id,'operation'),/capture-changed/);assert.equal(await store.read(f.reference.id,'operation'),null);
 }
});

test('strict external-contribution refusal reaches the caller without a fallback or saved review',async t=>{
 const f=fixture(t);let attempts=0;
 const store=createReactAuthoredSourceReviews(f.repo,f.load,async()=>{attempts++;throw Error('transparent-source-frame-external-contribution');});
 await assert.rejects(store.create(f.reference.id,'operation'),/^Error: transparent-source-frame-external-contribution$/);
 assert.equal(await store.read(f.reference.id,'operation'),null);assert.equal(attempts,1);
 const retained=fixture(t);await retained.store().create(retained.reference.id,'operation');
 const restarted=createReactAuthoredSourceReviews(retained.repo,retained.load,async()=>{throw Error('transparent-source-frame-external-contribution');});
 await assert.rejects(restarted.read(retained.reference.id,'operation'),/^Error: transparent-source-frame-external-contribution$/,
  'a saved cache cannot bypass a fresh strict refusal after restart');
});

test('coherent pixel receipt and integrity replacement fails both live and restarted recovery',async t=>{
 const f=fixture(t),store=f.store(),before=await store.create(f.reference.id,'operation'),dir=f.dir();
 const image=PNG.sync.read(f.result.transparent);
 for(let y=14;y<22;y++)for(let x=16;x<28;x++){const i=(y*48+x)*4;image.data[i]=0;image.data[i+1]=255;}
 const changed=PNG.sync.write(image),crop=cropSourceFrame(changed,f.result.receipt.bounds);
 writeFileSync(path.join(dir,'transparent.png'),changed);writeFileSync(path.join(dir,'context.png'),changed);writeFileSync(path.join(dir,'source.png'),crop.bytes);
 const record=JSON.parse(readFileSync(path.join(dir,'receipt.json'),'utf8'));
 record.receipt.contextSha256=evidenceSha(changed);record.receipt.transparentSha256=evidenceSha(changed);
 record.receipt.imageSha256=evidenceSha(crop.bytes);record.frame.imageSha256=evidenceSha(crop.bytes);
 writeFileSync(path.join(dir,'receipt.json'),JSON.stringify(record)+'\n');
 const files=inventoryEvidence(dir);delete files['integrity.json'];writeFileSync(path.join(dir,'integrity.json'),JSON.stringify({version:1,files})+'\n');
 await assert.rejects(store.read(f.reference.id,'operation'),/record-changed/,'live digest is independent of the rewritten manifest');
 let freshCaptures=0;
 const restarted=createReactAuthoredSourceReviews(f.repo,f.load,async()=>{freshCaptures++;return f.result;});
 await assert.rejects(restarted.read(f.reference.id,'operation'),/record-changed/,'fresh original capture rejects a coherent cache replacement');
 assert.equal(freshCaptures,1);assert.equal(before.requestRevision,revisionOf(f.request));
 assert.equal(before.sourceImageSha256,evidenceSha(f.result.original));assert.equal(before.frame.inputSha256,store.identity(f.reference.id,'operation').frameInputSha256);
});

test('warm-read interleaving returns only its verified buffers or refuses a mixed snapshot',async t=>{
 const fs=await import('node:fs'),{syncBuiltinESMExports}=await import('node:module');
 for(const trigger of ['transparent.png','receipt.json']){
  const f=fixture(t),store=f.store(),before=await store.create(f.reference.id,'operation'),dir=f.dir();
  const rewrite=()=>{
   const image=PNG.sync.read(f.result.transparent);
   for(let y=14;y<22;y++)for(let x=16;x<28;x++){const i=(y*48+x)*4;image.data[i]=0;image.data[i+1]=255;}
   const changed=PNG.sync.write(image),crop=cropSourceFrame(changed,f.result.receipt.bounds);
   writeFileSync(path.join(dir,'transparent.png'),changed);writeFileSync(path.join(dir,'context.png'),changed);writeFileSync(path.join(dir,'source.png'),crop.bytes);
   const record=JSON.parse(originalRead(path.join(dir,'receipt.json'),'utf8'));
   record.receipt.contextSha256=evidenceSha(changed);record.receipt.transparentSha256=evidenceSha(changed);
   record.receipt.imageSha256=evidenceSha(crop.bytes);record.frame.imageSha256=evidenceSha(crop.bytes);
   writeFileSync(path.join(dir,'receipt.json'),JSON.stringify(record)+'\n');
   const files=inventoryEvidence(dir);delete files['integrity.json'];writeFileSync(path.join(dir,'integrity.json'),JSON.stringify({version:1,files})+'\n');
  };
  const originalRead=fs.default.readFileSync,originalOpen=fs.default.openSync,opened=new Map<number,string>(),counts=new Map<string,number>();
  let armed=true,injected=false;
  fs.default.openSync=((p:any,...args:any[])=>{const fd=(originalOpen as any)(p,...args);if(String(p).startsWith(dir+path.sep))opened.set(fd,path.basename(String(p)));return fd;})as any;
  fs.default.readFileSync=((p:any,...args:any[])=>{
   const bytes=(originalRead as any)(p,...args),name=typeof p==='number'?opened.get(p):undefined;
   if(name){counts.set(name,(counts.get(name)??0)+1);if(armed&&name===trigger){armed=false;injected=true;rewrite();}}
   return bytes;
  })as any;
  syncBuiltinESMExports();
  try{
   if(trigger==='transparent.png'){
    const after=await store.read(f.reference.id,'operation');assert(after);assert.equal(after.image,before.image,'late replacement cannot alter the verified snapshot');
   }else await assert.rejects(store.read(f.reference.id,'operation'),/record-changed/,'mixed old/new buffers cannot pass the old manifest');
   assert(injected);assert.equal(f.captures(),1);assert.equal(counts.size,6);assert([...counts.values()].every(n=>n===1),'each retained file is read once');
  }finally{fs.default.readFileSync=originalRead;fs.default.openSync=originalOpen;syncBuiltinESMExports();}
  await assert.rejects(store.read(f.reference.id,'operation'),/record-changed/,'the next read detects the now-replaced cache');
 }
});

test('authored source review exposes named refusals without filesystem or browser details',()=>{
 for(const reason of ['react-authored-source-review-original-changed','transparent-source-frame-external-contribution'])
  assert.equal(authoredSourceReviewReason(Error(reason)),reason);
 for(const reason of ['ENOENT /private/source','browser launch failed\nsecret','react-failed:/private/source'])
  assert.equal(authoredSourceReviewReason(Error(reason)),'react-authored-source-review-unavailable');
});
