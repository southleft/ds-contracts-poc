import type {Part} from '../scripts/contract-schema.js';
export function wrapReactTextColor(part:Part,jsx:string,codePropOf:(name:string)=>string,owner:string):string {
 return part.textColorOverrideProp?`<__DscTextColor target={${JSON.stringify(owner+':'+part.textColorOverrideProp)}} color={${codePropOf(part.textColorOverrideProp)}}>${jsx}</__DscTextColor>`:jsx;
}
export const REACT_TEXT_COLOR_RUNTIME=`
import * as __DscTextColorReact from 'react';
function __DscTextColor({children,color,target}:{children:__DscTextColorReact.ReactElement<any>;color?:string;target:string}) {
 if(color===undefined)return __DscTextColorReact.cloneElement(children,{'data-dsc-text-color':target});
 if(!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))throw new globalThis.Error('text-color-override-invalid');
 return __DscTextColorReact.cloneElement(children,{'data-dsc-text-color':target,style:{...children.props.style,color}});
}
`;
