import {NATIVE_AUTHORED_FONT_PROFILE_RUNTIME} from './native-font-profile.js';
import {walkAnatomy,type Contract,type ComponentRef,type Part} from '../scripts/contract-schema.js';
import {inspectTextAppearance,inspectAuthoredTextAppearance,type QualifiedTextAppearance} from './source-text-appearance-control.js';

const SCALAR_FACE_WEIGHTS:Readonly<Record<string,number>>={thin:100,extralight:200,light:300,regular:400,medium:500,semibold:600,bold:700,extrabold:800,black:900};
/** The scalar writer's finite face vocabulary, independent of readback values. */
export function nativeScalarFaceWeight(style:string):number|undefined {
 return SCALAR_FACE_WEIGHTS[style.toLowerCase().replace(/[ _-]+/g,'').replace(/italic$/,'')||'regular'];
}

/** Only independently compiled scalar channels. Never derive replacement
 * styling from an authored range or from an already styled native instance. */
export interface NativeScalarTextRecipe {
 fontSize:number;fontStyle:string;fontFamily?:string;
 fontVariationSettings?:Record<string,number>;
 lineHeight?:number|{unit:'PIXELS'|'PERCENT';value:number};
 letterSpacing:number;textCase:'ORIGINAL'|'UPPER'|'LOWER'|'TITLE';
 textDecoration:'NONE'|'UNDERLINE'|'STRIKETHROUGH';
 textStyle?:string;fontSizeVar?:string;fontWeightVar?:string;lineHeightVar?:string;
 textFill?:string;textFillLit?:{r:number;g:number;b:number;a?:number};
 nativeWeightBinding?:boolean;
}
export interface NativeAuthoredTextRecipes {
 contractId:string;isSet:boolean;
 variants:Array<{name:string;plans:Array<{target:string;appearance:QualifiedTextAppearance;scalar:NativeScalarTextRecipe}>;
  instances?:Array<{target:string;spec:NativeAuthoredTextInstanceRecipe}>}>;
}
export interface NativeAuthoredTextInstanceRecipe {
 depContractId:string;instanceAuthoredTextAppearance:true;
 instanceAuthoredTextRecipes:NativeAuthoredTextRecipes;
 instanceTextAppearances?:Record<string,QualifiedTextAppearance>;
}
type AuthoredTextSpec=Partial<NativeScalarTextRecipe>&{characters?:string;authoredTextAppearance?:QualifiedTextAppearance;authoredTextAppearanceTarget?:string;authoredTextScalar?:NativeScalarTextRecipe};
export function attachNativeAuthoredTextAppearance(spec:AuthoredTextSpec,part:Part,contract:Contract,subst:Record<string,string>):void {
 if(part.textAppearanceTokenBindings)throw Error('authored-text-appearance-token-binding-native-unsupported');
 const table=part.textAppearanceByCombination;if(!table)return;
 const matches=walkAnatomy(contract).filter(w=>w.part.textAppearanceByCombination===table);
 if(matches.length!==1)throw Error('authored-text-appearance-owner-unqualified');
 const values=table.props.map(prop=>Object.hasOwn(subst,prop)?subst[prop]:null);
 const rows=table.rows.filter(row=>JSON.stringify(row.values)===JSON.stringify(values));
 if(rows.length!==1)throw Error('authored-text-appearance-combination-unqualified');
 const appearance=inspectAuthoredTextAppearance(rows[0].appearance);
 if(appearance.characters!==spec.characters)throw Error('authored-text-appearance-characters-unqualified');
 if(appearance.runs.some(r=>r.fill.variableId))throw Error('authored-text-appearance-range-binding-unsupported');
 spec.authoredTextScalar={fontSize:spec.fontSize??16,fontStyle:spec.fontStyle??'Medium',
  letterSpacing:spec.letterSpacing??0,textCase:spec.textCase??'ORIGINAL',textDecoration:spec.textDecoration??'NONE',
  ...Object.fromEntries(['fontFamily','fontVariationSettings','lineHeight','textStyle','fontSizeVar','fontWeightVar','lineHeightVar','textFill','textFillLit'].flatMap(key=>{
   const value=spec[key as keyof AuthoredTextSpec];return value===undefined?[]:[[key,value]];
  }))};
 spec.authoredTextAppearance=appearance;
 spec.authoredTextAppearanceTarget=contract.id+':authored:'+JSON.stringify(matches[0].path);
}
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

/** Explicit-only controls have no authenticated default profile. Any native
 * axis map absent from source intent must refuse rather than match face names. */
export const NATIVE_EXPLICIT_TEXT_AXIS_RUNTIME=NATIVE_TEXT_APPEARANCE_RUNTIME
 .replace('const fill=Array.isArray(s.fills)&&s.fills.length===1?s.fills[0]:undefined;',
  "if(nativeFontDefaultProfileRequired(s.fontName,r.fontName))throw Error('text-appearance-native-font-default-profile-unverified:'+key);const fill=Array.isArray(s.fills)&&s.fills.length===1?s.fills[0]:undefined;")
 .replace('s.fontName.family!==r.fontName.family||s.fontName.style!==r.fontName.style',
  '!nativeFontNameExact(s.fontName,r.fontName)');

/** Authored carriers independently calibrate omitted-axis named faces. */
export const NATIVE_AUTHORED_TEXT_OVERRIDE_RUNTIME=NATIVE_TEXT_APPEARANCE_RUNTIME
 .replace('await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));',
  'await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));for(const font of fonts.values())await prepareAuthoredFont(font);')
 .replace('s.fontName.family!==r.fontName.family||s.fontName.style!==r.fontName.style',
  '!authoredFontNameSame(s.fontName,r.fontName)');

/** Functions are emitted only for authored carriers. applyScalarText is the
 * factored existing scalar initializer supplied by emit-figma-script. */
export const NATIVE_AUTHORED_TEXT_APPEARANCE_FUNCTIONS=`
${NATIVE_AUTHORED_FONT_PROFILE_RUNTIME}
function nativeScalarFaceWeight(style) {
 return ${JSON.stringify(SCALAR_FACE_WEIGHTS)}[style.toLowerCase().replace(/[ _-]+/g,'').replace(/italic$/,'')||'regular'];
}
function authoredTextSame(a,b) {
 return typeof a==='number'&&typeof b==='number'?Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-5:a===b;
}
function authoredTextStyleSame(a,b) {
 return authoredFontNameSame(a.fontName,b.fontName)&&
  authoredTextSame(a.fontSize,b.fontSize)&&authoredTextSame(a.fontWeight,b.fontWeight)&&
  a.lineHeight.unit===b.lineHeight.unit&&(a.lineHeight.unit==='AUTO'||authoredTextSame(a.lineHeight.value,b.lineHeight.value))&&
  a.letterSpacing.unit===b.letterSpacing.unit&&authoredTextSame(a.letterSpacing.value,b.letterSpacing.value)&&
  a.textCase===b.textCase&&a.textDecoration===b.textDecoration;
}
function authoredTextFields(target) {
 return {fontName:target.fontName,fontSize:target.fontSize,fontWeight:target.fontWeight,
  lineHeight:target.lineHeight,letterSpacing:target.letterSpacing,textCase:target.textCase,textDecoration:target.textDecoration};
}
function qualifyScalarTextPaint(scalar,target) {
 if(!scalar.textFill)return;
 const variable=need(scalar.textFill);let resolved;
 try{resolved=variable.resolveForConsumer(target)?.value;}catch(error){throw Error('authored-text-appearance-scalar-paint-unresolved');}
 if(variable.resolvedType!=='COLOR'||!resolved||!['r','g','b'].every(c=>typeof resolved[c]==='number'&&Number.isFinite(resolved[c])&&resolved[c]>=0&&resolved[c]<=1)||
  resolved.a!==undefined&&(typeof resolved.a!=='number'||!Number.isFinite(resolved.a)||resolved.a<0||resolved.a>1))
  throw Error('authored-text-appearance-scalar-paint-unqualified');
}
async function preflightAuthoredText(plans) {
 const fonts=new Map();for(const {target,appearance} of plans){
  // Changed callers use applyScalarText's exact/compact face resolver and
  // calibration before any scalar mutation. Loading only the first spelling
  // here would incorrectly refuse a valid compact face.
  if(target&&target.characters!==appearance.characters)continue;
  for(const r of appearance.runs){
  if(r.fill.variableId)throw Error('authored-text-appearance-range-binding-unsupported');
  fonts.set(JSON.stringify(r.fontName),r.fontName);
  }
 }
 try{await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));}
 catch(error){throw Error('authored-text-appearance-font-unavailable');}
 for(const font of fonts.values())await prepareAuthoredFont(font);
}
function verifyAuthoredText(target,appearance,key) {
 if(target.characters!==appearance.characters)throw Error('authored-text-appearance-readback-characters:'+key);
 for(const r of appearance.runs){
  const segments=target.getStyledTextSegments(['fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','fills'],r.start,r.end);
  let end=r.start;
  for(const s of segments){
   const p=Array.isArray(s.fills)&&s.fills.length===1?s.fills[0]:undefined;
   if(!authoredTextSame(s.fontWeight,r.fontWeight))throw Error('authored-text-appearance-weight-unqualified:'+key);
   if(s.start!==end||s.end<=s.start||s.end>r.end||s.characters!==appearance.characters.slice(s.start,s.end)||!authoredTextStyleSame(s,r)||
    !p||p.type!=='SOLID'||p.visible===false||(p.blendMode||'NORMAL')!=='NORMAL'||Object.keys(p.boundVariables||{}).length||
    !authoredTextSame(p.opacity===undefined?1:p.opacity,r.fill.paint.opacity)||!['r','g','b'].every(c=>authoredTextSame(p.color[c],r.fill.paint.color[c])))
    throw Error('authored-text-appearance-readback-mismatch:'+key);
   end=s.end;
  }
  if(end!==r.end)throw Error('authored-text-appearance-readback-incomplete:'+key);
 }
}
async function applyAuthoredTextPlan(target,appearance,scalar,key) {
 if(target.type!=='TEXT'||!scalar)throw Error('authored-text-appearance-target-unqualified:'+key);
 const characters=target.characters;
 if(characters!==appearance.characters){
  await applyScalarText(target,scalar,undefined,true);
  if(target.characters!==characters)throw Error('authored-text-appearance-reset-changed-characters:'+key);
  return;
 }
 const baseline=authoredTextFields(target);
 // Scalar paint is an independently compiled fallback, not source range
 // binding authority. Qualify it before literal ranges replace its paint;
 // changed caller text must restore this exact recipe and alias.
 qualifyScalarTextPaint(scalar,target);
 for(const r of appearance.runs){
  const typographyChanged=!authoredTextStyleSame(baseline,r);
  if(scalar.textStyle&&typographyChanged)throw Error('authored-text-appearance-style-identity-conflict:'+key);
  if(!scalar.textStyle&&scalar.fontSizeVar&&!authoredTextSame(baseline.fontSize,r.fontSize))throw Error('authored-text-appearance-size-binding-conflict:'+key);
  if(scalar.nativeWeightBinding&&scalar.fontWeightVar&&!authoredTextSame(baseline.fontWeight,r.fontWeight))throw Error('authored-text-appearance-weight-binding-conflict:'+key);
  if(!authoredFontNameSame(baseline.fontName,r.fontName))target.setRangeFontName(r.start,r.end,r.fontName);
  if(!authoredTextSame(baseline.fontSize,r.fontSize))target.setRangeFontSize(r.start,r.end,r.fontSize);
  if(baseline.lineHeight.unit!==r.lineHeight.unit||r.lineHeight.unit!=='AUTO'&&!authoredTextSame(baseline.lineHeight.value,r.lineHeight.value))target.setRangeLineHeight(r.start,r.end,r.lineHeight);
  if(baseline.letterSpacing.unit!==r.letterSpacing.unit||!authoredTextSame(baseline.letterSpacing.value,r.letterSpacing.value))target.setRangeLetterSpacing(r.start,r.end,r.letterSpacing);
  if(baseline.textCase!==r.textCase)target.setRangeTextCase(r.start,r.end,r.textCase);
  if(baseline.textDecoration!==r.textDecoration)target.setRangeTextDecoration(r.start,r.end,r.textDecoration);
  target.setRangeFills(r.start,r.end,[{type:'SOLID',color:r.fill.paint.color,opacity:r.fill.paint.opacity,blendMode:'NORMAL'}]);
 }
 verifyAuthoredText(target,appearance,key);
 if(scalar.textStyle){const style=await ourTextStyle(scalar.textStyle);if(!style||target.textStyleId!==style.id)throw Error('authored-text-appearance-style-identity-lost:'+key);}
 for(const field of ['fontSize','fontWeight']){
  const name=field==='fontSize'&&!scalar.textStyle?scalar.fontSizeVar:field==='fontWeight'&&scalar.nativeWeightBinding?scalar.fontWeightVar:undefined;
  if(name&&target.boundVariables?.[field]?.id!==need(name).id)throw Error('authored-text-appearance-binding-lost:'+key);
 }
}
async function replayExplicitAuthoredTextAppearance(node,spec) {
${NATIVE_AUTHORED_TEXT_OVERRIDE_RUNTIME.slice(NATIVE_AUTHORED_TEXT_OVERRIDE_RUNTIME.indexOf('  if(spec.instanceTextAppearances)'))}
}
async function applyInstanceAuthoredText(node,spec,active) {
 if(!spec.instanceAuthoredTextAppearance)return;
 active=active||new Set();
 if(active.has(node.id))throw Error('authored-text-appearance-instance-cycle');
 active.add(node.id);
 const C=spec.instanceAuthoredTextRecipes,main=await node.getMainComponentAsync();
 if(!C||C.contractId!==spec.depContractId)throw Error('authored-text-appearance-child-recipe-unqualified');
 if(!main)throw Error('authored-text-appearance-child-main-unavailable');
 const owner=main.parent?.type==='COMPONENT_SET'?main.parent:main;
 if(owner.getSharedPluginData('ds_contracts','contractId')!==C.contractId)throw Error('authored-text-appearance-child-owner-unqualified');
 const variants=C.variants,selected=C.isSet?variants.filter(v=>v.name===main.name):variants;
 if(selected.length!==1)throw Error('authored-text-appearance-child-variant-unqualified');
 const recipes=selected[0].plans;
 const previousSkip=figma.skipInvisibleInstanceChildren;figma.skipInvisibleInstanceChildren=false;
 try{
  const plans=[];
  for(const recipe of recipes){
   const key=recipe.target,found=[];
   const visit=n=>{if(n.type==='INSTANCE')return;if(n.getSharedPluginData('ds_contracts','authoredTextAppearance')===key)found.push(n);for(const c of n.children||[])visit(c);};
   for(const c of node.children||[])visit(c);
   if(!key||found.length!==1||found[0].type!=='TEXT')throw Error('authored-text-appearance-child-target-unqualified');
   plans.push({target:found[0],appearance:recipe.appearance,scalar:recipe.scalar,key});
  }
  await preflightAuthoredText(plans);
  for(const plan of plans)await applyAuthoredTextPlan(plan.target,plan.appearance,plan.scalar,plan.key);
  for(const recipe of selected[0].instances||[]){
   if(!recipe.target||!recipe.spec?.instanceAuthoredTextAppearance)throw Error('authored-text-appearance-nested-recipe-unqualified');
   const found=[];
   // Locate exactly the compiled instance owned by this selected main. Never
   // inspect an arbitrary instance's private descendants at this boundary.
   const visit=n=>{if(n.type==='INSTANCE'){if(n.getSharedPluginData('ds_contracts','authoredTextInstance')===recipe.target)found.push(n);return;}for(const c of n.children||[])visit(c);};
   for(const c of node.children||[])visit(c);
   if(found.length!==1)throw Error('authored-text-appearance-nested-target-unqualified');
   // Ancestor TEXT/variant inputs have already settled. Re-applying the
   // original depProps would overwrite those caller values.
   await applyInstanceAuthoredText(found[0],recipe.spec,active);
   await replayExplicitAuthoredTextAppearance(found[0],recipe.spec);
  }
 }finally{active.delete(node.id);figma.skipInvisibleInstanceChildren=previousSkip;}
}
`;
