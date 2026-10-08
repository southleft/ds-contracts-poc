import {z} from 'zod';
const ownDense=(v:unknown):boolean=>Array.isArray(v)&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const denseArray=<T extends z.ZodType>(item:T,min=0,max=4096)=>{
 const array=z.array(item).min(min).max(max),{$schema:ignored,...jsonShape}=z.toJSONSchema(array,{target:'draft-7',io:'input'});
 // JSON cannot encode holes or inherited cells; its ordinary array shape is
 // derived from the exact downstream schema while runtime checks own indices.
 return z.preprocess(v=>ownDense(v)?v:undefined,array).meta(jsonShape);
};

/** An observed native VECTOR segment. Its logical height stays zero;
 * source path bytes and the independent logical width both survive. */
export const VectorStrokeSchema=z.strictObject({
  data:z.string().min(1).max(65536),width:z.number().finite().positive().max(1e6),height:z.literal(0),
  cap:z.literal('NONE'),join:z.literal('MITER'),miterLimit:z.number().finite().min(1).max(1000),
  weight:z.number().finite().positive().max(1e6),
  color:z.strictObject({r:z.number().finite().min(0).max(1),g:z.number().finite().min(0).max(1),b:z.number().finite().min(0).max(1)}),
  opacity:z.number().finite().min(0).max(1),
}).superRefine((stroke,ctx)=>{
  const m=/^M 0 0 L (\d+(?:\.\d+)?) 0$/.exec(stroke.data),end=m?Number(m[1]):NaN;
  if(!Number.isFinite(end)||end<=0||Math.fround(end)!==Math.fround(stroke.width))ctx.addIssue({code:'custom',message:'vector-stroke-source-endpoint-unqualified'});
});
export type VectorStroke=z.infer<typeof VectorStrokeSchema>;
export const VectorStrokeTableSchema=z.strictObject({
  props:denseArray(z.string().min(1),1,8),
  rows:denseArray(z.strictObject({values:denseArray(z.string().nullable()),stroke:VectorStrokeSchema.nullable(),refusal:z.enum(['vector-stroke-dashed-unqualified','vector-stroke-vertical-unqualified']).optional()}),1,4096),
}).superRefine((table,ctx)=>{
  if(table.rows.some(r=>r.stroke===null?r.refusal===undefined:r.refusal!==undefined))ctx.addIssue({code:'custom',message:'vector-stroke-null-requires-named-source-limit'});
  if(new Set(table.props).size!==table.props.length||table.rows.some(r=>r.values.length!==table.props.length)||new Set(table.rows.map(r=>JSON.stringify(r.values))).size!==table.rows.length)ctx.addIssue({code:'custom',message:'vector-stroke-table-invalid'});
});
export const VectorStrokeOverrideSchema=z.strictObject({prop:z.string().min(1),choices:z.record(z.string().min(1),VectorStrokeSchema)});

export function vectorStrokeColor(s:VectorStroke):string{return `rgba(${s.color.r*255},${s.color.g*255},${s.color.b*255},${s.opacity})`;}

/** No native LINE alias or silent no-paint lowering on other surfaces. */
export function refuseVectorStrokeSurface(contract:any,byId:ReadonlyMap<string,any>|undefined,surface:string):void {
  const visited=new Set<string>();
  const visit=(c:any)=>{if(!c||visited.has(c.id))return;visited.add(c.id);
    const walk=(p:any)=>{if(p.vectorStrokeByCombination||p.vectorStrokeOverride)throw Error('vector-stroke-surface-unqualified:'+surface+':'+c.id);
      for(const child of Object.values(p.parts??{}))walk(child);
      if(p.component?.id)visit(byId?.get(p.component.id));
      for(const item of p.slot?.defaultContent??[])visit(byId?.get(item.id));};for(const root of Object.values(c.anatomy))walk(root);
  };visit(contract);
}
