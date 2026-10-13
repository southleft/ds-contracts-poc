import type {NodeSpec} from './emit-figma-script.js';
import {canonicalJson} from './contract-provenance.js';

export function backgroundPaintIdentities(component:{variants:Array<{spec:NodeSpec}>}):string[] {
 const identities:string[]=[];
 const visit=(spec:NodeSpec)=>{if(spec.backgroundPaint&&spec.nativeContractPart)identities.push(canonicalJson(spec.nativeContractPart));(spec.children??[]).forEach(visit);};
 component.variants.forEach(v=>visit(v.spec));return identities;
}

const spacingFields = ['paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing'] as const;
const same = (a:unknown,b:unknown):boolean => canonicalJson(a) === canonicalJson(b);
const emptyRootSlot = (slot:NodeSpec|undefined):boolean => !!slot && slot.type==='slot' && slot.rootSlotContent===true &&
  !slot.children?.length && !slot.slotDefault?.length && !slot.callerSlotProperty && !slot.slotOptional &&
  !slot.absolute && !slot.overlay && !slot.insetOverlay;
const hugRow = (spec:NodeSpec):boolean => spec.type==='root' && spec.layout?.mode==='HORIZONTAL' &&
  !spec.layout.wrap && !spec.layout.grid && spec.layout.primary!=='SPACE_BETWEEN' &&
  !spec.rootFillWidth && !spec.callerRootFillWidth && !spec.fixedWidth && !spec.hugCeiling && spec.pct===undefined && !spec.widthFill && !spec.fillW && !spec.grow &&
  spec.lits?.width===undefined && spec.lits?.minWidth===undefined &&
  !['width','minWidth','maxWidth'].some(key=>spec.bindings?.[key]!==undefined) &&
  // A constrained HUG counter axis has no independently established inner
  // extent. Keep its existing representation until that topology is proved.
  (!!spec.fixedHeight || spec.lits?.height!==undefined ||
    (spec.lits?.minHeight===undefined && !['minHeight','maxHeight'].some(key=>spec.bindings?.[key]!==undefined))) &&
  spec.strokesIncludedInLayout!==false && !spec.strokeOutside && !spec.absolute && !spec.overlay && !spec.insetOverlay;

/** Closed internal topology, not a name-based or caller-supplied capability. */
export function rootSlotFlowSpecValid(parent:NodeSpec|undefined, carrier:NodeSpec):boolean {
  const geometry=carrier.rootSlotFlow, slot=carrier.children?.[0];
  return !!parent && hugRow(parent) && parent.backgroundClip==='padding-box' &&
    parent.children?.length===1 && parent.children[0]===carrier && !parent.fill && !parent.lits?.fillColor &&
    spacingFields.every(key=>parent.bindings?.[key]===undefined && parent.lits?.[key]===undefined) &&
    carrier.type==='frame' && carrier.name==='Root content flow' && !!geometry &&
    Object.keys(geometry).sort().join('|')==='inset|radius' &&
    [geometry.inset,geometry.radius].every(n=>Number.isFinite(n)&&n>=0) &&
    same(carrier.layout,parent.layout) && carrier.children?.length===1 && emptyRootSlot(slot) &&
    same(slot!.layout,parent.layout) && carrier.lits?.radius===geometry.radius &&
    !!(carrier.fill || carrier.lits?.fillColor) &&
    Object.keys(carrier).every(key=>['type','name','rootSlotFlow','layout','children','fill','lits','bindings','nativeContractPart'].includes(key)) &&
    Object.keys(carrier.bindings??{}).every(key=>(spacingFields as readonly string[]).includes(key)) &&
    Object.keys(carrier.lits??{}).every(key=>['radius','fillColor',...spacingFields].includes(key));
}

/** Actual geometry must hold on both the empty main and every filled caller.
 * Uses the same exact-or-float32 numeric policy as independent native readback. */
export function nativeRootSlotFlowGeometry(geometry:{inset:number;radius:number}, parent:Record<string,any>, carrier:Record<string,any>):boolean {
  const eq=(actual:unknown,expected:number)=>actual===expected || actual===Math.fround(expected);
  const inset=geometry.inset, radius=geometry.radius;
  // Compare observed values to authored geometry in the same direction as
  // every other scalar. A positive inner radius recovers the authored outer
  // radius; zero only establishes its clamped range, including the rounded
  // float32 representation of the upper boundary.
  const outerRadiusMatches=radius>0 ? eq(parent.cornerRadius,radius+inset)
    : parent.cornerRadius<=inset || eq(parent.cornerRadius,inset);
  return [inset,radius,parent.width,parent.height,parent.cornerRadius,carrier.width,carrier.height].every(n=>Number.isFinite(n)&&n>=0) &&
    parent.layoutMode==='HORIZONTAL' && parent.layoutSizingHorizontal==='HUG' && parent.primaryAxisSizingMode==='AUTO' &&
    ['AUTO','FIXED'].includes(parent.counterAxisSizingMode) &&
    parent.strokesIncludedInLayout===true && parent.strokeAlign==='INSIDE' &&
    ['Top','Right','Bottom','Left'].every(side=>eq(parent['stroke'+side+'Weight'],inset) && parent['padding'+side]===0) &&
    parent.itemSpacing===0 && outerRadiusMatches &&
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'].every(key=>eq(parent[key],parent.cornerRadius)) &&
    carrier.layoutMode==='HORIZONTAL' && carrier.layoutPositioning==='AUTO' && carrier.layoutSizingHorizontal==='HUG' &&
    carrier.primaryAxisSizingMode==='AUTO' && carrier.layoutSizingVertical===(parent.counterAxisSizingMode==='AUTO'?'HUG':'FILL') &&
    carrier.primaryAxisAlignItems===parent.primaryAxisAlignItems && carrier.counterAxisAlignItems===parent.counterAxisAlignItems &&
    eq(carrier.x,inset) && eq(carrier.y,inset) &&
    // Figma rounds the derived outer HUG extent to float32. Subtracting the
    // inset from that rounded value cannot recover a small inner SLOT seed.
    eq(parent.width,carrier.width+2*inset) && eq(parent.height,carrier.height+2*inset) &&
    eq(carrier.cornerRadius,radius) && ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'].every(key=>eq(carrier[key],radius)) &&
    same(carrier.relativeTransform,[[1,0,carrier.x],[0,1,carrier.y]]) && carrier.visible===true && carrier.opacity===1 &&
    carrier.clipsContent===false && Array.isArray(carrier.strokes) && carrier.strokes.length===0 &&
    Array.isArray(carrier.effects) && carrier.effects.length===0;
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
  // Native STRETCH paint retains the empty SLOT's 0.01px seed after caller
  // expansion. An in-flow frame follows the actual content box instead.
  // Other topologies retain their existing leaf-paint representation.
  if (hugRow(spec) && spec.children?.length===1 && emptyRootSlot(spec.children[0])) {
    const carrier:NodeSpec={type:'frame',name:'Root content flow',rootSlotFlow:{inset,radius:innerRadius},
      layout:structuredClone(spec.layout),children:spec.children,
      ...(spec.fill?{fill:spec.fill}:{}),lits:{radius:innerRadius,
        ...(!spec.fill&&spec.lits?.fillColor?{fillColor:spec.lits.fillColor}:{})}};
    for(const key of spacingFields) {
      if(spec.bindings?.[key]!==undefined) {
        (carrier.bindings??={})[key]=spec.bindings[key];delete spec.bindings[key];
      }
      if(spec.lits?.[key]!==undefined) {carrier.lits![key]=spec.lits[key];delete spec.lits[key];}
    }
    delete spec.fill;
    if(spec.lits){delete spec.lits.fillColor;delete spec.lits.fillClear;}
    if(inset===0 && spec.lits?.strokeWeight===undefined && !spec.bindings?.strokeWeight &&
        !spec.lits?.strokeSides && !['Top','Right','Bottom','Left'].some(side=>spec.bindings?.['stroke'+side+'Weight']))
      (spec.lits??={}).strokeWeight=0;
    spec.backgroundClip='padding-box';spec.strokesIncludedInLayout=true;spec.children=[carrier];
    if(!rootSlotFlowSpecValid(spec,carrier))throw Error('FIGMA_ROOT_SLOT_FLOW_INTERNAL_SHAPE');
    return true;
  }
  const paint:NodeSpec={type:'shape',name:'Background paint',shape:{kind:'rect',width:1,height:1},
    backgroundPaint:{inset,radius:innerRadius},absolute:{h:'STRETCH',v:'STRETCH',left:inset,right:inset,top:inset,bottom:inset},
    ...(spec.fill?{fill:spec.fill}:{}),lits:{radius:innerRadius,...(!spec.fill&&spec.lits?.fillColor?{fillColor:spec.lits.fillColor}:{})}};
  delete spec.fill;
  if(spec.lits) {delete spec.lits.fillColor;delete spec.lits.fillClear;}
  spec.backgroundClip='padding-box';
  spec.children=[paint,...spec.children??[]];
  return true;
}
