import {z} from 'zod';

import {SolidFillCompositionSchema,type SolidFillComposition} from './solid-fill-paint.js';
export {SolidFillCompositionSchema,type SolidFillComposition} from './solid-fill-paint.js';
import {SolidFillSourceBindingSchema,SolidFillObservedBindingSchema} from './solid-fill-binding.js';

/** Apply to an independent, full-size paint layer BEFORE the child content.
 * Applying these declarations to the content's wrapper would blend child ink.
 * This lowerer does not qualify arbitrary clipping, stacking or transforms. */
export function solidFillCompositionCss(input: SolidFillComposition) {
  const paint = SolidFillCompositionSchema.parse(input);
  return {
    position:'absolute',
    inset:'0',
    borderRadius:'inherit',
    backgroundColor:`rgba(${paint.color.r * 255},${paint.color.g * 255},${paint.color.b * 255},${paint.opacity})`,
    mixBlendMode:paint.blendMode === 'MULTIPLY' ? 'multiply' : 'normal',
    pointerEvents:'none',
  } as const;
}

/** Selected-context token ink already includes its resolved variable alpha.
 * Keep it on the independent paint layer; applying opacity again squares
 * alpha, while blending the content wrapper changes foreground ink.
 * This lowerer alone grants no public contract or native binding acceptance. */
export function solidFillCompositionTokenCss(input: SolidFillComposition, tokenPath: string) {
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(tokenPath))
    throw Error('solid-fill-composition-token-path-invalid');
  return {...solidFillCompositionCss(input), backgroundColor:`var(--${tokenPath.split('.').join('-')})`};
}

/** Exact literal paint for a native fill array. The caller owns actual variable
 * resolution and the enclosing node's stacking/opacity; neither is inferred. */
export function solidFillCompositionPaint(input: SolidFillComposition) {
  const paint = SolidFillCompositionSchema.parse(input);
  return {type:'SOLID' as const,color:{...paint.color},opacity:paint.opacity,blendMode:paint.blendMode};
}

/** Draft exact cells. No per-axis factoring or fallback from an undrawn cell. */
export const SolidFillCompositionTableSchema = z.strictObject({
  props: z.array(z.string().min(1)).min(1),
  rows: z.array(z.strictObject({values:z.array(z.string()),paint:SolidFillCompositionSchema,token:z.string().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i).optional(),sourceBinding:SolidFillSourceBindingSchema.optional(),observedBinding:SolidFillObservedBindingSchema.optional(),empty:z.literal(true).optional()})).min(1),
}).superRefine((table,ctx)=>{
  if(new Set(table.props).size!==table.props.length)ctx.addIssue({code:'custom',message:'solid-fill-composition-duplicate-axis'});
  const keys=new Set<string>();
  for(const row of table.rows){
    if(row.values.length!==table.props.length)ctx.addIssue({code:'custom',message:'solid-fill-composition-row-arity'});
    if((row.token!==undefined)!==(row.sourceBinding!==undefined))ctx.addIssue({code:'custom',message:'bound-paint-cell-proof-required'});
    if(row.empty && (row.token || row.sourceBinding || row.paint.opacity!==0 || row.paint.blendMode!=='NORMAL'))ctx.addIssue({code:'custom',message:'empty-paint-cell-conflict'});
    if(row.observedBinding && (row.token || row.sourceBinding || row.empty || JSON.stringify(row.paint)!==JSON.stringify(row.observedBinding.observedPaint)))
      ctx.addIssue({code:'custom',message:'observed-paint-cell-literal-required'});
    if(row.sourceBinding && JSON.stringify(row.paint)!==JSON.stringify(row.sourceBinding.binding.paint))ctx.addIssue({code:'custom',message:'bound-paint-cell-source-disagreement'});
    const key=JSON.stringify(row.values);
    if(keys.has(key))ctx.addIssue({code:'custom',message:'solid-fill-composition-duplicate-cell'});
    keys.add(key);
  }
});
export type SolidFillCompositionTable = z.infer<typeof SolidFillCompositionTableSchema>;
export function resolveSolidFillComposition(part:{solidFillComposition?:SolidFillComposition;solidFillCompositionByCombination?:SolidFillCompositionTable},values:Record<string,string|undefined>) {
  if(part.solidFillComposition && part.solidFillCompositionByCombination)throw Error('solid-fill-composition-base-table-conflict');
  if(!part.solidFillCompositionByCombination)return part.solidFillComposition;
  const table=SolidFillCompositionTableSchema.parse(part.solidFillCompositionByCombination);
  const row=table.rows.find(row=>table.props.every((prop,i)=>values[prop]===row.values[i]));
  return row?.empty?undefined:row?.paint;
}

export function resolveSolidFillToken(part:{solidFillCompositionToken?:string;solidFillCompositionByCombination?:SolidFillCompositionTable},values:Record<string,string|undefined>) {
 const table=part.solidFillCompositionByCombination;
 return table?table.rows.find(row=>table.props.every((prop,i)=>values[prop]===row.values[i]))?.token:part.solidFillCompositionToken;
}
