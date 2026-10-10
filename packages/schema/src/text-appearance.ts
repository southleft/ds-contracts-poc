import {z} from 'zod';
const unit=z.number().min(0).max(1).refine(n=>Math.fround(n)===n,'source-float-required');
const spacing=z.strictObject({unit:z.enum(['PIXELS','PERCENT']),value:z.number()});
export const TextAppearanceSchema=z.strictObject({
 characters:z.string().min(1).max(65536),
 runs:z.array(z.strictObject({
  start:z.number().int().min(0),end:z.number().int().positive(),
  fontName:z.strictObject({family:z.string().trim().min(1),style:z.string().trim().min(1),
   variationSettings:z.record(z.string().regex(/^[\x20-\x7e]{4}$/),z.number().finite()).optional()}),
  fontSize:z.number().positive(),fontWeight:z.number().min(1).max(1000),
  lineHeight:z.union([z.strictObject({unit:z.literal('AUTO')}),z.strictObject({unit:z.enum(['PIXELS','PERCENT']),value:z.number().min(0)})]),
  letterSpacing:spacing,
  textCase:z.enum(['ORIGINAL','UPPER','LOWER','TITLE','SMALL_CAPS','SMALL_CAPS_FORCED']),
  textDecoration:z.enum(['NONE','UNDERLINE','STRIKETHROUGH']),
  fill:z.strictObject({paint:z.strictObject({color:z.strictObject({r:unit,g:unit,b:unit}),opacity:unit,blendMode:z.literal('NORMAL')}),variableId:z.string().min(1).optional()}),
 })).min(1).max(256),
}).superRefine((v,ctx)=>{
 let end=0;
 const boundary=(i:number)=>i===0||i===v.characters.length||!(v.characters.charCodeAt(i-1)>=0xd800&&v.characters.charCodeAt(i-1)<=0xdbff&&v.characters.charCodeAt(i)>=0xdc00&&v.characters.charCodeAt(i)<=0xdfff);
 for(const run of v.runs){if(run.start!==end||run.end<=run.start||run.end>v.characters.length||!boundary(run.start)||!boundary(run.end))ctx.addIssue({code:'custom',message:'text-appearance-range-unqualified'});end=run.end;}
 if(end!==v.characters.length)ctx.addIssue({code:'custom',message:'text-appearance-range-incomplete'});
});
export type TextAppearance=z.infer<typeof TextAppearanceSchema>;
// Authored source can genuinely have one run. Public caller choices retain the
// existing range-override boundary independently of source observation.
export const TextAppearanceOverrideSchema=z.strictObject({prop:z.string().min(1),choices:z.record(z.string(),TextAppearanceSchema.refine(v=>v.runs.length>=2,'text-appearance-override-requires-ranges')).refine(v=>Object.keys(v).length>0&&Object.keys(v).length<=32,'text-appearance-choice-budget')});
export type TextAppearanceOverride=z.infer<typeof TextAppearanceOverrideSchema>;
export const TextAppearanceTableSchema=z.strictObject({
 props:z.array(z.string().min(1)).max(8),
 rows:z.array(z.strictObject({values:z.array(z.string().nullable()).max(8),appearance:TextAppearanceSchema})).min(1).max(4096),
}).superRefine((table,ctx)=>{
 if(new Set(table.props).size!==table.props.length)ctx.addIssue({code:'custom',message:'text-appearance-duplicate-axis'});
 const tuples=new Set<string>();
 for(const row of table.rows){
  const key=JSON.stringify(row.values);
  if(row.values.length!==table.props.length||tuples.has(key))ctx.addIssue({code:'custom',message:'text-appearance-tuple-unqualified'});
  tuples.add(key);
 }
 if(!table.props.length&&table.rows.length!==1)ctx.addIssue({code:'custom',message:'text-appearance-invariant-requires-one-row'});
});
export type TextAppearanceTable=z.infer<typeof TextAppearanceTableSchema>;
