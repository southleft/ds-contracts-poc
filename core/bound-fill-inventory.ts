import type {NodeSpec} from './emit-figma-script.js';
import {verifyBoundFillLayerReadback} from './solid-fill-layer-observation.js';

type Row={id:string;type:string;name:string;parentId:string;childIds:string[];values:Record<string,any>;metadata:Record<string,any>};
/** A verified receiver is an explicit inventory member, never an ignored node.
 * The caller supplies color resolved from the independent token inventory. */
export function boundFillInventory(spec:NodeSpec,host:Row,nodes:ReadonlyMap<string,Row>,fileKey:string,
  bound:{id:string;color:{r:number;g:number;b:number;a?:number}}|undefined,
  mode:Record<string,string>):{layerId:string;contentIds:string[]}|{refused:string} {
  const paint=spec.solidFillComposition;
  if(!spec.solidFillCompositionToken || !paint || !bound || !['root','frame'].includes(spec.type))
    return {refused:'bound-fill-inventory-spec'};
  const reverse=host.values.layoutMode!=='NONE'&&host.values.itemReverseZIndex===true;
  const ids=[...host.childIds],layerId=reverse?ids.pop():ids.shift();
  const layer=layerId?nodes.get(layerId):undefined;
  if(!layer || layer.name!=='[ds-contracts bound paint]' || layer.childIds.length ||
    ids.length!==(spec.children??[]).length || ids.includes(layer.id))return {refused:'bound-fill-inventory-topology'};
  if(JSON.stringify(layer.values.explicitVariableModes)!=='{}' ||
    Object.keys(layer.values.resolvedVariableModes??{}).length!==Object.keys(mode).length ||
    Object.entries(mode).some(([key,value])=>layer.values.resolvedVariableModes?.[key]!==value) ||
    Object.keys(layer.values.componentPropertyReferences??{}).length)
    return {refused:'bound-fill-inventory-mode-or-property'};
  const bindings=layer.values.boundVariables??{};
  if(Object.keys(bindings).some(k=>k!=='fills') || bindings.fills!==undefined &&
    (!Array.isArray(bindings.fills)||bindings.fills.length!==1||bindings.fills[0]?.type!=='VARIABLE_ALIAS'||bindings.fills[0]?.id!==bound.id))
    return {refused:'bound-fill-inventory-extra-binding'};
  const corners=(v:Record<string,any>)=>Object.fromEntries(['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','cornerSmoothing'].map(k=>[k,v[k]]));
  const expected={fileKey,hostId:host.id,layerId:layer.id,variableId:bound.id,
    paint:{color:paint.color,opacity:paint.opacity,blendMode:paint.blendMode},width:host.values.width,height:host.values.height,
    layoutMode:host.values.layoutMode,reversePaint:host.values.itemReverseZIndex===true,contentIds:ids};
  const receipt={version:1,fileKey,
    host:{...host.values,id:host.id,type:host.type,childIds:host.childIds,corners:corners(host.values)},
    layer:{...layer.values,id:layer.id,type:layer.type,parentId:layer.parentId,corners:corners(layer.values)},
    variable:{id:bound.id,resolved:{resolvedType:'COLOR',value:{...bound.color,a:bound.color.a??1}}}};
  const result=verifyBoundFillLayerReadback(expected,receipt);
  return result.status==='refused'?{refused:result.reason}:{layerId:layer.id,contentIds:ids};
}
