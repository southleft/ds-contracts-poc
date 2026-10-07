import type {DumpSet,DumpNode} from '../extract/figma/types.js';
import {revisionOf} from './contract-provenance.js';
import {walkAnatomy,type Contract} from '../scripts/contract-schema.js';
type Target=NonNullable<DumpNode['textOverrideTargets']>[string];
/** forwardTarget links a fixed instance input to its independently qualified leaf. */
export type CharacterDemand={fileKey:string;target:Target;forwardTarget?:Target};
export type CharacterBinding={fileKey:string;setKey:string;componentId:string;childPath:number[];prop:string;contractRevision:string;forwarded?:boolean};
export function characterDemandsFromDumps(dump:Record<string,unknown>,fileKey:string):CharacterDemand[]{
 const out:CharacterDemand[]=[];
 const visit=(n:DumpNode)=>{for(const [path,target] of Object.entries(n.textOverrideTargets??{}))
  if(typeof n.textOverrides?.[path]==='string'&&!target.instancePath.length)out.push({fileKey,target});
  for(const child of n.children??[])visit(child);};
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);
 for(const route of nestedCharacterRoutes(dump)){
  out.push({fileKey,target:route.target});
  if(!route.slotProperty)out.push({fileKey,target:route.ownerTarget,forwardTarget:route.target});
 }
 return out;
}
export function demandedCharacterNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly CharacterDemand[]):Map<string,CharacterDemand[]>{
 const out=new Map<string,CharacterDemand[]>();
 for(const d of demands){const t=d.target,variant=set.variants.find(v=>v.nodeId===t.componentId);if(!variant)continue;
  if(set.contractId||!fileKey||fileKey!==d.fileKey||!set.key||t.instancePath.length||!t.childPath.length||!t.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('character-demand-source-identity-unqualified');
  let n:DumpNode|undefined=variant;for(const i of t.childPath){if(n?.type==='INSTANCE')throw Error('character-demand-crosses-instance-owner');n=n?.children?.[i];}
  if(!n?.nodeId||(d.forwardTarget ? n.type!=='INSTANCE'||n.instanceGeometry?.componentId!==d.forwardTarget.componentId||n.nodeId!==d.forwardTarget.instanceId : n.type!=='TEXT'||typeof n.text?.characters!=='string')||t.nodeId!==`I${t.instanceId};${n.nodeId}`)throw Error('character-demand-source-target-unqualified');
  out.set(n.nodeId,[...(out.get(n.nodeId)??[]),d]);
 }return out;
}
export function characterBindingMatches(b:CharacterBinding,c:Contract,fileKey:string|null|undefined,t:Target):boolean{
 return !!fileKey&&b.fileKey===fileKey&&c.bindings.figma.anchors.fileKey===fileKey&&b.setKey===c.bindings.figma.anchors.componentSetKey&&b.componentId===t.componentId&&!t.instancePath.length&&JSON.stringify(b.childPath)===JSON.stringify(t.childPath)&&b.contractRevision===revisionOf(c)&&c.props.some(p=>p.name===b.prop&&p.type==='text'&&p.bindings.figma.kind==='TEXT')&&walkAnatomy(c).filter(w=>b.forwarded ? Object.values(w.part.component?.props??{}).some(v=>v==='{'+b.prop+'}') : w.part.content?.prop===b.prop).length===1;
}

export type NestedCharacterRoute={hostId:string;path:string;ownerKey:string;ownerMain:string;slotProperty?:string;targetKey:string;target:Target;ownerTarget:Target};
/** Resolve one captured instance boundary by numeric paths and source keys.
 * A fixed intermediate becomes a generated text input; swap slots keep their
 * existing caller-content route. Uncaptured intermediates stay unqualified. */
export function nestedCharacterRoutes(dump:Record<string,unknown>):NestedCharacterRoute[]{
 const mains=new Map<string,{set:DumpSet;node:DumpNode}>();
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants)){
  const set=value as DumpSet;for(const node of set.variants)if(node.nodeId)mains.set(node.nodeId,{set,node});
 }
 const routes:NestedCharacterRoute[]=[];
 const visit=(n:DumpNode)=>{
  const ownerId=n.instanceGeometry?.componentId,owner=ownerId&&mains.get(ownerId);
  for(const [path,t]of Object.entries(n.textOverrideTargets??{})){
   if(!n.nodeId||!owner||!owner.set.key||owner.set.contractId||owner.set.key!==(n.instanceSetKey??n.instanceKey)||typeof n.textOverrides?.[path]!=='string'||!t.instancePath.length||!t.instancePath.every(i=>Number.isSafeInteger(i)&&i>=0))continue;
   let inner:DumpNode|undefined=owner.node;
   for(const i of t.instancePath){if(inner?.type==='INSTANCE'){inner=undefined;break;}inner=inner?.children?.[i];}
   const leaf=mains.get(t.componentId),property=inner?.propRefs?.mainComponent;
   if(!inner?.nodeId||inner.type!=='INSTANCE'||!leaf?.set.key||leaf.set.contractId||t.instanceId!==`I${n.nodeId};${inner.nodeId}`||!t.childPath.length||!t.childPath.every(i=>Number.isSafeInteger(i)&&i>=0))continue;
   const swap=property?n.fixedSwaps?.[property]:undefined;
   const drawn=swap?.observedInstances;
   const selected=swap?.id===t.componentId&&swap.key===leaf.set.key&&drawn?.length===1&&
    drawn[0].nodeId===t.instanceId&&drawn[0].componentId===t.componentId&&JSON.stringify(drawn[0].path)===JSON.stringify(t.instancePath);
   const original=inner.instanceGeometry?.componentId===t.componentId&&leaf.set.key===(inner.instanceSetKey??inner.instanceKey)&&
    (!swap||(swap.id===t.componentId&&swap.key===leaf.set.key));
   if(!original&&!selected)continue;
   let text:DumpNode|undefined=leaf.node;
   for(const i of t.childPath){if(text?.type==='INSTANCE'){text=undefined;break;}text=text?.children?.[i];}
   if(text?.type!=='TEXT'||!text.nodeId||typeof text.text?.characters!=='string'||t.nodeId!==`${t.instanceId};${text.nodeId}`)continue;
   routes.push({hostId:n.nodeId,path,ownerKey:owner.set.key,ownerMain:ownerId!,slotProperty:property,targetKey:leaf.set.key,
    ownerTarget:{nodeId:`I${n.nodeId};${inner.nodeId}`,instanceId:n.nodeId,componentId:ownerId!,instancePath:[],childPath:t.instancePath},
    target:{...t,instancePath:[],instanceId:inner.nodeId,nodeId:`I${inner.nodeId};${text.nodeId}`}});
  }
  for(const c of n.children??[])visit(c);
 };
 for(const value of Object.values(dump))if(value&&typeof value==='object'&&Array.isArray((value as DumpSet).variants))for(const v of (value as DumpSet).variants)visit(v);
 return routes;
}
