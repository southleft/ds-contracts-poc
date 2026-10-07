import type {DumpHostOverride} from '../types.js';
import type {RestNode} from './map.js';

/** Read the actual nested usage, never its display name or main's defaults. */
export function nestedInstanceProperties(root:RestNode,targetId:string,
 components:ReadonlyMap<string,{key?:string;componentSetId?:string}>,
 sets:ReadonlyMap<string,{key?:string}>):DumpHostOverride['instanceProperties'] {
 if(root.type!=='INSTANCE'||!root.componentId||targetId===root.id)return;
 const owner=components.get(root.componentId);if(!owner?.key)return;
 const hits:Array<{node:RestNode;path:number[]}>=[];let visited=0,incomplete=false;
 const visit=(node:RestNode,path:number[])=>{
  if(++visited>1000||path.length>8){incomplete=true;return;}
  if(node.id===targetId)hits.push({node,path});
  for(const [i,c]of(node.children??[]).entries())visit(c,[...path,i]);
 };
 visit(root,[]);if(incomplete||hits.length!==1)return;
 const {node,path}=hits[0];if(node.type!=='INSTANCE'||!node.componentId||!node.componentProperties)return;
 const main=components.get(node.componentId);if(!main?.key)return;
 const setKey=main.componentSetId?sets.get(main.componentSetId)?.key:undefined;
 if(main.componentSetId&&!setKey)return;
 const properties:NonNullable<DumpHostOverride['instanceProperties']>['properties']={};
 for(const [name,p]of Object.entries(node.componentProperties)){
  const type=p.type,value=p.value;
  if(type!=='VARIANT'&&type!=='TEXT'&&type!=='BOOLEAN'&&type!=='INSTANCE_SWAP')return;
  if(type==='BOOLEAN'?typeof value!=='boolean':typeof value!=='string')return;
  if(typeof value!=='string'&&typeof value!=='boolean')return;
  const property:typeof properties[string]={type,value};
  if(type==='INSTANCE_SWAP'){
   const selected=typeof value==='string'?components.get(value):undefined;
   if(!selected?.key||typeof value!=='string')return;
   property.selected={nodeId:value,componentKey:selected.key};
  }
  properties[name]=property;
 }
 return {ownerId:root.id,ownerComponentId:root.componentId,ownerComponentKey:owner.key,
  nodeId:node.id,componentId:node.componentId,componentKey:main.key,
  ...(setKey?{componentSetKey:setKey}:{}),path,properties};
}
