import type {Part,VectorStroke} from '../scripts/contract-schema.js';
/** Literal source survives emitter bundling without Function.toString renaming. */
export const REACT_VECTOR_STROKE_SELECTOR_SOURCE=`
function __dscResolveVectorStroke(table:{values:(string|null)[];stroke:__DscVectorPaint|null;refusal?:string}[],values:(string|null)[],choices:Record<string,__DscVectorPaint>,choice:unknown):__DscVectorPaint {
 const dense=(v:unknown):v is unknown[]=>globalThis.Array.isArray(v)&&globalThis.Array.from({length:v.length},(_,i)=>globalThis.Object.hasOwn(v,i)).every(Boolean);
 if(!dense(table)||!dense(values)||values.some(v=>v!==null&&typeof v!=='string'))throw new globalThis.Error('vector-stroke-geometry-unqualified');
 const row=table.find(r=>dense(r.values)&&r.values.length===values.length&&r.values.every((v,i)=>v===values[i]));
 if(!row||!row.stroke)throw new globalThis.Error(row?.refusal??'vector-stroke-geometry-unqualified');
 if(choice!==undefined&&(typeof choice!=='string'||!globalThis.Object.hasOwn(choices,choice)))throw new globalThis.Error('vector-stroke-override-value-unqualified');
 return choice===undefined?row.stroke:choices[choice as string];
}
`;

export function reactVectorStroke(part:Part,attrs:string,codePropOf:(name:string)=>string):string {
  const t=part.vectorStrokeByCombination!;
  const values=t.props.map(p=>`(${codePropOf(p)} == null ? null : String(${codePropOf(p)}))`);
  return `<__DscVectorStroke ${attrs} table={${JSON.stringify(t.rows)}} values={[${values.join(', ')}]} choices={${JSON.stringify(part.vectorStrokeOverride?.choices??{})}} choice={${part.vectorStrokeOverride?codePropOf(part.vectorStrokeOverride.prop):'undefined'}} />`;
}
export const REACT_VECTOR_STROKE_RUNTIME=`
import type {CSSProperties as __DscVectorCSS} from 'react';
${REACT_VECTOR_STROKE_SELECTOR_SOURCE}
type __DscVectorPaint={data:string;width:number;height:0;cap:'NONE';join:'MITER';miterLimit:number;weight:number;color:{r:number;g:number;b:number};opacity:number};
function __DscVectorStroke({table,values,choices,choice,className,style}:{table:{values:(string|null)[];stroke:__DscVectorPaint|null;refusal?:string}[];values:(string|null)[];choices:Record<string,__DscVectorPaint>;choice?:string;className?:string;style?:__DscVectorCSS}) {
 const s=__dscResolveVectorStroke(table,values,choices,choice),color='rgba('+s.color.r*255+','+s.color.g*255+','+s.color.b*255+','+s.opacity+')';
 return <span className={className} style={{...style,position:'relative',height:0,minHeight:0}} aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="100%" height={s.weight} viewBox={'0 '+(-s.weight/2)+' '+s.width+' '+s.weight} preserveAspectRatio="none" style={{display:'block',position:'absolute',top:-s.weight/2,left:0,overflow:'visible'}}><path d={s.data} fill="none" stroke={color} strokeWidth={s.weight} strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit={s.miterLimit} vectorEffect="non-scaling-stroke" /></svg></span>;
}
`;
