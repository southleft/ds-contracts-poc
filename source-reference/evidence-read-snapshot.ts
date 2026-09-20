/** A synchronous display response may reuse checked immutable evidence. Nothing
 * survives the response, including failures. Native writes must run outside it. */
import {canonicalJson} from '../core/contract-provenance.js';
export type EvidenceReadEntry = {value:unknown} | {error:Error};
let snapshot:Map<string,EvidenceReadEntry>|undefined;
export function withEvidenceReadSnapshot<T>(read:()=>T):T {
 const outer=snapshot;snapshot??=new Map();
 try {
  const result=read();
  if(result&&typeof (result as any).then==='function')throw Error('async-evidence-read-snapshot');
  return result;
 }finally{snapshot=outer;}
}
export function evidenceReadOnce<T>(kind:string,identity:unknown,read:()=>T):T {
 if(!snapshot)return read();
 const key=kind+':'+canonicalJson(identity);
 return readSnapshotValue(snapshot,key,read);
}
/** The caller owns the synchronous scope and must discard this map afterward. */
export function readSnapshotValue<T>(snapshot:Map<string,EvidenceReadEntry>,key:string,read:()=>T):T {
 const saved=snapshot.get(key);
 if(saved) {
  if('error' in saved)throw structuredClone(saved.error);
  return structuredClone(saved.value) as T;
 }
 try {
  const value=read();snapshot.set(key,{value:structuredClone(value)});return value;
 } catch(error) {
  // Historical proposals can fail the same freshness check repeatedly in one
  // listing. Reuse plain refusals only; cloning arbitrary exception subclasses
  // or custom fields would change their meaning. The first caller also gets an
  // isolated error, so its catch block cannot change a later caller's refusal.
  try {
   if(error instanceof Error && Object.getPrototypeOf(error)===Error.prototype &&
      Object.getOwnPropertyNames(error).every(key=>['message','stack'].includes(key)) &&
      Object.getOwnPropertySymbols(error).length===0 &&
      Object.values(Object.getOwnPropertyDescriptors(error)).every(d=>'value' in d && typeof d.value==='string'))
    snapshot.set(key,{error:structuredClone(error)});
  } catch { /* Uncloneable or reflective exceptions keep their original behavior. */ }
  throw error;
 }
}
export function assertOutsideEvidenceSnapshot() {
 if(snapshot)throw Error('write-during-evidence-read-snapshot');
}
