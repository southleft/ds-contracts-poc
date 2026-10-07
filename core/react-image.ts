import type {Part} from '../scripts/contract-schema.js';
export function wrapReactImage(part:Part,jsx:string,codePropOf:(name:string)=>string):string {
 const input=part.imageOverride;
 return input?`<__DscImage value={${codePropOf(input.prop)}} choices={${JSON.stringify(input.choices)}}>${jsx}</__DscImage>`:jsx;
}
export const REACT_IMAGE_RUNTIME=`
import * as __DscImageReact from 'react';
function __DscImage({children,value,choices}:{children:__DscImageReact.ReactElement<any>;value?:string;choices:Record<string,{image:string;size:string;position:string}>}) {
 if(value===undefined)return children;
 if(!globalThis.Object.hasOwn(choices,value))throw new globalThis.Error('image-override-value-unqualified');
 const image=choices[value];
 return __DscImageReact.cloneElement(children,{style:{...children.props.style,backgroundImage:image.image,backgroundSize:image.size,backgroundPosition:image.position,backgroundRepeat:'no-repeat'}});
}
`;
