/** A synchronous display response may reuse checked immutable evidence. Nothing
 * survives the response, including failures. Native writes must run outside it. */
import {canonicalJson} from '../core/contract-provenance.js';
export type EvidenceReadEntry = {value:unknown} | {error:Error} | {json:string};
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
  return ('json' in saved ? JSON.parse(saved.json) : structuredClone(saved.value)) as T;
 }
 try {
  const value=read(),copy=structuredClone(value),json=plainJsonSnapshot(copy);
  snapshot.set(key,json===undefined?{value:copy}:{json});return value;
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

/** Serialize only an already-isolated, ordinary JSON tree. This is a copy
 * representation for one display response, never an evidence identity or a
 * persistent cache. The first structuredClone keeps getter/error behavior;
 * unsupported values and repeated references keep the original copy path. */
function plainJsonSnapshot(value:unknown):string|undefined {
 try {
  const seen=new Set<object>(),pending:unknown[]=[value];
  while(pending.length) {
   const current=pending.pop();
   if(current===null||typeof current==='boolean'||typeof current==='string')continue;
   if(typeof current==='number') { if(!Number.isFinite(current)||Object.is(current,-0))return undefined;continue; }
   if(!current||typeof current!=='object'||seen.has(current))return undefined;
   seen.add(current);
   // JSON must not invoke behavior, omit special values, erase holes/properties,
   // or split a shared reference. Richer clones retain structuredClone semantics.
   const proto=Object.getPrototypeOf(current),array=Array.isArray(current);
   if(proto!==(array?Array.prototype:Object.prototype)||'toJSON' in current)return undefined;
   const keys=Object.keys(current);
   if(array&&(keys.length!==current.length||keys.some((key,i)=>key!==String(i))))return undefined;
   for(const key of keys)pending.push((current as Record<string,unknown>)[key]);
  }
  return JSON.stringify(value);
 }catch {return undefined;}
}
