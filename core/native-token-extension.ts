/** Add literal number variables to an authenticated allocation. This separate
 * protocol never edits component nodes, existing variables, modes or ownership.
 * It is not application dispatch authority. IDs are recovered only from the
 * exact collection ledger plus an independent complete variable inventory. */
import {canonicalJson,revisionOf} from './contract-provenance.js';
import {nativeTokenAllocationBase,prepareNativeTokenContext,verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,type NativeTokenContextReceipt,type NativeTokenIdentity,
  type NativeTokenExtensionIdentity} from './native-token-context.js';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const copy=<T>(v:T):T=>structuredClone(v);
const fail=(code:string):never=>{throw Error('native-token-extension-'+code);};
export interface NativeTokenExtensionPlan {
  version:1;
  before:NativeTokenContextInput;
  identity:NativeTokenIdentity;
  baseline:NativeTokenContextReceipt;
  after:NativeTokenContextInput;
  additions:ReturnType<typeof prepareNativeTokenContext>['variables'];
  revision:string;
}
export interface NativeTokenExtensionObservation {
  version:1; kind:'native-token-extension-observation';
  receipt:NativeTokenContextReceipt;
  ledger:unknown;
}

/** Desired source metadata describes a new observation, while the original
 * collection owner remains the allocation-time source. Every existing token
 * definition and mode must remain unchanged. Value and geometry writes are
 * separate corrections and cannot be smuggled into this allocation step. */
export function prepareNativeTokenExtension(before:NativeTokenContextInput, identity:NativeTokenIdentity,
  baseline:NativeTokenContextReceipt, desired:NativeTokenContextInput):NativeTokenExtensionPlan {
  if (verifyNativeTokenContextReceipt({input:before,expectedIdentity:identity,receipt:baseline}).status!=='native-token-context-observed')
    fail('verified-baseline-required');
  if (before.writeProtocol || before.modes.length!==1 || desired.writeProtocol || desired.modes.length!==1 ||
      before.fileKey!==desired.fileKey || before.scopeId!==desired.scopeId) fail('context-unsupported');
  const after:NativeTokenContextInput={...copy(before),tokenPaths:copy(desired.tokenPaths),modes:copy(desired.modes),
    allocationBase:nativeTokenAllocationBase(before)};
  const prepared=prepareNativeTokenContext(after),prior=prepareNativeTokenContext(before);
  if (prepared.revision!==identity.preparationRevision ||
      prior.variables.some(v=>!same(v,prepared.variables.find(n=>n.tokenPath===v.tokenPath)))) fail('existing-variable-changed');
  const old=new Set(prior.variables.map(v=>v.tokenPath));
  const additions=prepared.variables.filter(v=>!old.has(v.tokenPath));
  if (!additions.length || additions.length>100) fail('additions-required');
  const body={version:1 as const,before:copy(before),identity:copy(identity),baseline:copy(baseline),after,additions};
  return {...body,revision:revisionOf(body)};
}

/** The same exact-delta check runs on the host and inside emitted programs.
 * A pending ledger may settle as complete only when every recorded actual ID
 * and every value already matches. It never licenses allocating missing IDs. */
const INSPECT=`(plan,observation,complete=false)=>{
 const stable=v=>JSON.stringify((function order(x){if(Array.isArray(x))return x.map(order);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,order(x[k])]));return x;})(v));
 const same=(a,b)=>stable(a)===stable(b),clone=v=>JSON.parse(JSON.stringify(v));
 const refuse=code=>{throw Error('native-token-extension-'+code);};
 if(!observation||observation.version!==1||observation.kind!=='native-token-extension-observation')refuse('observation-invalid');
 const old=plan.identity.extensions||[],ledger=observation.ledger,r=clone(observation.receipt);
 if(same(ledger,old)){
  if(complete)refuse('allocation-incomplete');
  if(!same(r,plan.baseline))refuse('baseline-conflict');
  return {state:'untouched',variables:[]};
 }
 const pending=!!ledger&&!Array.isArray(ledger)&&ledger.pending===plan.revision&&same(ledger.prior,old)&&Array.isArray(ledger.variables);
 if(pending&&!same(Object.keys(ledger).sort(),['pending','prior','variables']))refuse('ledger-conflict');
 const entries=pending?[...old,{revision:ledger.pending,variables:ledger.variables}]:ledger;
 if(!Array.isArray(entries)||entries.length!==old.length+1||!same(entries.slice(0,-1),old)||entries.at(-1).revision!==plan.revision)refuse('ledger-conflict');
 if(!same(Object.keys(entries.at(-1)).sort(),['revision','variables']))refuse('ledger-conflict');
 if(!pending&&!same(r.collection.extensions,entries))refuse('ledger-receipt-conflict');
 const variables=entries.at(-1).variables;
 if(!Array.isArray(variables)||variables.length!==plan.additions.length)refuse('partial-allocation-recovery-required');
 if(new Set(variables.map(v=>v.id)).size!==variables.length||new Set(variables.map(v=>v.key)).size!==variables.length||
   new Set(variables.map(v=>v.tokenPath)).size!==variables.length)refuse('allocation-ambiguous');
 const previousIds=new Set(plan.identity.variables.map(v=>v.id)),previousKeys=new Set(plan.identity.variables.map(v=>v.key));
 for(let i=0;i<plan.additions.length;i++){
  const planned=plan.additions[i],id=variables[i],actual=r.variables.find(v=>v.id===id.id);
  if(!same(Object.keys(id).sort(),['id','key','tokenPath'])||id.tokenPath!==planned.tokenPath||typeof id.id!=='string'||!id.id||typeof id.key!=='string'||!id.key||
    previousIds.has(id.id)||previousKeys.has(id.key)||!actual||actual.key!==id.key||actual.name!==planned.name||actual.remote!==false||
    actual.resolvedType!=='FLOAT'||actual.variableCollectionId!==plan.identity.collection.id)refuse('allocation-identity');
  const values=Object.fromEntries(planned.values.map((v,i)=>[plan.identity.modes[i].modeId,v.value]));
  if(!same(Object.keys(actual.valuesByMode).sort(),Object.keys(values).sort())||Object.entries(values).some(([mode,value])=>
    typeof value!=='number'||!Number.isFinite(value)||(actual.valuesByMode[mode]!==value&&actual.valuesByMode[mode]!==Math.fround(value))))refuse('allocation-value');
  if(!same(Object.keys(actual).sort(),['id','key','name','remote','resolvedType','valuesByMode','variableCollectionId']))refuse('allocation-extra-field');
 }
 r.variables=r.variables.filter(v=>!variables.some(a=>a.id===v.id));
 if(plan.baseline.collection.extensions)r.collection.extensions=clone(plan.baseline.collection.extensions);else delete r.collection.extensions;
 if(!same(r,plan.baseline))refuse('baseline-conflict');
 if(complete&&pending)refuse('allocation-unsettled');
 return {state:pending?'pending-complete':'complete',variables};
}`;
const inspect=new Function('return '+INSPECT)() as (plan:NativeTokenExtensionPlan,observation:NativeTokenExtensionObservation,complete?:boolean)=>{
  state:'untouched'|'pending-complete'|'complete';variables:NativeTokenExtensionIdentity['variables']};

export function nativeTokenExtensionState(plan:NativeTokenExtensionPlan, observation:NativeTokenExtensionObservation) {
  return inspect(plan,observation);
}
export function verifyNativeTokenExtension(plan:NativeTokenExtensionPlan, observation:NativeTokenExtensionObservation) {
  const {variables}=inspect(plan,observation,true);
  const identity=copy(plan.identity);
  identity.variables.push(...variables);
  identity.extensions=[...(identity.extensions??[]),{revision:plan.revision,variables:copy(variables)}];
  if(verifyNativeTokenContextReceipt({input:plan.after,expectedIdentity:identity,receipt:observation.receipt}).status!=='native-token-context-observed')
    fail('independent-readback');
  return {input:copy(plan.after),identity,receipt:copy(observation.receipt)};
}

/** No display-name discovery: enumerate the exact pinned collection's complete
 * ID inventory, then compare old IDs and the revision-bound extension ledger. */
function readRuntime():string {return `
const NS='ds_contracts',KEY='nativeTokenExtensions';
const stable=v=>JSON.stringify((function order(x){if(Array.isArray(x))return x.map(order);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,order(x[k])]));return x;})(v));
const same=(a,b)=>stable(a)===stable(b),copy=v=>JSON.parse(JSON.stringify(v));
const fail=code=>{throw Error('native-token-extension-'+code);};
const guard=()=>{if(figma.fileKey!==plan.before.fileKey)fail('file-mismatch');};
const parse=raw=>{try{return raw===''?[]:JSON.parse(raw);}catch{fail('ledger-unreadable');}};
const variableRow=v=>({id:v.id,key:v.key,name:v.name,variableCollectionId:v.variableCollectionId,resolvedType:v.resolvedType,remote:v.remote,valuesByMode:copy(v.valuesByMode)});
const collectionRow=c=>({id:c.id,key:c.key,name:c.name,remote:c.remote,ownership:JSON.parse(c.getSharedPluginData(NS,'nativeTokenContext')),
 defaultModeId:c.defaultModeId,modes:c.modes.map(m=>({modeId:m.modeId,name:m.name}))});
async function read(){
 guard();const collection=await figma.variables.getVariableCollectionByIdAsync(plan.identity.collection.id);guard();
 if(!collection||collection.id!==plan.identity.collection.id||collection.key!==plan.identity.collection.key)fail('collection-missing');
 const raw=collection.getSharedPluginData(NS,KEY),ids=[...collection.variableIds],header=collectionRow(collection);
 if(new Set(ids).size!==ids.length||ids.length>10000)fail('inventory-invalid');
 const variables=await Promise.all(ids.map(id=>figma.variables.getVariableByIdAsync(id)));guard();
 if(raw!==collection.getSharedPluginData(NS,KEY)||!same(ids,collection.variableIds)||!same(header,collectionRow(collection)))fail('changed-during-read');
 if(variables.some((v,i)=>!v||v.id!==ids[i]||v.variableCollectionId!==collection.id))fail('variable-missing');
 const ledger=parse(raw);
 if(raw!=='')header.extensions=copy(ledger);
 const order=[...plan.identity.variables.map(v=>v.id),...ids.filter(id=>!plan.identity.variables.some(v=>v.id===id))];
 const rows=new Map(variables.map(v=>[v.id,variableRow(v)]));
 const observation={version:1,kind:'native-token-extension-observation',receipt:{fileKey:figma.fileKey,collection:header,variables:order.map(id=>rows.get(id))},ledger};
 return {observation,collection,variables,raw,ids};
}
`;}

export function emitNativeTokenExtensionReadbackScript(plan:NativeTokenExtensionPlan):string {
  return `const plan=${JSON.stringify(plan)};${readRuntime()}
return (await read()).observation;`;
}

/** Same receipt envelope as the ordinary token reader, with a complete
 * inventory during the allocation transition. The host decides qualification. */
export function emitNativeTokenExtensionContextReadbackScript(plan:NativeTokenExtensionPlan):string {
  return `const result={version:1,status:'refused',acceptedContract:null,nativeQualification:'unqualified',
preparationRevision:${JSON.stringify(plan.identity.preparationRevision)},receiptKind:'independent-native-readback',problems:[]};
try{const observation=await(async()=>{${emitNativeTokenExtensionReadbackScript(plan)}})();
result.receipt=observation.receipt;result.status='readback-collected';
}catch(error){result.problems=[error&&error.message?error.message:String(error)];}
return result;`;
}

export function emitNativeTokenExtensionScript(plan:NativeTokenExtensionPlan,readOnly=false,synchronousGuard=''):string {
  const {revision,...body}=plan;
  if(revisionOf(body)!==revision)fail('plan-changed');
  return `const plan=${JSON.stringify(plan)},readOnly=${readOnly};
const inspect=${INSPECT};${readRuntime()}
const out={version:1,kind:'native-token-extension-result',status:'refused',allocations:[],problems:[]};
try{
 const current=await read(),state=inspect(plan,current.observation);
 out.observation=current.observation;
 if(readOnly){out.status='preflight-observed';return out;}
 if(state.state==='complete'){out.status='no-op';return out;}
 // All guards and allocations below are synchronous. Record intent before any
 // create call; an unrecorded allocation leaves an inventory mismatch forever.
 guard();const c=current.collection;
 if(current.raw!==c.getSharedPluginData(NS,KEY)||!same(current.ids,c.variableIds)||
   !same(collectionRow(c),(()=>{const h=copy(current.observation.receipt.collection);delete h.extensions;return h;})()))fail('final-collection-conflict');
 const observed=new Map(current.observation.receipt.variables.map(v=>[v.id,v]));
 for(const v of current.variables)if(!same(variableRow(v),observed.get(v.id)))fail('final-variable-conflict');
 ${synchronousGuard}
 const prior=plan.identity.extensions||[];
 if(state.state==='pending-complete'){
  c.setSharedPluginData(NS,KEY,JSON.stringify([...prior,{revision:plan.revision,variables:state.variables}]));
 }else{
  const pending={prior:copy(prior),pending:plan.revision,variables:[]};
  c.setSharedPluginData(NS,KEY,JSON.stringify(pending));
  for(const addition of plan.additions){
   const v=figma.variables.createVariable(addition.name,c,'FLOAT');
   const identity={tokenPath:addition.tokenPath,id:v.id,key:v.key};
   out.allocations.push(identity);pending.variables.push(identity);
   c.setSharedPluginData(NS,KEY,JSON.stringify(pending));
   addition.values.forEach((row,i)=>v.setValueForMode(plan.identity.modes[i].modeId,row.value));
  }
  c.setSharedPluginData(NS,KEY,JSON.stringify([...prior,{revision:plan.revision,variables:pending.variables}]));
 }
 out.observation=(await read()).observation;inspect(plan,out.observation,true);out.status='extended';
}catch(error){out.problems.push(error&&error.message?error.message:String(error));
 try{out.observation=(await read()).observation;}catch{}
 // Never remove allocations or overwrite values after an uncertain failure.
 // The host must settle the durable ledger with an independent read.
}
return out;`;
}
