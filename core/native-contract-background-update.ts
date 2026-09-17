/** A compiler paint-layer migration preserves every old allocation. New IDs
 * are learned from an independent inventory, never guessed or accepted from
 * the write acknowledgement. Original creation evidence remains immutable. */
import {canonicalJson, revisionOf} from './contract-provenance.js';
import {flattenTokens,makeResolveLiteral,pxOrNull} from './tokens.js';
import {lowerPaddingBoxBackground} from './figma-background-clip.js';
import type {NodeSpec} from './emit-figma-script.js';
import {emitNativeContractReadbackScript, verifyNativeContractReadback} from './native-source-observation.js';
import type {NativeContractUpdateInput, NativeOpacityUpdatePlan} from './native-contract-update.js';

type Rewrite = {nodeId:string; before:string; after:string};
export interface NativeBackgroundUpdatePlan extends Omit<NativeOpacityUpdatePlan,'version'|'kind'|'changes'> {
  version:5; kind:'native-contract-background-update'; allocationRevision:string;
  changes:Array<{nodeId:string;variant:string;part:string;channel:'background-clip';before:'border-box';after:'padding-box';
    paint:NodeSpec; rewrites:Rewrite[]}>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const copy=<T>(v:T):T=>structuredClone(v);
const part=(n:Record<string,any>)=>{try{return JSON.parse(n.metadata.nativeContractPart);}catch{return null;}};
const fail=(s:string):never=>{throw Error('native-update-background-'+s);};

export function prepareNativeBackgroundUpdate(input:NativeContractUpdateInput,
  prepareBase:(input:NativeContractUpdateInput)=>{plan:NativeOpacityUpdatePlan;revision:string}) {
  const addsPaint=(old:NodeSpec,next:NodeSpec|undefined):boolean=>!!next&&((!old.backgroundClip&&next.backgroundClip==='padding-box')||!!old.children?.some((child,i)=>addsPaint(child,next.children?.[i])));
  if(!input.before.component.variants.some((v,i)=>addsPaint(v.spec,input.desired.component.variants[i]?.spec)))return null;
  const sanitized=copy(input), changes:NativeBackgroundUpdatePlan['changes']=[];
  const desired=copy(input.desired.component);
  const resolve=makeResolveLiteral(flattenTokens(input.before.tokenInput.modes[0].tokens));
  function visit(old:NodeSpec,next:NodeSpec|undefined,normalized:NodeSpec|undefined,variant:string,
    owner?:NativeBackgroundUpdatePlan['changes'][number]) {
    if(!next||!normalized)return;
    const paint=next.children?.[0];
    const added=next.backgroundClip==='padding-box'&&!old.backgroundClip&&paint?.backgroundPaint;
    if(!old.nativeContractPart||!next.nativeContractPart||old.nativeContractPart.contractRevision!==next.nativeContractPart.contractRevision||
        old.nativeContractPart.variant!==next.nativeContractPart.variant)fail('source-identity-changed');
    const rows=input.baseline.nodes!.filter(n=>same(part(n),old.nativeContractPart));
    if(!rows.length)fail('part-identity');
    if(added) {
      if(!paint.nativeContractPart||rows.length!==1||old.type!==next.type||
          !['root','frame'].includes(old.type)||!old.layout||old.layout.mode==='GRID'||
          next.children!.length!==(old.children?.length??0)+1)fail('topology-unqualified');
      const expected=copy(old);
      if(!lowerPaddingBoxBackground(expected,name=>{
        try{return pxOrNull(resolve(name.split('/').join('.')))??undefined;}catch{return undefined;}
      })||!same({...expected.children![0],nativeContractPart:undefined},{...paint,nativeContractPart:undefined}))fail('paint-not-derived');
      normalized.children=normalized.children!.slice(1);delete normalized.backgroundClip;
      if(paint.fill)normalized.fill=paint.fill;
      if(paint.lits?.fillColor){normalized.lits??={};normalized.lits.fillColor=paint.lits.fillColor;}
      if(!old.lits&&normalized.lits&&!Object.keys(normalized.lits).length)delete normalized.lits;
      owner={nodeId:rows[0].id,variant,part:old.name,channel:'background-clip',before:'border-box',after:'padding-box',paint:copy(paint),rewrites:[]};
      changes.push(owner);
    }
    if(!same(old.nativeContractPart,next.nativeContractPart)) {
      if(!owner)fail('unrelated-part-shift');
      for(const row of rows)owner!.rewrites.push({nodeId:row.id,before:row.metadata.nativeContractPart,after:JSON.stringify(next.nativeContractPart)});
    }
    normalized.nativeContractPart=copy(old.nativeContractPart);
    old.children?.forEach((child,i)=>visit(child,next.children?.[i+(added?1:0)],normalized.children?.[i],variant,owner));
  }
  input.before.component.variants.forEach((v,i)=>visit(v.spec,desired.variants[i]?.spec,sanitized.desired.component.variants[i]?.spec,v.name));
  if(!changes.length)return null;
  // Only this rule's code-only receipts may disappear. Never erase another
  // unsupported fact merely because the enclosing component now has a layer.
  const oldFacts=input.before.component.codeOnlyFacts??[],nextFacts=desired.codeOnlyFacts??[];
  if(!same(oldFacts,nextFacts)) {
    if(!same(oldFacts.filter(f=>!(f.channel==='background-clip'&&f.value==='padding-box')),nextFacts))fail('other-facts-changed');
    sanitized.desired.component.codeOnlyFacts=copy(input.before.component.codeOnlyFacts);
    const oldDescription=input.before.component.description;
    const newDescription=oldDescription?.replace(` † (${oldFacts.length} code-only facts — see plugin report)`,nextFacts.length?` † (${nextFacts.length} code-only facts — see plugin report)`:'');
    if(desired.description!==oldDescription&&desired.description!==newDescription)fail('description-changed');
    sanitized.desired.component.description=oldDescription;
  }
  const base=prepareBase(sanitized).plan;
  if(base.changes.length)fail('mixed-channels');
  const after=copy(base.after);
  after.component.variants=copy(desired.variants);
  after.component.codeOnlyFacts=copy(desired.codeOnlyFacts);
  after.component.description=desired.description;
  const allocationRevision=revisionOf({before:base.before,baseline:base.baseline,desiredRevision:input.desired.revision,changes});
  const plan:NativeBackgroundUpdatePlan={...base,version:5,kind:'native-contract-background-update',after,changes,allocationRevision};
  return {plan,revision:revisionOf(plan)};
}

/** Shared exact-delta verifier used by both the host and generated writer.
 * Existing fields are compared byte-for-byte after undoing only this migration.
 * A new rectangle must satisfy geometry, paint, ownership and allocation rules. */
const INSPECT_BACKGROUND_DELTA = `(plan,raw,complete) => {
  const clone=(v)=>JSON.parse(JSON.stringify(v));
  const canonical=(value)=>JSON.stringify((function order(v) {
    if(Array.isArray(v))return v.map(order);
    if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,order(v[k])]));
    return v;
  })(value));
  const equal=(a,b)=>canonical(a)===canonical(b);
  const near=(a,b)=>typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.00001;
  const r=clone(raw);delete r.images;
  if(!Array.isArray(r.nodes)||new Set(r.nodes.map((n)=>n.id)).size!==r.nodes.length)throw Error('background-inventory');
  const original=new Map(plan.baseline.nodes.map(n=>[n.id,n])),allocations=[];
  const byId=new Map(r.nodes.map((n)=>[n.id,n]));
  // The new reader also sees constraints on an old first rectangle whose
  // former path equals the proposed paint path. That field was not part of
  // the old observation. It is unrelated to allocating the new rectangle.
  for(const n of r.nodes){const old=original.get(n.id);
    if(old&&n.type==='RECTANGLE'&&old.values.constraints===undefined&&!n.metadata.nativeBackgroundMigration&&
      plan.changes.some(c=>equal(JSON.parse(old.metadata.nativeContractPart),c.paint.nativeContractPart)))delete n.values.constraints;
  }
  for(const c of plan.changes) {
    const host=byId.get(c.nodeId),before=original.get(c.nodeId);
    if(!host||!before)throw Error('background-parent');
    if(equal(host.childIds,before.childIds)) {
      if(complete)throw Error('background-missing');
      continue;
    }
    const paint=byId.get(host.childIds[0]),v=paint?.values,geometry=c.paint.backgroundPaint;
    if(!paint||original.has(paint.id)||paint.name!==c.paint.name||paint.type!=='RECTANGLE'||paint.parentId!==host.id||paint.childIds.length||
      !equal(host.childIds.slice(1),before.childIds)||allocations.some(a=>a.id===paint.id)||
      paint.metadata.nativeBackgroundMigration!==plan.allocationRevision||paint.metadata.nativeSourceAllocation!==paint.id||
      !equal(JSON.parse(paint.metadata.nativeSourceOperation),JSON.parse(before.metadata.nativeSourceOperation))||
      !equal(JSON.parse(paint.metadata.nativeContractPart),c.paint.nativeContractPart)||
      !equal(v.fills,before.values.fills)||!equal(v.strokes,[])||!equal(v.effects,[])||v.opacity!==1||v.visible!==true||
      v.layoutPositioning!=='ABSOLUTE'||!equal(v.constraints,{horizontal:'STRETCH',vertical:'STRETCH'})||
      !near(v.x,geometry.inset)||!near(v.y,geometry.inset)||
      !near(v.width,Math.max(0.01,host.values.width-2*geometry.inset))||!near(v.height,Math.max(0.01,host.values.height-2*geometry.inset))||
      !equal(v.relativeTransform,[[1,0,geometry.inset],[0,1,geometry.inset]])||
      (host.values.boundVariables?.fills!==undefined&&!equal(host.values.boundVariables.fills,[]))||
      !near(v.cornerRadius,geometry.radius)||!equal(v.explicitVariableModes,before.values.explicitVariableModes)||
      !equal(host.values.fills,[]))throw Error('background-allocation-conflict');
    for(const [key,value] of Object.entries(paint.metadata))if(!['nativeSourceOperation','nativeSourceAllocation','nativeContractPart','nativeBackgroundMigration'].includes(key)&&value!=='')throw Error('background-extra-metadata');
    host.childIds=clone(before.childIds);host.values.fills=clone(before.values.fills);
    // Figma's aggregate fill bindings follow the paints when they move.
    if(host.values.boundVariables&&before.values.boundVariables) {
      if('fills' in before.values.boundVariables)host.values.boundVariables.fills=clone(before.values.boundVariables.fills);
      else delete host.values.boundVariables.fills;
    }
    for(const rewrite of c.rewrites) {
      const n=byId.get(rewrite.nodeId);
      if(!n||n.metadata.nativeContractPart!==rewrite.after)throw Error('background-part-conflict');
      n.metadata.nativeContractPart=rewrite.before;
    }
    allocations.push({id:paint.id,type:'RECTANGLE'});
  }
  r.nodes=r.nodes.filter((n)=>!allocations.some(a=>a.id===n.id));
  // Native traversal order changes only by inserting the new paint children.
  if(!equal(r,plan.baseline))throw Error('background-baseline-conflict');
  return allocations;
}`;
const inspectBackgroundDelta = new Function('return '+INSPECT_BACKGROUND_DELTA)() as (plan:NativeBackgroundUpdatePlan,raw:unknown,complete:boolean)=>Array<{id:string;type:string}>;

export function resolveNativeBackgroundUpdateInput(plan:NativeBackgroundUpdatePlan,receipt:unknown) {
  const allocations=inspectBackgroundDelta(plan,receipt,true),after=copy(plan.after);
  after.creation.nodes.push(...allocations);
  after.backgroundMigration={desiredRevision:plan.desiredRevision,allocationRevision:plan.allocationRevision};
  if(verifyNativeContractReadback(after,receipt).status!=='supported-structure-observed')fail('independent-readback');
  return after;
}
export function nativeBackgroundUpdateMatches(plan:NativeBackgroundUpdatePlan,receipt:unknown,complete=false) {
  try {
    const allocations=inspectBackgroundDelta(plan,receipt,complete);
    if(allocations.length===plan.changes.length)resolveNativeBackgroundUpdateInput(plan,receipt);
    else if(allocations.length||verifyNativeContractReadback(plan.before,receipt).status!=='supported-structure-observed')return false;
    return true;
  }catch{return false;}
}

export function emitNativeBackgroundUpdateScript(plan:NativeBackgroundUpdatePlan,direction:'apply'|'rollback',readOnly:boolean) {
  if(direction==='rollback')fail('rollback-delivery-not-qualified');
  return `const plan=${JSON.stringify(plan)},readOnly=${readOnly};
const inspect=${INSPECT_BACKGROUND_DELTA};
const copy=value=>JSON.parse(JSON.stringify(value));
const out={version:1,kind:'native-contract-update-result',direction:'apply',status:'refused',changes:[],allocations:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const attempted=[],rewritten=[];let allocationAttempted=false;
const paintState=node=>JSON.stringify({name:node.name,parentId:node.parent?.id,
 values:Object.fromEntries(['x','y','width','height','relativeTransform','fills','strokes','effects','opacity','visible','cornerRadius','constraints','layoutPositioning','boundVariables','explicitVariableModes'].map(k=>[k,node[k]])),
 metadata:Object.fromEntries(node.getSharedPluginDataKeys('ds_contracts').sort().map(k=>[k,node.getSharedPluginData('ds_contracts',k)]))});
try {
 if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const collection=await figma.variables.getVariableCollectionByIdAsync(plan.before.tokenIdentity.collection.id);
 if(!collection)throw Error('native-update-background-collection-missing');
 const nodes=new Map();
 for(const id of plan.before.creation.nodes.map(n=>n.id)) {
  if(!nodes.has(id)){const node=await figma.getNodeByIdAsync(id);if(!node)throw Error('native-update-background-node-missing');nodes.set(id,node);}
 }
 const current=await(async()=>{${emitNativeContractReadbackScript(plan.after)}})();
 const allocated=inspect(plan,current,false);
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 if(allocated.length===plan.changes.length){out.status='no-op';out.observation=current;return out;}
 // Final synchronous check closes the gap after asynchronous token reads.
 const stable=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;})(value));
 for(const row of current.nodes){
  const node=nodes.get(row.id);if(!node||node.removed||node.type!==row.type||node.name!==row.name||node.parent?.id!==row.parentId||
    stable(node.children?node.children.map(n=>n.id):[])!==stable(row.childIds))throw Error('native-update-background-final-conflict');
  for(const [key,value] of Object.entries(row.values)){const live=node[key];
   if(stable(typeof live==='symbol'?{mixed:true}:live===undefined?null:live)!==stable(value))throw Error('native-update-background-final-field-conflict:'+key);}
  for(const [key,value] of Object.entries(row.metadata))if(node.getSharedPluginData('ds_contracts',key)!==value)throw Error('native-update-background-final-metadata-conflict');
 }
 for(const c of plan.changes) {
  const host=nodes.get(c.nodeId),before=plan.baseline.nodes.find(n=>n.id===c.nodeId);
  allocationAttempted=true;const paint=figma.createRectangle();
  attempted.push({host,paint,fills:copy(host.fills)});out.allocations.push({id:paint.id,type:paint.type});
  paint.setSharedPluginData('ds_contracts','nativeSourceOperation',before.metadata.nativeSourceOperation);
  paint.setSharedPluginData('ds_contracts','nativeSourceAllocation',paint.id);
  paint.setSharedPluginData('ds_contracts','nativeBackgroundMigration',plan.allocationRevision);
  paint.setSharedPluginData('ds_contracts','nativeContractPart',JSON.stringify(c.paint.nativeContractPart));
  paint.setExplicitVariableModeForCollection(collection,plan.before.tokenIdentity.modes[0].modeId);
  paint.name=c.paint.name;paint.fills=copy(host.fills);paint.strokes=[];paint.effects=[];
  host.insertChild(0,paint);paint.layoutPositioning='ABSOLUTE';
  const inset=c.paint.backgroundPaint.inset;
  paint.resize(Math.max(0.01,host.width-2*inset),Math.max(0.01,host.height-2*inset));
  paint.x=inset;paint.y=inset;paint.cornerRadius=c.paint.backgroundPaint.radius;
  paint.constraints={horizontal:'STRETCH',vertical:'STRETCH'};
  for(const rewrite of c.rewrites) {
   const node=nodes.get(rewrite.nodeId);rewritten.push({node,previous:rewrite.before,after:rewrite.after});
   node.setSharedPluginData('ds_contracts','nativeContractPart',rewrite.after);
  }
  host.fills=[];attempted[attempted.length-1].fingerprint=paintState(paint);out.changes.push(host.id);
 }
 out.observation=await(async()=>{${emitNativeContractReadbackScript(plan.after)}})();
 inspect(plan,out.observation,true);
 if(attempted.some(a=>paintState(a.paint)!==a.fingerprint))throw Error('native-update-background-post-write-edit');
 out.status='updated';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
 for(const r of rewritten.reverse())try{
  if(r.node.getSharedPluginData('ds_contracts','nativeContractPart')===r.after)r.node.setSharedPluginData('ds_contracts','nativeContractPart',r.previous);
  if(r.node.getSharedPluginData('ds_contracts','nativeContractPart')!==r.previous)unrestored.push(r.node.id);
 }catch{unrestored.push(r.node.id);}
 for(const a of attempted.reverse())try{
  // Only remove a layer allocated in this invocation. Unknown earlier writes
  // never reach this code through the durable application write claim.
  if(a.fingerprint&&!a.paint.removed&&paintState(a.paint)!==a.fingerprint){unrestored.push(a.paint.id);continue;}
  if(!a.paint.removed)a.paint.remove();
  if(a.host.fills.length===0)a.host.fills=copy(a.fills);
 }catch{unrestored.push(a.host.id);}
 if(allocationAttempted)try{
  const restored=await(async()=>{${emitNativeContractReadbackScript(plan.before)}})();
  if(inspect(plan,restored,false).length)throw Error('remaining-background');
 }catch{unrestored.push('independent-rollback-observation');}
 out.status=unrestored.length?'recovery-required':allocationAttempted?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
