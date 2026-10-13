import type {Part} from '../scripts/contract-schema.js';
export function reactRectStrokePattern(part:Part,codePropOf:(name:string)=>string):string {
 const t=part.rectStrokePatternByCombination;if(!t)return '';
 const values=t.props.map(p=>`String(${codePropOf(p)})`).join(', ');
 return `<__DscRectStrokePattern table={${JSON.stringify(t.rows)}} values={[${values}]} layer={${Object.keys(part.parts??{}).length+1}} />`;
}
/** Exact authored dash/gap lengths; the live box owns geometry, not the old screenshot size. */
export const REACT_RECT_STROKE_PATTERN_RUNTIME=String.raw`
import * as __DscStrokeReact from 'react';
function __DscRectStrokePattern({table,values,layer}:{table:{values:string[];dashes:number[]}[];values:string[];layer:number}) {
 const ref=__DscStrokeReact.useRef<SVGSVGElement>(null);
 const matches=table.filter(r=>r.values.length===values.length&&r.values.every((v,i)=>v===values[i]));
 if(matches.length!==1)throw new globalThis.Error('rect-stroke-pattern-tuple-unavailable');
 const dashes=matches[0].dashes;
 if(![0,2].includes(dashes.length)||dashes.some(v=>!Number.isFinite(v)||v<=0))throw new globalThis.Error('rect-stroke-pattern-invalid');
 __DscStrokeReact.useLayoutEffect(()=>{
  const svg=ref.current,host=svg?.parentElement,rect=svg?.firstElementChild;
  if(!svg||!host||!rect)throw new globalThis.Error('rect-stroke-pattern-host-unavailable');
  const paint=()=>{
   const cs=getComputedStyle(host);
   const read=(v:string)=>{if(!/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:px)?$/.test(v.trim()))throw new globalThis.Error('rect-stroke-pattern-length-unavailable');return Number.parseFloat(v);};
   const weight=read(cs.getPropertyValue('--_stroke-width')),radius=read(cs.borderTopLeftRadius);
   // Computed used lengths stay in local coordinates under ancestor transforms.
   const borderBox=cs.boxSizing==='border-box';
   const width=read(cs.width)+(borderBox?0:read(cs.paddingLeft)+read(cs.paddingRight)+read(cs.borderLeftWidth)+read(cs.borderRightWidth));
   const height=read(cs.height)+(borderBox?0:read(cs.paddingTop)+read(cs.paddingBottom)+read(cs.borderTopWidth)+read(cs.borderBottomWidth));
   if([cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].some(v=>read(v)!==radius)||
      ![width,height,weight,radius].every(Number.isFinite)||weight<=0||width<weight||height<weight)throw new globalThis.Error('rect-stroke-pattern-box-unavailable');
   svg.setAttribute('viewBox','0 0 '+width+' '+height);
   rect.setAttribute('x',String(weight/2));rect.setAttribute('y',String(weight/2));
   rect.setAttribute('width',String(width-weight));rect.setAttribute('height',String(height-weight));
   rect.setAttribute('rx',String(Math.max(0,radius-weight/2)));
   rect.setAttribute('stroke-width',String(weight));
  };
  paint();const observer=new ResizeObserver(paint);observer.observe(host);
  const mutations=new MutationObserver(paint);for(let p:Element|null=host;p;p=p.parentElement)mutations.observe(p,{attributes:true});
  return ()=>{observer.disconnect();mutations.disconnect();};
 },[JSON.stringify(values),JSON.stringify(dashes)]);
 return <svg ref={ref} aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none" style={{display:'block',position:'absolute',inset:0,pointerEvents:'none',overflow:'visible',zIndex:layer}}><rect fill="none" stroke="var(--_stroke-color, currentColor)" strokeDasharray={dashes.length?dashes.join(' '):undefined}/></svg>;
}
`;
