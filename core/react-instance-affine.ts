import {instanceAffineCss} from './instance-affine-css.js';
import {type Part} from '../scripts/contract-schema.js';
/** A flow allocation host and an origin-zero local transform, shared by both React emitters. */
export function wrapReactInstanceAffine(part:Part,jsx:string,codePropOf:(name:string)=>string=name=>name):string {
 if(part.instanceAffineLayout){
  const table=part.instanceAffineLayout,styles=Object.fromEntries(table.rows.map(row=>[JSON.stringify(row.values),instanceAffineCss(row.geometry,row.fill)]));
  const key=`JSON.stringify([${table.props.map(name=>`String(${codePropOf(name)})`).join(',')}])`;
  return `<__DscAffineLayout plan={(${JSON.stringify(styles)} as any)[${key}]}>${jsx}</__DscAffineLayout>`;
 }
 const observations=part.instanceAffineByProp?.map ?? (part.instanceAffine?{base:part.instanceAffine}:undefined);
 if(!observations)return jsx;
 const styles=Object.fromEntries(Object.entries(observations).map(([key,observation])=>{
  return [key,instanceAffineCss(observation)];
 }));
 const expr=(layer:'outer'|'inner')=>part.instanceAffineByProp
  ? `(${JSON.stringify(Object.fromEntries(Object.entries(styles).map(([key,value])=>[key,value[layer]])))} as const)[${codePropOf(part.instanceAffineByProp.prop)}]`
  : JSON.stringify(styles.base[layer]);
 return `<span style={${expr('outer')}}><span style={${expr('inner')}}>${jsx}</span></span>`;
}

export const REACT_AFFINE_LAYOUT_RUNTIME=`
import * as __DscAffineReact from 'react';
function __DscAffineLayout({children,plan}:{children:__DscAffineReact.ReactElement<any>;plan:any}) {
 if(!plan)throw new globalThis.Error('instance-affine-layout-combination-unavailable');
 const flow=Object.fromEntries(Object.entries(children.props.style??{}).filter(([key])=>['flex','flexGrow','flexShrink','flexBasis','alignSelf','minWidth','minHeight'].includes(key)));
 return <span className={children.props.className} style={{...flow,...plan.outer}}><span style={plan.inner}>{__DscAffineReact.cloneElement(children,{style:{...children.props.style,flex:'none',...plan.child}})}</span></span>;
}
`;
