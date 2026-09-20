/** Pure planning for one owned variable driving fixed flex cross-axis roots.
 * Native dispatch must additionally establish
 * the complete document consumer scope and synchronously recheck all facts. */
import {canonicalJson, revisionOf} from './contract-provenance.js';
import {flattenTokens} from './tokens.js';
import {prepareNativeTokenContext, setNativeTokenLeafValue} from './native-token-context.js';
import {verifyNativeContractReadback} from './native-source-observation.js';
import {predictNativeFixedCrossSize} from './native-fixed-cross-size.js';
import {nativeBoundCrossSizeObservationMatches, type NativeBoundCrossSizeObservationPlan} from './native-bound-cross-size-observation.js';
import type {NativeBoundCrossSizeScope} from './native-bound-cross-size-scope.js';
import {prepareNativeAbsoluteShapeUpdate, type NativeAbsoluteShapeUpdatePlan} from './native-contract-absolute-shape-update.js';
import type {NativeContractUpdateInput, NativeOpacityUpdatePlan} from './native-contract-update.js';

export interface NativeBoundCrossSizeUpdatePlan extends Omit<NativeOpacityUpdatePlan,'version'|'kind'|'changes'>,
  NativeBoundCrossSizeObservationPlan {
  version:9; kind:'native-contract-bound-cross-size-update';
  changes:NativeAbsoluteShapeUpdatePlan['changes'];
  scope:NativeBoundCrossSizeScope;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const copy=<T>(v:T):T=>structuredClone(v);
function fail(reason:string):never {throw Error('native-update-bound-cross-size-'+reason);}
function px(value:unknown):number {
  if(typeof value!=='string'||! /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value))fail('literal-pixel-token-required');
  const number=Number(value.slice(0,-2));if(!Number.isFinite(number)||number<0.01)fail('literal-pixel-token-required');
  return number;
}
function references(value:unknown,id:string):boolean {
  return Array.isArray(value)?value.some(v=>references(v,id)):!!value&&typeof value==='object'&&
    ((value as any).type==='VARIABLE_ALIAS'&&(value as any).id===id||Object.values(value).some(v=>references(v,id)));
}

export function prepareNativeBoundCrossSizeUpdate(input:NativeContractUpdateInput,
  prepareBase:(input:NativeContractUpdateInput)=>{plan:NativeOpacityUpdatePlan;revision:string}) {
  const sanitized=copy(input), roots:Array<{index:number;channel:'width'|'height';field:'fixedWidth'|'fixedHeight';name:string;before:number;after:number}>=[];
  input.before.component.variants.forEach((variant,index)=>{
    const next=input.desired.component.variants[index]?.spec;
    if(!next)return;
    for(const [channel,field] of [['width','fixedWidth'],['height','fixedHeight']] as const){
      const old=variant.spec[field],desired=next[field];
      if(same(old,desired))continue;
      // Unbound root sizes remain the existing literal-size writer's scope.
      // A mixed literal edit is left unsanitized for base validation to refuse.
      if(!old?.varName)continue;
      if(!desired||!same({...old,px:0},{...desired,px:0}))fail('binding-change-unsupported');
      roots.push({index,channel,field,name:old.varName,before:old.px,after:desired.px});
      sanitized.desired.component.variants[index].spec[field]={...copy(old),varName:old.varName};
    }
  });
  if(!roots.length)return null;
  const first=roots[0], before=input.before, identity=before.tokenIdentity;
  if(!before.fixedCrossSizeReadback||before.graphComponents||before.tokenInput.modes.length!==1||identity.modes.length!==1||
      roots.some(r=>r.channel!==first.channel||r.name!==first.name||r.before!==first.before||r.after!==first.after))
    fail('single-variable-mode-required');
  if(verifyNativeContractReadback(before,input.baseline).status!=='supported-structure-observed')fail('verified-layout-required');
  const prepared=prepareNativeTokenContext(before.tokenInput), variables=prepared.variables.filter(v=>v.name===first.name);
  if(variables.length!==1||variables[0].resolvedType!=='FLOAT')fail('variable-unavailable');
  const variable=variables[0], pinned=identity.variables.filter(v=>v.tokenPath===variable.tokenPath);
  if(pinned.length!==1||!before.tokenInput.tokenPaths.includes(variable.tokenPath))fail('variable-unavailable');
  const mode=before.tokenInput.modes[0], desiredModes=input.desired.tokenInput.modes;
  if(desiredModes.length!==1||!same({...mode,tokens:null,tokenTreeRevision:null},{...desiredModes[0],tokens:null,tokenTreeRevision:null}))
    fail('mode-change-unsupported');
  const oldLeaf=flattenTokens(mode.tokens).get(variable.tokenPath), newLeaf=flattenTokens(desiredModes[0].tokens).get(variable.tokenPath);
  if(!oldLeaf||!newLeaf||oldLeaf.type!=='dimension'||!same({...oldLeaf,value:null},{...newLeaf,value:null}))fail('dimension-token-required');
  const oldValue=px(oldLeaf.value),newValue=px(newLeaf.value);
  if(oldValue!==first.before||newValue!==first.after||Math.fround(oldValue)===Math.fround(newValue))fail('compiled-size-disagrees');
  setNativeTokenLeafValue(sanitized.desired.tokenInput.modes[0].tokens,variable.tokenPath,oldLeaf.value);
  sanitized.desired.tokenInput.modes[0].tokenTreeRevision=revisionOf(sanitized.desired.tokenInput.modes[0].tokens);
  const base=(prepareNativeAbsoluteShapeUpdate(sanitized,prepareBase)??prepareBase(sanitized)).plan;
  if(base.tokenChanges?.length||base.kind==='native-contract-opacity-update'&&base.changes.length)fail('mixed-channels');
  const ids=roots.map(r=>before.creation.variants[r.index].id), idSet=new Set(ids);
  if(idSet.size!==ids.length)fail('consumer-identity');
  const strict=new Set(before.fixedCrossSizeReadback.nodeIds),collectionId=identity.collection.id, modeId=identity.modes[0].modeId;
  for(const row of base.baseline.nodes!){
    const rest=copy(row);
    if(idSet.has(row.id)){
      if(row.type!=='COMPONENT'||!same(row.values.boundVariables?.[first.channel],{type:'VARIABLE_ALIAS',id:pinned[0].id})||
          row.values.resolvedVariableModes?.[collectionId]!==modeId||
          ![row.id,...row.childIds].every(id=>strict.has(id)))fail('consumer-baseline');
      delete rest.values.boundVariables[first.channel];
    }
    if(references(rest,pinned[0].id))fail('other-owned-binding');
  }
  if((base.baseline.tokens!.receipt!.variables as any[]).some(v=>references(v.valuesByMode,pinned[0].id)))fail('variable-alias');
  const observed=base.baseline.tokens!.receipt!.variables.find((v:any)=>v.id===pinned[0].id)?.valuesByMode[modeId];
  if(typeof observed!=='number'||observed!==oldValue&&observed!==Math.fround(oldValue))fail('variable-baseline');
  const nextTokens=copy(before.tokenInput), history=new Map((nextTokens.allocatedValues??[]).map(v=>[JSON.stringify([v.sourceMode,v.brand,v.tokenPath]),v]));
  const historyKey=JSON.stringify([mode.sourceMode,mode.brand,variable.tokenPath]);
  if(!history.has(historyKey))history.set(historyKey,{sourceMode:mode.sourceMode,brand:mode.brand,tokenPath:variable.tokenPath,value:oldLeaf.value});
  if(same(history.get(historyKey)!.value,newLeaf.value))history.delete(historyKey);
  setNativeTokenLeafValue(nextTokens.modes[0].tokens,variable.tokenPath,newLeaf.value);
  nextTokens.modes[0].tokenTreeRevision=revisionOf(nextTokens.modes[0].tokens);
  delete nextTokens.allocatedValues;delete nextTokens.allocatedValueProtocol;
  if(history.size)nextTokens.allocatedValues=[...history.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,row])=>row);
  if(nextTokens.allocatedValues?.some(row=>flattenTokens(nextTokens.modes[0].tokens).get(row.tokenPath)?.type==='dimension'))
    nextTokens.allocatedValueProtocol='px-dimension-v1';
  if(prepareNativeTokenContext(nextTokens).revision!==identity.preparationRevision)fail('allocation-identity-changed');
  const plan:NativeBoundCrossSizeUpdatePlan={version:9,kind:'native-contract-bound-cross-size-update',
    acceptedContract:null,nativeQualification:'unqualified',before:base.before,baseline:base.baseline,
    desiredRevision:base.desiredRevision,after:base.after,
    changes:base.kind==='native-contract-absolute-shape-update'?copy(base.changes):[],
    variable:{id:pinned[0].id,modeId,before:observed,after:newValue},
    scope:{variableId:pinned[0].id,collectionId,modeId,channel:first.channel,nodeIds:ids.slice().sort()},
    derived:ids.flatMap(id=>predictNativeFixedCrossSize(base.baseline.nodes!,id,first.channel,newValue)),
    absolute:base.kind==='native-contract-absolute-shape-update'?base.transitions.map(t=>({nodeId:t.nodeId,before:{...t.before},after:{...t.after}})):[],
    tokenChanges:[{tokenPath:variable.tokenPath,variableId:pinned[0].id,modeId,sourceMode:mode.sourceMode,brand:mode.brand,before:observed,after:newValue}],
    tokenBindingScope:'document-v1',
  };
  for(const t of plan.absolute)if(!idSet.has(plan.baseline.nodes!.find(n=>n.id===t.nodeId)!.parentId))fail('unrelated-absolute-change');
  plan.after.tokenInput=nextTokens;
  for(const root of roots){
    plan.after.component.variants[root.index].spec[root.field]={...copy(input.desired.component.variants[root.index].spec[root.field]!),varName:root.name};
    const id=before.creation.variants[root.index].id;
    plan.changes.push({nodeId:id,variant:before.component.variants[root.index].name,part:'Component',channel:root.channel,before:observed,after:Math.fround(newValue)});
  }
  const expected=copy(plan.baseline);
  for(const t of [...plan.derived,...plan.absolute])Object.assign(expected.nodes!.find(n=>n.id===t.nodeId)!.values,t.after);
  expected.tokens!.receipt!.variables.find((v:any)=>v.id===pinned[0].id)!.valuesByMode[modeId]=newValue;
  if(!nativeBoundCrossSizeObservationMatches(plan,expected,'after')||verifyNativeContractReadback(plan.after,expected).status!=='supported-structure-observed')
    fail('predicted-postcondition-unqualified');
  return {plan,revision:revisionOf(plan)};
}
