/** A separately reviewed allocation step. Component correction follows only
 * after this step has independently established the added variable IDs. */
import {canonicalJson,revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback,type NativeSourceReadback} from './native-source-observation.js';
import {prepareNativeTokenExtension,nativeTokenExtensionState,verifyNativeTokenExtension,emitNativeTokenExtensionScript,
  type NativeTokenExtensionPlan,type NativeTokenExtensionObservation} from './native-token-extension.js';
import type {NativeContractUpdateInput,NativeOpacityUpdatePlan} from './native-contract-update.js';

export interface NativeTokenAllocationUpdatePlan extends Omit<NativeOpacityUpdatePlan,'version'|'kind'> {
  version:9;kind:'native-contract-token-allocation-update';
  extension:NativeTokenExtensionPlan;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const copy=<T>(v:T):T=>structuredClone(v);
const clean=(r:NativeSourceReadback)=>{const result=copy(r);delete result.images;return result;};
const fail=(why:string):never=>{throw Error('native-update-token-allocation-'+why);};
const tokenObservation=(r:NativeSourceReadback):NativeTokenExtensionObservation=>({version:1,kind:'native-token-extension-observation',
  receipt:r.tokens!.receipt,ledger:r.tokens!.receipt.collection.extensions??[]});

export function prepareNativeTokenAllocationUpdate(input:NativeContractUpdateInput) {
  if(!input.desired.tokenInput.tokenPaths.some(p=>!input.before.tokenInput.tokenPaths.includes(p)))return null;
  if(!/^sha256:[a-f0-9]{64}$/.test(input.desired.revision)||verifyNativeContractReadback(input.before,input.baseline).status!=='supported-structure-observed')
    fail('verified-baseline-required');
  const before=copy(input.before);delete before.allocationAnchor;
  const baseline=clean(input.baseline);
  const extension=prepareNativeTokenExtension(before.tokenInput,before.tokenIdentity,baseline.tokens!.receipt,input.desired.tokenInput);
  const after=copy(before);after.tokenExtensionReadback=extension;
  const plan:NativeTokenAllocationUpdatePlan={version:9,kind:'native-contract-token-allocation-update',acceptedContract:null,
    nativeQualification:'unqualified',before,baseline,desiredRevision:input.desired.revision,changes:[],after,extension};
  return {plan,revision:revisionOf(plan)};
}

export function resolveNativeTokenAllocationUpdate(plan:NativeTokenAllocationUpdatePlan,receipt:NativeSourceReadback) {
  const resolved=verifyNativeTokenExtension(plan.extension,tokenObservation(receipt)),after=copy(plan.after);
  delete after.tokenExtensionReadback;
  after.tokenInput=resolved.input;after.tokenIdentity=resolved.identity;
  if(verifyNativeContractReadback(after,receipt).status!=='supported-structure-observed')fail('independent-readback');
  return after;
}

export function nativeTokenAllocationUpdateMatches(plan:NativeTokenAllocationUpdatePlan,receipt:NativeSourceReadback,complete=false) {
  try {
    const normalized=clean(receipt),state=nativeTokenExtensionState(plan.extension,tokenObservation(receipt));
    if(complete){if(state.state!=='complete')return false;resolveNativeTokenAllocationUpdate(plan,receipt);}
    normalized.tokens!.receipt=copy(plan.baseline.tokens!.receipt);
    return same(normalized,plan.baseline)&&verifyNativeContractReadback(plan.before,normalized).status==='supported-structure-observed';
  }catch{return false;}
}

export function emitNativeTokenAllocationUpdateScript(plan:NativeTokenAllocationUpdatePlan,direction:'apply'|'rollback',readOnly:boolean) {
  if(direction!=='apply')fail('rollback-unqualified');
  // This guard executes inside the token writer immediately before its first
  // metadata/allocation mutation, after its final asynchronous token read.
  const guard=`for(const row of componentBaseline.nodes){
 const node=componentNodes.get(row.id);
 if(!node||node.removed||node.type!==row.type||node.name!==row.name||node.parent?.id!==row.parentId||
  !same(node.children?node.children.map(n=>n.id):[],row.childIds))fail('component-final-conflict');
 for(const [key,value] of Object.entries(row.values)){const live=node[key];
  if(!same(typeof live==='symbol'?{mixed:true}:live===undefined?null:live,value))fail('component-final-field-conflict:'+key);}
 for(const [key,value] of Object.entries(row.metadata))if(node.getSharedPluginData('ds_contracts',key)!==value)fail('component-final-metadata-conflict');
}`;
  return `const update=${JSON.stringify(plan)},readOnly=${readOnly};
const out={version:1,kind:'native-contract-update-result',direction:'apply',status:'refused',changes:[],tokenAllocations:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const stable=v=>JSON.stringify((function order(x){if(Array.isArray(x))return x.map(order);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,order(x[k])]));return x;})(v));
const same=(a,b)=>stable(a)===stable(b),copy=v=>JSON.parse(JSON.stringify(v));
try{
 if(figma.fileKey!==update.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const componentNodes=new Map();for(const row of update.baseline.nodes){const n=await figma.getNodeByIdAsync(row.id);if(!n)throw Error('native-update-token-allocation-node-missing');componentNodes.set(row.id,n);}
 const current=await(async()=>{${emitNativeContractReadbackScript(plan.after)}})();
 const componentBaseline=copy(current);delete componentBaseline.images;
 const normalized=copy(componentBaseline);normalized.tokens=copy(update.baseline.tokens);
 if(!same(normalized,update.baseline))throw Error('native-update-token-allocation-component-conflict');
 const result=await(async()=>{${emitNativeTokenExtensionScript(plan.extension,readOnly,guard)}})();
 out.tokenAllocations=result.allocations;out.problems=result.problems.map(p=>p.replace(/^native-token-extension-/,'native-update-token-allocation-'));
 out.observation=await(async()=>{${emitNativeContractReadbackScript(plan.after)}})();
 out.status=result.status==='extended'?'updated':result.status;
}catch(error){out.problems.push(error&&error.message?error.message:String(error));}
return out;`;
}
