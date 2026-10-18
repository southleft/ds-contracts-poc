import {scalarTextSizeInput} from '../packages/schema/src/scalar-text-size-input.js';
import type {Contract,ComponentRef,Part} from '../scripts/contract-schema.js';
export type NativeTextSize={characters:string;fontSize:number;lineHeight:number};
export const scalarTextSizeTarget=(c:Contract,path:string[])=>c.id+':scalar-size:'+JSON.stringify(path);
export function nativeTextSizeTarget(c:Contract,part:Part):string|undefined{
 if(!part.literalsByProp?.length)return;
 for(const p of c.props){const q=scalarTextSizeInput(c,p.name);if(q?.part===part)return scalarTextSizeTarget(c,q.path);}
}
export function mapNativeTextSizes(c:Contract,props:NonNullable<ComponentRef['props']>,subst:Record<string,string>):Record<string,NativeTextSize>|undefined{
 const out:Record<string,NativeTextSize>={};
 for(const [name,raw]of Object.entries(props)){
  const q=scalarTextSizeInput(c,name);if(!q)continue;
  let value:unknown=typeof raw==='object'?raw.map[subst[raw.prop]??'']:raw;
  if(typeof raw==='string'&&/^\{[\w-]+\}$/.test(raw))value=subst[raw.slice(1,-1)];
  if(value===undefined)continue;
  if(typeof value!=='string'||!Object.hasOwn(q.choices,value))throw Error('scalar-text-size-native-value-unqualified');
  out[scalarTextSizeTarget(c,q.path)]={characters:q.part.text!,...q.choices[value]};
 }
 return Object.keys(out).length?out:undefined;
}
/** Existing exact owned-text markers locate the target; this is explicitly a
 * whole-node scalar operation, not a fabricated multi-range appearance. */
export const NATIVE_SCALAR_TEXT_SIZE_FUNCTION=`
async function applyInstanceTextSizes(node,spec){
 if(!spec.instanceTextSizes){if(spec.instanceIntrinsicPlacements)reflowInstanceIntrinsicPlacements(node,spec);return;}
 const previous=figma.skipInvisibleInstanceChildren;figma.skipInvisibleInstanceChildren=false;
 try{
  const plans=[];
  for(const [key,size]of Object.entries(spec.instanceTextSizes)){
   const found=[];const visit=n=>{if(n.type==='INSTANCE')return;if(n.getSharedPluginData('ds_contracts','textSizeOverride')===key)found.push(n);for(const c of n.children||[])visit(c);};
   for(const c of node.children||[])visit(c);
   if(found.length!==1||found[0].type!=='TEXT')throw Error('scalar-text-size-native-target-unqualified:'+key);
   const target=found[0],font=target.fontName;
   if(target.characters!==size.characters||!font||font===figma.mixed||typeof font.family!=='string'||typeof font.style!=='string'||
      !Number.isFinite(target.fontSize)||target.fontSize<=0||!target.lineHeight||target.lineHeight.unit!=='PIXELS'||!Number.isFinite(target.lineHeight.value)||
      !Number.isFinite(size.fontSize)||size.fontSize<=0||!Number.isFinite(size.lineHeight)||size.lineHeight<=0)throw Error('scalar-text-size-native-source-unqualified:'+key);
   const fields=['characters','fontName','fontWeight','letterSpacing','textCase','textDecoration','fills','paragraphIndent','paragraphSpacing','textAlignHorizontal','textAutoResize','textStyleId'];
   const snapshot=()=>JSON.stringify(fields.map(k=>{if(target[k]===figma.mixed)throw Error('scalar-text-size-native-mixed:'+key);return target[k];}));
   const before=snapshot(),bound=()=>JSON.stringify(Object.fromEntries(Object.entries(target.boundVariables||{}).filter(([k])=>k!=='fontSize'&&k!=='lineHeight'))),bindings=bound();
   plans.push({key,target,font,size,before,snapshot,bound,bindings});
  }
  for(const p of plans)await figma.loadFontAsync(p.font);
  for(const p of plans){
   if(p.snapshot()!==p.before||p.bound()!==p.bindings)throw Error('scalar-text-size-native-source-changed:'+p.key);
   p.target.setBoundVariable('fontSize',null);p.target.setBoundVariable('lineHeight',null);
   p.target.fontSize=p.size.fontSize;p.target.lineHeight={unit:'PIXELS',value:p.size.lineHeight};
   if(p.target.fontSize!==p.size.fontSize||p.target.lineHeight.unit!=='PIXELS'||p.target.lineHeight.value!==p.size.lineHeight||p.snapshot()!==p.before||p.bound()!==p.bindings||
      p.target.boundVariables?.fontSize!==undefined||p.target.boundVariables?.lineHeight!==undefined)throw Error('scalar-text-size-native-readback-mismatch:'+p.key);
  }
  if(spec.instanceIntrinsicPlacements)reflowInstanceIntrinsicPlacements(node,spec);
 }finally{figma.skipInvisibleInstanceChildren=previous;}
}
`;
