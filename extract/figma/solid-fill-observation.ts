import type {SolidFillComposition} from '@ds-contracts/schema';

/** Exact source observation. NORMAL peers are captured only when explicitly
 * requested, so ordinary non-composed proposal behavior stays unchanged. A variable ID
 * is source identity only; no name, binding, mode or resolved value is inferred. */
export type SourceFillComposition = {paint:SolidFillComposition;variableId?:string} | {issue:string};
export function observeSolidFillComposition(input:unknown,includeNormal=false):SourceFillComposition | undefined {
  if (!Array.isArray(input)) return undefined;
  const paints=input.filter(p=>p && p.visible!==false);
  if (!paints.length || !includeNormal && !paints.some(p=>p.blendMode!==undefined && p.blendMode!=='NORMAL')) return undefined;
  if (paints.length!==1 || paints[0].type!=='SOLID') return {issue:'solid-fill-composition-source-paint-stack-unqualified'};
  const p=paints[0],c=p.color;
  const blendMode=p.blendMode===undefined?'NORMAL':p.blendMode;
  if (blendMode!=='MULTIPLY' && blendMode!=='NORMAL') return {issue:'solid-fill-composition-source-blend-unqualified'};
  const unit=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=1 && Math.fround(v)===v;
  const opacity=p.opacity===undefined?1:p.opacity;
  if (!c || ![c.r,c.g,c.b,opacity].every(unit) || c.a!==undefined && c.a!==1)
    return {issue:'solid-fill-composition-source-values-unqualified'};
  const alias=p.boundVariables?.color;
  if (alias!==undefined && (!alias || alias.type!=='VARIABLE_ALIAS' || typeof alias.id!=='string' || !alias.id))
    return {issue:'solid-fill-composition-source-variable-unqualified'};
  return {paint:{color:{r:c.r,g:c.g,b:c.b},opacity,blendMode},...(alias?{variableId:alias.id}:{})};
}


/** Resolved NORMAL solid stroke layers, in Figma's bottom-to-top order.
 * The result is a provisional literal, never an alias to one source layer.
 * Gradients, blend effects, missing colors and invalid alpha remain unsupported. */
export function composeNormalSolidStrokePaints(input: unknown): {hex:string;alpha?:number} | undefined {
  if (!Array.isArray(input)) return;
  const paints=input.filter(p=>p && p.visible!==false);
  if (paints.length<2) return;
  const unit=(n:unknown):n is number=>typeof n==='number' && Number.isFinite(n) && n>=0 && n<=1;
  let alpha=0, rgb=[0,0,0];
  for(const p of paints){
    const c=p.color, opacity=p.opacity??1, ca=c?.a??1;
    if(p.type!=='SOLID' || (p.blendMode!==undefined && p.blendMode!=='NORMAL') ||
      !c || ![c.r,c.g,c.b,opacity,ca].every(unit)) return;
    const a=opacity*ca;
    rgb=rgb.map((v,i)=>[c.r,c.g,c.b][i]*a+v*(1-a));
    alpha=a+alpha*(1-a);
  }
  return {hex:rgb.map(v=>Math.round((alpha?v/alpha:0)*255).toString(16).padStart(2,'0')).join(''),
    ...(alpha<1?{alpha}:{})};
}
