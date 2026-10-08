import {resolveTokens,resolveLiterals,type Contract,type Part} from '@ds-contracts/schema';

type Size={width:number;height:number};
type Measure=(resolve:(path:string)=>unknown)=>Size|undefined;
/** Prove a generated HUG box from its selected fixed path children and spacing.
 * This is a layout proof, not a captured bbox override. Unsupported geometry
 * or caller-dependent selections leave the existing refusal in place. */
export function instanceIntrinsicSizePlan(child:Contract,instance:Part):Measure|undefined {
 const root=child.anatomy.root;
 if(!root || !['div','span'].includes(child.semantics.element) || Object.keys(child.anatomy).length!==1 || child.bindings.code.runtime ||
    !instance.component || Object.keys(instance.component.overrides??{}).length ||
    Object.keys(instance.component.rootOverrides??{}).some(key=>!['width','height'].includes(key) || !root.instanceRootInputs?.includes(key as 'width'|'height')) || instance.component.rootFill?.length)return;
 const selected:Record<string,string>={};
 for(const prop of child.props){
  const value=instance.component.props?.[prop.name]??prop.default;
  if(typeof prop.type!=='object'||!('enum'in prop.type)||typeof value!=='string'||!prop.type.enum.includes(value))return;
  selected[prop.name]=value;
 }
 const allowed=new Set(['layout','parts','literals','tokens','declared','literalsByProp','tokensByProp','shape',
  'solidFillComposition','solidFillCompositionByCombination','solidFillCompositionSourceBinding','solidFillCompositionObservedBinding','solidFillCompositionToken','instanceRootInputs']);
 const geometryKeys=new Set(['width','height','padding','padding-inline','padding-block','padding-left','padding-right','padding-top','padding-bottom','gap','row-gap','column-gap']);
 const paintKeys=new Set(['background-color','color','opacity']);
 const styles=(part:Part)=>{
  if(Object.keys(part).some(key=>!allowed.has(key)))return;
  const resolved=resolveLiterals(part,selected);
  if(Object.keys(part.declared??{}).some(key=>key in resolved))return;
  const lits={...resolved,...part.declared},refs=resolveTokens(part,selected);
  if(Object.keys(refs).some(key=>key in lits))return;
  const entries={...lits,...refs};
  if(Object.keys(entries).some(key=>!geometryKeys.has(key)&&!paintKeys.has(key)&&!(key==='position'&&entries[key]==='relative')))return;
  return entries;
 };
 const r=styles(root),layout=root.layout;
 if(root.shape)return;
 if(!r||r.width!=='fit-content'||r.height!=='fit-content'||!layout||
    !['flex','inline-flex'].includes(layout.display??'')||!['row','column'].includes(layout.direction??'row')||
    Object.keys(layout).some(key=>!['display','direction','align','justify'].includes(key)))return;
 const leaves=Object.values(root.parts??{}).map(part=>{
  const shape=part.shape,s=styles(part);
  if(!s||!shape||shape.kind!=='path'||shape.rotation||shape.parentViewport||part.layout||part.parts||
     Object.keys(s).some(key=>!['width','height'].includes(key)&&!paintKeys.has(key)))return;
  const chosen=shape.pathsByProp?shape.pathsByProp.map[selected[shape.pathsByProp.prop]]:shape;
  if(!chosen)return;
  return {style:s,size:{width:chosen.width,height:chosen.height}};
 });
 if(!leaves.length||leaves.some(value=>!value))return;
 return resolve=>{
  try{
   const px=(value:unknown):number=>{
    if(typeof value==='string'&&/^\{[^{}]+\}$/.test(value))value=resolve(value.slice(1,-1));
    const n=typeof value==='number'?value:typeof value==='string'&&/^(?:\d+(?:\.\d+)?px|0)$/.test(value)?parseFloat(value):NaN;
    if(!Number.isFinite(n)||n<0)throw Error('intrinsic-dimension-unproven');return n;
   };
   const box={top:0,right:0,bottom:0,left:0};
   // Refuse overlapping padding spellings rather than assume CSS ordering.
   const assigned=new Set<string>();
   for(const [key,sides] of Object.entries({padding:['top','right','bottom','left'],'padding-inline':['left','right'],'padding-block':['top','bottom'],'padding-left':['left'],'padding-right':['right'],'padding-top':['top'],'padding-bottom':['bottom']})){
    if(r[key]===undefined)continue;
    const value=px(r[key]);for(const side of sides){if(assigned.has(side))throw Error('padding-conflict');assigned.add(side);box[side as keyof typeof box]=value;}
   }
   const sizes=leaves.map(leaf=>{
    const {style,size}=leaf!;
    for(const axis of ['width','height'] as const)if(style[axis]!==undefined&&px(style[axis])!==size[axis])throw Error('shape-size-conflict');
    return size;
   });
   if(r.gap!==undefined&&(r['row-gap']!==undefined||r['column-gap']!==undefined))return;
   const row=(layout.direction??'row')==='row',gap=px(r[row?'column-gap':'row-gap']??r.gap??0);
   const width=(row?sizes.reduce((sum,size)=>sum+size.width,0)+gap*(sizes.length-1):Math.max(...sizes.map(size=>size.width)))+box.left+box.right;
   const height=(row?Math.max(...sizes.map(size=>size.height)):sizes.reduce((sum,size)=>sum+size.height,0)+gap*(sizes.length-1))+box.top+box.bottom;
   // An explicit caller dimension is redundant only if every resolved mode
   // equals the independently derived HUG extent. Never use it to derive size.
   for(const axis of ['width','height'] as const){
    const override=instance.component?.rootOverrides?.[axis];
    if(override!==undefined && px(override)!==({width,height})[axis])return;
   }
   return width>0&&height>0&&Number.isFinite(width+height)?{width,height}:undefined;
  }catch{return;}
 };
}
