import type {Contract, ComponentRef} from '../scripts/contract-schema.js';
import {walkAnatomy} from '../scripts/contract-schema.js';
import {nativeImageFill, type NativeImageFill} from './native-image-fill.js';

/** Compile only finite, source-owned choices; omission retains the main paint. */
export function mapNativeImageArguments(contract:Contract,props:NonNullable<ComponentRef['props']>,subst:Record<string,string>):Record<string,NativeImageFill>|undefined {
 const out:Record<string,NativeImageFill>={};
 for(const {part} of walkAnatomy(contract)) {
  const control=part.imageOverride;if(!control||!Object.hasOwn(props,control.prop))continue;
  const raw=props[control.prop];let value:unknown=typeof raw==='object'?raw.map[subst[raw.prop]??'']:raw;
  if(typeof raw==='string'&&/^\{[\w-]+\}$/.test(raw))value=subst[raw.slice(1,-1)];
  if(value===undefined)continue;
  const prop=contract.props.find(p=>p.name===control.prop);
  if(typeof value!=='string'||!Object.hasOwn(control.choices,value)||!prop||typeof prop.type!=='object'||!('enum'in prop.type)||!prop.type.enum.includes(value))throw Error('image-override-value-unqualified');
  const choice=control.choices[value];
  out[contract.id+':'+control.prop]=nativeImageFill(choice.image,{'background-size':choice.size,'background-position':choice.position,'background-repeat':'no-repeat'});
 }
 return Object.keys(out).length?out:undefined;
}

/** Serialized into the native writer. Resolve every target before editing any
 * paint; do not traverse a nested component instance's ownership boundary. */
export const NATIVE_IMAGE_CONTROL_RUNTIME=`
  if(spec.imageTarget)node.setSharedPluginData('ds_contracts','imageOverride',spec.imageTarget);
  if(spec.instanceImages){
    const previousSkip=figma.skipInvisibleInstanceChildren;figma.skipInvisibleInstanceChildren=false;
    try{
      const plans=[];
      for(const [key,image] of Object.entries(spec.instanceImages)){
        const found=[];
        const visit=n=>{if(n.type==='INSTANCE')return;if(n.getSharedPluginData('ds_contracts','imageOverride')===key)found.push(n);for(const child of n.children||[])visit(child);};
        for(const child of node.children||[])visit(child);
        if(found.length!==1||!['FRAME','RECTANGLE','ELLIPSE'].includes(found[0].type))throw Error('image-override-target-unqualified:'+key);
        const target=found[0],fills=target.fills;
        if(!Array.isArray(fills)||fills.filter(p=>p.type==='IMAGE').length!==1)throw Error('image-override-original-paint-unqualified:'+key);
        const original=fills.find(p=>p.type==='IMAGE');
        if(original.visible===false||(original.opacity!==undefined&&original.opacity!==1)||(original.blendMode!==undefined&&original.blendMode!=='NORMAL'))throw Error('image-override-original-paint-unqualified:'+key);
        plans.push({target,fills,image});
      }
      const updates=plans.map(({target,fills,image})=>{
        const asset=figma.createImage(figma.base64Decode(image.base64));
        const paint={type:'IMAGE',imageHash:asset.hash,scaleMode:image.scaleMode,...(image.imageTransform?{imageTransform:image.imageTransform}:{})};
        return{target,fills:fills.map(p=>p.type==='IMAGE'?paint:p)};
      });
      for(const update of updates)update.target.fills=update.fills;
    }finally{figma.skipInvisibleInstanceChildren=previousSkip;}
  }
`;
