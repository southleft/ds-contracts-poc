import {emitNativeComparisonMigrationRepairScript,nativeComparisonMigrationRepairMatches} from './native-comparison-migration-repair.js';
/** Correct two known projection defects on existing linked, source-owned
 * instances. Expectations come from verified mains; unrelated edits refuse. */
import {canonicalJson,revisionOf} from './contract-provenance.js';
import {resolveNativeSlotIdentities,nativeSlotIdentityRuntime} from './native-slot-identity.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback,type NativeContractComparisonObservationInput} from './native-contract-comparison-observation.js';
type Row=Record<string,any>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail(s:string):never {throw Error('native-comparison-repair-'+s);}
const clean=(value:unknown):Row=>{const r=structuredClone(value) as Row;if(r?.content)r.content.images=[];return r;};
type Change={nodeId:string;kind:'height';before:number;after:number;variableId:string}|{nodeId:string;kind:'mode';collectionId:string;before:string}|{nodeId:string;kind:'comparison-clipping';before:true;after:false}|{nodeId:string;kind:'metadata';key:string;before:string;after:string};
export interface NativeComparisonRepairPlan {
  version:1|2|3;input:NativeContractComparisonObservationInput;before:Row;after:Row;changes:Change[];revision:string;migrationOriginalCreation?:Row;
}
/** The app-owned presentation frame is not part of the source component.
 * Restore only its neutral framing; never remove clipping inside a component. */
export function prepareNativeComparisonFrameRepair(input:NativeContractComparisonObservationInput,receipt:unknown):NativeComparisonRepairPlan {
  const before=clean(receipt),after=structuredClone(before);
  if(verifyNativeContractComparisonReadback(input,before).status!=='supported-comparison-structure-observed')fail('frame-observation-required');
  const board=after.content.nodes.find((n:Row)=>n.id===input.creation.comparisonBoardId),v=board?.values;
  // Two named framings: a hugging frame, or the caller's place pinned FIXED at
  // the plan's observed containing width (already verified by the reader above).
  const width=input.comparison.containerWidth;
  if(!board||board.type!=='FRAME'||board.name!=='Observed caller content'||v.clipsContent!==true||
      v.visible!==true||v.opacity!==1||v.layoutMode!=='VERTICAL'||v.primaryAxisSizingMode!=='AUTO'||v.counterAxisSizingMode!==(width===undefined?'AUTO':'FIXED')||
      ['fills','strokes','effects','reactions'].some(k=>v[k]?.length)||Object.keys(v.boundVariables??{}).length||Object.keys(v.explicitVariableModes??{}).length||
      ['itemSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'].some(k=>v[k]!==0)||
      ['minWidth','minHeight','maxWidth','maxHeight'].some(k=>v[k]!=null))fail('frame-context-unqualified');
  v.clipsContent=false;
  const plan={version:2 as const,input:structuredClone(input),before,after,
    changes:[{nodeId:board.id,kind:'comparison-clipping' as const,before:true as const,after:false as const}]};
  return {...plan,revision:revisionOf(plan)};
}
export function prepareNativeComparisonRepair(input:NativeContractComparisonObservationInput,receipt:unknown):NativeComparisonRepairPlan {
  if (input.comparison.textTemplate) fail('text-template-unqualified');
  const before=clean(receipt),after=structuredClone(before),p=input.comparison,c=input.creation;
  // The ordinary reader validates all source/main/token ownership after only
  // the specifically derived changes below. An arbitrary refused receipt is
  // never sufficient authority to repair its other differences.
  const rows=resolveNativeSlotIdentities(c,before.content?.nodes??[]);
  if(!rows)fail('allocation-unavailable');
  const nodes=new Map<string,Row>(rows.map(n=>[n.id,n]));
  const raw=new Map<string,Row>();
  for(const row of before.content.nodes) {
    const allocated=row.metadata.nativeSourceAllocation;
    if(raw.has(allocated))fail('allocation-ambiguous');raw.set(allocated,row);
  }
  const targets=new Map<string,Row>(after.content.nodes.map((n:Row)=>[n.id,n]));
  const changes:Change[]=[];
  for(const record of c.comparisons[0].nested??[]) {
    const ref=p.instances?.[record.index];if(ref?.contentMode!=='source-owned')continue;
    const originalNodes=new Map<string,Row>(ref.receipt.nodes!.map(n=>[n.id,n]));
    const main=originalNodes.get(ref.mainId)!,root=nodes.get(record.instanceId);
    if(!root||!main)fail('main-unavailable');
    const heightChanged=!same(root.values.height,main.values.height)||root.values.layoutSizingVertical!==main.values.layoutSizingVertical||!same(root.values.boundVariables?.height,main.values.boundVariables?.height);
    let delta=0;
    if(heightChanged){
      const host=nodes.get(root.parentId),binding=main.values.boundVariables?.height;
      if(!host||root.values.layoutMode!=='HORIZONTAL'||host.values.layoutMode!=='HORIZONTAL'||
          main.values.layoutSizingVertical!=='FIXED'||root.values.layoutSizingVertical!=='FILL'||
          root.values.boundVariables?.height||binding?.type!=='VARIABLE_ALIAS'||typeof binding.id!=='string'||
          !Number.isFinite(root.values.height)||!Number.isFinite(main.values.height)||main.values.height<=0||main.values.height>=root.values.height||
          !same(root.values.width,main.values.width)||host.values.layoutWrap&&host.values.layoutWrap!=='NO_WRAP'||
          !['MIN','CENTER','MAX'].includes(host.values.counterAxisAlignItems)||!['MIN','CENTER','MAX'].includes(root.values.counterAxisAlignItems)||
          root.values.y!==0||root.values.height!==host.values.height||
          ['paddingTop','paddingBottom'].some(k=>host.values[k]!==0)||
          ['strokeTopWeight','strokeBottomWeight'].some(k=>host.values.strokes?.length?host.values[k]!==0:host.values[k]!=null&&host.values[k]!==0)||
          !host.childIds.some((id:string)=>id!==root.id&&nodes.get(id)?.values.height===host.values.height))fail('height-context-unqualified');
      delta=root.values.height-main.values.height;
      const target=targets.get(raw.get(root.id)!.id)!;
      changes.push({nodeId:target.id,kind:'height',before:root.values.height,after:main.values.height,variableId:binding.id});
      target.values.height=main.values.height;target.values.layoutSizingVertical='FIXED';target.values.boundVariables.height=structuredClone(binding);
      const y=delta*(host.values.counterAxisAlignItems==='CENTER'?.5:host.values.counterAxisAlignItems==='MAX'?1:0);
      if(!same(root.values.relativeTransform,[[1,0,root.values.x],[0,1,root.values.y]]))fail('root-transform-unqualified');
      target.values.y=y;target.values.relativeTransform[1][2]=y;
    }
    for(const part of record.sourceParts){
      let original=main;for(const index of part.specPath)original=originalNodes.get(original.childIds[index])!;
      const actual=nodes.get(part.nodeId),live=raw.get(part.nodeId);
      if(!original||!actual||!live)fail('part-unavailable');
      const target=targets.get(live.id)!,modes=original.values.explicitVariableModes??{};
      const expected=part.specPath.length?modes:{...modes,[input.tokenIdentity.collection.id]:input.tokenIdentity.modes[0].modeId};
      if(!same(actual.values.explicitVariableModes??{},expected)){
        const collectionId=ref.parent.tokenIdentity.collection.id,mode=ref.parent.tokenIdentity.modes[0].modeId;
        if(!part.specPath.length||Object.hasOwn(expected,collectionId)||!same(actual.values.explicitVariableModes,{...expected,[collectionId]:mode}))fail('mode-context-unqualified');
        changes.push({nodeId:live.id,kind:'mode',collectionId,before:mode});target.values.explicitVariableModes=structuredClone(expected);
      }
      if(delta&&part.specPath.length){
        const adjustment=part.specPath.length===1&&original.values.layoutPositioning!=='ABSOLUTE'
          ?delta*(main.values.counterAxisAlignItems==='CENTER'?.5:main.values.counterAxisAlignItems==='MAX'?1:0):0;
        const expectedTransform=structuredClone(original.values.relativeTransform);expectedTransform[1][2]+=adjustment;
        if(!same(actual.values.x,original.values.x)||!same(actual.values.y,original.values.y+adjustment)||!same(actual.values.relativeTransform,expectedTransform))fail('descendant-geometry-unqualified');
        target.values.y=original.values.y;target.values.relativeTransform=structuredClone(original.values.relativeTransform);
      }
    }
  }
  if(!changes.length)fail('no-supported-correction');
  if(verifyNativeContractComparisonReadback(input,after).status!=='supported-comparison-structure-observed')fail('unrelated-differences');
  const plan={version:1 as const,input:structuredClone(input),before,after,changes};
  return {...plan,revision:revisionOf(plan)};
}
export function nativeComparisonRepairMatches(plan:NativeComparisonRepairPlan,receipt:unknown,complete=false){
  if(plan.version===3)return nativeComparisonMigrationRepairMatches(plan,receipt,complete);
  const normalize=(value:unknown)=>{const r=clean(value);const nodes=resolveNativeSlotIdentities(plan.input.creation,r.content?.nodes??[]);if(!nodes)fail('allocation-unavailable');r.content.nodes=nodes;return r;};
  try {const r=normalize(receipt);return same(r,normalize(plan.after))&&verifyNativeContractComparisonReadback(plan.input,receipt).status==='supported-comparison-structure-observed'||!complete&&same(r,normalize(plan.before));}
  catch{return false;}
}
export function emitNativeComparisonRepairScript(plan:NativeComparisonRepairPlan,readOnly=false):string {
  if(plan.version===3)return emitNativeComparisonMigrationRepairScript(plan,readOnly);
  if(!same((plan.version===2?prepareNativeComparisonFrameRepair:prepareNativeComparisonRepair)(plan.input,plan.before),plan))fail('plan-changed');
  return `// GENERATED guarded correction of existing linked instances. No allocation.
const plan=${JSON.stringify(plan)},readOnly=${readOnly};
const canonical=value=>JSON.stringify((function order(v){if(Array.isArray(v))return v.map(order);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])]));})(value));
const same=(a,b)=>canonical(a)===canonical(b);
const resolve=(()=>{const canonicalJson=canonical;${nativeSlotIdentityRuntime()};return resolveNativeSlotIdentities;})();
function normalize(value){const r=JSON.parse(JSON.stringify(value));r.content.images=[];const nodes=resolve(plan.input.creation,r.content.nodes);if(!nodes)throw Error('comparison-repair-allocation-unavailable');r.content.nodes=nodes;return r;}
const equivalent=(a,b)=>same(normalize(a),normalize(b));
async function read(){return await(async()=>{${emitNativeContractComparisonReadbackScript(plan.input)}})();}
const out={status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const attempted=[],targets=new Map(),variables=new Map(),collections=new Map();
function assign(change,back){const node=targets.get(change.nodeId);
 if(change.kind==='comparison-clipping')node.clipsContent=back?change.before:change.after;
 else if(change.kind==='height'){
   if(back){node.setBoundVariable('height',null);node.layoutSizingVertical='FILL';}
   else{node.layoutSizingVertical='FIXED';node.setBoundVariable('height',variables.get(change.variableId));}
 }else if(back)node.setExplicitVariableModeForCollection(collections.get(change.collectionId),change.before);
 else node.clearExplicitVariableModeForCollection(collections.get(change.collectionId));
}
try{
 if(figma.fileKey!==plan.input.operation.fileKey)throw Error('comparison-repair-file-changed');
 const candidate=await read();out.observation=candidate;
 if(!equivalent(candidate,plan.before)&&!equivalent(candidate,plan.after))throw Error('comparison-repair-preflight-changed');
 for(const change of plan.changes){
  const allocation=plan.before.content.nodes.find(n=>n.id===change.nodeId)?.metadata.nativeSourceAllocation;
  const matches=candidate.content.nodes.filter(n=>n.metadata.nativeSourceAllocation===allocation);
  if(!allocation||matches.length!==1)throw Error('comparison-repair-target-unavailable');
  const target=await figma.getNodeByIdAsync(matches[0].id);
  if(!target)throw Error('comparison-repair-target-unavailable');
  targets.set(change.nodeId,target);
  if(change.kind==='height')variables.set(change.variableId,await figma.variables.getVariableByIdAsync(change.variableId));
  else if(change.kind==='mode')collections.set(change.collectionId,await figma.variables.getVariableCollectionByIdAsync(change.collectionId));
 }
 const current=await read();
 out.observation=current;
 if(figma.fileKey!==plan.input.operation.fileKey||!same(current,candidate))throw Error('comparison-repair-preflight-changed');
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 if(equivalent(current,plan.after)){out.status='no-op';return out;}
 // All target and dependency reads finish before this synchronous mutation block.
 for(const change of plan.changes){attempted.push(change);assign(change,false);out.changes.push(targets.get(change.nodeId).id);}
 out.observation=await read();
 if(!equivalent(out.observation,plan.after))throw Error('comparison-repair-postcondition-changed');
 out.status='updated';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));
 const unrestored=[];
 for(const change of attempted.reverse())try{
   const node=targets.get(change.nodeId);
   if(change.kind==='comparison-clipping'){
     if(node.clipsContent!==change.before&&node.clipsContent!==change.after)throw Error('independent clipping edit');
   }else if(change.kind==='height'){
     const binding=node.boundVariables?.height,mode=node.layoutSizingVertical;
     if(![change.before,change.after].includes(node.height)||!['FIXED','FILL'].includes(mode)||binding&&!same(binding,{type:'VARIABLE_ALIAS',id:change.variableId}))throw Error('independent height edit');
   }else{const mode=node.explicitVariableModes?.[change.collectionId];if(mode!==undefined&&mode!==change.before)throw Error('independent mode edit');}
   assign(change,true);
 }catch{unrestored.push(change.nodeId);}
 if(attempted.length){try{out.observation=await read();if(!equivalent(out.observation,plan.before))unrestored.push('baseline');}catch{unrestored.push('observation');}}
 out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
