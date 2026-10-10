import type {RestNode,RestTypeStyle} from './map.js';
import {observeTextAppearance,type TextAppearanceObservation} from '../text-appearance-observation.js';

/** REST range styles are sparse deltas over the node style, indexed in UTF-16. */
export function restTextAppearance(node:RestNode):TextAppearanceObservation|undefined {
 const characters=node.characters;
 if(typeof characters!=='string'||!characters.length)return;
 const issue=(reason:string)=>({issue:'text-appearance-'+reason});
 if(node.characterStyleOverrides===undefined&&Object.keys(node.styleOverrideTable??{}).length)return issue('range-incomplete');
 // A complete uniform observation is a real source segment, never an invented
 // second range. Absent facts still fail the shared observer below.
 const indices=node.characterStyleOverrides??Array.from({length:characters.length},()=>0);
 if(indices.length!==characters.length)return issue('range-incomplete');
 const segments=[];
 for(let start=0;start<indices.length;){
  const index=indices[start];let end=start+1;while(end<indices.length&&indices[end]===index)end++;
  const override=index===0?{}:node.styleOverrideTable?.[String(index)];
  if(!Number.isInteger(index)||index<0||!override)return issue('style-index-unqualified');
  const s={...node.style,...override} as RestTypeStyle & {fills?:unknown};
  const lineHeight=s.lineHeightUnit==='INTRINSIC_%'?{unit:'AUTO'}:s.lineHeightUnit==='PIXELS'?{unit:'PIXELS',value:s.lineHeightPx}:s.lineHeightUnit==='FONT_SIZE_%'?{unit:'PERCENT',value:s.lineHeightPercentFontSize}:undefined;
  segments.push({start,end,characters:characters.slice(start,end),fontName:{family:s.fontFamily,style:s.fontStyle},fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight,
   letterSpacing:{unit:'PIXELS',value:s.letterSpacing},textCase:s.textCase??'ORIGINAL',textDecoration:s.textDecoration??'NONE',fills:s.fills??node.fills});start=end;
 }
 return observeTextAppearance(characters,segments);
}
