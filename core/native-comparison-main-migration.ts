/** Reconstruct the exact verified main migration before rebasing a comparison.
 * Only a pinned background allocation transition may extend old inventory. */
import {canonicalJson} from './contract-provenance.js';
import {prepareNativeContractUpdate,nativeContractUpdateAfter,nativeContractUpdateMatches} from './native-contract-update.js';
import type {NativeContractObservationInput,NativeSourceReadback} from './native-source-observation.js';
import type {NativeContractPartIdentity} from './native-contract-draft.js';

type Row=Record<string,any>;
export interface NativeComparisonMainMigration {
 index:number;
 additions:Array<{mainNodeId:string;parentMainId:string;parentBeforePath:number[];part:NativeContractPartIdentity}>;
 rewrites:Array<{mainNodeId:string;before:NativeContractPartIdentity;after:NativeContractPartIdentity}>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw Error('native-comparison-main-migration-unverified');};
export function verifiedComparisonMainMigration(before:NativeContractObservationInput,baseline:NativeSourceReadback,
 after:NativeContractObservationInput,receipt:NativeSourceReadback,mainId:string,index:number):NativeComparisonMainMigration {
 const proof=after.backgroundMigration;if(!proof)fail();
 const {plan}=prepareNativeContractUpdate({before,baseline,desired:{component:after.component,revision:proof!.desiredRevision,tokenInput:after.tokenInput}});
 if(plan.kind!=='native-contract-background-update'||plan.allocationRevision!==proof!.allocationRevision||
   !nativeContractUpdateMatches(plan,receipt,true)||!same(nativeContractUpdateAfter(plan,receipt),after))fail();
 const nodes=new Map(baseline.nodes!.map(n=>[n.id,n])),current=new Map(receipt.nodes!.map(n=>[n.id,n]));
 const within=(id:string)=>{const seen=new Set();while(id!==mainId){if(seen.has(id)||!nodes.has(id))return false;seen.add(id);id=nodes.get(id)!.parentId;}return true;};
 const additions:NativeComparisonMainMigration['additions']=[],rewrites:NativeComparisonMainMigration['rewrites']=[];
 if(plan.kind!=='native-contract-background-update')return fail();
 for(const change of plan.changes)if(within(change.nodeId)){
  const paint=current.get(current.get(change.nodeId)!.childIds[0])!;
  additions.push({mainNodeId:paint.id,parentMainId:change.nodeId,parentBeforePath:JSON.parse(nodes.get(change.nodeId)!.metadata.nativeContractPart).specPath,part:JSON.parse(paint.metadata.nativeContractPart)});
  for(const r of change.rewrites)rewrites.push({mainNodeId:r.nodeId,before:JSON.parse(r.before),after:JSON.parse(r.after)});
 }
 if(!additions.length)fail();
 return {index,additions,rewrites};
}
export function mainNodeAtPath(receipt:NativeSourceReadback,mainId:string,path:number[]):Row|undefined {
 const nodes=new Map(receipt.nodes!.map(n=>[n.id,n]));let node=nodes.get(mainId);
 for(const i of path)node=nodes.get(node?.childIds[i]);return node;
}

/** Apply proven main-path shifts to a current expected inventory. This returns
 * a copy; it never changes the historical creation acknowledgement. */
export function rebaseComparisonCreation(creation:Row,migrations:NativeComparisonMainMigration[]):Row {
 const out=structuredClone(creation),root=out.comparisons[0];
 const prefixes:Array<{slotId:string;path:number[]}> = [];
 for(const migration of migrations) {
  const record=migration.index===-1?root:root.nested?.find((n:Row)=>n.index===migration.index);
  if(!record)fail();
  const born=out.nodes.find((n:Row)=>n.id===record.instanceId);
  if(born?.slotIdentity)for(const a of migration.additions)prefixes.push({slotId:born.slotIdentity.slotId,path:[...born.slotIdentity.path,...a.parentBeforePath]});
  const rebase=(path:number[])=>migration.rewrites.find(r=>same(r.before.specPath,path))?.after.specPath??path;
  for(const part of record.sourceParts??[])part.specPath=structuredClone(rebase(part.specPath));
  for(const slot of record.slots??[])slot.specPath=structuredClone(rebase(slot.specPath));
 }
 for(const node of out.nodes)if(node.slotIdentity){
  const old=node.slotIdentity.path as number[],next=[...old];
  for(const prefix of prefixes)if(prefix.slotId===node.slotIdentity.slotId&&old.length>prefix.path.length&&prefix.path.every((v,i)=>old[i]===v))next[prefix.path.length]++;
  node.slotIdentity.path=next;
 }
 return out;
}
