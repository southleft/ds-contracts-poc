/** Independent inventory of an acknowledged partial component allocation.
 * This reports what survived; it never proves a complete graph or permits a
 * retry, cleanup or repair. It is intentionally pinned to the original plan. */
import {canonicalJson} from './contract-provenance.js';
import {emitNativeInventoryReadbackScript} from './native-source-observation.js';
import {resolveNativeGraphSlotIdentities} from './native-slot-identity.js';
import {verifyNativeTokenContextReceipt, type NativeTokenContextInput, type NativeTokenIdentity} from './native-token-context.js';

type Row = Record<string, any>;
export interface NativePartialObservationInput {
  operation: {id:string; fileKey:string};
  planRevision:string;
  sourceContractId:string;
  sourceContractRevision:string;
  tokenInput:NativeTokenContextInput;
  tokenIdentity:NativeTokenIdentity;
  creation:Row;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const text=(v:unknown):v is string=>typeof v==='string' && v.length>0 && v.length<=512;
function checkInput(input:NativePartialObservationInput) {
  const c=input.creation;
  if (!c || c.version!==1 || c.status!=='partial-or-unknown-allocation' || c.allocationAttempted!==true ||
      c.operationId!==input.operation.id || c.fileKey!==input.operation.fileKey ||
      c.acceptedContract!==null || c.nativeQualification!=='unqualified' || !text(c.pageId) ||
      !Array.isArray(c.nodes) || !c.nodes.length || c.nodes.length>10000 ||
      c.nodes.some((n:Row)=>!n || !text(n.id) || !text(n.type)) ||
      new Set(c.nodes.map((n:Row)=>n.id)).size!==c.nodes.length ||
      c.nodes.filter((n:Row)=>n.type==='PAGE').length!==1 ||
      !c.nodes.some((n:Row)=>n.id===c.pageId && n.type==='PAGE') ||
      !/^sha256:[a-f0-9]{64}$/.test(input.planRevision) || !text(input.sourceContractId) ||
      !/^sha256:[a-f0-9]{64}$/.test(input.sourceContractRevision) ||
      !input.tokenIdentity || input.tokenIdentity.origin!=='created' || input.tokenIdentity.fileKey!==input.operation.fileKey ||
      !/^sha256:[a-f0-9]{64}$/.test(input.tokenIdentity.preparationRevision) ||
      input.tokenInput.fileKey!==input.operation.fileKey || input.tokenInput.scopeId!=='source-'+input.operation.id)
    throw Error('native-partial-observation-input-invalid');
  return {operation:input.operation,planRevision:input.planRevision,pageId:c.pageId as string,
    nodes:c.nodes.map((n:Row)=>({id:n.id as string,type:n.type as string})),comparisons:[]};
}
export function emitNativePartialReadbackScript(input:NativePartialObservationInput, replacement=false):string {
  return emitNativeInventoryReadbackScript(checkInput(input),input.tokenInput,input.tokenIdentity,
    ['nativeContractPart','nativeContractSample','nativeContractCase','fontWeightVar','lineHeightVar',
      ...(replacement?['nativeLibraryReplacementClaim']:[])],false,false,[],[],false,[],replacement,false,undefined,replacement);
}
export interface NativePartialObservation {
  status:'partial-output-inspected'|'refused';
  pageId:string;
  recordedNodeCount:number;
  nodeCount:number;
  missingNodeIds:string[];
  additionalNodeIds:string[];
  changedTypeNodeIds:string[];
  ownershipMismatchNodeIds:string[];
  allocationAliases:Array<{recordedId:string;nodeId:string}>;
  inheritedNodeIds:string[];
  tokensObserved:boolean;
  problems:string[];
}
export function verifyNativePartialReadback(input:NativePartialObservationInput,value:unknown):NativePartialObservation {
  const expected=checkInput(input), r=value as Row;
  const out:NativePartialObservation={status:'refused',pageId:expected.pageId,recordedNodeCount:expected.nodes.length,
    nodeCount:0,missingNodeIds:[],additionalNodeIds:[],changedTypeNodeIds:[],ownershipMismatchNodeIds:[],allocationAliases:[],inheritedNodeIds:[],tokensObserved:false,problems:[]};
  if (!r || r.version!==1 || r.status!=='native-readback-collected' ||
      r.receiptKind!=='independent-native-component-readback' || r.operationId!==input.operation.id ||
      r.fileKey!==input.operation.fileKey || r.planRevision!==input.planRevision ||
      r.acceptedContract!==null || r.nativeQualification!=='unqualified' || !same(r.problems,[]) || !same(r.images,[]) ||
      !Array.isArray(r.nodes) || !r.nodes.length || r.nodes.length>10000 ||
      r.nodes.some((n:Row)=>!n || !text(n.id) || !text(n.type) || !Array.isArray(n.childIds) ||
        n.childIds.some((id:unknown)=>!text(id)) || !n.metadata || typeof n.metadata!=='object') ||
      new Set(r.nodes.map((n:Row)=>n.id)).size!==r.nodes.length) {
    out.problems=['native-partial-observation-readback-invalid']; return out;
  }
  const nodes=new Map<string,Row>(r.nodes.map((n:Row)=>[n.id,n]));
  const page=nodes.get(expected.pageId);
  if (!page || page.type!=='PAGE' || r.nodes.filter((n:Row)=>n.type==='PAGE').length!==1) {
    out.problems=['native-partial-observation-page-invalid']; return out;
  }
  // Every reported node must be in this one page's tree. Missing or extra
  // allocation identities below remain visible differences, never authority.
  const reached=new Set<string>(), pending=[page.id]; let topologyValid=true;
  while(pending.length && topologyValid) {
    const id=pending.pop()!, node=nodes.get(id);
    if(reached.has(id) || !node) {topologyValid=false;break;}
    reached.add(id);
    for(const child of node.childIds) {
      if(nodes.get(child)?.parentId!==id) {topologyValid=false;break;}
      pending.push(child);
    }
  }
  if(!topologyValid || reached.size!==nodes.size) {
    out.problems=['native-partial-observation-topology-invalid']; return out;
  }
  out.nodeCount=nodes.size;
  const recorded=new Map(expected.nodes.map(n=>[n.id,n]));
  // Caller allocations can acquire virtual IDs inside an instance's SLOT.
  // Reuse the complete-graph bridge; it rejects duplicate stamps, wrong types,
  // unrelated ancestry and aliases beside still-present originals.
  const resolved=resolveNativeGraphSlotIdentities({...input.creation,graphVerification:2},r.nodes);
  if(!resolved){out.problems=['native-partial-observation-allocation-identity'];return out;}
  const canonical=new Map<string,Row>(resolved.map(n=>[n.id,n]));
  for(let i=0;i<resolved.length;i++)if(resolved[i].id!==r.nodes[i].id)
    out.allocationAliases.push({recordedId:resolved[i].id,nodeId:r.nodes[i].id});
  out.allocationAliases.sort((a,b)=>a.recordedId.localeCompare(b.recordedId));
  const inherited=new Set<string>();
  let inheritedValid=true;
  const pair=(node:Row,main:Row,seen:Set<string>)=>{
    if(seen.has(node.id)){inheritedValid=false;return;}
    const next=new Set(seen);next.add(node.id);
    // Caller-owned allocations replace a slot's sample contents. Their own
    // instance/main relationship is checked independently below.
    if(node.type==='SLOT' && node.childIds.every((id:string)=>recorded.has(id)))return;
    if(node.childIds.length!==main.childIds.length){inheritedValid=false;return;}
    for(let i=0;i<node.childIds.length;i++){
      const child=canonical.get(node.childIds[i]),source=canonical.get(main.childIds[i]);
      if(!child||!source||recorded.has(child.id)||child.type!==source.type||
          !recorded.has(source.metadata?.nativeSourceAllocation)||
          recorded.get(source.metadata.nativeSourceAllocation)?.type!==source.type||
          child.metadata.nativeSourceAllocation!==source.metadata.nativeSourceAllocation||
          child.metadata.nativeSourceOperation!==source.metadata.nativeSourceOperation||
          child.metadata.nativeContractPart!==source.metadata.nativeContractPart||
          child.type==='INSTANCE'&&child.mainId!==source.mainId){inheritedValid=false;continue;}
      inherited.add(child.id);pair(child,source,next);
    }
  };
  for(const born of expected.nodes)if(born.type==='INSTANCE'){
    const node=canonical.get(born.id),main=node&&canonical.get(node.mainId);
    if(!node)continue;
    if(!main||main.type!=='COMPONENT'||recorded.get(main.id)?.type!=='COMPONENT')inheritedValid=false;
    else pair(node,main,new Set());
  }
  out.inheritedNodeIds=[...inherited].sort();
  if(!inheritedValid)out.problems.push('native-partial-observation-inherited-identity');
  out.missingNodeIds=expected.nodes.filter(n=>!canonical.has(n.id)).map(n=>n.id).sort();
  out.additionalNodeIds=[...canonical.keys()].filter(id=>!recorded.has(id)&&!inherited.has(id)).sort();
  out.changedTypeNodeIds=expected.nodes.filter(n=>canonical.has(n.id) && canonical.get(n.id)!.type!==n.type).map(n=>n.id).sort();
  const owner={version:1,operationId:input.operation.id,sourceContractId:input.sourceContractId,
    sourceContractRevision:input.sourceContractRevision,tokenPreparationRevision:input.tokenIdentity.preparationRevision,acceptedContract:null};
  for(const n of canonical.values()) {
    let actual; try {actual=JSON.parse(n.metadata.nativeSourceOperation);} catch {actual=null;}
    if(!same(actual,owner) || !inherited.has(n.id)&&n.metadata.nativeSourceAllocation!==n.id) out.ownershipMismatchNodeIds.push(n.id);
  }
  out.ownershipMismatchNodeIds.sort();
  try {out.tokensObserved=r.tokens?.status==='readback-collected' &&
    verifyNativeTokenContextReceipt({input:input.tokenInput,expectedIdentity:input.tokenIdentity,receipt:r.tokens.receipt}).status==='native-token-context-observed';}
  catch {out.tokensObserved=false;}
  for(const [ids,name] of [[out.missingNodeIds,'missing-nodes'],[out.additionalNodeIds,'additional-nodes'],
    [out.changedTypeNodeIds,'changed-types'],[out.ownershipMismatchNodeIds,'ownership-mismatch']] as const)
    if(ids.length) out.problems.push('native-partial-observation-'+name);
  if(!out.tokensObserved)out.problems.push('native-partial-observation-tokens-unverified');
  out.status='partial-output-inspected';
  return out;
}
