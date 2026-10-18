import type {DumpHostOverride} from '../types.js';
import type {RestNode} from './map.js';

/** Read the actual nested usage, never its display name or main's defaults. */
export function nestedInstanceProperties(root:RestNode,targetId:string,
 components:ReadonlyMap<string,{key?:string;componentSetId?:string}>,
 sets:ReadonlyMap<string,{key?:string}>):DumpHostOverride['instanceProperties'] {
 if(root.type!=='INSTANCE'||!root.componentId||targetId===root.id)return;
 const owner=components.get(root.componentId);if(!owner?.key)return;
 const hits:Array<{node:RestNode;parent:RestNode|null;path:number[]}>=[];let visited=0,incomplete=false;
 const visit=(node:RestNode,path:number[],parent:RestNode|null)=>{
  if(++visited>1000||path.length>8){incomplete=true;return;}
  if(node.id===targetId)hits.push({node,parent,path});
  for(const [i,c]of(node.children??[]).entries())visit(c,[...path,i],node);
 };
 visit(root,[],null);if(incomplete||hits.length!==1)return;
 const {node,parent,path}=hits[0];if(node.type!=='INSTANCE'||!node.componentId||!node.componentProperties)return;
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
 const layout=(()=>{
  const local=node.size,parentSize=parent?.size,matrix=node.relativeTransform;
  if(typeof parent?.id!=='string'||!parent.id||typeof node.id!=='string'||!node.id||parent.id===node.id||!['HORIZONTAL','VERTICAL'].includes(parent.layoutMode??'')||
    ![local?.x,local?.y,parentSize?.x,parentSize?.y].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>0)||
    !Array.isArray(matrix)||matrix.length!==2||Array.from({length:2},(_,i)=>Object.hasOwn(matrix,i)&&Array.isArray(matrix[i])&&matrix[i].length===3&&Array.from({length:3},(_,j)=>Object.hasOwn(matrix[i],j)&&typeof matrix[i][j]==='number'&&Number.isFinite(matrix[i][j])).every(Boolean)).some(ok=>!ok)||
    !['FIXED','HUG','FILL'].includes(node.layoutSizingHorizontal??'')||!['FIXED','HUG','FILL'].includes(node.layoutSizingVertical??'')||
    ![undefined,'AUTO','ABSOLUTE'].includes(node.layoutPositioning)||
    node.boundVariables!==undefined&&(!node.boundVariables||typeof node.boundVariables!=='object'||Array.isArray(node.boundVariables)))return;
  const limits=[node.minWidth,node.minHeight,node.maxWidth,node.maxHeight];
  if(limits.some(value=>value!=null&&(typeof value!=='number'||!Number.isFinite(value)||value<0)))return;
  const sizing:NonNullable<NonNullable<DumpHostOverride['instanceProperties']>['layout']>['sizing']={horizontal:node.layoutSizingHorizontal,vertical:node.layoutSizingVertical};
  if(sizing.horizontal==='FIXED')sizing.width=local!.x;
  if(sizing.vertical==='FIXED')sizing.height=local!.y;
  const sizeBound=!!node.boundVariables&&['size','width','height','minWidth','minHeight','maxWidth','maxHeight'].some(key=>Object.hasOwn(node.boundVariables!,key))||
   (node.minWidth??0)>0||(node.minHeight??0)>0||node.maxWidth!=null||node.maxHeight!=null||node.targetAspectRatio!=null;
  return {kind:'nested-instance-layout-v1' as const,nodeId:node.id,componentId:node.componentId!,parentId:parent.id,
   localSize:{width:local!.x,height:local!.y},parentSize:{width:parentSize!.x,height:parentSize!.y},relativeTransform:matrix.map(row=>[...row]),sizing,
   inFlow:node.layoutPositioning!=='ABSOLUTE',sizeBound};
 })();
 return {ownerId:root.id,ownerComponentId:root.componentId,ownerComponentKey:owner.key,
  nodeId:node.id,componentId:node.componentId,componentKey:main.key,
  ...(setKey?{componentSetKey:setKey}:{}),path,properties,...(layout?{layout}:{})};
}
