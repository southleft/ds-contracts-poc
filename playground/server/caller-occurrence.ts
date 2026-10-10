/** Host-only retained occurrence registry. HTTP callers select identities;
 * paths, event selection and opaque proof remain on the host. */
import {createHash} from 'node:crypto';
import {closeSync,constants,fstatSync,lstatSync,mkdirSync,openSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalJson} from '../../core/contract-provenance.js';
import {authenticateCallerSlotInputs,type CallerCaptureSelection} from '../../source-reference/caller-occurrence-assignment.js';
import {callerOccurrenceLibraryRequest} from '../../source-reference/caller-occurrence-library.js';
import type {MatchedSpec} from '../../scripts/react-native-matched-record.js';
type Row=Record<string,any>;
export interface RetainedOccurrenceKey {fileKey:string;nodeId:string;canonicalJsonSha256:string}
export interface RetainedOccurrenceRegistration {spec:MatchedSpec;capture:CallerCaptureSelection}
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const fail=(code:string):never=>{throw Error('retained-occurrence-'+code);};
export function parseRetainedOccurrenceKey(value:unknown):RetainedOccurrenceKey {
 const r=value as Row;if(!r||Array.isArray(r)||Object.keys(r).sort().join(',')!=='canonicalJsonSha256,fileKey,nodeId'||
  typeof r.fileKey!=='string'||!r.fileKey||r.fileKey.length>200||typeof r.nodeId!=='string'||!r.nodeId||r.nodeId.length>300||!/^[a-f0-9]{64}$/.test(r.canonicalJsonSha256))fail('invalid-selection');
 const valid=r as Row;return {fileKey:valid.fileKey,nodeId:valid.nodeId,canonicalJsonSha256:valid.canonicalJsonSha256};
}
function stat(file:string){try{return lstatSync(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
function read(file:string,limit=2_000_000){let fd:number;try{fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);}catch{return fail('manifest-unavailable');}
 try{const info=fstatSync(fd);if(!info.isFile()||info.size>limit)fail('unsafe-manifest');return readFileSync(fd);}finally{closeSync(fd);}}
export function createRetainedOccurrenceStore(repo:string,storeDir=path.join(repo,'private/caller-occurrences')) {
 const filename=(key:RetainedOccurrenceKey)=>path.join(storeDir,sha(canonicalJson(key))+'.json');
 const directory=(create:boolean)=>{const parent=path.dirname(storeDir);for(const dir of [parent,storeDir]){if(!stat(dir)){if(!create)fail('not-registered');mkdirSync(dir);}if(!stat(dir)?.isDirectory()||stat(dir)?.isSymbolicLink())fail('unsafe-store');}};
 const lower=(registration:RetainedOccurrenceRegistration)=>{const proof=authenticateCallerSlotInputs(repo,registration.spec,registration.capture),dump=JSON.parse(readFileSync(registration.capture.canonical,'utf8'));return {dump,result:callerOccurrenceLibraryRequest(proof,dump)};};
 const keyFor=(dump:Row):RetainedOccurrenceKey=>{const root=dump._occurrences?.roots?.[0];return parseRetainedOccurrenceKey({fileKey:root?.source?.fileKey,nodeId:root?.source?.nodeId,canonicalJsonSha256:sha(canonicalJson(dump))});};
 return {
  /** Trusted host API only. Never expose this registration as an HTTP route. */
  register(registration:RetainedOccurrenceRegistration){
   const {dump}=lower(registration),key=keyFor(dump),manifest=Buffer.from(JSON.stringify({version:1,key,registration}));
   if(manifest.length>64_000)fail('manifest-too-large');directory(true);const file=filename(key);
   if(stat(file)){if(!read(file,64_000).equals(manifest))fail('registration-conflict');}else writeFileSync(file,manifest,{flag:'wx',mode:0o600});
   return key;
  },
  resolve(value:unknown){
   const key=parseRetainedOccurrenceKey(value);directory(false);const bytes=read(filename(key),64_000);let saved:Row;try{saved=JSON.parse(bytes.toString());}catch{return fail('manifest-invalid');}
   if(saved.version!==1||Object.keys(saved).sort().join(',')!=='key,registration,version'||canonicalJson(saved.key)!==canonicalJson(key)||!saved.registration)fail('manifest-invalid');
   const {dump,result}=lower(saved.registration);
   if(canonicalJson(keyFor(dump))!==canonicalJson(key))fail('capture-selection-changed');
   // Data only. The proof expired after lower(); none is returned or stored.
   return {kind:'host-retained-occurrence' as const,key,request:result.request,selection:result.selection,
    degradations:result.source.degradations,qualification:'unqualified' as const,acceptedContract:null};
  },
 };
}
