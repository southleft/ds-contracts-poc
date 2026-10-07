import type {SourceImageDemand} from './source-image-control.js';
import {nativeImageFill, type NativeImageFill} from './native-image-fill.js';

export interface SourceImageInput {
  owner:{fileKey:string;setKey:string;componentId:string;sourceNodeId:string;childPath:number[]};
  choices:Array<{value:string;image:string;declared:Record<string,string>;native:NativeImageFill}>;
  callers:Array<{instanceId:string;instanceNodeId:string;value:string}>;
}
/** Finite source-observed image choices. Omission means no override, never the
 * first choice. Crop geometry is part of choice identity, not just asset hash. */
export function sourceImageInput(demands:readonly SourceImageDemand[]):SourceImageInput {
  const first=demands[0];if(!first)throw Error('image-input-empty');
  const ownerOf=(d:SourceImageDemand)=>({fileKey:d.fileKey,setKey:d.setKey,componentId:d.componentId,sourceNodeId:d.sourceNodeId,childPath:[...d.childPath]});
  const owner=ownerOf(first),signature=JSON.stringify(owner);
  if(demands.some(d=>JSON.stringify(ownerOf(d))!==signature))throw Error('image-input-mixed-source-owner');
  const identity=(d:SourceImageDemand)=>JSON.stringify([d.image,Object.entries(d.declared).sort(([a],[b])=>a.localeCompare(b))]);
  const unique=new Map(demands.map(d=>[identity(d),d]));
  const choices=[...unique].sort(([a],[b])=>a.localeCompare(b)).map(([key,d],i)=>({key,value:`image${i+1}`,image:d.image,declared:{...d.declared},native:nativeImageFill(d.image,d.declared)}));
  const byKey=new Map(choices.map(c=>[c.key,c.value]));
  const callers=new Map<string,{instanceId:string;instanceNodeId:string;value:string}>();
  for(const d of demands){
    const value=byKey.get(identity(d))!,key=JSON.stringify([d.instanceId,d.instanceNodeId]),prior=callers.get(key);
    if(prior&&prior.value!==value)throw Error('image-input-conflicting-caller');
    callers.set(key,{instanceId:d.instanceId,instanceNodeId:d.instanceNodeId,value});
  }
  return {owner,choices:choices.map(({key,...choice})=>choice),callers:[...callers.values()].sort((a,b)=>a.instanceId.localeCompare(b.instanceId))};
}

export function selectSourceImage(input:SourceImageInput,value:unknown){
  if(value===undefined)return undefined;
  if(typeof value!=='string')throw Error('image-input-value-unqualified');
  const choice=input.choices.find(c=>c.value===value);
  if(!choice)throw Error('image-input-value-unqualified');
  return structuredClone(choice);
}

export interface SourceImageBinding {prop:string;contractRevision:string;input:SourceImageInput}
