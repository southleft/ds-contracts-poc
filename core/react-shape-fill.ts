import type {Part,Contract} from '../scripts/contract-schema.js';
export function wrapReactShapeFill(part:Part,jsx:string,codePropOf:(name:string)=>string,contract:Contract):string {
 if(!part.shapeFillOverrideProp)return jsx;
 const prop=contract.props.find(p=>p.name===part.shapeFillOverrideProp),colors=prop&&typeof prop.type==='object'&&'enum' in prop.type?prop.type.enum:[];
 return `<__DscShapeFill colors={${JSON.stringify(colors)}} color={${codePropOf(part.shapeFillOverrideProp)}}>${jsx}</__DscShapeFill>`;
}
export const REACT_SHAPE_FILL_RUNTIME=`
import * as __DscShapeFillReact from 'react';
function __DscShapeFill({children,color,colors}:{children:__DscShapeFillReact.ReactElement<any>;color?:string;colors:string[]}) {
 if(color===undefined)return children;
 if(!colors.includes(color))throw new globalThis.Error('shape-fill-override-value-unqualified');
 return __DscShapeFillReact.cloneElement(children,{style:{...children.props.style,backgroundColor:color}});
}
`;
