import {textAppearanceTokenBindingIssues,type Part} from '../scripts/contract-schema.js';
import {aliasTarget} from '../packages/core/src/tokens.js';
import {cssVarName} from '../packages/core/src/emit-tokens-css.js';
import {inspectTextAppearance,inspectAuthoredTextAppearance} from './source-text-appearance-control.js';

export interface ReactTextAppearance {
 characters:string;
 runs:Array<{start:number;end:number;style:Record<string,string|number>}>;
}
/** Compile an already captured complete partition. Font family and weight remain
 * source facts; preserve fractional pixel spacing and Figma's rounded percent
 * line boxes. No source text is replaced or inferred here. */
export function compileReactTextAppearance(value:unknown,authored=false):ReactTextAppearance {
 const appearance=authored?inspectAuthoredTextAppearance(value):inspectTextAppearance(value);
 return {characters:appearance.characters,runs:appearance.runs.map(r=>{
  const paint=r.fill.paint,variationSettings=r.fontName.variationSettings;
  const style:Record<string,string|number>={
   fontFamily:JSON.stringify(r.fontName.family),fontSize:r.fontSize,fontWeight:r.fontWeight,
   fontStyle:/italic|oblique/i.test(r.fontName.style)?'italic':'normal',
   ...(variationSettings===undefined?{}:{fontVariationSettings:Object.keys(variationSettings).sort()
    .map(axis=>`${JSON.stringify(axis)} ${variationSettings[axis]}`).join(', ')||'normal'}),
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
type __DscAppearance={characters:string;runs:Array<{start:number;end:number;style:__DscAppearanceReact.CSSProperties}>};
function __DscTextAppearance({children,value,characters,choices,authored,values=[]}:{children:__DscAppearanceReact.ReactElement<any>;value?:string;characters:string;choices:Record<string,__DscAppearance>;authored?:Array<{values:(string|null)[];appearance:__DscAppearance}>;values?:(string|null)[]}) {
 let appearance:__DscAppearance;
 if(value!==undefined){
  if(!globalThis.Object.hasOwn(choices,value))throw new globalThis.Error('text-appearance-value-unqualified');
  appearance=choices[value];
  if(appearance.characters!==characters)throw new globalThis.Error('text-appearance-characters-unqualified');
 }else if(authored){
  const rows=authored.filter(row=>row.values.length===values.length&&row.values.every((v,i)=>v===values[i]));
  if(rows.length!==1)throw new globalThis.Error('authored-text-appearance-combination-unqualified');
  appearance=rows[0].appearance;
  if(appearance.characters!==characters)return children;
 }else return children;
 const runs=appearance.runs.map((run,index)=><span key={index} style={run.style}>{characters.slice(run.start,run.end)}</span>);
 return __DscAppearanceReact.cloneElement(children,{style:{...children.props.style,...appearance.runs[0].style,whiteSpace:'pre-wrap'}},runs);
}
`;

export function boundAuthoredReactTextAppearance(part:Part,resolveToken:(path:string)=>string|number=(path)=>`var(${cssVarName(path)})`):ReactTextAppearance|undefined {
 const errors=textAppearanceTokenBindingIssues(part);if(errors.length)throw Error(errors.join('; '));
 if(!part.textAppearanceTokenBindings)return;
 const appearance=compileReactTextAppearance(part.textAppearanceByCombination!.rows[0].appearance,true);
 for(const channel of part.textAppearanceTokenBindings){
  const path=aliasTarget(part.tokens![channel]);if(!path)throw Error('text-appearance-token-reference-invalid:'+channel);
  const value=resolveToken(path);if(typeof value!=='string'&&typeof value!=='number'||typeof value==='number'&&!Number.isFinite(value))throw Error('text-appearance-token-value-invalid:'+channel);
  appearance.runs[0].style[channel==='font-size'?'fontSize':'color']=value;
 }
 return appearance;
}

export function wrapReactTextAppearance(part:Part,jsx:string,codePropOf:(name:string)=>string,resolveToken?:(path:string)=>string|number){
 const control=part.textAppearanceOverride,table=part.textAppearanceByCombination;if(!control&&!table)return jsx;
 const characters=part.content?part.content.prop:part.textByProp?Object.entries(part.textByProp.map).map(([value,text])=>`${codePropOf(part.textByProp!.prop)} === ${JSON.stringify(value)} ? ${JSON.stringify(text)} : `).join('')+JSON.stringify(part.text):JSON.stringify(part.text);
 const choices=Object.fromEntries(Object.entries(control?.choices??{}).map(([key,value])=>[key,compileReactTextAppearance(value)]));
 const bound=boundAuthoredReactTextAppearance(part,resolveToken);
 const authored=table?` authored={${JSON.stringify(table.rows.map(row=>({values:row.values,appearance:bound??compileReactTextAppearance(row.appearance,true)})))}} values={[${table.props.map(name=>`(${codePropOf(name)} == null ? null : globalThis.String(${codePropOf(name)}))`).join(', ')}]}`:'';
 return `<__DscTextAppearance value={${control?codePropOf(control.prop):'undefined'}} characters={${characters}} choices={${JSON.stringify(choices)}}${authored}>${jsx}</__DscTextAppearance>`;
}
