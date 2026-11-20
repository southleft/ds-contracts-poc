import {z} from 'zod';

/** Literal source text selected by a complete observed variant tuple. Missing
 * tuples never fall back to the first sample. Caller text uses `content`. */
export const TextByCombinationSchema=z.strictObject({
 props:z.array(z.string().min(1)).min(1).max(8),
 rows:z.array(z.strictObject({values:z.array(z.string().nullable()).max(8),text:z.string().max(65536)})).min(1).max(4096),
}).superRefine((table,ctx)=>{
 if(new Set(table.props).size!==table.props.length)ctx.addIssue({code:'custom',message:'text-combination-duplicate-axis'});
 const seen=new Set<string>();
 for(const row of table.rows){const key=JSON.stringify(row.values);
  if(row.values.length!==table.props.length||seen.has(key))ctx.addIssue({code:'custom',message:'text-combination-tuple-unqualified'});
  seen.add(key);
 }
});
export type TextByCombination=z.infer<typeof TextByCombinationSchema>;
export function resolveTextByCombination(table:TextByCombination,subst:Record<string,unknown>):string {
 const values=table.props.map(name=>subst[name]==null?null:String(subst[name]));
 const rows=table.rows.filter(row=>row.values.length===values.length&&row.values.every((value,i)=>value===values[i]));
 if(rows.length!==1)throw Error('literal-text-combination-unavailable');
 return rows[0].text;
}

/** Profile convention text-baseline-as-drawn: where the browser drew the baseline of a part's one line of text, in px
 * below that line box's top, with the font's ascent and descent per em, per complete variant tuple (no props: every
 * variant). The native Figma writer reads it under the convention only; the React emitters never do. */
export const TextBaselineSchema=z.strictObject({
 props:z.array(z.string().min(1)).max(8),
 rows:z.array(z.strictObject({values:z.array(z.string().nullable()).max(8),px:z.number().finite().nonnegative(),ascent:z.number().finite().positive(),descent:z.number().finite().nonnegative()})).min(1).max(4096),
}).superRefine((table,ctx)=>{
 const seen=new Set<string>();
 for(const row of table.rows){const key=JSON.stringify(row.values);if(row.values.length!==table.props.length||seen.has(key))ctx.addIssue({code:'custom',message:'text-baseline-tuple-unqualified'});seen.add(key);}
});
export type TextBaseline=z.infer<typeof TextBaselineSchema>;
export function resolveTextBaseline(table:TextBaseline,subst:Record<string,unknown>):TextBaseline['rows'][number]|undefined {
 const values=table.props.map(name=>subst[name]==null?null:String(subst[name]));
 return table.rows.find(row=>row.values.every((value,i)=>value===values[i]));
}

/** Profile convention inline-block-line-box-as-drawn: how far the line box an atomic inline sits alone on reaches above its
 * margin box (`top`) and below it (`bottom`), in px, measured in the page, per complete variant tuple (no props: every
 * variant). The native Figma writer reads it under the convention only; the React emitters never do. */
export const LineBoxSchema=z.strictObject({
 props:z.array(z.string().min(1)).max(8),
 rows:z.array(z.strictObject({values:z.array(z.string().nullable()).max(8),top:z.number().finite().nonnegative(),bottom:z.number().finite().nonnegative()})).min(1).max(4096),
}).superRefine((table,ctx)=>{
 const seen=new Set<string>();
 for(const row of table.rows){const key=JSON.stringify(row.values);if(row.values.length!==table.props.length||seen.has(key))ctx.addIssue({code:'custom',message:'line-box-tuple-unqualified'});seen.add(key);}
});
export type LineBox=z.infer<typeof LineBoxSchema>;
export function resolveLineBox(table:LineBox,subst:Record<string,unknown>):LineBox['rows'][number]|undefined {
 const values=table.props.map(name=>subst[name]==null?null:String(subst[name]));
 return table.rows.find(row=>row.values.every((value,i)=>value===values[i]));
}
