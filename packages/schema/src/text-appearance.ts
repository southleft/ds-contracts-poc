import {z} from 'zod';
const unit=z.number().min(0).max(1).refine(n=>Math.fround(n)===n,'source-float-required');
const spacing=z.strictObject({unit:z.enum(['PIXELS','PERCENT']),value:z.number()});
export const TextAppearanceSchema=z.strictObject({
 characters:z.string().min(1).max(65536),
 runs:z.array(z.strictObject({
  start:z.number().int().min(0),end:z.number().int().positive(),
  fontName:z.strictObject({family:z.string().trim().min(1),style:z.string().trim().min(1)}),
  fontSize:z.number().positive(),fontWeight:z.number().min(1).max(1000),
  lineHeight:z.union([z.strictObject({unit:z.literal('AUTO')}),z.strictObject({unit:z.enum(['PIXELS','PERCENT']),value:z.number().min(0)})]),
  letterSpacing:spacing,
  textCase:z.enum(['ORIGINAL','UPPER','LOWER','TITLE','SMALL_CAPS','SMALL_CAPS_FORCED']),
  textDecoration:z.enum(['NONE','UNDERLINE','STRIKETHROUGH']),
  fill:z.strictObject({paint:z.strictObject({color:z.strictObject({r:unit,g:unit,b:unit}),opacity:unit,blendMode:z.literal('NORMAL')}),variableId:z.string().min(1).optional()}),
 })).min(2).max(256),
}).superRefine((v,ctx)=>{
 let end=0;
 const boundary=(i:number)=>i===0||i===v.characters.length||!(v.characters.charCodeAt(i-1)>=0xd800&&v.characters.charCodeAt(i-1)<=0xdbff&&v.characters.charCodeAt(i)>=0xdc00&&v.characters.charCodeAt(i)<=0xdfff);
 for(const run of v.runs){if(run.start!==end||run.end<=run.start||run.end>v.characters.length||!boundary(run.start)||!boundary(run.end))ctx.addIssue({code:'custom',message:'text-appearance-range-unqualified'});end=run.end;}
 if(end!==v.characters.length)ctx.addIssue({code:'custom',message:'text-appearance-range-incomplete'});
});
export type TextAppearance=z.infer<typeof TextAppearanceSchema>;
export const TextAppearanceOverrideSchema=z.strictObject({prop:z.string().min(1),choices:z.record(z.string(),TextAppearanceSchema).refine(v=>Object.keys(v).length>0&&Object.keys(v).length<=32,'text-appearance-choice-budget')});
export type TextAppearanceOverride=z.infer<typeof TextAppearanceOverrideSchema>;
