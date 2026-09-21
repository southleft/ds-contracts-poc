/** Adopt only inherited paint allocations from an independently verified main
 * migration. Component instances and caller content are never rebuilt. */
import {canonicalJson,revisionOf} from './contract-provenance.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback,type NativeContractComparisonObservationInput} from './native-contract-comparison-observation.js';
import {resolveNativeSlotIdentities,nativeSlotIdentityRuntime} from './native-slot-identity.js';
import type {NativeComparisonRepairPlan} from './native-comparison-repair.js';
type Row=Record<string,any>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const clean=(value:unknown):Row=>{const r=structuredClone(value) as Row;if(r?.content)r.content.images=[];return r;};
const fail=(why:string):never=>{throw Error('native-comparison-migration-'+why);};

export function prepareNativeComparisonMigrationRepair(input:NativeContractComparisonObservationInput,receipt:unknown):NativeComparisonRepairPlan {
  if (input.comparison.textTemplate) throw Error('native-comparison-migration-repair-text-template-unqualified');
 if(!input.mainMigrations?.length)fail('proven-main-transition-required');
 const before=clean(receipt),after=clean(receipt),next=structuredClone(input),creation=next.creation;
 const nodes=new Map<string,Row>((after.content?.nodes??[]).map((n:Row)=>[n.id,n]));
 const originalIds=new Set(creation.nodes.map((n:Row)=>n.id)),adopted=new Set<string>();
 const changes:NativeComparisonRepairPlan['changes']=[];
 const owner=JSON.stringify({version:1,operationId:input.operation.id,sourceContractId:input.comparison.projection.contractId,
  sourceContractRevision:input.comparison.projection.contractRevision,tokenPreparationRevision:input.tokenIdentity.preparationRevision,acceptedContract:null});
 const write=(node:Row,key:string,value:string)=>{
  const old=node.metadata[key]??'';if(old===value)return;
  changes.push({nodeId:node.id,kind:'metadata',key,before:old,after:value});node.metadata[key]=value;
 };
 for(const migration of input.mainMigrations!) {
  const reference=migration.index===-1?input.comparison:input.comparison.instances?.[migration.index];
  const record=migration.index===-1?creation.comparisons[0]:creation.comparisons[0].nested?.find((r:Row)=>r.index===migration.index);
  if(!reference||!record)fail('reference-missing');
  const roots=[...nodes.values()].filter(n=>n.id===record.instanceId||n.metadata.nativeSourceAllocation===record.instanceId);
  if(roots.length!==1||roots[0].type!=='INSTANCE'||roots[0].mainId!==record.mainId)fail('linked-instance-required');
  const root=roots[0],mainNodes=new Map(reference!.receipt.nodes!.map(n=>[n.id,n]));
  const at=(path:number[])=>{let node:Row|undefined=root;for(const i of path)node=nodes.get(node?.childIds[i]);if(!node)fail('part-missing');return node!;};
  const rootBorn=creation.nodes.find((n:Row)=>n.id===record.instanceId);
  for(const addition of migration.additions) {
   const node=at(addition.part.specPath),main=mainNodes.get(addition.mainNodeId);
   if(!main||node.type!=='RECTANGLE'||originalIds.has(node.id)||adopted.has(node.id)||
      node.metadata.nativeBackgroundMigration!==reference!.parent.backgroundMigration?.allocationRevision||
      !same(JSON.parse(node.metadata.nativeContractPart),addition.part))fail('inherited-paint-required');
   const inherited=same(JSON.parse(node.metadata.nativeSourceOperation),JSON.parse(main!.metadata.nativeSourceOperation))&&node.metadata.nativeSourceAllocation===main!.id;
   const owned=same(JSON.parse(node.metadata.nativeSourceOperation),JSON.parse(owner))&&node.metadata.nativeSourceAllocation===node.id;
   if(!inherited&&!owned)fail('paint-ownership-conflict');
   adopted.add(node.id);
   creation.nodes.push({id:node.id,type:'RECTANGLE',...(rootBorn?.slotIdentity?{slotIdentity:{slotId:rootBorn.slotIdentity.slotId,path:[...rootBorn.slotIdentity.path,...addition.part.specPath]}}:{})});
   record.sourceParts.push({nodeId:node.id,specPath:structuredClone(addition.part.specPath)});
   write(node,'nativeSourceOperation',owner);write(node,'nativeSourceAllocation',node.id);
  }
  for(const rewrite of migration.rewrites) {
   const node=at(rewrite.after.specPath),saved=record.sourceParts.find((p:Row)=>same(p.specPath,rewrite.after.specPath));
   if(!saved||node.metadata.nativeSourceAllocation!==saved.nodeId||!same(JSON.parse(node.metadata.nativeSourceOperation),JSON.parse(owner)))fail('existing-part-ownership');
   const actual=JSON.parse(node.metadata.nativeContractPart);
   if(!same(actual,rewrite.before)&&!same(actual,rewrite.after))fail('part-identity-conflict');
   write(node,'nativeContractPart',JSON.stringify(rewrite.after));
  }
 }
 const verified=verifyNativeContractComparisonReadback(next,after);
 if(verified.status!=='supported-comparison-structure-observed')fail('unrelated-differences:'+verified.problems.join(','));
 const plan={version:3 as const,input:next,migrationOriginalCreation:structuredClone(input.creation),before,after,changes};
 return {...plan,revision:revisionOf(plan)};
}
export function nativeComparisonMigrationRepairMatches(plan:NativeComparisonRepairPlan,receipt:unknown,complete=false) {
 try {
  if(!complete&&same(clean(receipt),plan.before))return true;
  const normalized=clean(receipt),rows=resolveNativeSlotIdentities(plan.input.creation,normalized.content?.nodes??[]);
  if(!rows)return false;normalized.content.nodes=rows;
  const expected=clean(plan.after);expected.content.nodes=resolveNativeSlotIdentities(plan.input.creation,expected.content.nodes);
  return same(normalized,expected)&&verifyNativeContractComparisonReadback(plan.input,receipt).status==='supported-comparison-structure-observed';
 }catch{return false;}
}
export function emitNativeComparisonMigrationRepairScript(plan:NativeComparisonRepairPlan,readOnly:boolean):string {
 if(!plan.migrationOriginalCreation||!same(prepareNativeComparisonMigrationRepair({...plan.input,creation:plan.migrationOriginalCreation},plan.before),plan))fail('plan-changed');
 return `const plan=${JSON.stringify(plan)},readOnly=${readOnly};
const canonicalJson=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
${nativeSlotIdentityRuntime()}
const clean=value=>{const r=JSON.parse(JSON.stringify(value));if(r.content)r.content.images=[];return r;};
const afterMatches=value=>{const r=clean(value),e=clean(plan.after);r.content.nodes=resolveNativeSlotIdentities(plan.input.creation,r.content.nodes);e.content.nodes=resolveNativeSlotIdentities(plan.input.creation,e.content.nodes);return !!r.content.nodes&&canonicalJson(r)===canonicalJson(e);};
async function read(){return await(async()=>{${emitNativeContractComparisonReadbackScript(plan.input)}})();}
const out={status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'},attempted=[],targets=new Map();
try {
 if(figma.fileKey!==plan.input.operation.fileKey)throw Error('comparison-migration-file-mismatch');
 for(const c of plan.changes){const node=await figma.getNodeByIdAsync(c.nodeId);if(!node)throw Error('comparison-migration-node-missing');targets.set(c.nodeId,node);}
 const current=await read(),complete=afterMatches(current);
 if(!complete&&canonicalJson(clean(current))!==canonicalJson(plan.before))throw Error('comparison-migration-precondition-changed');
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 if(complete){out.status='no-op';out.observation=current;return out;}
 // No await between final metadata checks and the complete bounded rewrite.
 for(const c of plan.changes)if(targets.get(c.nodeId).getSharedPluginData('ds_contracts',c.key)!==c.before)throw Error('comparison-migration-metadata-conflict');
 for(const c of plan.changes){const node=targets.get(c.nodeId);attempted.push(c);node.setSharedPluginData('ds_contracts',c.key,c.after);out.changes.push(c.nodeId);}
 out.observation=await read();if(!afterMatches(out.observation))throw Error('comparison-migration-postcondition-changed');out.status='updated';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
 for(const c of attempted.reverse())try{const node=targets.get(c.nodeId),value=node.getSharedPluginData('ds_contracts',c.key);if(value===c.after)node.setSharedPluginData('ds_contracts',c.key,c.before);if(node.getSharedPluginData('ds_contracts',c.key)!==c.before)unrestored.push(c.nodeId);}catch{unrestored.push(c.nodeId);}
 if(attempted.length)try{out.observation=await read();if(canonicalJson(clean(out.observation))!==canonicalJson(plan.before))unrestored.push('independent-rollback-observation');}catch{unrestored.push('independent-rollback-observation');}
 out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
