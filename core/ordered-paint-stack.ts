import {SolidFillSourceBindingSchema,qualifySolidFillColorBinding,inspectSolidFillColorBinding,SolidFillObservedBindingSchema} from '../packages/schema/src/solid-fill-binding.js';
import {FillStackSchema,type FillStack,type FillStackPaint} from '../scripts/contract-schema.js';
import type {DumpNode,DumpImageAsset} from '../extract/figma/types.js';
import {nativeImageFill} from './native-image-fill.js';
import {planSolidFillBindingTokens} from '../packages/core/src/solid-fill-binding-tokens.js';
/** Raw capture remains untouched. Unsupported or incomplete members never vanish,
 * including hidden and zero-alpha paints. */
export function sourceFillStack(node:DumpNode,assets:Record<string,DumpImageAsset>|undefined,owner:string,variant:string):FillStack {
 const raw=node.sourceFillStack;
 const fail=(why:string):never=>{throw Error('fill-stack-source-unqualified:'+owner+':'+why);};
 if(!raw||raw.version!==1||raw.complete!==true||raw.order!=='bottom-to-top'||!Array.isArray(raw.paints))return fail('complete-observation-required');
 const paints=raw.paints.map((row,index):FillStackPaint=>{
  const p=row.paint as Record<string,any>;
  if(row.index!==index||!p||Array.isArray(p)||typeof p!=='object')return fail('original-index');
  const allowed=p.type==='SOLID'?['type','visible','opacity','blendMode','color','boundVariables']:['type','visible','opacity','blendMode','imageHash','scaleMode','imageTransform','rotation','scalingFactor','filters','boundVariables'];
  if(Object.keys(p).some(k=>!allowed.includes(k)))return fail('unsupported-paint-field');
  const common={index,visible:p.visible===undefined?true:p.visible,opacity:p.opacity===undefined?1:p.opacity,blendMode:p.blendMode===undefined?'NORMAL':p.blendMode};
  if(p.type==='SOLID'){
   const value:any={...common,type:'SOLID',color:p.color};
   const bindings=p.boundVariables;
   if(bindings!==undefined&&(!bindings||Array.isArray(bindings)||Object.keys(bindings).some(k=>k!=='color')))return fail('solid-binding-field');
   const alias=bindings?.color;
   if(alias!==undefined){
    if(alias.type!=='VARIABLE_ALIAS'||typeof alias.id!=='string'||!alias.id||Object.keys(alias).some(k=>!['type','id'].includes(k)))return fail('solid-binding-identity');
    const paint={color:{r:p.color?.r,g:p.color?.g,b:p.color?.b},opacity:common.opacity,blendMode:common.blendMode};
    try{
     const binding=qualifySolidFillColorBinding({paint,variableId:alias.id},node.variableConsumers);
     value.sourceBinding=SolidFillSourceBindingSchema.parse({owner,nodeName:node.name,variantName:variant,binding});
     value.token=planSolidFillBindingTokens([binding]).requestedTokenPaths[0];
    }catch(error){
     try{const observed=inspectSolidFillColorBinding({paint,variableId:alias.id},node.variableConsumers);if(observed?.kind!=='observed-paint-disagreement')throw error;value.observedBinding=SolidFillObservedBindingSchema.parse({owner,nodeName:node.name,variantName:variant,observedPaint:observed.observedPaint,resolvedBinding:observed.resolvedBinding,bindingRecreated:false});}
     catch{value.unresolvedBinding={variableId:alias.id,reason:String(error instanceof Error?error.message:error),bindingRecreated:false};}
    }
   }
   return value;
  }
  if(p.type!=='IMAGE')return fail('unsupported-paint-type');
  if(p.boundVariables&&Object.keys(p.boundVariables).length)return fail('image-binding');
  const asset=assets?.[p.imageHash];
  if(!asset||!('base64'in asset)||asset.imageHash!==p.imageHash)return fail('original-image-bytes-missing');
  const image=`url('data:${asset.mimeType};base64,${asset.base64}')`;
  const t=p.imageTransform;const size=p.scaleMode==='FILL'?'cover':p.scaleMode==='FIT'?'contain':t?`${100/t[0][0]}% ${100/t[1][1]}%`:'';
  const position=t?`${t[0][0]===1?0:100*t[0][2]/(1-t[0][0])}% ${t[1][1]===1?0:100*t[1][2]/(1-t[1][1])}%`:'50% 50%';
  nativeImageFill(image,{'background-repeat':'no-repeat','background-size':size,'background-position':position});
  const decoded=asset.base64.length/4*3-(asset.base64.endsWith('==')?2:asset.base64.endsWith('=')?1:0);if(decoded!==asset.byteLength)return fail('original-image-byte-count');
  return {...common,type:'IMAGE',imageHash:p.imageHash,image,scaleMode:p.scaleMode,...Object.fromEntries(['imageTransform','rotation','scalingFactor','filters'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))};
 });
 return FillStackSchema.parse({version:1,order:'bottom-to-top',paints});
}
