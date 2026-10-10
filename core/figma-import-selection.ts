/** One root decision for ordinary dump consumers. Occurrence authority is an
 * in-process host resolver, never a JSON flag or a guessed component main. */
import {dumpClosure,pickRequestedContract} from '../extract/figma/rest/closure.js';
import type {Contract} from '../scripts/contract-schema.js';
type Dump=Record<string,any>;
export interface FigmaImportSelection { kind:'declaration'|'occurrence';nodeId:string;contractId:string;index:number; }
export type HostOccurrenceResolver=(dump:Dump,nodeId:string)=>{contractId:string};
export function selectFigmaImportRoot(dump:Dump,contracts:readonly Contract[],resolveOccurrence?:HostOccurrenceResolver):FigmaImportSelection {
 const occurrence=dump._occurrences;
 if(occurrence!==undefined){
  if(occurrence.version!==1||occurrence.dependencyInventory!=='complete'||occurrence.requested?.length!==1||occurrence.roots?.length!==1)throw Error('figma-occurrence-selection-unqualified');
  const nodeId=occurrence.requested[0],root=occurrence.roots[0];
  if(typeof nodeId!=='string'||root.source?.nodeId!==nodeId||root.root?.nodeId!==nodeId)throw Error('figma-occurrence-source-mismatch');
  if(!resolveOccurrence)throw Error('figma-occurrence-host-proof-required');
  const {contractId}=resolveOccurrence(dump,nodeId),matches=contracts.map((c,index)=>({c,index})).filter(r=>r.c.id===contractId);
  if(matches.length!==1||matches[0].c.bindings.figma.anchors.nodeId!==nodeId||matches[0].c.bindings.figma.anchors.fileKey!==root.source.fileKey)throw Error('figma-occurrence-proposal-mismatch');
  return {kind:'occurrence',nodeId,contractId,index:matches[0].index};
 }
 const closure=dumpClosure(dump),requested=closure?.requested[0];
 if(closure&&!requested)throw Error('figma-requested-set-missing');
 if(requested){
  const selected=pickRequestedContract(contracts.map((contract,index)=>({file:String(index),contract})),requested.nodeId);
  if('refusal'in selected)throw Error(selected.refusal);
  return {kind:'declaration',nodeId:requested.nodeId,contractId:contracts[Number(selected.file)].id,index:Number(selected.file)};
 }
 if(!contracts.length)throw Error('figma-import-no-proposals');
 const first=contracts[0];return {kind:'declaration',nodeId:first.bindings.figma.anchors.nodeId??'',contractId:first.id,index:0};
}
