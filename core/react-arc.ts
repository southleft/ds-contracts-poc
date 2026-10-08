import type {Part} from '../scripts/contract-schema.js';
export function wrapReactArc(part:Part,jsx:string,codePropOf:(name:string)=>string=(name)=>name):string {
 const arc=part.shape?.arc;
 if(!arc?.cap)return jsx;
 const table=part.shape?.arcByCombination;
 const expression=table
  ? `${JSON.stringify(Object.fromEntries(table.rows.map(row=>[JSON.stringify(row.values),row.arc])))}[JSON.stringify([${table.props.map(prop=>`String(${codePropOf(prop)})`).join(',')}])]`
  : JSON.stringify(arc);
 const qualified = table ? `(()=>{const arc=${expression};if(!arc)throw new globalThis.Error('ellipse-arc-row-missing');return arc;})()` : expression;
 return `<__DscArc arc={${qualified}}>${jsx}</__DscArc>`;
}
/** Keep the original layout box and update its SVG paint from live CSS sizes.
 * No source-size raster is frozen into a token-driven component. */
export const REACT_ARC_RUNTIME = `
import * as __DscArcReact from 'react';
function __DscArc({children,arc}:{children:__DscArcReact.ReactElement<any>;arc:{start:number;end:number;innerRadius:number;cap:string;align?:string}}) {
 const host=__DscArcReact.useRef<HTMLElement|null>(null);
 const childRef=children.props.ref ?? Object.getOwnPropertyDescriptor(children,'ref')?.value;
 const ref=__DscArcReact.useCallback((node:HTMLElement|null)=>{host.current=node;if(typeof childRef==='function')return childRef(node);if(childRef)childRef.current=node;},[childRef]);
 __DscArcReact.useLayoutEffect(()=>{
  const node=host.current;if(!node)return;
  const original={borderColor:node.style.borderColor,mask:node.style.mask,position:node.style.position};
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('data-dsc-arc','');svg.appendChild(path);node.appendChild(svg);
  let stopped=false;
  let owned:typeof original|null=null;
  const restore=()=>{for(const key of ['borderColor','mask','position'] as const){if(owned && node.style[key]!==owned[key])original[key]=node.style[key];else node.style[key]=original[key];}owned=null;};
  const observe=()=>{for(let parent:HTMLElement|null=node;parent;parent=parent.parentElement)mutations.observe(parent,{attributes:true,attributeFilter:['style','class','dir']});if(document.head)mutations.observe(document.head,{childList:true,subtree:true,characterData:true});};
  const update=()=>{
   if(stopped)return;mutations.disconnect();restore();
   const css=getComputedStyle(node),left=parseFloat(css.borderLeftWidth),top=parseFloat(css.borderTopWidth);
   // SVG stroke widths retain fractions that CSS borders snap away. Resolve
   // the authored declaration on SVG, including var(), calc() and unit values.
   path.style.strokeWidth=node.style.borderTopWidth || node.style.borderWidth || css.getPropertyValue('--dsc-arc-stroke-width').trim() || css.borderTopWidth;
   const stroke=parseFloat(getComputedStyle(path).strokeWidth);
   let width=parseFloat(css.width),height=parseFloat(css.height);
   if(css.boxSizing!=='border-box'){width+=left+parseFloat(css.borderRightWidth)+parseFloat(css.paddingLeft)+parseFloat(css.paddingRight);height+=top+parseFloat(css.borderBottomWidth)+parseFloat(css.paddingTop)+parseFloat(css.paddingBottom);}
   const inset=arc.align==='CENTER'?0:arc.align==='OUTSIDE'?-stroke:stroke;
   const rx=(width-inset)/2,ry=(height-inset)/2,cx=width/2,cy=height/2;
   if(![width,height,stroke].every(Number.isFinite)||rx<=0||ry<=0||stroke<=0){svg.style.display='none';observe();return;}
   const color=css.borderTopColor;
   svg.style.cssText='position:absolute;pointer-events:none;overflow:visible;left:'+(-left)+'px;top:'+(-top)+'px;width:'+width+'px;height:'+height+'px';
   svg.setAttribute('viewBox','0 0 '+width+' '+height);
   path.setAttribute('d','M '+(cx+rx*Math.cos(arc.start))+' '+(cy+ry*Math.sin(arc.start))+' A '+rx+' '+ry+' 0 '+(arc.end-arc.start>Math.PI?1:0)+' 1 '+(cx+rx*Math.cos(arc.end))+' '+(cy+ry*Math.sin(arc.end)));
   path.setAttribute('fill','none');path.setAttribute('stroke',color);path.setAttribute('stroke-width',String(stroke));path.setAttribute('stroke-linecap',arc.cap==='NONE'?'butt':arc.cap.toLowerCase());
   node.style.borderColor='transparent';node.style.mask='none';if(css.position==='static')node.style.position='relative';owned={borderColor:node.style.borderColor,mask:node.style.mask,position:node.style.position};observe();
  };
  const mutations=new MutationObserver(update),resize=new ResizeObserver(update);
  const events=['pointerenter','pointerleave','pointerdown','pointerup','focusin','focusout'];
  const ancestors:HTMLElement[]=[];for(let ancestor:HTMLElement|null=node;ancestor;ancestor=ancestor.parentElement){ancestors.push(ancestor);for(const event of events)ancestor.addEventListener(event,update);}
  update();resize.observe(node);window.addEventListener('resize',update);
  return()=>{stopped=true;mutations.disconnect();resize.disconnect();window.removeEventListener('resize',update);for(const ancestor of ancestors)for(const event of events)ancestor.removeEventListener(event,update);svg.remove();restore();};
 });
 return __DscArcReact.cloneElement(children,{ref});
}
`;
