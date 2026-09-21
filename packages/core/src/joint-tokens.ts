import {tokensByPropEntries,walkAnatomy,type Contract,type Part} from '@ds-contracts/schema';

/** Initial admission is a complete resting paint table on an ordinary root.
 * No cascade precedence is invented against another binding of that channel. */
export const JOINT_PAINT_CHANNELS=new Set(['background-color','color','border-color',
  'border-top-color','border-right-color','border-bottom-color','border-left-color']);

export function jointTokenTableErrors(contract:Contract):string[]{
 const errors:string[]=[];
 for(const {name,part} of walkAnatomy(contract)){
  if(!part.tokensByCombination?.length)continue;
  const fail=(reason:string)=>errors.push(`${contract.id}: part "${name}" tokensByCombination ${reason}`);
  if(contract.states.length)fail('supports resting paint only; interaction states need a separate cascade proof');
  if(part!==contract.anatomy.root||Object.keys(contract.anatomy).length!==1||Object.keys(part.parts??{}).length||part.component||part.shape||part.icon||part.meter||part.repeat||part.strokesIncludedInLayout===false||part.overridable?.length)
   fail('requires one ordinary root without component, shape, icon, meter, repeat, outside-layout stroke or override paint');
  const family=(channel:string)=>channel==='background'?'background-color':/^border(?:-(?:top|right|bottom|left))?-color$/.test(channel)?'border-color':channel;
  const occupied=new Set<string>();
  const claim=(record:Record<string,unknown>|undefined)=>Object.keys(record??{}).forEach(c=>occupied.add(family(c)));
  claim(part.tokens);claim(part.literals);claim(part.declared);
  Object.values(part.states??{}).forEach(claim);Object.values(part.declaredStates??{}).forEach(claim);
  for(const entry of [...tokensByPropEntries(part),...(part.literalsByProp??[]),...(part.statesByProp??[])])Object.values(entry.map).forEach(claim);
  for(const rule of part.stylesWhen??[])claim(rule.styles);
  for(const table of part.tokensByCombination){
   if(table.props[0]===table.props[1])fail('requires two distinct properties');
   const axes=table.props.map(name=>contract.props.find(prop=>prop.name===name));
   const domains=axes.map(prop=>prop&&typeof prop.type==='object'&&'enum' in prop.type?[null,...prop.type.enum]:[]);
   if(axes.some(prop=>!prop||typeof prop.type!=='object'||!('enum' in prop.type)||prop.required||prop.default!==undefined||prop.bindings.figma.kind!=='VARIANT'||prop.bindings.figma.unsetValue===undefined))
    fail('properties must be optional defaultless enums with explicit native omitted planes');
   const tuples=new Set<string>(),channels=Object.keys(table.rows[0]?.tokens??{}).sort();
   if(!channels.length)fail('needs at least one paint channel');
   if(channels.some(channel=>!JOINT_PAINT_CHANNELS.has(channel)))fail('supports root color channels only');
   if(channels.some(channel=>occupied.has(family(channel))))fail('channel conflicts with another root binding or table');
   channels.forEach(channel=>occupied.add(family(channel)));
   if(channels.includes('border-color')&&channels.some(channel=>/^border-(top|right|bottom|left)-color$/.test(channel)))fail('cannot mix shorthand and per-side border colors');
   for(const row of table.rows){
    const tuple=JSON.stringify(row.values);
    if(tuples.has(tuple))fail('contains a duplicate tuple');tuples.add(tuple);
    if(row.values.some((value,i)=>!domains[i].includes(value)))fail('contains an unknown enum value');
    if(JSON.stringify(Object.keys(row.tokens).sort())!==JSON.stringify(channels))fail('rows must carry identical channel sets');
    if(Object.values(row.tokens).some(ref=>!/^\{[^{}]+\}$/.test(ref)))fail('requires plain token references without placeholders');
   }
   if(tuples.size!==domains[0].length*domains[1].length||domains[0].some(a=>domains[1].some(b=>!tuples.has(JSON.stringify([a,b])))))
    fail('requires every named and omitted Cartesian tuple');
  }
 }
 return [...new Set(errors)];
}

export function jointTokenRows(part:Part|undefined){return (part?.tokensByCombination??[]).flatMap(table=>table.rows.map(row=>({props:table.props,...row})));}

/** Each surface supplies its existing enum selector and root spelling. Omission
 * is the absence of every declared enum selector, never a synthetic enum value. */
export function jointTokenCss(contract:Contract,enumSelector:(prop:string,value:string)=>string,
 rootSelector:(conditions:string[])=>string,tokenValue:(ref:string)=>string):string[]{
 const domains=new Map(contract.props.filter(prop=>typeof prop.type==='object'&&'enum' in prop.type)
  .map(prop=>[prop.name,(prop.type as {enum:string[]}).enum]));
 return jointTokenRows(contract.anatomy.root).map(row=>{
  const conditions=row.props.map((prop,i)=>row.values[i]===null
   ?`:not(:is(${domains.get(prop)!.map(value=>enumSelector(prop,value)).join(', ')}))`
   :enumSelector(prop,row.values[i]!));
  return `\n${rootSelector(conditions)} {\n${Object.entries(row.tokens).map(([channel,ref])=>`  ${channel}: ${tokenValue(ref)};`).join('\n')}\n}`;
 });
}
