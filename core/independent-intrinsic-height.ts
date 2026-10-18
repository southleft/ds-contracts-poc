import {isNativeCheckablePart,resolveLayout,resolveLiterals,resolvePresence,resolveTokens,type Contract,type Part} from '../scripts/contract-schema.js';

/** A conservative positive-height certificate, not a measurement. Only a
 * selected, supported in-flow subtree may contribute to a sibling's HUG row.
 * Unresolved dimensions, caller content and compound styling stay unproved. */
export function independentIntrinsicHeight(contract:Contract,values:Record<string,string>,resolveToken:(path:string)=>unknown):boolean {
 const selected=Object.fromEntries(contract.props.flatMap(prop=>{
  const value=values[prop.name]??prop.default;
  return typeof value==='string'||typeof value==='boolean'?[[prop.name,String(value)]]:[];
 }));
 for(const prop of contract.props){const value=selected[prop.name];if(value!==undefined&&
  (typeof prop.type==='object'&&(!('enum'in prop.type)||!prop.type.enum.includes(value))||prop.type==='boolean'&&!['true','false'].includes(value)))return false;}
 const positive=(value:unknown):boolean=>typeof value==='number'?Number.isFinite(value)&&value>0:
  typeof value==='string'&&/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)&&parseFloat(value)>0;
 const walk=(part:Part,inheritedLine:unknown,depth:number,parentDirection?:string,widthSensitive=false):boolean=>{
  if(depth>32||!resolvePresence(part,selected)||isNativeCheckablePart(part)||part.component||part.slot||part.repeat||part.mask||part.meter||part.icon||
   part.absoluteGeometry||part.absoluteGeometryByCombination||part.absolutePlacement||part.absolutePlacementByCombination||part.overlay||part.placement||
   part.stylesWhen?.length||part.textByCombination||part.availabilityByCombination||
   part.declared?.position==='absolute'||part.declared?.position==='fixed'||part.declared?.display==='none'||part.declared?.transform||part.declared?.rotate)return false;
  if(part.visibleWhen){const condition=part.visibleWhen,value=selected[condition.prop],equals=condition.equals??true;
   if(!(Array.isArray(equals)?equals:[equals]).some(expected=>String(expected)===value))return false;}
  if(part.visibilityOverrideProp&&(selected[part.visibilityOverrideProp]??String(part.visibilityOverrideDefault??true))!=='true')return false;
  const layout=resolveLayout(part,selected);
  if(layout?.alignSelf==='stretch'&&parentDirection!=='column'||layout?.wrap||layout?.display==='grid')return false;
  const widthDependent=widthSensitive||layout?.alignSelf==='stretch';
  const literals={...resolveLiterals(part,selected),...part.declared},tokens=resolveTokens(part,selected);
  const value=(channel:string):unknown=>{
   const ref=tokens[channel];if(ref===undefined)return literals[channel];
   const path=ref.slice(1,-1).replace(/\{([^}]+)\}/g,(_,name:string)=>selected[name]??`{${name}}`);
   try{return resolveToken(path);}catch{return undefined;}
  };
  if(['none','contents'].includes(String(value('display'))))return false;
  const maximum=value('max-height');
  if((tokens['max-height']!==undefined||literals['max-height']!==undefined)&&maximum!=='none'&&!positive(maximum))return false;
  const height=value('height');
  if(height!==undefined&&!['auto','fit-content','max-content','min-content'].includes(String(height)))return positive(height);
  if(tokens.height!==undefined&&height===undefined)return false;
  if(part.shape)return !part.shape.rotation&&part.shape.height>0;
  const ownLine=value('line-height');
  if(tokens['line-height']!==undefined&&ownLine===undefined)return false;
  const line=ownLine??inheritedLine;
  if(part.textByProp&&selected[part.textByProp.prop]===undefined)return false;
  const text=part.textOutOfBox||part.textAppearanceOverride||part.textAppearanceByCombination?undefined:part.content?selected[part.content.prop]:part.textByProp?
   part.textByProp.map[selected[part.textByProp.prop]]??part.text:part.text;
  // Width-only stretch in a column is independent of height only for owned
  // intrinsic text. Authored width bounds or wrapping stay unproved.
  const unboundedText=part.textAutoResize==='WIDTH_AND_HEIGHT'&&
   ['width','inline-size','max-width','max-inline-size'].every(channel=>tokens[channel]===undefined&&literals[channel]===undefined)&&
   (value('white-space')===undefined||['nowrap','pre'].includes(String(value('white-space'))));
  const visibleText=typeof text==='string'&&(/\S/u.test(text)||value('white-space')==='pre'&&text.length>0);
  if(visibleText&&positive(line)&&(!widthDependent||unboundedText))return true;
  if(!layout)return false;
  return Object.values(part.parts??{}).some(child=>walk(child,line,depth+1,layout.direction??'row',widthDependent));
 };
 return walk(contract.anatomy.root,undefined,0);
}
