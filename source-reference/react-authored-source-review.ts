/** Strict, supplemental review of one authenticated authored-v1 original.
 * This never grades fidelity or grants authority to a native operation. */
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,constants,fstatSync,lstatSync,mkdirSync,openSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {revisionOf} from '../core/contract-provenance.js';
import {assertOutsideEvidenceSnapshot} from './evidence-read-snapshot.js';
import {captureValidatedTree} from './capture.js';
import {readReactAuthoredNativeEvidence} from './react-authored-native-evidence.js';
import {isReactAuthoredNativeRequest,type ReactAuthoredNativeRequest} from './react-authored-native-request.js';
import {reactReferenceHtml,reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {watchSourceFailures} from './observe.js';
import {inventoryEvidence} from './react-validation-evidence.js';
import {cropSourceFrame,type SourceFrame} from './source-framing.js';
import {captureTransparentSourceFrame} from './transparent-source-frame-v2.js';

type Capture = Awaited<ReturnType<typeof captureTransparentSourceFrame>>;
export interface ReactAuthoredSourceReview {
 id:string;requestRevision:string;sourceImageSha256:string;treeSha256:string;
 frame:SourceFrame;image:string;qualification:'unqualified';
}
interface Input {
 reference:ReactReference;request:ReactAuthoredNativeRequest;
 captured:{treeSha256:string;sourcePngSha256:string};source:Buffer;
}
const hash=/^[a-f0-9]{64}$/;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const same=(a:unknown,b:unknown)=>revisionOf(a)===revisionOf(b);
const fail=(reason:string):never=>{throw Error('react-authored-source-review-'+reason);};
const files=['original.png','context.png','transparent.png','source.png','receipt.json'];

export function authoredSourceReviewReason(error:unknown) {
 const message=error instanceof Error?error.message:'';
 return /^(?:react-|transparent-source-frame-)[a-z0-9-]{1,160}(?::[a-z0-9-]{1,80})?$/.test(message)
  ?message:'react-authored-source-review-unavailable';
}

/** The ordinary authored reader reopens the complete seal and rederives the
 * native draft before its original capture can become review input. */
export function loadReactAuthoredSourceReviewInput(repo:string,reference:ReactReference,request:ReactAuthoredNativeRequest):Input {
 if(!isReactAuthoredNativeRequest(request)||reference.id!==request.referenceId||!reactReferenceUnchanged(reference))fail('reference-unavailable');
 const {captured}=readReactAuthoredNativeEvidence(repo,reference,request);
 if(!hash.test(captured.treeSha256)||!hash.test(captured.sourcePngSha256??''))fail('original-unavailable');
 const source=readFileSync(path.join(repo,'private/react-source-ownership',request.referenceId,request.ownership.id,request.caseId,'source.png'));
 if(sha(source)!==captured.sourcePngSha256)fail('original-changed');
 return {reference,request,captured:{treeSha256:captured.treeSha256,sourcePngSha256:captured.sourcePngSha256!},source};
}

async function captureOriginal(input:Input):Promise<Capture> {
 const {reference,request,captured}=input,profile=reference.cohort.profile(request.caseId);
 if(profile.path.length!==1)fail('shadow-path-unsupported');
 const browser=await chromium.launch({args:['--enable-automation']});
 try{
  const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
  const url='http://127.0.0.1/react-ownership?case='+request.caseId;
  await context.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',
   headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},
   body:reactReferenceHtml(reference)}):route.abort());
  const page=await context.newPage(),failures=watchSourceFailures(page);
  try{
   await page.goto(url);await page.locator(profile.path[0]).waitFor({state:'attached',timeout:15000});
   const before=await captureValidatedTree(page,profile,failures,'#root','--');
   if(before.status!=='captured'||before.treeSha256!==captured.treeSha256||before.sourcePngSha256!==captured.sourcePngSha256)fail('original-changed');
   try{return await captureTransparentSourceFrame(page,profile.path[0],captured.sourcePngSha256);}
   finally{
    // A refused strict frame must also leave the original unchanged.
    const after=await captureValidatedTree(page,profile,failures,'#root','--');
    if(!same(before,after))fail('original-not-restored');
   }
  }finally{failures.dispose();}
 }finally{await browser.close();}
}

function instrument() {
 const root=path.dirname(fileURLToPath(import.meta.url));
 return Object.fromEntries(['react-authored-source-review.ts','react-authored-native-evidence.ts','capture.ts',
  'transparent-source-frame-v2.ts','source-framing.ts'].map(file=>[file,sha(readFileSync(path.join(root,file)))]));
}
function validateCapture(capture:Capture,source:Buffer) {
 const r=capture.receipt;
 if(r?.version!==2||r.kind!=='transparent-source-frame'||r.qualification!=='unqualified'||
   !capture.original.equals(source)||r.originalSha256!==sha(source)||r.contextSha256!==sha(capture.withContext)||
   r.transparentSha256!==sha(capture.transparent)||r.imageSha256!==sha(capture.bytes))fail('capture-changed');
 const derived=cropSourceFrame(capture.transparent,r.bounds);
 if(!derived.bytes.equals(capture.bytes)||!same(derived.crop,r.crop)||!same(derived.sourceSize,r.sourceSize)||
   !same(r.rootOffset,{x:r.bounds.x-r.crop.x,y:r.bounds.y-r.crop.y}))fail('capture-changed');
}

/** As with initial-source-review, retain all four pixel artifacts and their
 * v2 receipt. Unlike the legacy frame store, never recrop the opaque original
 * to stand in for the strict transparent result. The callback is host-owned. */
export function createReactAuthoredSourceReviews(repo:string,
 load:(referenceId:string,operationId:string)=>Input,
 capture:(input:Input)=>Promise<Capture>=captureOriginal) {
 const root=path.join(repo,'private/react-authored-source-reviews');
 let active:{key:string;promise:Promise<ReactAuthoredSourceReview>}|undefined;
 // Only a real capture may establish trust. Disk files, including their own
 // manifest, cannot attest to themselves after a process restart.
 const trusted=new Map<string,string>();
 function input(referenceId:string,operationId:string) {
  const value=load(referenceId,operationId);
  if(!isReactAuthoredNativeRequest(value.request)||value.reference.id!==referenceId||value.request.referenceId!==referenceId||
    !reactReferenceUnchanged(value.reference)||!hash.test(value.captured.treeSha256)||sha(value.source)!==value.captured.sourcePngSha256)fail('input-changed');
  const engine=instrument(),pin={request:value.request,sourceSha256:value.captured.sourcePngSha256,treeSha256:value.captured.treeSha256,engine};
  return {value,engine,pin,key:revisionOf(pin).slice(7)};
 }
 function directory(p:string,create=false) {
  for(const item of [repo,path.join(repo,'private'),root,p]){
   try{if(!lstatSync(item).isDirectory()||lstatSync(item).isSymbolicLink())fail('directory-invalid');}
   catch(error){if(create&&(error as NodeJS.ErrnoException).code==='ENOENT')mkdirSync(item,{mode:0o700});else throw error;}
  }
 }
 function readLoaded(current:ReturnType<typeof input>,expectedIntegrity?:string,fresh?:Capture):
  {review:ReactAuthoredSourceReview;integritySha256:string}|null {
  const d=path.join(root,current.key);
  try{directory(d);}catch(error){
   if((error as NodeJS.ErrnoException).code==='ENOENT'){
    if(expectedIntegrity)fail('record-unavailable');
    return null;
   }
   throw error;
  }
  const names=[...files,'integrity.json'].sort();
  if(!same(readdirSync(d).sort(),names))fail('record-invalid');
  // Hash, parse and return one captured set of bytes. A writer can replace the
  // disk files during this read, but cannot substitute later unverified bytes.
  const buffers=new Map<string,Buffer>();
  for(const name of names){
   const p=path.join(d,name);
   if(!lstatSync(p).isFile()||lstatSync(p).isSymbolicLink())fail('record-invalid');
   const fd=openSync(p,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
   try{if(!fstatSync(fd).isFile())fail('record-invalid');buffers.set(name,Buffer.from(readFileSync(fd)));}
   finally{closeSync(fd);}
  }
  if(!same(readdirSync(d).sort(),names))fail('record-invalid');
  const read=(name:string)=>buffers.get(name)??fail('record-invalid');
  const integrity=read('integrity.json'),seal=JSON.parse(integrity.toString());
  if(expectedIntegrity&&sha(integrity)!==expectedIntegrity)fail('record-changed');
  if(!object(seal)||seal.version!==1||!object(seal.files)||!same(Object.keys(seal.files).sort(),[...files].sort())||
    !Object.values(seal.files).every(value=>typeof value==='string'&&hash.test(value)))fail('record-changed');
  if(files.some(name=>sha(read(name))!==seal.files[name]))fail('record-changed');
  const record=JSON.parse(read('receipt.json').toString());
  if(record.version!==1||!/^[-a-f0-9]{36}$/.test(record.id)||!same(record.pin,current.pin))fail('record-changed');
  const result={original:read('original.png'),withContext:read('context.png'),transparent:read('transparent.png'),bytes:read('source.png'),receipt:record.receipt};
  validateCapture(result,current.value.source);
  if(fresh&&(!result.original.equals(fresh.original)||!result.withContext.equals(fresh.withContext)||
    !result.transparent.equals(fresh.transparent)||!result.bytes.equals(fresh.bytes)||!same(result.receipt,fresh.receipt)))fail('record-changed');
  const frame:SourceFrame={version:1,sourceSha256:current.value.captured.sourcePngSha256,inputSha256:current.key,
   imageSha256:result.receipt.imageSha256,bounds:result.receipt.bounds,crop:result.receipt.crop,sourceSize:result.receipt.sourceSize,qualification:'unqualified'};
  if(!same(frame,record.frame))fail('record-changed');
  return {integritySha256:sha(integrity),review:{id:record.id,requestRevision:revisionOf(current.value.request),sourceImageSha256:current.value.captured.sourcePngSha256,
   treeSha256:current.value.captured.treeSha256,frame,image:'data:image/png;base64,'+result.bytes.toString('base64'),qualification:'unqualified'}};
 }
 async function acquire(referenceId:string,operationId:string,createMissing:boolean):Promise<ReactAuthoredSourceReview|null>{
   assertOutsideEvidenceSnapshot();
   const current=input(referenceId,operationId),expected=trusted.get(current.key),existing=readLoaded(current,expected);
   if(existing&&expected)return existing.review;
   if(!existing&&!createMissing)return null;
   if(active){if(active.key===current.key)return active.promise;return fail('busy');}
   const promise=(async()=>{
    const result=await capture(current.value);validateCapture(result,current.value.source);
    if(input(referenceId,operationId).key!==current.key)fail('input-changed');
    // Recovery requires a fresh strict capture until this process has pinned
    // the exact manifest. A coherent cache rewrite must not become authority.
    const prior=readLoaded(current,undefined,result);
    if(prior){trusted.set(current.key,prior.integritySha256);return prior.review;}
    const d=path.join(root,current.key),temp=path.join(root,'.pending-'+randomUUID());
    directory(root,true);mkdirSync(temp,{mode:0o700});
    try{
     for(const [name,bytes]of Object.entries({'original.png':result.original,'context.png':result.withContext,'transparent.png':result.transparent,'source.png':result.bytes}))
      writeFileSync(path.join(temp,name),bytes,{flag:'wx',mode:0o600});
     const r=result.receipt,frame:SourceFrame={version:1,sourceSha256:r.originalSha256,inputSha256:current.key,imageSha256:r.imageSha256,
      bounds:r.bounds,crop:r.crop,sourceSize:r.sourceSize,qualification:'unqualified'};
     writeFileSync(path.join(temp,'receipt.json'),JSON.stringify({version:1,id:randomUUID(),pin:current.pin,receipt:r,frame})+'\n',{flag:'wx',mode:0o600});
     writeFileSync(path.join(temp,'integrity.json'),JSON.stringify({version:1,files:inventoryEvidence(temp)})+'\n',{flag:'wx',mode:0o600});
     if(input(referenceId,operationId).key!==current.key)fail('input-changed');
     try{renameSync(temp,d);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
     const verified=readLoaded(input(referenceId,operationId),undefined,result)??fail('record-unavailable');
     trusted.set(current.key,verified.integritySha256);return verified.review;
    }finally{rmSync(temp,{recursive:true,force:true});}
   })();
   active={key:current.key,promise};try{return await promise;}finally{active=undefined;}
 }
 return {
  identity(referenceId:string,operationId:string){
   const {value,key}=input(referenceId,operationId);
   return {requestRevision:revisionOf(value.request),sourceImageSha256:value.captured.sourcePngSha256,treeSha256:value.captured.treeSha256,frameInputSha256:key};
  },
  read(referenceId:string,operationId:string){return acquire(referenceId,operationId,false);},
  async create(referenceId:string,operationId:string){return await acquire(referenceId,operationId,true)??fail('record-unavailable');},
 };
}
