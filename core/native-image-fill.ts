/** Lossless original-asset projection. No node screenshot or image resampling. */
export interface NativeImageFill { base64:string; scaleMode:'FILL'|'FIT'|'CROP'; imageTransform?:[[number,number,number],[number,number,number]] }
export function nativeImageFill(value:string,declared:Record<string,string>={}):NativeImageFill {
 const fail=(reason:string):never=>{throw Error('native-image-fill-unqualified:'+reason)};
 const match=/^url\((['"]?)(data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2}))\1\)$/.exec(value);
 if(!match) return fail('original-data-url');
 const encoded=match[4],prefix={png:'iVBORw0KGgo',jpeg:'/9j/',gif:'R0lGOD',webp:'UklGR'}[match[3]]!;
 if(encoded.length%4||!encoded.startsWith(prefix)||encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0)>8*1024*1024)return fail('original-asset-integrity-or-budget');
 if(declared['background-repeat']!=='no-repeat'||declared['background-attachment']&&declared['background-attachment']!=='scroll'||declared['background-blend-mode']&&declared['background-blend-mode']!=='normal')return fail('repeat-attachment-or-blend');
 const size=declared['background-size'],position=declared['background-position'];
 if((size==='cover'||size==='contain')&&position==='50% 50%')return{base64:encoded,scaleMode:size==='cover'?'FILL':'FIT'};
 const pair=(v:string|undefined)=>v?.trim().split(/\s+/).map(x=>/^-?(?:\d+\.?\d*|\.\d+)%$/.test(x)?Number(x.slice(0,-1)):NaN);
 const s=pair(size),p=pair(position);
 if(s?.length!==2||p?.length!==2||!s.every(x=>Number.isFinite(x)&&x>0)||!p.every(Number.isFinite))return fail('size-or-position');
 const a=100/s[0],d=100/s[1],e=p[0]/100*(1-a),f=p[1]/100*(1-d);
 if(![a,d,e,f].every(Number.isFinite))return fail('crop-transform');
 return{base64:encoded,scaleMode:'CROP',imageTransform:[[a,0,e],[0,d,f]]};
}
export const NATIVE_IMAGE_FILL_RUNTIME=`
  if (spec.imagePaint) {
    const image=figma.createImage(figma.base64Decode(spec.imagePaint.base64));
    const paint={type:'IMAGE',imageHash:image.hash,scaleMode:spec.imagePaint.scaleMode,...(spec.imagePaint.imageTransform?{imageTransform:spec.imagePaint.imageTransform}:{})};
    const base=node.fills===figma.mixed?[]:(node.fills||[]);
    node.fills=base.concat([paint]);
  }`;
