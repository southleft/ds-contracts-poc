import type {NativeImageFill} from './native-image-fill.js';

/** Asset bytes must come from getImageByHash(observed.imageHash).getBytesAsync(),
 * not the writer's acknowledgement or expected plan. Hash equality alone is not
 * a substitute for independently collected original bytes. */
export function nativeImageOverrideMatches(expected:NativeImageFill,observed:unknown,originalBase64:unknown):boolean {
 if(!observed||typeof observed!=='object'||typeof originalBase64!=='string'||originalBase64!==expected.base64)return false;
 const p=observed as Record<string,any>;
 if(p.type!=='IMAGE'||typeof p.imageHash!=='string'||!p.imageHash||p.scaleMode!==expected.scaleMode||p.visible===false||
   p.opacity!==undefined&&p.opacity!==1||p.blendMode!==undefined&&p.blendMode!=='NORMAL'||
   p.rotation!==undefined&&p.rotation!==0||p.scalingFactor!==undefined&&p.scalingFactor!==1||
   Object.keys(p.boundVariables??{}).length||Object.values(p.filters??{}).some(v=>v!==0))return false;
 if(expected.scaleMode!=='CROP')return p.imageTransform===undefined;
 const matrix=p.imageTransform;
 return Array.isArray(matrix)&&matrix.length===2&&matrix.every((row:any,i:number)=>Array.isArray(row)&&row.length===3&&row.every((v:unknown,j:number)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v-expected.imageTransform![i][j])<=1e-6));
}
