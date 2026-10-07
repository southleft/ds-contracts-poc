import type { Part } from '../scripts/contract-schema.js';

// Shared React projection. Native path records and their source coordinates stay unchanged.
export function wrapReactFilledPath(part: Part, jsx: string, codePropOf: (name: string) => string): string {
 const shape=part.shape;
 if(shape?.kind!=='path' || part.mask || (!shape.paths && !shape.pathsByProp))return jsx;
 // A geometry gets one stable resource identity within this occurrence. Equal
 // variants reuse it; changing the path changes the referenced clipping resource.
 const keys=new Map<string,number>();
 const project=(g:NonNullable<NonNullable<Part['shape']>['pathsByProp']>['map'][string])=>{
  const value={width:g.width,height:g.height,paths:g.paths,...(g.parentViewport?{parentViewport:g.parentViewport}:{})};
  const key=JSON.stringify(value);if(!keys.has(key))keys.set(key,keys.size);
  return {...value,resourceKey:keys.get(key)!};
 };
 const geometry=shape.pathsByProp
  ? `(${JSON.stringify(Object.fromEntries(Object.entries(shape.pathsByProp.map).map(([key,value])=>[key,project(value)])))})[String(${codePropOf(shape.pathsByProp.prop)})]`
  : JSON.stringify(project({width:shape.width!,height:shape.height!,paths:shape.paths!,...(shape.parentViewport?{parentViewport:shape.parentViewport}:{})}));
 const paints:string[]=[];
 const collect=(value:unknown):void=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='background-color')paints.push(String(item));else if(key!=='parts'&&key!=='shape')collect(item);}};
 collect(part);
 const geometries=shape.pathsByProp?Object.values(shape.pathsByProp.map):[shape];
 const directSvg=geometries.every(g=>g.parentViewport)&&paints.length>0&&paints.every(paint=>paint==='currentColor');
 return `<__DscFilledPath ${directSvg?'directSvg ':''}geometry={${geometry}}>${jsx}</__DscFilledPath>`;
}
export const REACT_FILLED_PATH_RUNTIME=`
import * as __DscPathReact from 'react';
function __DscFilledPath({children,geometry,style,directSvg}:{children:__DscPathReact.ReactElement<any>;geometry:{resourceKey:number;width:number;height:number;paths:{data:string;windingRule:string}[];parentViewport?:{width:number;height:number;x:number;y:number}}|undefined;style?:__DscPathReact.CSSProperties;directSvg?:boolean}) {
 const instanceId=__DscPathReact.useId();
 if(!geometry)throw new globalThis.Error('filled-path-variant-unavailable');
 const id=instanceId+'-'+geometry.resourceKey;
 const v=geometry.parentViewport;
 if(directSvg)return __DscPathReact.cloneElement(children,{style:{...children.props.style,...style,mask:'none',WebkitMask:'none',backgroundColor:'transparent'}},
  <svg aria-hidden="true" width="100%" height="100%" viewBox={'0 0 '+(v?.width??geometry.width)+' '+(v?.height??geometry.height)} preserveAspectRatio="none" style={{display:'block',position:'absolute',inset:0}}>
   <g transform={v?'translate('+v.x+' '+v.y+')':undefined}>{geometry.paths.map((path,index)=><path key={index} d={path.data} fill={style?.backgroundColor??children.props.style?.backgroundColor??'currentColor'} fillRule={path.windingRule==='EVENODD'?'evenodd':'nonzero'}/>)}</g>
  </svg>);
 const transform='scale('+1/(v?.width??geometry.width)+' '+1/(v?.height??geometry.height)+')'+(v?' translate('+v.x+' '+v.y+')':'');
 return <>{__DscPathReact.cloneElement(children,{style:{...children.props.style,...style,mask:'none',WebkitMask:'none',clipPath:'url("#'+id+'")'}})}
  <svg data-dsc-paint-layer="path-definitions" aria-hidden="true" width="0" height="0" style={{position:'absolute',pointerEvents:'none'}}><defs><clipPath id={id} clipPathUnits="objectBoundingBox">{geometry.paths.map((path,index)=><path key={index} d={path.data} clipRule={path.windingRule==='EVENODD'?'evenodd':'nonzero'} transform={transform}/>)}</clipPath></defs></svg></>;
}
`;
