import {SolidFillCompositionSchema, type SolidFillComposition} from '../packages/schema/src/solid-fill-composition.js';
import {canonicalJson} from './contract-provenance.js';

export interface BoundFillLayerIdentity {
  fileKey:string; hostId:string; layerId:string; variableId:string;
}
export interface BoundFillLayerExpected extends BoundFillLayerIdentity {
  paint:SolidFillComposition;
  width:number; height:number;
  layoutMode:'NONE'|'HORIZONTAL'|'VERTICAL';
  reversePaint:boolean;
  contentIds:string[];
}

/** Separate read-only execution after writing. This proves one paint receiver,
 * not token alias-graph recreation or whole-component visual qualification. */
export function emitBoundFillLayerReadbackScript(identity:BoundFillLayerIdentity):string {
  return `const expected=${JSON.stringify(identity)};
if(figma.fileKey!==expected.fileKey)throw Error('bound-fill-readback-file');
const host=await figma.getNodeByIdAsync(expected.hostId),layer=await figma.getNodeByIdAsync(expected.layerId);
if(!host||!layer||!('children'in host)||!('fills'in layer))throw Error('bound-fill-readback-node');
const variable=await figma.variables.getVariableByIdAsync(expected.variableId);
if(!variable)throw Error('bound-fill-readback-variable');
const corners=n=>Object.fromEntries(['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','cornerSmoothing'].map(k=>[k,n[k]]));
return {version:1,fileKey:figma.fileKey,host:{id:host.id,type:host.type,width:host.width,height:host.height,layoutMode:host.layoutMode,itemReverseZIndex:host.itemReverseZIndex,fills:host.fills,childIds:host.children.map(n=>n.id),corners:corners(host)},
layer:{id:layer.id,parentId:layer.parent?.id,type:layer.type,rotation:layer.rotation,relativeTransform:layer.relativeTransform,isMask:layer.isMask,strokes:layer.strokes,effects:layer.effects,x:layer.x,y:layer.y,width:layer.width,height:layer.height,visible:layer.visible,opacity:layer.opacity,blendMode:layer.blendMode,layoutPositioning:layer.layoutPositioning,constraints:layer.constraints,corners:corners(layer),fills:layer.fills},
variable:{id:variable.id,resolved:variable.resolveForConsumer(layer)}};`;
}

/** Missing, redirected or structurally different observations never qualify.
 * Variable graph identity is checked separately by the token-context reader. */
export function verifyBoundFillLayerReadback(expected:BoundFillLayerExpected,receipt:unknown):
 {status:'bound-fill-layer-observed'}|{status:'refused';reason:string} {
  try {
    const paint=SolidFillCompositionSchema.parse(expected.paint);
    if(!(expected.width>0&&expected.height>0)||!Number.isFinite(expected.width+expected.height)||
       new Set(expected.contentIds).size!==expected.contentIds.length||expected.contentIds.includes(expected.layerId))
      throw Error('expected-domain');
    const r=receipt as any,h=r?.host,l=r?.layer,v=r?.variable;
    const check=(ok:unknown,reason:string)=>{if(!ok)throw Error(reason);};
    check(r?.version===1&&r.fileKey===expected.fileKey,'file');
    check(h?.id===expected.hostId&&['FRAME','COMPONENT'].includes(h.type),'host');
    check(l?.id===expected.layerId&&l.parentId===h.id&&l.type==='RECTANGLE','layer');
    check(h.layoutMode===expected.layoutMode&&h.width===expected.width&&h.height===expected.height,'host-layout');
    const reverse=expected.layoutMode!=='NONE'&&expected.reversePaint;
    check((h.itemReverseZIndex===true)===expected.reversePaint,'host-paint-order');
    check(canonicalJson(h.fills)==='[]','host-fill');
    check(canonicalJson(h.childIds)===canonicalJson(reverse?[...expected.contentIds,l.id]:[l.id,...expected.contentIds]),'child-order');
    check(l.rotation===0&&canonicalJson(l.relativeTransform)==='[[1,0,0],[0,1,0]]','layer-transform');
    check(l.isMask===false&&canonicalJson(l.strokes)==='[]'&&canonicalJson(l.effects)==='[]','layer-extra-paint');
    check(l.x===0&&l.y===0&&l.width===expected.width&&l.height===expected.height,'layer-geometry');
    check(l.visible===true&&l.opacity===1&&l.blendMode===paint.blendMode,'layer-composition');
    check(expected.layoutMode==='NONE'||l.layoutPositioning==='ABSOLUTE','layer-flow');
    check(l.constraints?.horizontal==='STRETCH'&&l.constraints?.vertical==='STRETCH','layer-constraints');
    check(canonicalJson(l.corners)===canonicalJson(h.corners),'layer-corners');
    const fill=l.fills?.[0];
    check(l.fills?.length===1&&fill?.type==='SOLID'&&fill.visible!==false&&fill.blendMode==='NORMAL','layer-fill');
    check(fill.boundVariables?.color?.type==='VARIABLE_ALIAS'&&fill.boundVariables.color.id===expected.variableId&&v?.id===expected.variableId,'variable-identity');
    const rgba={...paint.color,a:paint.opacity};
    check(v.resolved?.resolvedType==='COLOR'&&canonicalJson(v.resolved.value)===canonicalJson(rgba),'variable-value');
    check(canonicalJson(fill.color)===canonicalJson(paint.color)&&fill.opacity===paint.opacity,'resolved-paint');
    return {status:'bound-fill-layer-observed'};
  } catch(e) { return {status:'refused',reason:'bound-fill-readback-'+(e instanceof Error?e.message:String(e))}; }
}
