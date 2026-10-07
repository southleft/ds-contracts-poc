/** Qualify the origin of a REST render-bounds export against a separately
 * requested full-layout export. This does not qualify browser overflow capture
 * or change acceptance scoring. Offsets come only from recorded source bounds. */
import {PNG} from 'pngjs';
import {figmaFramesFromSnapshots, figmaBoundsInLayoutUnits, imageSha256, type FrameBox} from './design-consumer-framing-v2.js';

export type RenderExportProof = {
  nodeId:string; version:string; layout:FrameBox; render:FrameBox;
  layoutInRender:{x:number;y:number}; layoutSha256:string; renderSha256:string;
  overlapPixels:number; paintedOverlapPixels:number;
};
export function qualifyRenderBoundsExport(before:any,after:any,nodeId:string,layoutBytes:Buffer,renderBytes:Buffer):
 {proof:RenderExportProof}|{refused:string} {
  const recorded=figmaFramesFromSnapshots(before,after,{[nodeId]:renderBytes});
  if(recorded.refused)return {refused:recorded.refused};
  const frame=recorded.frames[nodeId],layout=PNG.sync.read(layoutBytes),render=PNG.sync.read(renderBytes);
  const spans=(png:PNG,box:FrameBox)=>{
    const unit=figmaBoundsInLayoutUnits(box);
    return (png.width===Math.ceil(box.width)||png.width===Math.ceil(unit.width))&&
      (png.height===Math.ceil(box.height)||png.height===Math.ceil(unit.height));
  };
  if(!spans(layout,frame.layout))return {refused:'layout-export-span-mismatch'};
  if(!spans(render,frame.render))return {refused:'render-export-span-mismatch'};
  const offset={x:frame.layout.x-frame.render.x,y:frame.layout.y-frame.render.y};
  if(!Number.isInteger(offset.x)||!Number.isInteger(offset.y))return {refused:'render-export-fractional-origin'};
  const left=Math.max(0,-offset.x),top=Math.max(0,-offset.y);
  const right=Math.min(layout.width,render.width-offset.x),bottom=Math.min(layout.height,render.height-offset.y);
  if(right<=left||bottom<=top)return {refused:'render-export-no-overlap'};
  let painted=0;const colors=new Set<string>();
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const a=(y*layout.width+x)*4,b=((y+offset.y)*render.width+x+offset.x)*4;
    if(layout.data[a+3]!==render.data[b+3] || (layout.data[a+3]>0 &&
       [0,1,2].some(c=>layout.data[a+c]!==render.data[b+c])))return {refused:'render-export-overlap-mismatch'};
    if(layout.data[a+3]>0)painted++;
    colors.add(layout.data[a+3]===0?'transparent':layout.data.subarray(a,a+4).toString('hex'));
  }
  // Uniform or empty overlap does not anchor a translation. Do not infer an
  // origin from PNG dimensions or an alpha-trimming/search operation alone.
  if(!painted||colors.size<2)return {refused:'render-export-origin-unobservable'};
  return {proof:{nodeId,version:before.version,layout:frame.layout,render:frame.render,layoutInRender:offset,
    layoutSha256:imageSha256(layoutBytes),renderSha256:imageSha256(renderBytes),
    overlapPixels:(right-left)*(bottom-top),paintedOverlapPixels:painted}};
}
