import {inspectTextAppearance} from './source-text-appearance-control.js';
/** Compare independent native segments, allowing Figma to merge/split identical
 * adjacent segments while retaining complete exact-character coverage. */
export function nativeTextAppearanceMatches(expected:unknown,characters:unknown,segments:unknown):boolean {
 try{
  const e=inspectTextAppearance(expected);if(characters!==e.characters||!Array.isArray(segments)||!segments.length||segments.length>65536)return false;
  const same=(a:unknown,b:unknown)=>typeof a==='number'&&typeof b==='number'?Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-5:a===b;
  let end=0;
  for(const s of segments){
   if(!s||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start!==end||s.end<=s.start||s.end>e.characters.length||s.characters!==e.characters.slice(s.start,s.end))return false;
   const paints=s.fills,p=Array.isArray(paints)&&paints.length===1?paints[0]:undefined;
   if(!p||p.type!=='SOLID'||p.visible===false||(p.blendMode??'NORMAL')!=='NORMAL'||Object.keys(p.boundVariables??{}).length)return false;
   for(const r of e.runs.filter(r=>r.start<s.end&&r.end>s.start)){
    if(s.fontName?.family!==r.fontName.family||s.fontName?.style!==r.fontName.style||!same(s.fontSize,r.fontSize)||!same(s.fontWeight,r.fontWeight)||s.lineHeight?.unit!==r.lineHeight.unit||r.lineHeight.unit!=='AUTO'&&!same(s.lineHeight.value,r.lineHeight.value)||s.letterSpacing?.unit!==r.letterSpacing.unit||!same(s.letterSpacing.value,r.letterSpacing.value)||s.textCase!==r.textCase||s.textDecoration!==r.textDecoration||!same(p.opacity??1,r.fill.paint.opacity)||!['r','g','b'].every(k=>same(p.color?.[k],r.fill.paint.color[k as 'r'|'g'|'b'])))return false;
   }
   end=s.end;
  }
  return end===e.characters.length;
 }catch{return false;}
}
