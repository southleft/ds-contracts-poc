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
