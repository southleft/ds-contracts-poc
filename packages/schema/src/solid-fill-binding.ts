import {z} from 'zod';
import {SolidFillCompositionSchema} from './solid-fill-paint.js';
export interface DumpVariableConsumer {
  name: string;
  collectionId: string;
  modeId: string;
  modeName: string;
  resolvedType: 'FLOAT' | 'COLOR' | 'STRING' | 'BOOLEAN';
  /** Native precision; unlike the global token table, colors are not rounded. */
  value: number | string | boolean | { r: number; g: number; b: number; a?: number };
  /** Raw selected-mode value, including a VARIABLE_ALIAS when present.
   * The optional aliasChain corroborates only this selected path. */
  selectedValue: unknown;
  /** Plugin v1.44: selected targets in traversal order, at most 16 edges.
   * Every target includes its own inherited consuming mode and native value.
   * Absent means uncaptured; it never authorizes an alias projection. */
  aliasChain?: Array<Omit<DumpVariableConsumer, 'aliasChain'> & { id: string }>;
}
/** Selected native binding evidence, not a token name/mode projection. The
 * observed paint already contains the normalized variable alpha. Never multiply
 * it by the resolved color alpha again. Public binding rendering is separate. */
export function qualifySolidFillColorBinding(observation:{paint:unknown;variableId?:string} | {issue:string},consumers:Record<string,DumpVariableConsumer>|undefined) {
 const fail=(reason:string):never=>{throw Error('solid-fill-composition-source-variable-binding-unqualified:'+reason);};
 if(!observation || !('paint' in observation) || !observation.variableId)fail('identity-missing');
 const source=observation as {paint:unknown;variableId:string};
 const paint=SolidFillCompositionSchema.parse(source.paint),direct=consumers?.[source.variableId];
 if(!direct)fail('consumer-missing');
 const root=direct!;
 if(typeof root!=='object' || Array.isArray(root) || Object.keys(root).some(key=>!['name','collectionId','modeId','modeName','resolvedType','value','selectedValue','aliasChain'].includes(key)) || root.aliasChain!==undefined && !Array.isArray(root.aliasChain))fail('consumer-shape');
 const object=(value:unknown):value is Record<string,unknown>=>!!value && typeof value==='object' && !Array.isArray(value);
 const unit=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=1 && Math.fround(v)===v;
 const color=(value:unknown)=>{
  if(!object(value) || ![value.r,value.g,value.b,value.a===undefined?1:value.a].every(unit) || Object.keys(value).some(key=>!['r','g','b','a'].includes(key)))fail('color-not-native');
  const v=value as {r:number;g:number;b:number;a?:number};
  return {r:v.r,g:v.g,b:v.b,a:v.a===undefined?1:v.a};
 };
 const expected={...paint.color,a:paint.opacity},seen=new Set<string>(),names=new Map<string,string>(),modes=new Map<string,string>(),collectionModes=new Map<string,string>();
 const rows=[{id:source.variableId,...root},...(root.aliasChain??[])];
 if(rows.length>17)fail('alias-depth');
 for(const [index,row] of rows.entries()){
  if(!object(row) || Object.keys(row).some(key=>!['id','name','collectionId','modeId','modeName','resolvedType','value','selectedValue','aliasChain'].includes(key)))fail('alias-consumer-shape');
  if(typeof row.id!=='string' || !row.id || seen.has(row.id))fail('alias-identity');seen.add(row.id);
  if(['name','collectionId','modeId','modeName'].some(key=>typeof row[key as keyof typeof row]!=='string' || !row[key as keyof typeof row]) || row.resolvedType!=='COLOR')fail('consumer-identity');
  // Figma variable names are scoped to collections. A theme alias may use
  // the same name in its source and destination collections; identity stays
  // the captured variable ID, never the display name.
  const nameKey=JSON.stringify([row.collectionId,row.name]);
  if(names.has(nameKey) && names.get(nameKey)!==row.id)fail('name-collision');names.set(nameKey,row.id);
  const modeKey=JSON.stringify([row.collectionId,row.modeId]);if(modes.has(modeKey) && modes.get(modeKey)!==row.modeName)fail('mode-name-conflict');modes.set(modeKey,row.modeName);
  if(collectionModes.has(row.collectionId) && collectionModes.get(row.collectionId)!==row.modeId)fail('alias-mode-conflict');collectionModes.set(row.collectionId,row.modeId);
  const resolved=color(row.value);if(Object.keys(expected).some(key=>resolved[key as keyof typeof resolved]!==expected[key as keyof typeof expected]))fail('paint-consumer-disagreement');
  const selected=row.selectedValue;
  if(object(selected) && selected.type==='VARIABLE_ALIAS'){
   if(Object.keys(selected).some(key=>!['type','id'].includes(key)) || typeof selected.id!=='string' || !selected.id || rows[index+1]?.id!==selected.id)fail('selected-alias-edge');
  }else{
   if(index!==rows.length-1)fail('alias-tail');
   const terminal=color(selected);if(Object.keys(expected).some(key=>terminal[key as keyof typeof terminal]!==expected[key as keyof typeof expected]))fail('terminal-value-disagreement');
  }
 }
 const clone=(value:any):any=>Array.isArray(value)?value.map(clone):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clone(item)])):value;
 return {variableId:source.variableId,paint,consumer:clone(root) as DumpVariableConsumer};
}

/** Classify two independently captured facts without turning a conflicting
 * observed fill into a recreated variable binding. The selected variable
 * graph must still pass every strict identity, mode and alias check. */
export function inspectSolidFillColorBinding(
 observation:{paint:unknown;variableId?:string}|{issue:string},
 consumers:Record<string,DumpVariableConsumer>|undefined,
) {
 if(!observation || !('paint' in observation) || !observation.variableId)
  throw Error('solid-fill-observed-binding-unqualified:identity-missing');
 const observedPaint=SolidFillCompositionSchema.parse(observation.paint);
 const value=consumers?.[observation.variableId]?.value;
 if(!value || typeof value!=='object')throw Error('solid-fill-observed-binding-unqualified:consumer-color-missing');
 // This paint is solely the variable's resolved value, used to validate its
 // graph. It must never substitute for the separately captured observed fill.
 const resolvedBinding=qualifySolidFillColorBinding({variableId:observation.variableId,
  paint:{color:{r:value.r,g:value.g,b:value.b},opacity:value.a??1,blendMode:observedPaint.blendMode}},consumers);
 const same=observedPaint.opacity===resolvedBinding.paint.opacity &&
  (['r','g','b'] as const).every(channel=>observedPaint.color[channel]===resolvedBinding.paint.color[channel]);
 if(same)return {kind:'matched' as const,binding:qualifySolidFillColorBinding(observation,consumers)};
 return {kind:'observed-paint-disagreement' as const,observedPaint,resolvedBinding,
  bindingRecreated:false as const};
}

const identity=z.string().min(1);
const color=z.strictObject({r:z.number(),g:z.number(),b:z.number(),a:z.number().optional()});
const selected=z.union([color,z.strictObject({type:z.literal('VARIABLE_ALIAS'),id:identity})]);
const consumerRow=z.strictObject({name:identity,collectionId:identity,modeId:identity,modeName:identity,
 resolvedType:z.literal('COLOR'),value:color,selectedValue:selected});
export const SolidFillSourceBindingSchema=z.strictObject({
 owner:identity,nodeName:identity,variantName:identity,
 binding:z.strictObject({variableId:identity,paint:SolidFillCompositionSchema,
 consumer:consumerRow.extend({aliasChain:z.array(consumerRow.extend({id:identity})).max(16).optional()})})
}).superRefine((row,ctx)=>{
 try{qualifySolidFillColorBinding(row.binding,{[row.binding.variableId]:row.binding.consumer});}
 catch(error){ctx.addIssue({code:'custom',message:String(error)});}
});
export const SolidFillSourceBindingsSchema=z.array(SolidFillSourceBindingSchema).min(1);


/** Evidence retained with literal paint; explicitly not a recreated binding. */
export const SolidFillObservedBindingSchema=z.strictObject({
 owner:identity,nodeName:identity,variantName:identity,
 observedPaint:SolidFillCompositionSchema,
 resolvedBinding:z.strictObject({variableId:identity,paint:SolidFillCompositionSchema,
  consumer:consumerRow.extend({aliasChain:z.array(consumerRow.extend({id:identity})).max(16).optional()})}),
 bindingRecreated:z.literal(false),
}).superRefine((row,ctx)=>{
 try{
  const inspected=inspectSolidFillColorBinding({paint:row.observedPaint,variableId:row.resolvedBinding.variableId},
   {[row.resolvedBinding.variableId]:row.resolvedBinding.consumer});
  if(inspected.kind!=='observed-paint-disagreement' || JSON.stringify(inspected.resolvedBinding.paint)!==JSON.stringify(row.resolvedBinding.paint))
   throw Error('observed-paint-disagreement-evidence-unqualified');
 }catch(error){ctx.addIssue({code:'custom',message:String(error)});}
});
export type SolidFillObservedBinding = z.infer<typeof SolidFillObservedBindingSchema>;
