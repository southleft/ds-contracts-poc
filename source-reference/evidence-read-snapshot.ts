/** A synchronous display response may reuse checked immutable evidence. Nothing
 * survives the response, including failures. Native writes must run outside it. */
import {canonicalJson} from '../core/contract-provenance.js';
let snapshot:Map<string,unknown>|undefined;
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
 if(snapshot.has(key))return structuredClone(snapshot.get(key)) as T;
 const value=read();snapshot.set(key,structuredClone(value));return value;
}
export function assertOutsideEvidenceSnapshot() {
 if(snapshot)throw Error('write-during-evidence-read-snapshot');
}
