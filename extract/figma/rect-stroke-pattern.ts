import {composeNormalSolidStrokePaints} from './solid-fill-observation.js';

/** Exact numeric dash input for an ordinary, layout-neutral rounded frame.
 * No label inference, SVG-outline approximation or alias substitution. */
export function observeRectStrokePattern(node: any, pattern: unknown): {nodeId:string;weight:number;radius:number;dashes:number[]} | undefined {
  if (!['FRAME','COMPONENT'].includes(node.type) || !['HORIZONTAL','VERTICAL'].includes(node.layoutMode) ||
      node.strokeAlign !== 'INSIDE' || node.strokesIncludedInLayout === true || node.visible === false ||
      (node.opacity !== undefined && node.opacity !== 1) || (node.cornerSmoothing ?? 0) !== 0 ||
      (node.rotation ?? 0) !== 0 || ![undefined,'NONE'].includes(node.strokeCap) || ![undefined,'MITER'].includes(node.strokeJoin) ||
      !Number.isFinite(node.strokeWeight) || node.strokeWeight <= 0 ||
      (node.complexStrokeProperties?.strokeType !== undefined && node.complexStrokeProperties.strokeType !== 'BASIC')) return;
  const radius=node.cornerRadius ?? 0;
  if (!Number.isFinite(radius) || radius < 0 ||
      node.rectangleCornerRadii?.some((v:number)=>v!==radius) ||
      node.individualStrokeWeights && Object.values(node.individualStrokeWeights).some(v=>v!==node.strokeWeight)) return;
  if (!Array.isArray(pattern) || ![0,2].includes(pattern.length) ||
      !Array.from({length:pattern.length},(_,i)=>Object.hasOwn(pattern,i)).every(Boolean) ||
      pattern.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1e6)) return;
  const paints=Array.isArray(node.strokes)?node.strokes.filter((p:any)=>p.visible!==false):[];
  // A solid outline shares one node-wide geometry even when the ordinary
  // mapper resolves several NORMAL solid paints. Keep that same paint admission;
  // nonempty multi-paint dash patterns remain outside this projection.
  const admitted=paints.length===1
    ? paints[0].type==='SOLID' && (paints[0].blendMode ?? 'NORMAL')==='NORMAL'
    : pattern.length===0 && composeNormalSolidStrokePaints(paints)!==undefined;
  if (!admitted || typeof node.id!=='string' || !node.id) return;
  return {nodeId:node.id,weight:node.strokeWeight,radius,dashes:pattern.slice()};
}
