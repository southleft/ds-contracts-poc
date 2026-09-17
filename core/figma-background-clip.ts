import type {NodeSpec} from './emit-figma-script.js';
import {canonicalJson} from './contract-provenance.js';

export function backgroundPaintIdentities(component:{variants:Array<{spec:NodeSpec}>}):string[] {
 const identities:string[]=[];
 const visit=(spec:NodeSpec)=>{if(spec.backgroundPaint&&spec.nativeContractPart)identities.push(canonicalJson(spec.nativeContractPart));(spec.children??[]).forEach(visit);};
 component.variants.forEach(v=>visit(v.spec));return identities;
}

/** A separate paint plane preserves the CSS border box and content layout.
 * Geometry is derived from the current contract; colour keeps its binding.
 * Native stretch constraints preserve the inset when the outer box resizes.
 */
export function lowerPaddingBoxBackground(spec:NodeSpec, number:(name:string)=>number|undefined):boolean {
  if (!['root','frame'].includes(spec.type) || !spec.layout || spec.layout.mode==='GRID' ||
      spec.gradient || spec.strokeOutside || spec.backgroundClip || (!spec.fill&&!spec.lits?.fillColor)) return false;
  const value=(field:string,literal:number|undefined,fallback:number):number|undefined =>
    spec.bindings?.[field] ? number(spec.bindings[field]) : literal??fallback;
  const border=value('strokeWeight',spec.lits?.strokeWeight,0);
  const radius=value('cornerRadius',spec.lits?.radius,0);
  const widths=([['Top','top'],['Right','right'],['Bottom','bottom'],['Left','left']] as const)
    .map(([field,key])=>value('stroke'+field+'Weight',spec.lits?.strokeSides?.[key],border??NaN));
  const radii=([['topLeftRadius','tl'],['topRightRadius','tr'],['bottomLeftRadius','bl'],['bottomRightRadius','br']] as const)
    .map(([field,key])=>value(field,spec.lits?.radiusCorners?.[key],radius??NaN));
  if (![...widths,...radii].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0) ||
      !widths.every(v=>v===widths[0]) || !radii.every(v=>v===radii[0])) return false;
  const inset=widths[0]!,innerRadius=Math.max(0,radii[0]!-inset);
  const paint:NodeSpec={type:'shape',name:'Background paint',shape:{kind:'rect',width:1,height:1},
    backgroundPaint:{inset,radius:innerRadius},absolute:{h:'STRETCH',v:'STRETCH',left:inset,right:inset,top:inset,bottom:inset},
    ...(spec.fill?{fill:spec.fill}:{}),lits:{radius:innerRadius,...(!spec.fill&&spec.lits?.fillColor?{fillColor:spec.lits.fillColor}:{})}};
  delete spec.fill;
  if(spec.lits) {delete spec.lits.fillColor;delete spec.lits.fillClear;}
  spec.backgroundClip='padding-box';
  spec.children=[paint,...spec.children??[]];
  return true;
}
