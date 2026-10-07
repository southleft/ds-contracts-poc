import {walkAnatomy,type Contract,type Part} from '../scripts/contract-schema.js';
import {flattenTokens} from './tokens.js';

/** Figma FILL divides outer sizes, even below a padding sum. CSS flex's
 * zero basis includes padding. For centered, nonshrinking path graphics,
 * symmetric main-axis padding cancels algebraically from their center:
 * p + (W - 2p - content)/2 = (W - content)/2.
 * Remove only that redundant code-side padding, retaining the source contract
 * for native generation. Other content and conditional layouts are untouched. */
export function lowerCenteredFillPadding(input:Contract,tokenValues?:unknown):Contract {
 const values=tokenValues as any;
 const trees=values?[values.primitives,values.semantic,values.light,values.dark,...Object.values(values.brands??{})].filter(Boolean):[];
 const maps=trees.map(t=>flattenTokens(t as Record<string,unknown>));
 const scalar=(value:unknown,seen=new Set<string>()):boolean=>{
  if(typeof value!=='string')return false;
  if(/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)||value==='0')return true;
  const match=/^\{([^{}]+)\}$/.exec(value);if(!match||seen.has(match[1]))return false;
  const found=maps.flatMap(m=>m.has(match[1])?[m.get(match[1])!.value]:[]);
  return found.length>0&&found.every(v=>scalar(v,new Set([...seen,match[1]])));
 };
 // Resolve all finite enum substitutions before admitting fixed geometry.
 // An unresolved token, percent, flex basis or content-sized axis is not proof.
 const numbers=(value:unknown,seen=new Set<string>(),dimension=false):number[]|undefined=>{
  if(typeof value==='number')return !dimension&&Number.isFinite(value)?[value]:undefined;
  if(typeof value!=='string')return;
  if((dimension?/^(?:\d+(?:\.\d+)?|\.\d+)px$/:/^(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/).test(value))return [parseFloat(value)];
  for(const prop of input.props){
   if(!value.includes(`{${prop.name}}`)||!prop.type||typeof prop.type!=='object'||!('enum' in prop.type))continue;
   const rows=prop.type.enum.map(v=>numbers(value.replaceAll(`{${prop.name}}`,v),seen,dimension));
   return rows.every(Boolean)?rows.flatMap(v=>v!):undefined;
  }
  const match=/^\{([^{}]+)\}$/.exec(value);if(!match||seen.has(match[1]))return;
  const found=maps.flatMap(m=>m.has(match[1])?[m.get(match[1])!.value]:[]);
  const rows=found.map(v=>numbers(v,new Set([...seen,match[1]]),dimension));
  return found.length&&rows.every(Boolean)?rows.flatMap(v=>v!):undefined;
 };
 const own=(p:Part,k:string)=>[p.tokens,p.literals,p.declared].flatMap(h=>h?.[k]!==undefined?[h[k]]:[]);
 const fixed=(p:Part,k:string)=>{const values=own(p,k);const nums=values.length===1?numbers(values[0],new Set(),true):undefined;return !!nums?.length&&nums.every(v=>Number.isFinite(v)&&v>0)};
 const dynamic=(p:Part)=>JSON.stringify([p.states,p.declaredStates,p.statesByProp,p.stylesWhen,p.tokensByProp,p.tokensByCombination,p.literalsByProp,p.literalsByCombination]);
 const fixedCentered=(p:Part,root:boolean)=>{
  const l=p.layout;
  if((!root&&!l)||l&&(l.display==='grid'||l.align!=='center'||l.justify!=='center'||l.wrap||l.grow||l.growBasis)||
      p.layoutByProp||p.layoutByCombination||p.component||p.slot||p.shape||p.icon||p.text!==undefined||p.content||p.repeat||p.mask||p.meter||!p.parts||Object.keys(p.parts).length!==1)return false;
  if(!fixed(p,'width')||!fixed(p,'height')||/padding|width|height|display|align|justify|flex|position|background-clip|background-origin/.test(dynamic(p)))return false;
  const holders=[p.tokens,p.literals,p.declared];
  if(holders.some(h=>Object.keys(h??{}).some(k=>/^(?:padding(?:-(?!inline$|block$).*)?|min-width|min-height|max-width|max-height|box-sizing|background-clip|background-origin|writing-mode|position|display|flex.*|align.*|justify.*)$/.test(k))))return false;
  const child=Object.values(p.parts)[0];
  if(!fixed(child,'width')||!fixed(child,'height')||child.layout||child.layoutByProp||child.layoutByCombination||child.absolutePlacement||child.absolutePlacementByCombination||child.absoluteGeometry||child.absoluteGeometryByCombination||child.placement||child.overlay||child.repeat||child.mask||
      /width|height|flex|position|margin|align/.test(dynamic(child)))return false;
  if([child.tokens,child.literals,child.declared].some(h=>Object.keys(h??{}).some(k=>/^(?:position|margin.*|flex-(?:grow|basis)|align.*|min-width|min-height|max-width|max-height)$/.test(k))))return false;
  const shrink=own(child,'flex-shrink');if(shrink.length!==1||!numbers(shrink[0])?.every(n=>n===0))return false;
  return ['padding-inline','padding-block'].every(k=>{const a=own(p,k);return a.length===1&&!!numbers(a[0])?.every(n=>Number.isFinite(n)&&n>=0)});
 };
 const clone=structuredClone(input);let changed=false;
 for(const {part,path} of walkAnatomy(clone)){
  // For one nonshrinking fixed child, symmetric padding cancels on both
  // centered axes. CSS alone must drop it so padding cannot inflate the box.
  if(fixedCentered(part,path.length===1)){
   for(const holder of [part.tokens,part.literals,part.declared])if(holder){delete holder['padding-inline'];delete holder['padding-block'];}
   changed=true;continue;
  }

  if(path.length<2||part.layout?.growBasis!=='zero'||part.layout.justify!=='center'||part.layout.wrap||part.layoutByProp||part.layoutByCombination||!part.parts||part.component||part.slot||part.text!==undefined||part.content||part.shape||part.icon||part.repeat||part.meter)continue;
  let parent:Part=clone.anatomy[path[0]];for(const key of path.slice(1,-1))parent=parent.parts![key];
  const direction=part.layout.direction??'row';if(!['row','column'].includes(direction)||!parent.layout||parent.layout.wrap||(parent.layout?.direction??'row')!==direction||parent.layoutByCombination||Object.values(parent.layoutByProp?.map??{}).some(o=>Object.keys(o).some(k=>k!=='direction')||o.direction!==undefined&&o.direction!==direction&&o.direction!==direction+'-reverse')||parent.layout?.display==='grid')continue;
  const children=Object.values(part.parts);if(!children.length||children.some(c=>c.shape?.kind!=='path'||c.shape.parentViewport||c.parts||c.layout?.grow||c.layoutByProp||c.layoutByCombination||c.absoluteGeometry||c.absoluteGeometryByCombination||c.overlay||c.absolutePlacement||c.placement||c.declared?.position==='absolute'||/"(?:flex(?:-shrink|-basis|-grow)?|position|writing-mode)":/.test(JSON.stringify([c.tokens,c.literals,c.declared,c.states,c.declaredStates,c.stylesWhen,c.tokensByProp,c.tokensByCombination,c.literalsByProp,c.literalsByCombination]))))continue;
  const channel=direction==='column'?'padding-block':'padding-inline';
  // Limit to static own style holders; conditional or competing padding can
  // change the symmetry and must retain its original interpretation.
  const forbidden=direction==='column'?['padding','padding-top','padding-bottom','padding-block-start','padding-block-end']:['padding','padding-left','padding-right','padding-inline-start','padding-inline-end'];
  const dynamic=[part.states,part.declaredStates,part.statesByProp,part.stylesWhen,part.tokensByProp,part.tokensByCombination,part.literalsByProp,part.literalsByCombination];
  if(dynamic.some(v=>v&&/padding|flex-wrap|justify-content/.test(JSON.stringify(v))))continue;
  const holders=[part.tokens,part.literals,part.declared];
  if(holders.some(h=>h&&Object.keys(h).some(k=>forbidden.includes(k)||['flex-wrap','flex-direction','justify-content','writing-mode'].includes(k))))continue;
  const pads=holders.flatMap(h=>h?.[channel]!==undefined?[h[channel]]:[]);if(pads.length!==1||!scalar(pads[0]))continue;
  for(const h of holders)if(h)delete h[channel];changed=true;
 }
 return changed?clone:input;
}
