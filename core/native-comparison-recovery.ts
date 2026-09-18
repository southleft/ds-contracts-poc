/** Bounded continuation of an empty comparison stopped at caller sizing.
 * This is independent preflight evidence, never a rewritten creation receipt. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { nativeComparisonDependencies } from './native-contract-comparison.js';
import type { NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import { emitNativeContractReadbackScript, emitNativeInventoryReadbackScript, verifyNativeContractReadback } from './native-source-observation.js';
import { verifyNativeTokenContextReceipt } from './native-token-context.js';

type Row = Record<string, any>;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const fail = (reason: string): never => { throw Error('native-comparison-recovery-' + reason); };
export type NativeComparisonRecoveryInput = NativeContractComparisonObservationInput;
function checkInput(input: NativeComparisonRecoveryInput) {
  const {creation:c,comparison:p}=input, record=c?.comparisons?.[0];
  if (!c || c.status!=='partial-or-unknown-allocation' || c.allocationAttempted!==true ||
      c.operationId!==input.operation.id || c.fileKey!==input.operation.fileKey || c.target!==null ||
      c.acceptedContract!==null || c.nativeQualification!=='unqualified' ||
      !same(c.problems,['native-source-write-comparison-instance-width-refused']) ||
      !Array.isArray(c.nodes) || c.nodes.length!==4 || new Set(c.nodes.map((n:Row)=>n.id)).size!==4 ||
      c.comparisons.length!==1 || record.status!=='building' || record.id!==p.caseId || record.mainId!==p.mainId ||
      !same(record.slots,[]) || (record.nested?.length??0)!==0 ||
      !same(record.sourceParts?.map((n:Row)=>n.specPath),[[],p.slotSpecPath]) ||
      record.sourceParts[0].nodeId!==record.instanceId || !same(p.slotSpecPath,[0]) || p.contentSpecPath ||
      !Number.isFinite(p.instanceWidth) || p.instanceWidth! <= 0 ||
      input.operation.id===p.parent.operation.id || input.operation.fileKey!==p.parent.operation.fileKey ||
      input.tokenInput.scopeId!=='source-'+input.operation.id || input.tokenInput.fileKey!==input.operation.fileKey ||
      !/^sha256:[a-f0-9]{64}$/.test(input.planRevision) ||
      verifyNativeContractReadback(p.parent,p.receipt).status!=='supported-structure-observed') fail('input-unqualified');
  const expected=[[c.pageId,'PAGE'],[c.comparisonBoardId,'FRAME'],[record.instanceId,'INSTANCE'],[record.sourceParts[1].nodeId,'SLOT']];
  if(!same(c.nodes.map((n:Row)=>[n.id,n.type]),expected) || expected.some(([id])=>typeof id!=='string'||!id)) fail('allocation-unqualified');
  return record;
}
export function emitNativeComparisonRecoveryReadbackScript(input:NativeComparisonRecoveryInput):string {
  checkInput(input);
  const parents=[{parent:input.comparison.parent},...nativeComparisonDependencies(input.comparison).parents];
  const scripts=parents.map(p=>emitNativeContractReadbackScript(p.parent));
  const inventory=emitNativeInventoryReadbackScript({operation:input.operation,planRevision:input.planRevision,
    pageId:input.creation.pageId,nodes:input.creation.nodes,comparisons:[]},input.tokenInput,input.tokenIdentity,
    ['nativeContractPart','nativeContractSample','nativeContractCase','nativeComparisonRecoveryClaim','fontWeightVar','lineHeightVar']);
  return `// GENERATED independent partial comparison preflight. READ ONLY.
const readers=[${scripts.map(s=>`async()=>{${s}}`).join(',')}];
const before=[]; for(const read of readers) before.push(await read());
const content=await(async()=>{${inventory}})();
const after=[]; for(const read of readers) after.push(await read());
return {version:1,status:JSON.stringify(before)===JSON.stringify(after)?'partial-comparison-observed':'refused',
 inputRevision:${JSON.stringify(revisionOf(input))},content,parents:after};`;
}
export function prepareNativeComparisonRecovery(input:NativeComparisonRecoveryInput, observation:unknown) {
  const record=checkInput(input),p=input.comparison,c=input.creation,r=observation as Row;
  const parents=[{parent:p.parent,receipt:p.receipt},...nativeComparisonDependencies(p).parents];
  if(!r || r.version!==1 || r.status!=='partial-comparison-observed' || r.inputRevision!==revisionOf(input) ||
      !Array.isArray(r.parents) || r.parents.length!==parents.length) fail('observation-invalid');
  parents.forEach((ref,i)=>{
    const observed=structuredClone(r.parents[i]);delete observed.images;
    if(!same(observed,ref.receipt) || verifyNativeContractReadback(ref.parent,r.parents[i]).status!=='supported-structure-observed') fail('dependency-changed');
  });
  const content=r.content;
  if(!content || content.status!=='native-readback-collected' || content.receiptKind!=='independent-native-component-readback' ||
      content.operationId!==input.operation.id || content.fileKey!==input.operation.fileKey || content.planRevision!==input.planRevision ||
      content.acceptedContract!==null || content.nativeQualification!=='unqualified' || !same(content.problems,[]) ||
      !same(content.images,[]) || !Array.isArray(content.nodes) || content.nodes.length!==4 ||
      content.tokens?.status!=='readback-collected' ||
      verifyNativeTokenContextReceipt({input:input.tokenInput,expectedIdentity:input.tokenIdentity,receipt:content.tokens.receipt}).status!=='native-token-context-observed') fail('inventory-invalid');
  const nodes=new Map<string,Row>(content.nodes.map((n:Row)=>[n.id,n]));
  const owner={version:1,operationId:input.operation.id,sourceContractId:p.projection.contractId,
    sourceContractRevision:p.projection.contractRevision,tokenPreparationRevision:input.tokenIdentity.preparationRevision,acceptedContract:null};
  const meta=(n:Row,key:string)=>{try{return JSON.parse(n.metadata[key]);}catch{return undefined;}};
  for(const allocated of c.nodes){
    const n=nodes.get(allocated.id);
    if(!n || n.type!==allocated.type || !same(meta(n,'nativeSourceOperation'),owner) ||
        n.metadata.nativeSourceAllocation!==n.id || n.metadata.nativeComparisonRecoveryClaim ||
        n.metadata.nativeContractCase || n.metadata.nativeContractSample) fail('ownership-changed');
  }
  const page=nodes.get(c.pageId)!,board=nodes.get(c.comparisonBoardId)!,instance=nodes.get(record.instanceId)!,slot=nodes.get(record.sourceParts[1].nodeId)!;
  if(!same(page.childIds,[board.id]) || board.parentId!==page.id || !same(board.childIds,[instance.id]) ||
      instance.parentId!==board.id || !same(instance.childIds,[slot.id]) || slot.parentId!==instance.id || !same(slot.childIds,[]) ||
      instance.mainId!==p.mainId || instance.name!==p.caseId || board.name!=='Observed caller content' ||
      page.name!==`DS contract draft / ${input.operation.id}`) fail('topology-changed');
  for(const [field,value] of Object.entries({layoutMode:'VERTICAL',primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'AUTO',
    fills:[],strokes:[],effects:[],opacity:1,visible:true,itemSpacing:0,paddingTop:0,paddingBottom:0,paddingLeft:0,paddingRight:0}))
    if(!same(board.values[field],value)) fail('board-changed');
  const main=p.receipt.nodes!.find(n=>n.id===p.mainId)!;
  const originalSlot=p.receipt.nodes!.find(n=>n.id===main.childIds[0])!;
  if(main.childIds.length!==1 || !originalSlot || originalSlot.type!=='SLOT' || originalSlot.childIds.length) fail('main-unqualified');
  for(const [original,actual,root] of [[main,instance,true],[originalSlot,slot,false]] as const){
    if(!same(meta(actual,'nativeContractPart'),meta(original,'nativeContractPart'))) fail('part-changed');
    const ignore=new Set(['x','y','relativeTransform','resolvedVariableModes','explicitVariableModes']);
    if(root){ignore.add('counterAxisSizingMode');ignore.add('layoutSizingHorizontal');ignore.add('componentPropertyReferences');}
    for(const field of new Set([...Object.keys(original.values),...Object.keys(actual.values)]))
      if(!ignore.has(field) && !same(actual.values[field],original.values[field])) fail('instance-'+field+'-changed');
    const expectedModes=root?{...original.values.explicitVariableModes,[input.tokenIdentity.collection.id]:input.tokenIdentity.modes[0].modeId}:original.values.explicitVariableModes;
    if(!same(actual.values.explicitVariableModes,expectedModes)) fail('modes-changed');
  }
  if(instance.values.layoutMode!=='VERTICAL' || instance.values.counterAxisSizingMode!=='FIXED' ||
      instance.values.layoutSizingHorizontal!=='FIXED' || ![null,'{}'].includes(instance.values.componentPropertyReferences===null?null:canonicalJson(instance.values.componentPropertyReferences))) fail('instance-sizing-changed');
  for(const [key,value] of Object.entries(main.variantProperties??{}))
    if(instance.componentProperties?.[key]?.type!=='VARIANT' || instance.componentProperties[key].value!==value) fail('variant-changed');
  return {input:structuredClone(input),observation:structuredClone(observation),revision:revisionOf({input,observation})};
}
export type PreparedNativeComparisonRecovery=ReturnType<typeof prepareNativeComparisonRecovery>;
