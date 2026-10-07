import {observeSolidFillComposition} from './solid-fill-observation.js';

export interface TextAppearanceRun {
 start:number; end:number;
 fontName:{family:string;style:string}; fontSize:number; fontWeight:number;
 lineHeight:{unit:'AUTO'}|{unit:'PIXELS'|'PERCENT';value:number};
 letterSpacing:{unit:'PIXELS'|'PERCENT';value:number};
 textCase:string; textDecoration:string;
 fill:Exclude<ReturnType<typeof observeSolidFillComposition>,undefined|{issue:string}>;
}
export type TextAppearanceObservation={characters:string;runs:TextAppearanceRun[]}|{issue:string};

/** A complete UTF-16 partition, retaining source appearance without granting
 * a rendering override. Missing/unsupported facts are explicit issues. */
export function observeTextAppearance(characters:unknown,segments:unknown):TextAppearanceObservation|undefined {
 if(typeof characters!=='string'||!characters.length||!Array.isArray(segments)||segments.length<2)return;
 const issue=(reason:string):TextAppearanceObservation=>({issue:'text-appearance-'+reason});
 if(characters.length>65536||segments.length>256)return issue('budget-exceeded');
 const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
 const boundary=(n:number)=>n===0||n===characters.length||!(characters.charCodeAt(n-1)>=0xd800&&characters.charCodeAt(n-1)<=0xdbff&&characters.charCodeAt(n)>=0xdc00&&characters.charCodeAt(n)<=0xdfff);
 const runs:TextAppearanceRun[]=[];let end=0;
 for(const s of segments){
  if(!s||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start!==end||s.end<=s.start||s.end>characters.length||!boundary(s.start)||!boundary(s.end)||s.characters!==characters.slice(s.start,s.end))return issue('range-unqualified');
  const f=s.fontName,l=s.lineHeight,k=s.letterSpacing;
  if(!f||typeof f.family!=='string'||!f.family.trim()||typeof f.style!=='string'||!f.style.trim()||f.variationSettings!==undefined||!finite(s.fontSize)||s.fontSize<=0||!finite(s.fontWeight)||s.fontWeight<1||s.fontWeight>1000)return issue('font-unqualified');
  if(!l||!['AUTO','PIXELS','PERCENT'].includes(l.unit)||l.unit!=='AUTO'&&(!finite(l.value)||l.value<0)||!k||!['PIXELS','PERCENT'].includes(k.unit)||!finite(k.value))return issue('spacing-unqualified');
  if(!['ORIGINAL','UPPER','LOWER','TITLE','SMALL_CAPS','SMALL_CAPS_FORCED'].includes(s.textCase)||!['NONE','UNDERLINE','STRIKETHROUGH'].includes(s.textDecoration))return issue('decoration-unqualified');
  const fill=observeSolidFillComposition(s.fills,true);
  if(!fill||'issue'in fill||fill.paint.blendMode!=='NORMAL')return issue('paint-unqualified');
  runs.push({start:s.start,end:s.end,fontName:{family:f.family,style:f.style},fontSize:s.fontSize,fontWeight:s.fontWeight,
   lineHeight:l.unit==='AUTO'?{unit:'AUTO'}:{unit:l.unit,value:l.value},letterSpacing:{unit:k.unit,value:k.value},textCase:s.textCase,textDecoration:s.textDecoration,fill});end=s.end;
 }
 if(end!==characters.length)return issue('range-incomplete');
 return {characters,runs};
}
