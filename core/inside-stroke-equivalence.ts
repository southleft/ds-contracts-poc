import {SolidFillCompositionSchema} from '../scripts/contract-schema.js';
import {filledPathsIssue} from '../scripts/contract-schema.js';
import type {DumpHostOverride} from '../extract/figma/types.js';
import {qualifySolidFillColorBinding} from '../extract/figma/solid-fill-binding.js';

/** A compositing proof only. It does not authorize removing native stroke
 * attributes, replacing an instance, or bypassing a renderer's refusal.
 * Consumers must carry the returned source through their native projection.
 * Equal current colors with different variable identities are NOT equivalent:
 * changing modes or editing either binding can separate their appearances. */
export function inspectOpaqueInsideStroke(source: DumpHostOverride) {
 const fail=(reason:string):never=>{throw Error('opaque-inside-stroke-unqualified:'+reason);};
 const g=source.vectorStrokeGeometry;
 if(!g || !source.solidFillTarget || !source.solidStrokeTarget ||
    JSON.stringify(source.solidFillTarget)!==JSON.stringify(source.solidStrokeTarget) ||
    JSON.stringify(g.target)!==JSON.stringify(source.solidFillTarget))fail('target');
 const geometry=g!;
 if(!geometry.target.nodeId || !geometry.target.instanceId || !geometry.target.componentId ||
    !Array.isArray(geometry.target.instancePath) || !Array.isArray(geometry.target.childPath) ||
    !geometry.target.childPath.length || [...geometry.target.instancePath,...geometry.target.childPath].some(n=>!Number.isInteger(n)||n<0))fail('target-path');
 if(!source.fields.includes('fills') || !source.fields.includes('strokes') ||
    source.fields.some(f=>!['fills','fillStyleId','strokes','strokeStyleId','strokeWeight'].includes(f)))fail('override-fields');
 if(geometry.strokeAlign!=='INSIDE' || !Number.isFinite(geometry.strokeWeight) || geometry.strokeWeight<=0 ||
    !['MITER','BEVEL','ROUND'].includes(geometry.strokeJoin) || !['NONE','ROUND','SQUARE'].includes(geometry.strokeCap) ||
    !Number.isFinite(geometry.strokeMiterLimit) || geometry.strokeMiterLimit<1 || geometry.strokeMiterLimit>1000 ||
    !Array.isArray(geometry.dashPattern) || geometry.dashPattern.length ||
    geometry.opacity!==1 || !['PASS_THROUGH','NORMAL'].includes(geometry.blendMode) ||
    !Array.isArray(geometry.effects) || geometry.effects.length)fail('composition');
 if(!Number.isFinite(geometry.width) || geometry.width<=0 || !Number.isFinite(geometry.height) || geometry.height<=0 ||
    !Array.isArray(geometry.relativeTransform) || geometry.relativeTransform.length!==2 ||
    geometry.relativeTransform.some(row=>!Array.isArray(row)||row.length!==3||row.some(v=>!Number.isFinite(v))) ||
    !geometry.fillGeometry?.length || !geometry.centeredStrokeGeometry?.length ||
    filledPathsIssue(geometry.fillGeometry) || filledPathsIssue(geometry.centeredStrokeGeometry))fail('geometry');
 const fill=source.sourceNormalFillComposition,stroke=source.sourceNormalStrokeComposition;
 if(!fill || !stroke || !('paint'in fill) || !('paint'in stroke))fail('paint-observation');
 const f=fill as {paint:unknown;variableId?:string},s=stroke as {paint:unknown;variableId?:string};
 const fp=SolidFillCompositionSchema.parse(f.paint),sp=SolidFillCompositionSchema.parse(s.paint);
 if(fp.opacity!==1 || sp.opacity!==1 || fp.blendMode!=='NORMAL' || sp.blendMode!=='NORMAL' ||
    ['r','g','b'].some(k=>fp.color[k as 'r']!==sp.color[k as 'r']))fail('paint-composition');
 if(f.variableId!==s.variableId)fail('paint-binding-identity');
 if(f.variableId){
  qualifySolidFillColorBinding(fill!,source.variableConsumers);
  qualifySolidFillColorBinding(stroke!,source.variableConsumers);
 }else if(source.fill?.var || source.stroke?.var)fail('paint-binding-missing');
 // Preserve every captured native attribute and both paint planes; the proof
 // never edits the caller's source or turns the stroke into a filled outline.
 return {kind:'opaque-same-paint-inside-stroke' as const,source:structuredClone(source)};
}
