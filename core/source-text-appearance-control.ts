import type {DumpNode,DumpSet} from '../extract/figma/types.js';
import {observeTextAppearance,type TextAppearanceObservation} from '../extract/figma/text-appearance-observation.js';
import {canonicalJson} from './contract-provenance.js';

export type QualifiedTextAppearance=Extract<TextAppearanceObservation,{runs:unknown}>;
export interface SourceTextAppearanceDemand {
 fileKey:string;setKey:string;componentId:string;instanceId:string;
 sourceNodeId:string;instanceNodeId:string;childPath:number[];
 appearance:QualifiedTextAppearance;
}
/** Revalidate serialized observations; a typed field alone is not evidence. */
export function inspectTextAppearance(value:unknown):QualifiedTextAppearance {
 return inspectAppearance(value,2);
}
/** Complete authored partitions do not widen the public caller override. */
export function inspectAuthoredTextAppearance(value:unknown):QualifiedTextAppearance {
 return inspectAppearance(value,1);
}
function inspectAppearance(value:unknown,minimumRuns:number):QualifiedTextAppearance {
 const v=value as QualifiedTextAppearance|undefined;
 if(!v||typeof v.characters!=='string'||!Array.isArray(v.runs)||v.runs.length<minimumRuns||v.runs.length>256||v.runs.some(r=>!r||typeof r!=='object'))throw Error('text-appearance-observation-unqualified');
 const segments=v.runs.map(r=>({...r,characters:v.characters.slice(r.start,r.end),fills:r.fill&&'paint'in r.fill?[{
  type:'SOLID',...r.fill.paint,...(r.fill.variableId?{boundVariables:{color:{type:'VARIABLE_ALIAS',id:r.fill.variableId}}}:{})
 }]:undefined}));
 const checked=observeTextAppearance(v.characters,segments);
 if(!checked||'issue'in checked||canonicalJson(checked)!==canonicalJson(v))throw Error('text-appearance-observation-unqualified');
 return checked;
}

/** Numeric source paths and inherited IDs identify a direct child-owned TEXT.
 * A descendant behind another instance must be qualified by that owner. */
export function qualifySourceTextAppearance(set:DumpSet,instance:DumpNode,childPath:readonly number[],fileKey:string):SourceTextAppearanceDemand {
 const fail=(reason:string):never=>{throw Error('text-appearance-demand-'+reason);};
 const g=instance.instanceGeometry,key=instance.instanceSetKey??instance.instanceKey;
 if(!fileKey||set.contractId||!set.key||set.key!==key||instance.type!=='INSTANCE'||!instance.nodeId||g?.nodeId!==instance.nodeId||!g.componentId||
  !instance.instanceContent?.root||instance.instanceContent.root.nodeId!==instance.nodeId||!childPath.length||childPath.length>32||!childPath.every(i=>Number.isInteger(i)&&i>=0))fail('source-identity-unqualified');
 const mains=set.variants.filter(v=>v.nodeId===g!.componentId);
 if(mains.length!==1)fail('main-ambiguous-or-missing');
 if(!instance.instanceKey||mains[0].componentKey!==instance.instanceKey)fail('main-key-unqualified');
 let source:DumpNode|undefined=mains[0],observed:DumpNode|undefined=instance.instanceContent!.root;
 for(const index of childPath){
  if(source?.type==='INSTANCE'||observed?.type==='INSTANCE')fail('crosses-instance-owner');
  source=source?.children?.[index];observed=observed?.children?.[index];
  if(!source?.nodeId||!observed?.nodeId||observed.nodeId!==`I${instance.nodeId};${source.nodeId}`||source.type!==observed.type)fail('target-identity-unqualified');
 }
 if(source?.type!=='TEXT'||observed?.type!=='TEXT'||source.children?.length||observed.children?.length||!source.text||!observed.text)fail('target-kind-unqualified');
 const appearance=inspectTextAppearance(observed!.text!.sourceAppearance);
 if(appearance.characters!==observed!.text!.characters)fail('characters-mismatch');
 return {fileKey,setKey:set.key!,componentId:g!.componentId,instanceId:instance.nodeId!,sourceNodeId:source!.nodeId!,instanceNodeId:observed!.nodeId!,childPath:[...childPath],appearance};
}

export function textAppearanceDemandsFromDumps(dump:Record<string,unknown>,fileKey:string){
 const sets=Object.values(dump).filter((v):v is DumpSet=>!!v&&typeof v==='object'&&Array.isArray((v as DumpSet).variants));
 const demands:SourceTextAppearanceDemand[]=[],notes:string[]=[];
 const hasAppearance=(n:DumpNode):boolean=>!!n.text?.sourceAppearance||!!n.children?.some(hasAppearance);
 const visit=(instance:DumpNode)=>{
  if(instance.type==='INSTANCE'&&instance.instanceContent?.root&&hasAppearance(instance.instanceContent.root)){
   const mains=sets.filter(s=>s.key===(instance.instanceSetKey??instance.instanceKey)&&s.variants.some(v=>v.nodeId===instance.instanceGeometry?.componentId));
   if(mains.length!==1)notes.push(`${instance.nodeId}: text-appearance-demand-main-ambiguous-or-missing`);
   else {
    const set=mains[0],main=set.variants.find(v=>v.nodeId===instance.instanceGeometry?.componentId)!;
    const scan=(source:DumpNode|undefined,observed:DumpNode,path:number[])=>{
     if(path.length&&(source?.type==='INSTANCE'||observed.type==='INSTANCE')){if(hasAppearance(observed))notes.push(`${instance.nodeId}:${path.join('.')}: text-appearance-demand-crosses-instance-owner`);return;}
     if(observed.text?.sourceAppearance&&(!('runs'in observed.text.sourceAppearance)||observed.text.sourceAppearance.runs.length>=2)&&canonicalJson(observed.text.sourceAppearance)!==canonicalJson(source?.text?.sourceAppearance)){
      try{demands.push(qualifySourceTextAppearance(set,instance,path,fileKey));}
      catch(error){notes.push(`${instance.nodeId}:${path.join('.')}: ${error instanceof Error?error.message:String(error)}`);}
     }
     observed.children?.forEach((child,i)=>scan(source?.children?.[i],child,[...path,i]));
    };scan(main,instance.instanceContent.root,[]);
   }
  }
  instance.children?.forEach(visit);
 };
 sets.forEach(s=>s.variants.forEach(visit));return {demands,notes};
}

export interface SourceTextAppearanceInput {
 owner:Pick<SourceTextAppearanceDemand,'fileKey'|'setKey'|'componentId'|'sourceNodeId'|'childPath'>;
 choices:Array<{value:string;appearance:QualifiedTextAppearance}>;
 callers:Array<{instanceId:string;instanceNodeId:string;value:string}>;
}
/** Omission retains the child main. The entire text is part of choice identity;
 * no ranges are transferred onto a caller's different string. */
export function sourceTextAppearanceInput(demands:readonly SourceTextAppearanceDemand[]):SourceTextAppearanceInput {
 if(!demands.length||demands.length>256)throw Error('text-appearance-input-budget');
 const ownerOf=(d:SourceTextAppearanceDemand)=>({fileKey:d.fileKey,setKey:d.setKey,componentId:d.componentId,sourceNodeId:d.sourceNodeId,childPath:[...d.childPath]});
 const owner=ownerOf(demands[0]),signature=canonicalJson(owner);
 if(!owner.fileKey||!owner.setKey||!owner.componentId||!owner.sourceNodeId||!owner.childPath.length||owner.childPath.length>32||!owner.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('text-appearance-input-owner-unqualified');
 const observations=demands.map(d=>{if(canonicalJson(ownerOf(d))!==signature||!d.instanceId||d.instanceNodeId!==`I${d.instanceId};${owner.sourceNodeId}`)throw Error('text-appearance-input-owner-unqualified');return inspectTextAppearance(d.appearance);});
 const unique=new Map(observations.map(o=>[canonicalJson(o),o]));
 if(unique.size>32)throw Error('text-appearance-input-choice-budget');
 const choices=[...unique].sort(([a],[b])=>a.localeCompare(b)).map(([key,appearance],i)=>({key,value:`text${i+1}`,appearance}));
 const values=new Map(choices.map(c=>[c.key,c.value])),callers=new Map<string,SourceTextAppearanceInput['callers'][number]>();
 demands.forEach((d,i)=>{const value=values.get(canonicalJson(observations[i]))!,prior=callers.get(d.instanceId);if(prior&&prior.value!==value)throw Error('text-appearance-input-conflicting-caller');callers.set(d.instanceId,{instanceId:d.instanceId,instanceNodeId:d.instanceNodeId,value});});
 return {owner,choices:choices.map(({key,...choice})=>choice),callers:[...callers.values()].sort((a,b)=>a.instanceId.localeCompare(b.instanceId))};
}
export function selectSourceTextAppearance(input:SourceTextAppearanceInput,value:unknown,characters:string){
 if(value===undefined)return undefined;
 const selected=input.choices.find(choice=>choice.value===value);
 if(!selected||selected.appearance.characters!==characters)throw Error('text-appearance-input-value-or-characters-unqualified');
 return inspectTextAppearance(selected.appearance);
}

export interface SourceTextAppearanceBinding {prop:string;contractRevision:string;input:SourceTextAppearanceInput}
/** Bind discoveries to the exact main before assigning an anatomy control. */
export function demandedTextAppearanceNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly SourceTextAppearanceDemand[]){
 const out=new Map<string,SourceTextAppearanceDemand[]>();
 for(const demand of demands){
  const mains=set.variants.filter(v=>v.nodeId===demand.componentId);if(!mains.length)continue;
  if(mains.length!==1||set.contractId||!fileKey||fileKey!==demand.fileKey||set.key!==demand.setKey||!demand.childPath.length||!demand.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('text-appearance-demand-main-identity-unqualified');
  let node:DumpNode|undefined=mains[0];for(const i of demand.childPath){if(node?.type==='INSTANCE')throw Error('text-appearance-demand-crosses-instance-owner');node=node?.children?.[i];}
  if(!node?.nodeId||node.nodeId!==demand.sourceNodeId||node.type!=='TEXT'||!node.text||node.children?.length||demand.instanceNodeId!==`I${demand.instanceId};${node.nodeId}`)throw Error('text-appearance-demand-main-target-unqualified');
  inspectTextAppearance(demand.appearance);
  out.set(node.nodeId,[...out.get(node.nodeId)??[],demand]);
 }
 return out;
}
