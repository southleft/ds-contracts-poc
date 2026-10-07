import {type Contract, type Part} from '../scripts/contract-schema.js';

/** Root-only usage styles. Never scale a child subtree or mutate its defaults. */
export function reactInstanceRootStyle(contract: Contract, part: Part,
 resolve: (path:string,channel:string)=>string|number, codePropOf:(name:string)=>string): string {
 const entries=Object.entries(part.component?.rootOverrides??{});
 const styles = [...(part.component?.rootFill??[]).map(channel=>`${JSON.stringify(channel)}: "100%"`), ...entries.map(([channel,ref])=>{
  const path=ref.slice(1,-1), axes=[...new Set([...path.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]))];
  let count=1;
  const domains=axes.map(name=>{
   const prop=contract.props.find(p=>p.name===name);
   const values=prop&&typeof prop.type==='object'&&'enum' in prop.type?prop.type.enum:prop?.type==='boolean'?[false,true]:undefined;
   if(!prop||!values)throw Error('instance-root-input-axis-unsupported:'+name);
   count*=values.length;if(count>4096)throw Error('instance-root-input-domain-too-large');
   return {prop,values};
  });
  const expand=(i:number,resolved:string):string=>{
   if(i===domains.length)return JSON.stringify(resolve(resolved,channel==='outline-color'?'background-color':channel));
   const {prop,values}=domains[i];
   // Visibility wrappers can narrow this axis before the style is evaluated.
   // A lookup keeps every declared input without emitting impossible equality
   // tests inside that narrowed branch (TypeScript TS2367).
   const input=codePropOf(prop.name);
   const entries=values.map(value=>`[${JSON.stringify(String(value))}]: ${expand(i+1,resolved.replaceAll(`{${prop.name}}`,String(value)))}`).join(', ');
   const keys=values.map(value=>JSON.stringify(String(value))).join(' | ');
   return `(${input} == null ? undefined : ({${entries}})[String(${input}) as ${keys}])`;
  };
  return `${JSON.stringify(channel.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase()))}: ${expand(0,path)}`;
 })].join(', ');
 return part.component?.rootOverrides?.['outline-color'] ? [styles, 'outlineStyle: "solid", outlineOffset: 0'].join(', ') : styles;
}
