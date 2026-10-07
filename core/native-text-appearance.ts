import {walkAnatomy,type Contract,type ComponentRef} from '../scripts/contract-schema.js';
import {inspectTextAppearance,type QualifiedTextAppearance} from './source-text-appearance-control.js';
export function mapNativeTextAppearances(contract:Contract,props:NonNullable<ComponentRef['props']>,subst:Record<string,string>){
 const out:Record<string,QualifiedTextAppearance>={};
 for(const {part} of walkAnatomy(contract)){
  const control=part.textAppearanceOverride;if(!control||!Object.hasOwn(props,control.prop))continue;
  const raw=props[control.prop];let value:unknown=typeof raw==='object'?raw.map[subst[raw.prop]??'']:raw;
  if(typeof raw==='string'&&/^\{[\w-]+\}$/.test(raw))value=subst[raw.slice(1,-1)];
  if(value===undefined)continue;
  if(typeof value!=='string'||!Object.hasOwn(control.choices,value))throw Error('text-appearance-native-value-unqualified');
  out[contract.id+':'+control.prop]=inspectTextAppearance(control.choices[value]);
 }
 return Object.keys(out).length?out:undefined;
}
/** Preflight every owner and font before editing ranges. Characters are set by
 * the existing TEXT property path, not by this appearance control. Readback is
 * mandatory because native instance overrides can silently refuse writes. */
export const NATIVE_TEXT_APPEARANCE_RUNTIME=`
  if(spec.textAppearanceTarget)node.setSharedPluginData('ds_contracts','textAppearanceOverride',spec.textAppearanceTarget);
  if(spec.instanceTextAppearances){
    const previousSkip=figma.skipInvisibleInstanceChildren;figma.skipInvisibleInstanceChildren=false;
    try{
      const plans=[];
      for(const [key,appearance] of Object.entries(spec.instanceTextAppearances)){
        const found=[];
        const visit=n=>{if(n.type==='INSTANCE')return;if(n.getSharedPluginData('ds_contracts','textAppearanceOverride')===key)found.push(n);for(const c of n.children||[])visit(c);};
        for(const c of node.children||[])visit(c);
        if(found.length!==1||found[0].type!=='TEXT')throw Error('text-appearance-native-target-unqualified:'+key);
        const target=found[0];
        if(target.characters!==appearance.characters)throw Error('text-appearance-native-characters-unqualified:'+key);
        plans.push({key,target,appearance});
      }
      const fonts=new Map();for(const {appearance} of plans)for(const r of appearance.runs)fonts.set(JSON.stringify(r.fontName),r.fontName);
      await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));
      for(const {key,target,appearance} of plans){
        for(const r of appearance.runs){
          target.setRangeFontName(r.start,r.end,r.fontName);
          target.setRangeFontSize(r.start,r.end,r.fontSize);
          target.setRangeLineHeight(r.start,r.end,r.lineHeight);
          target.setRangeLetterSpacing(r.start,r.end,r.letterSpacing);
          target.setRangeTextCase(r.start,r.end,r.textCase);
          target.setRangeTextDecoration(r.start,r.end,r.textDecoration);
          target.setRangeFills(r.start,r.end,[{type:'SOLID',color:r.fill.paint.color,opacity:r.fill.paint.opacity,blendMode:'NORMAL'}]);
        }
        const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-5:a===b;
        for(const r of appearance.runs){
          const actual=target.getStyledTextSegments(['fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','fills'],r.start,r.end);
          let end=r.start;
          for(const s of actual){
            const fill=Array.isArray(s.fills)&&s.fills.length===1?s.fills[0]:undefined;
            if(s.start!==end||s.end>r.end||s.end<=s.start||s.characters!==appearance.characters.slice(s.start,s.end)||s.fontName.family!==r.fontName.family||s.fontName.style!==r.fontName.style||!same(s.fontSize,r.fontSize)||!same(s.fontWeight,r.fontWeight)||s.lineHeight.unit!==r.lineHeight.unit||r.lineHeight.unit!=='AUTO'&&!same(s.lineHeight.value,r.lineHeight.value)||s.letterSpacing.unit!==r.letterSpacing.unit||!same(s.letterSpacing.value,r.letterSpacing.value)||s.textCase!==r.textCase||s.textDecoration!==r.textDecoration||!fill||fill.type!=='SOLID'||fill.visible===false||(fill.blendMode||'NORMAL')!=='NORMAL'||!same(fill.opacity===undefined?1:fill.opacity,r.fill.paint.opacity)||!['r','g','b'].every(k=>same(fill.color[k],r.fill.paint.color[k])))throw Error('text-appearance-native-readback-mismatch:'+key);
            end=s.end;
          }
          if(end!==r.end)throw Error('text-appearance-native-readback-incomplete:'+key);
        }
      }
    }finally{figma.skipInvisibleInstanceChildren=previousSkip;}
  }
`;
