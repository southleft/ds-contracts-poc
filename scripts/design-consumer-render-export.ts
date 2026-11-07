/** Qualify the origin of a REST render-bounds export against a separately
 * requested full-layout export. This does not qualify browser overflow capture
 * or change acceptance scoring. Offsets come only from recorded source bounds. */
import {PNG} from 'pngjs';
import {figmaFramesFromSnapshots, figmaBoundsInLayoutUnits, imageSha256, type FrameBox} from './design-consumer-framing-v2.js';

export type RenderExportProof = {
  nodeId:string; version:string; layout:FrameBox; render:FrameBox;
  layoutInRender:{x:number;y:number}; layoutSha256:string; renderSha256:string;
  overlapPixels:number; paintedOverlapPixels:number;
  /** Set only where `ring` left the box's outer pixel row or column out, on each side where paint reaches past it. */
  edgeRing?:{sides:Side[]; pixels:number};
};
type Side='left'|'top'|'right'|'bottom';
export function qualifyRenderBoundsExport(before:any,after:any,nodeId:string,layoutBytes:Buffer,renderBytes:Buffer,ring=false):
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
  const compare=(out:Side[])=>{
    let painted=0,compared=0;const colors=new Set<string>();
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
      if((x===0&&out.includes('left'))||(y===0&&out.includes('top'))||(x===layout.width-1&&out.includes('right'))||(y===layout.height-1&&out.includes('bottom')))continue;
      const a=(y*layout.width+x)*4,b=((y+offset.y)*render.width+x+offset.x)*4;
      if(layout.data[a+3]!==render.data[b+3] || (layout.data[a+3]>0 &&
         [0,1,2].some(c=>layout.data[a+c]!==render.data[b+c])))return null;
      compared++;if(layout.data[a+3]>0)painted++;
      colors.add(layout.data[a+3]===0?'transparent':layout.data.subarray(a,a+4).toString('hex'));
    }
    return {painted,compared,colors};
  };
  // A plugin capture's layout export is clipped to the box, so where paint reaches past a side, the box's outer pixel
  // row or column there is composited differently (the live Card's shadow: 6 pixels, all on that ring). With `ring`,
  // and only after the exact comparison is refused, those are left out and named; any other difference, a shifted
  // interior included, is still refused. There is no value tolerance.
  const l=frame.layout,r=frame.render,sides=([['left',r.x<l.x],['top',r.y<l.y],['right',r.x+r.width>l.x+l.width],['bottom',r.y+r.height>l.y+l.height]] as const)
    .filter(([,past])=>ring&&past).map(([side])=>side as Side);
  const exact=compare([]),seen=exact??(sides.length?compare(sides):null);
  if(!seen)return {refused:'render-export-overlap-mismatch'};
  // Uniform or empty overlap does not anchor a translation. Do not infer an
  // origin from PNG dimensions or an alpha-trimming/search operation alone.
  if(!seen.painted||seen.colors.size<2)return {refused:'render-export-origin-unobservable'};
  return {proof:{nodeId,version:before.version,layout:frame.layout,render:frame.render,layoutInRender:offset,
    layoutSha256:imageSha256(layoutBytes),renderSha256:imageSha256(renderBytes),
    overlapPixels:seen.compared,paintedOverlapPixels:seen.painted,...(exact?{}:{edgeRing:{sides,pixels:(right-left)*(bottom-top)-seen.compared}})}};
}
