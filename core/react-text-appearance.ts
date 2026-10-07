import type {Part} from '../scripts/contract-schema.js';
import {inspectTextAppearance} from './source-text-appearance-control.js';

export interface ReactTextAppearance {
 characters:string;
 runs:Array<{start:number;end:number;style:Record<string,string|number>}>;
}
/** Compile an already captured complete partition. Font family and weight remain
 * source facts; preserve fractional pixel spacing and Figma's rounded percent
 * line boxes. No source text is replaced or inferred here. */
export function compileReactTextAppearance(value:unknown):ReactTextAppearance {
 const appearance=inspectTextAppearance(value);
 return {characters:appearance.characters,runs:appearance.runs.map(r=>{
  const paint=r.fill.paint;
  const style:Record<string,string|number>={
   fontFamily:JSON.stringify(r.fontName.family),fontSize:r.fontSize,fontWeight:r.fontWeight,
   fontStyle:/italic|oblique/i.test(r.fontName.style)?'italic':'normal',
   lineHeight:r.lineHeight.unit==='AUTO'?'normal':`${r.lineHeight.unit==='PERCENT'?Math.round(r.fontSize*r.lineHeight.value/100):r.lineHeight.value}px`,
   letterSpacing:`${r.letterSpacing.unit==='PERCENT'?r.fontSize*r.letterSpacing.value/100:r.letterSpacing.value}px`,
   color:`rgba(${paint.color.r*255}, ${paint.color.g*255}, ${paint.color.b*255}, ${paint.opacity})`,
   textTransform:({ORIGINAL:'none',UPPER:'uppercase',LOWER:'lowercase',TITLE:'capitalize',SMALL_CAPS:'none',SMALL_CAPS_FORCED:'none'} as Record<string,string>)[r.textCase],
   fontVariantCaps:r.textCase==='SMALL_CAPS_FORCED'?'all-small-caps':r.textCase==='SMALL_CAPS'?'small-caps':'normal',
   textDecoration:r.textDecoration==='UNDERLINE'?'underline':r.textDecoration==='STRIKETHROUGH'?'line-through':'none',
  };
  return {start:r.start,end:r.end,style};
 })};
}

/** Shared generated runtime for both React surfaces. The caller supplies the
 * resolved text independently; a stale choice cannot silently replace it. */
export const REACT_TEXT_APPEARANCE_RUNTIME=`
import * as __DscAppearanceReact from 'react';
function __DscTextAppearance({children,value,characters,choices}:{children:__DscAppearanceReact.ReactElement<any>;value?:string;characters:string;choices:Record<string,{characters:string;runs:Array<{start:number;end:number;style:__DscAppearanceReact.CSSProperties}>}>}) {
 if(value===undefined)return children;
 if(!globalThis.Object.hasOwn(choices,value))throw new globalThis.Error('text-appearance-value-unqualified');
 const appearance=choices[value];
 if(appearance.characters!==characters)throw new globalThis.Error('text-appearance-characters-unqualified');
 const runs=appearance.runs.map((run,index)=><span key={index} style={run.style}>{characters.slice(run.start,run.end)}</span>);
 return __DscAppearanceReact.cloneElement(children,{style:{...children.props.style,...appearance.runs[0].style,whiteSpace:'pre-wrap'}},runs);
}
`;

export function wrapReactTextAppearance(part:Part,jsx:string,codePropOf:(name:string)=>string){
 const control=part.textAppearanceOverride;if(!control)return jsx;
 const characters=part.content?part.content.prop:part.textByProp?Object.entries(part.textByProp.map).map(([value,text])=>`${codePropOf(part.textByProp!.prop)} === ${JSON.stringify(value)} ? ${JSON.stringify(text)} : `).join('')+JSON.stringify(part.text):JSON.stringify(part.text);
 const choices=Object.fromEntries(Object.entries(control.choices).map(([key,value])=>[key,compileReactTextAppearance(value)]));
 return `<__DscTextAppearance value={${codePropOf(control.prop)}} characters={${characters}} choices={${JSON.stringify(choices)}}>${jsx}</__DscTextAppearance>`;
}
