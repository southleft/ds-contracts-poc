import type {DumpSet,DumpHostOverride,DumpNode} from '../extract/figma/types.js';
import {revisionOf} from './contract-provenance.js';
import {walkAnatomy,type Contract} from '../scripts/contract-schema.js';
export type VisibilityDemand={fileKey:string;target:NonNullable<DumpHostOverride['visibilityTarget']>};
export type VisibilityBinding={fileKey:string;setKey:string;componentId:string;childPath:number[];prop:string;contractRevision:string};
export function visibilityDemandsFromDumps(dump:Record<string,unknown>,fileKey:string):VisibilityDemand[]{
 const out:VisibilityDemand[]=[];const visit=(node:DumpNode)=>{for(const h of node.hostOverrides??[])if(h.visibilityTarget&&!h.visibilityTarget.instancePath.length)out.push({fileKey,target:h.visibilityTarget});for(const child of node.children??[])visit(child);};
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);
 return out;
}
export function demandedVisibilityNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly VisibilityDemand[]):Map<string,VisibilityDemand[]> {
 const nodes=new Map<string,VisibilityDemand[]>();
 for(const demand of demands){const t=demand.target,variant=set.variants.find(v=>v.nodeId===t.componentId);if(!variant)continue;
  if(set.contractId||!fileKey||fileKey!==demand.fileKey||!set.key||t.instancePath.length||!t.childPath.length||!t.childPath.every(n=>Number.isInteger(n)&&n>=0))throw Error('visibility-demand-source-identity-unqualified');
  let node:DumpNode|undefined=variant;for(const i of t.childPath){if(node?.type==='INSTANCE')throw Error('visibility-demand-crosses-instance-owner');node=node?.children?.[i];}
  if(!node?.nodeId||typeof t.visible!=='boolean'||t.nodeId!==`I${t.instanceId};${node.nodeId}`)throw Error('visibility-demand-source-target-unqualified');
  nodes.set(node.nodeId,[...nodes.get(node.nodeId)??[],demand]);
 }
 return nodes;
}
export function visibilityBindingMatches(binding:VisibilityBinding,child:Contract,fileKey:string|undefined|null,target:NonNullable<DumpHostOverride['visibilityTarget']>):boolean {
 return !!fileKey&&binding.fileKey===fileKey&&child.bindings.figma.anchors.fileKey===fileKey&&binding.setKey===child.bindings.figma.anchors.componentSetKey&&binding.componentId===target.componentId&&target.instancePath.length===0&&JSON.stringify(binding.childPath)===JSON.stringify(target.childPath)&&binding.contractRevision===revisionOf(child)&&walkAnatomy(child).filter(w=>w.part.visibilityOverrideProp===binding.prop).length===1;
}
