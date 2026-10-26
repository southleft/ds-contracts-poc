import {z} from 'zod';
import {SolidFillSourceBindingSchema,SolidFillObservedBindingSchema} from './solid-fill-binding.js';
const unit=z.number().finite().min(0).max(1).refine(v=>Math.fround(v)===v,'fill-stack-native-float32-required');
const common={index:z.number().int().min(0),visible:z.boolean(),opacity:unit,blendMode:z.literal('NORMAL')};
const color=z.strictObject({r:unit,g:unit,b:unit,a:z.literal(1).optional()});
const binding=z.strictObject({variableId:z.string().min(1),reason:z.string().min(1),bindingRecreated:z.literal(false)});
export const FillStackPaintSchema=z.discriminatedUnion('type',[
 z.strictObject({...common,type:z.literal('SOLID'),color,token:z.string().min(1).optional(),sourceBinding:SolidFillSourceBindingSchema.optional(),observedBinding:SolidFillObservedBindingSchema.optional(),unresolvedBinding:binding.optional()}),
 z.strictObject({...common,type:z.literal('IMAGE'),imageHash:z.string().min(1),image:z.string().regex(/^url\(['"]?data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}['"]?\)$/),scaleMode:z.enum(['FILL','FIT','CROP','STRETCH']),imageTransform:z.tuple([z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]),z.tuple([z.number().finite(),z.number().finite(),z.number().finite()])]).optional(),rotation:z.literal(0).optional(),scalingFactor:z.literal(1).optional(),filters:z.record(z.string(),z.literal(0)).optional()}),
]);
export const FillStackSchema=z.strictObject({version:z.literal(1),order:z.literal('bottom-to-top'),paints:z.array(FillStackPaintSchema).max(64)}).superRefine((stack,ctx)=>{
 const assets=new Set<string>();let totalBytes=0;
 for(const[p,paint]of stack.paints.entries()){
  if(paint.index!==p)ctx.addIssue({code:'custom',message:'fill-stack-original-index-required'});
  if(paint.type==='SOLID'){
   if((paint.token!==undefined)!==(paint.sourceBinding!==undefined)||paint.unresolvedBinding&&(paint.token||paint.sourceBinding||paint.observedBinding)||paint.observedBinding&&(paint.token||paint.sourceBinding))ctx.addIssue({code:'custom',message:'fill-stack-binding-proof-conflict'});
   if(paint.observedBinding&&JSON.stringify({color:{r:paint.color.r,g:paint.color.g,b:paint.color.b},opacity:paint.opacity,blendMode:paint.blendMode})!==JSON.stringify(paint.observedBinding.observedPaint))ctx.addIssue({code:'custom',message:'fill-stack-observed-binding-disagreement'});
   if(paint.sourceBinding){const observed={color:{r:paint.color.r,g:paint.color.g,b:paint.color.b},opacity:paint.opacity,blendMode:paint.blendMode};if(JSON.stringify(observed)!==JSON.stringify(paint.sourceBinding.binding.paint))ctx.addIssue({code:'custom',message:'fill-stack-binding-paint-disagreement'});}
  }else {
   const match=/^url\((['"]?)data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})\1\)$/.exec(paint.image);
   const prefixes:Record<string,string>={'image/png':'iVBORw0KGgo','image/jpeg':'/9j/','image/gif':'R0lGOD','image/webp':'UklGR'};
   const data=match?.[3],size=data?data.length/4*3-(data.endsWith('==')?2:data.endsWith('=')?1:0):0;
   if(!match||!data||data.length%4||!data.startsWith(prefixes[match[2]])||size<=0||size>8*1024*1024)ctx.addIssue({code:'custom',message:'fill-stack-image-bytes-unqualified'});
   if(!assets.has(paint.image)){assets.add(paint.image);totalBytes+=size;}
   if(['CROP','STRETCH'].includes(paint.scaleMode)){
   const t=paint.imageTransform;if(!t||t[0][1]!==0||t[1][0]!==0||t[0][0]<=0||t[1][1]<=0||(t[0][0]===1&&t[0][2]!==0)||(t[1][1]===1&&t[1][2]!==0))ctx.addIssue({code:'custom',message:'fill-stack-image-transform-unqualified'});
   }else if(paint.imageTransform!==undefined)ctx.addIssue({code:'custom',message:'fill-stack-fill-fit-transform-unqualified'});
  }
 }
 if(totalBytes>32*1024*1024)ctx.addIssue({code:'custom',message:'fill-stack-total-image-byte-budget'});
});
export const FillStackTableSchema=z.strictObject({props:z.array(z.string().min(1)).min(1),rows:z.array(z.strictObject({values:z.array(z.string()),stack:FillStackSchema})).min(1).max(4096)}).superRefine((table,ctx)=>{
 if(new Set(table.props).size!==table.props.length)ctx.addIssue({code:'custom',message:'fill-stack-duplicate-axis'});
 const keys=new Set<string>();for(const row of table.rows){const key=JSON.stringify(row.values);if(row.values.length!==table.props.length||keys.has(key))ctx.addIssue({code:'custom',message:'fill-stack-row-domain'});keys.add(key);}
});
export type FillStack=z.infer<typeof FillStackSchema>;
export type FillStackPaint=z.infer<typeof FillStackPaintSchema>;
export type FillStackTable=z.infer<typeof FillStackTableSchema>;
export function resolveFillStack(part:{fillStack?:FillStack;fillStackByCombination?:FillStackTable},values:Record<string,string|undefined>):FillStack|undefined {
 if(part.fillStack&&part.fillStackByCombination)throw Error('fill-stack-base-table-conflict');
 if(part.fillStack)return FillStackSchema.parse(part.fillStack);
 if(!part.fillStackByCombination)return;
 const table=FillStackTableSchema.parse(part.fillStackByCombination),row=table.rows.find(r=>table.props.every((p,i)=>values[p]===r.values[i]));
 if(!row)throw Error('fill-stack-selected-row-missing');return row.stack;
}
export function fillStackPaintCss(paint:FillStackPaint,image=paint.type==='IMAGE'?paint.image:undefined):Record<string,string> {
 const base={position:'absolute',inset:'0',borderRadius:'inherit',pointerEvents:'none',display:paint.visible?'block':'none'};
 if(paint.type==='SOLID')return{...base,backgroundColor:paint.token?`var(--${paint.token.replaceAll('.','-')})`:`rgba(${paint.color.r*255},${paint.color.g*255},${paint.color.b*255},${paint.opacity})`};
 const t=paint.imageTransform;return{...base,backgroundImage:image!,backgroundRepeat:'no-repeat',opacity:String(paint.opacity),backgroundSize:paint.scaleMode==='FILL'?'cover':paint.scaleMode==='FIT'?'contain':`${100/t![0][0]}% ${100/t![1][1]}%`,backgroundPosition:!t?'50% 50%':`${t[0][0]===1?0:100*t[0][2]/(1-t[0][0])}% ${t[1][1]===1?0:100*t[1][2]/(1-t[1][1])}%`};
}
