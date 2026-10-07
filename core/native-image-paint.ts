import type {DumpImageAsset,DumpNode,DumpSet} from '../extract/figma/types.js';
type Projection={image:string;declared:Record<string,string>};
type ImageNode=DumpNode & {__nativeImageProjection?:Projection};
export const nativeImageProjection=(node:DumpNode|undefined)=> (node as ImageNode|undefined)?.__nativeImageProjection;
/** Preserve raw paint facts; derive a separate deterministic CSS projection.
 * CROP maps the layer's normalized viewport into original image coordinates.
 * Original bytes remain original; no node PNG is baked into the contract. */
export function projectNativeImagePaints(input:DumpSet,assets:Record<string,DumpImageAsset>|undefined){
 const clone=(v:any):any=>Array.isArray(v)?v.map(clone):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,clone(value)])):v;
 const set=clone(input) as DumpSet,notes:string[]=[];
 const visit=(node:ImageNode,path:string)=>{
  delete node.__nativeImageProjection;
  const paints=node.imagePaints;
  if(paints?.length){
   const paint=paints[0],hash=paint.imageHash,asset=typeof hash==='string'?assets?.[hash]:undefined;
   if(asset&&'base64'in asset){
    const refuse=(reason:string):never=>{throw Error(`native-image-paint-unqualified:${path}:${reason}`)};
    const mime=asset.mimeType,encoded=asset.base64;
    const prefixes={'image/png':'iVBORw0KGgo','image/jpeg':'/9j/','image/gif':'R0lGOD','image/webp':'UklGR'};
    if(asset.imageHash!==hash||!Object.hasOwn(prefixes,mime)||typeof encoded!=='string'||!encoded.startsWith(prefixes[mime])||asset.byteLength>8*1024*1024||encoded.length>11184812||encoded.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||asset.byteLength!==encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0))refuse('original-asset-integrity');
    if(paints.length!==1||paint.index!==0||paint.opacity!==undefined&&paint.opacity!==1||paint.blendMode!==undefined&&paint.blendMode!=='NORMAL'||paint.filters&&Object.values(paint.filters as object).some(v=>v!==0))refuse('paint-stack-blend-opacity-or-filter');
    const declared:Record<string,string>={'background-repeat':'no-repeat'};
    if(paint.scaleMode==='FILL'||paint.scaleMode==='FIT'){
     if(paint.rotation!==undefined&&paint.rotation!==0)refuse('image-rotation');
     declared['background-size']=paint.scaleMode==='FILL'?'cover':'contain';declared['background-position']='50% 50%';
    }else if(paint.scaleMode==='CROP'||paint.scaleMode==='STRETCH'){
     // REST calls this STRETCH; the plugin API calls the affine image mode CROP.
     if(paint.rotation!==undefined&&paint.rotation!==0)refuse('image-rotation');
     const t=paint.imageTransform as number[][]|undefined;
     if(!Array.isArray(t)||t.length!==2||t.some(r=>!Array.isArray(r)||r.length!==3||r.some(n=>!Number.isFinite(n)))||t[0][1]!==0||t[1][0]!==0||t[0][0]<=0||t[1][1]<=0)refuse('crop-affine-basis');
     const [[a,,e],[,d,f]]=t!;
     const position=(scale:number,offset:number)=>scale===1?offset===0?0:refuse('crop-unit-scale-offset'):100*offset/(1-scale);
     declared['background-size']=`${100/a}% ${100/d}%`;
     declared['background-position']=`${position(a,e)}% ${position(d,f)}%`;
    }else refuse('image-scale-mode');
    node.__nativeImageProjection={image:`url('data:${mime};base64,${encoded}')`,declared};
    notes.push(`${path}: original native bitmap ${hash} carried as ${mime}; observed ${paint.scaleMode} paint projected into CSS. No rendered-node screenshot or source crop rewrite; native/browser downsampling remains subject to the unchanged visual check.`);
   }else if(asset)notes.push(`${path}: native image bytes unavailable (${asset.refused}); legacy placeholder remains, not visual equivalence.`);
  }
  for(const child of node.children??[])visit(child,`${path}/${child.name}`);
 };
 for(const node of set.variants)visit(node,`${set.setName}/${node.name}`);
 return{set,notes};
}
