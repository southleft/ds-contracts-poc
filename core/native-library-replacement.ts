/** Replacement of an inspected, acknowledged partial library allocation.
 * The app must separately pin the replacement compiler plan and durably claim
 * its write. This layer neither reserves operations nor rewrites old evidence. */
import {canonicalJson,revisionOf} from './contract-provenance.js';
import {emitNativePartialReadbackScript,verifyNativePartialReadback,type NativePartialObservationInput} from './native-partial-observation.js';

type Row=Record<string,any>;
export type NativeLibraryReplacementInput=NativePartialObservationInput & {priorClaim?:string};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(reason:string):never=>{throw Error('native-library-replacement-'+reason);};

/** No await inside the snapshot. Loading all pages happens before calling it.
 * An unsupported synchronous main-component API refuses before any mutation. */
function reader(input:NativeLibraryReplacementInput):string {
  const script=emitNativePartialReadbackScript(input,true);
  return `function readReplacement() {
  const content=(()=>{${script}\n})();
  const result={version:1,status:'refused',inputRevision:${JSON.stringify(revisionOf(input))},content,consumers:[],references:[],problems:[]};
  try {
    if(figma.fileKey!==${JSON.stringify(input.operation.fileKey)})throw Error('file-mismatch');
    if(content.status!=='native-readback-collected')throw Error('inventory-unavailable');
    if(figma.skipInvisibleInstanceChildren===true)throw Error('complete-instance-inventory-unavailable');
    const owned=new Set(content.nodes.map(n=>n.id));
    const mains=new Set(content.nodes.filter(n=>n.type==='COMPONENT').map(n=>n.id));
    const identities=new Set(content.nodes.flatMap(n=>[n.id,...(n.key?[n.key]:[])]));
    const referenced=value=>{
      const found=new Set(), pending=[value];
      while(pending.length){const v=pending.pop();if(typeof v==='string'&&identities.has(v))found.add(v);
        else if(v&&typeof v==='object')pending.push(...Object.values(v));}
      return [...found].sort();
    };
    let count=0;
    for(const page of figma.root.children) {
      for(const node of [page,...page.findAll(()=>true)]) {
        if(++count>100000)throw Error('consumer-scope-too-large');
        if(node.type==='INSTANCE') {
          const main=node.mainComponent;
          if(!main || main.type!=='COMPONENT' || typeof main.id!=='string')throw Error('consumer-main-unavailable');
          if(mains.has(main.id))result.consumers.push({nodeId:node.id,mainId:main.id,inside:owned.has(node.id)});
        }
        if(owned.has(node.id))continue;
        const fields=[];
        if('reactions' in node)fields.push(['reactions',node.reactions]);
        if(node.type==='INSTANCE')fields.push(['componentProperties',Object.values(node.componentProperties).filter(p=>p.type==='INSTANCE_SWAP')]);
        if(node.type==='COMPONENT_SET'||node.type==='COMPONENT'&&node.parent.type!=='COMPONENT_SET')
          fields.push(['componentPropertyDefinitions',Object.values(node.componentPropertyDefinitions).filter(p=>p.type==='INSTANCE_SWAP')]);
        for(const [field,value] of fields){const targets=referenced(value);if(targets.length)result.references.push({nodeId:node.id,field,targets});}
      }
    }
    result.consumers.sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
    result.references.sort((a,b)=>a.nodeId.localeCompare(b.nodeId)||a.field.localeCompare(b.field));
    result.status='partial-replacement-observed';
  } catch(error) {result.problems=[error&&error.message?error.message:'readback-failed'];}
  return result;
}`;
}
export function emitNativeLibraryReplacementReadbackScript(input:NativeLibraryReplacementInput):string {
  return `// GENERATED partial-library replacement preflight. READ ONLY.
${reader(input)}
if(figma.fileKey!==${JSON.stringify(input.operation.fileKey)})throw Error('native-library-replacement-file-mismatch');
await figma.loadAllPagesAsync();
return readReplacement();`;
}

export function prepareNativeLibraryReplacement(input:NativeLibraryReplacementInput,observation:unknown) {
  if(input.priorClaim!==undefined&&!/^sha256:[a-f0-9]{64}$/.test(input.priorClaim))fail('prior-claim-invalid');
  const r=observation as Row;
  if(!r || r.version!==1 || r.status!=='partial-replacement-observed' || r.inputRevision!==revisionOf(input) ||
      !same(r.problems,[]) || !Array.isArray(r.consumers) || !Array.isArray(r.references)) fail('observation-invalid');
  if(r.references.length)fail('external-reference-consumer');
  const inventory=verifyNativePartialReadback(input,r.content);
  if(inventory.status!=='partial-output-inspected' || inventory.problems.length || !inventory.tokensObserved)
    fail('allocation-changed');
  const nodes=new Map<string,Row>(r.content.nodes.map((n:Row)=>[n.id,n]));
  const aliases=new Map(inventory.allocationAliases.map(a=>[a.recordedId,a.nodeId]));
  if(nodes.get(input.creation.pageId)?.metadata.nativeLibraryReplacementClaim!==(input.priorClaim??''))fail('already-claimed');
  for(const allocated of input.creation.nodes) {
    const node=nodes.get(aliases.get(allocated.id)??allocated.id)!;
    if(allocated.key!==undefined && node.key!==allocated.key)fail('allocation-key-changed');
  }
  if(new Set(r.consumers.map((c:Row)=>c?.nodeId)).size!==r.consumers.length)fail('consumer-inventory-invalid');
  for(const c of r.consumers) {
    if(!c || typeof c.nodeId!=='string' || !c.nodeId || typeof c.mainId!=='string' || nodes.get(c.mainId)?.type!=='COMPONENT' ||
        typeof c.inside!=='boolean' || c.inside!==nodes.has(c.nodeId))fail('consumer-inventory-invalid');
    if(!c.inside)fail('external-instance-consumer');
    if(nodes.get(c.nodeId)?.type!=='INSTANCE' || nodes.get(c.nodeId)?.mainId!==c.mainId)fail('consumer-inventory-invalid');
  }
  for(const node of nodes.values())
    if(node.type==='INSTANCE' && nodes.get(node.mainId)?.type==='COMPONENT' && !r.consumers.some((c:Row)=>c.nodeId===node.id))
      fail('consumer-inventory-incomplete');
  return {version:1 as const,input:structuredClone(input),observation:structuredClone(r),
    revision:revisionOf({input,observation:r})};
}
export type NativeLibraryReplacement=ReturnType<typeof prepareNativeLibraryReplacement>;

/** The host supplies a newly compiled shared-writer program after authenticating
 * the same retained archive and token input. No executable client input here.
 * The final supported inventory and removal are synchronous. Tokens are reused.
 * This is not yet exposed as an application recovery action. */
export function wrapNativeLibraryReplacement(plan:NativeLibraryReplacement,render:string):string {
  if(!same(prepareNativeLibraryReplacement(plan.input,plan.observation),plan) || typeof render!=='string' || !render.trim())
    fail('plan-invalid');
  return `// GENERATED journal-claimed replacement of a retained partial library.
const replacement=${JSON.stringify(plan)};
${reader(plan.input)}
const canonical=v=>JSON.stringify((function order(x){if(Array.isArray(x))return x.map(order);if(!x||typeof x!=='object')return x;return Object.fromEntries(Object.keys(x).sort().map(k=>[k,order(x[k])]));})(v));
const out={version:1,status:'refused',operationId:replacement.input.operation.id,fileKey:replacement.input.operation.fileKey,
  replacementRevision:replacement.revision,acceptedContract:null,nativeQualification:'unqualified',mutationAttempted:false,
  retiredPageId:null,retiredNodeIds:[],creation:null,problems:[]};
try {
  if(figma.fileKey!==out.fileKey)throw Error('native-library-replacement-file-mismatch');
  await figma.loadAllPagesAsync();
  // Figma refuses to remove the current page. Navigate before the final
  // synchronous inventory; navigation never permits a changed snapshot.
  if(figma.currentPage.id===replacement.input.creation.pageId) {
    const other=figma.root.children.find(p=>p.id!==replacement.input.creation.pageId);
    if(!other)throw Error('native-library-replacement-other-page-required');
    await figma.setCurrentPageAsync(other);
  }
  const current=readReplacement();
  if(canonical(current)!==canonical(replacement.observation))throw Error('native-library-replacement-live-conflict');
  const page=figma.getNodeById(replacement.input.creation.pageId);
  if(!page || page.type!=='PAGE' || page.getSharedPluginData('ds_contracts','nativeLibraryReplacementClaim')!==(replacement.input.priorClaim??''))
    throw Error('native-library-replacement-page-unavailable');
  // No asynchronous work between the reviewed inventory and this claim /
  // removal. A throwing native API can leave an unknown result; never replay it.
  out.mutationAttempted=true;
  page.setSharedPluginData('ds_contracts','nativeLibraryReplacementClaim',replacement.revision);
  const retiredPageId=page.id;
  page.remove();
  out.retiredPageId=retiredPageId;
  out.retiredNodeIds=replacement.observation.content.nodes.map(n=>n.id);
  const creation=await(async()=>{${render}\n})();
  out.creation=creation;
  out.status='replacement-executed';
} catch(error) {
  out.status=out.mutationAttempted ? out.retiredPageId ? 'replacement-creation-unknown' : 'retirement-unknown' : 'refused';
  out.problems=[error&&error.message?error.message:'native-library-replacement-api-failed'];
}
return out;`;
}
