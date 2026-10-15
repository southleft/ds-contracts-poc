import {PNG} from 'pngjs';
/** Observe Chromium's painted layer extents, not DOM scroll dimensions.
 * This supplies an extent candidate; capture integration must still verify the
 * original composited raster. Unsupported compositor effects remain named. */
import type {CDPSession, JSHandle, Page} from 'playwright-core';
import {enclosingFrame,type FrameBox} from './design-consumer-framing-v2.js';
// Keep the complete snapshot in Chromium. Sending these multi-megabyte
// objects through the protocol dominated capture time. Equality is exact;
// no computed properties, pseudo styles, or geometry fields are omitted.
type SnapshotHandle = JSHandle<{snapshot:string}>;
async function sameSnapshot(before:SnapshotHandle,after:SnapshotHandle):Promise<boolean> {
 try{return await before.evaluate((left,right)=>left.snapshot===right.snapshot,after);}
 finally{await after.dispose();}
}

export interface PaintLayer {
 layerId:string;parentLayerId?:string;backendNodeId?:number;offsetX:number;offsetY:number;
 width:number;height:number;drawsContent:boolean;invisible?:boolean;transform?:number[];
 anchorX?:number;anchorY?:number;anchorZ?:number;
}
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a:number[],b:number[])=>Array.from({length:16},(_,i)=>{
 const row=i%4,col=Math.floor(i/4);let v=0;for(let k=0;k<4;k++)v+=a[k*4+row]*b[col*4+k];return v;
});
export function paintLayerDocumentBox(layer:PaintLayer,layers:PaintLayer[],scroll:{x:number;y:number}):FrameBox|null {
 const seen=new Set<string>();const chain:PaintLayer[]=[];let next:PaintLayer|undefined=layer;
 while(next){if(seen.has(next.layerId))return null;seen.add(next.layerId);chain.unshift(next);
  if(!next.parentLayerId)break;
  next=layers.find(l=>l.layerId===next!.parentLayerId);if(!next)return null;
 }
 let matrix=identity();for(const item of chain){
  const m=item.transform??identity();if(m.length!==16||!m.every(Number.isFinite)||
    [item.offsetX,item.offsetY,item.width,item.height].some(v=>!Number.isFinite(v))||
    (item.anchorX??0)!==0||(item.anchorY??0)!==0||(item.anchorZ??0)!==0)return null;
  // The protocol does not expose CSS flattening/3D clip semantics. Do not
  // silently interpret those transforms as an ordinary two-dimensional plane.
  if([2,3,6,7,8,9,11,14].some(i=>m[i]!==0)||m[10]!==1||m[15]!==1)return null;
  const offset=identity();offset[12]=item.offsetX;offset[13]=item.offsetY;
  matrix=multiply(matrix,multiply(offset,m));
 }
 const points=[[0,0],[layer.width,0],[0,layer.height],[layer.width,layer.height]].map(([x,y])=>({x:matrix[0]*x+matrix[4]*y+matrix[12]+scroll.x,y:matrix[1]*x+matrix[5]*y+matrix[13]+scroll.y}));
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
 return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
export async function observeConsumerPaintExtent(page:Page,selector:string):Promise<
 {observation:{layout:FrameBox;paint:FrameBox;layers:PaintLayer[];boxes:FrameBox[];blendRasterVerified?:true}}|{refused:string}> {
 const root=page.locator(selector);if(await root.count()!==1)return {refused:'paint-extent-subject-not-unique'};
 const initial=await root.evaluate(el=>({style:el.getAttribute('style'),value:(el as HTMLElement).style.getPropertyValue('will-change'),priority:(el as HTMLElement).style.getPropertyPriority('will-change')}));
 const observe=()=>root.evaluateHandle(el=>({snapshot:JSON.stringify([el,...el.querySelectorAll('*')].map(n=>{
  const b=n.getBoundingClientRect();const styles=[null,'::before','::after'].map(p=>{const s=getComputedStyle(n,p);return [...s].filter(k=>!(n===el&&p===null&&k==='will-change')).map(k=>[k,s.getPropertyValue(k)]);});
  return {box:{x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height},styles};
 }))}));
 const effects=await root.evaluate(el=>{
  let blend=false;
  for(const n of [el,...el.querySelectorAll('*')])for(const pseudo of [null,'::before','::after']){const s=getComputedStyle(n,pseudo);
   if(s.filter!=='none'||s.backdropFilter!=='none')return {unsupported:'filter',blend};
   if(s.mixBlendMode!=='normal')blend=true;
   if(Number(s.zIndex)<0)return {unsupported:'negative-stacking',blend};
  }return {unsupported:null,blend};
 });
 if(effects.unsupported)return {refused:'paint-extent-compositor-effect-unqualified:'+effects.unsupported};
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scale:devicePixelRatio,scrollX,scrollY}));
 if(viewport.scale!==1)return {refused:'paint-extent-scale-not-one'};
 let before:SnapshotHandle|undefined;let cdp:CDPSession|undefined;let layers:PaintLayer[]=[];
 try{
  before=await observe();
  const originalRaster=effects.blend?PNG.sync.read(await page.screenshot({omitBackground:true,animations:'disabled'})):undefined;
  cdp=await page.context().newCDPSession(page);
  cdp.on('LayerTree.layerTreeDidChange',(event:{layers?:PaintLayer[]})=>{layers=event.layers??[];});
  await cdp.send('DOM.enable');await cdp.send('LayerTree.enable');
  const document=await cdp.send('DOM.getDocument',{depth:0});
  const found=await cdp.send('DOM.querySelector',{nodeId:document.root.nodeId,selector});
  if(!found.nodeId)return {refused:'paint-extent-subject-not-found'};
  const description=await cdp.send('DOM.describeNode',{nodeId:found.nodeId,depth:-1,pierce:true});
  const ids=new Set<number>();const visit=(n:any)=>{if(typeof n.backendNodeId==='number')ids.add(n.backendNodeId);for(const key of ['children','shadowRoots','pseudoElements'])for(const child of n[key]??[])visit(child);};visit(description.node);
  await root.evaluate(el=>(el as HTMLElement).style.setProperty('will-change','transform','important'));
  // Flush the compositor and wait for a tree containing this subject, rather
  // than accepting an earlier unrelated layer-tree event.
  const promotedBytes=await page.screenshot({omitBackground:true,animations:'disabled'});
  for(let attempt=0;attempt<20&&!layers.some(l=>l.backendNodeId===description.node.backendNodeId);attempt++)
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  const current=await cdp.send('DOM.describeNode',{nodeId:found.nodeId,depth:-1,pierce:true});
  const originalIds=[...ids].sort((a,b)=>a-b);ids.clear();visit(current.node);
  if(JSON.stringify(originalIds)!==JSON.stringify([...ids].sort((a,b)=>a-b)))return {refused:'paint-extent-subtree-changed'};
  if(!await sameSnapshot(before,await observe()))return {refused:'paint-extent-promotion-changed-subject'};
  if(JSON.stringify(viewport)!==JSON.stringify(await page.evaluate(()=>({width:innerWidth,height:innerHeight,scale:devicePixelRatio,scrollX,scrollY}))))return {refused:'paint-extent-view-changed'};
  if(!layers.some(l=>l.backendNodeId===description.node.backendNodeId))return {refused:'paint-extent-subject-layer-missing'};
  if(layers.some(l=>l.drawsContent&&!l.invisible&&l.width>0&&l.height>0&&l.backendNodeId===undefined))return {refused:'paint-extent-unattributed-layer'};
  const selected=layers.filter(l=>l.backendNodeId!==undefined&&ids.has(l.backendNodeId)&&l.drawsContent&&!l.invisible&&l.width>0&&l.height>0);
  if(!selected.length)return {refused:'paint-extent-no-subject-paint'};
  const boxes:FrameBox[]=[];for(const layer of selected){const box=paintLayerDocumentBox(layer,layers,{x:viewport.scrollX,y:viewport.scrollY});if(!box)return {refused:'paint-extent-transform-unqualified'};boxes.push(box);}
  const layout=await before.evaluate((s:{snapshot:string})=>(JSON.parse(s.snapshot) as Array<{box:FrameBox}>)[0].box),all=[layout,...boxes],x=Math.min(...all.map(b=>b.x)),y=Math.min(...all.map(b=>b.y));
  const paint={x,y,width:Math.max(...all.map(b=>b.x+b.width))-x,height:Math.max(...all.map(b=>b.y+b.height))-y};
  // Raster equality only proves the viewport actually observed. A distant
  // blend or shadow cannot borrow this proof for pixels outside that raster.
  if(effects.blend && (paint.x<viewport.scrollX||paint.y<viewport.scrollY||paint.x+paint.width>viewport.scrollX+viewport.width||paint.y+paint.height>viewport.scrollY+viewport.height))
   return {refused:'paint-extent-blend-outside-observed-viewport'};
  if(originalRaster){
   const promoted=PNG.sync.read(promotedBytes);
   const clip=enclosingFrame({...paint,x:paint.x-viewport.scrollX,y:paint.y-viewport.scrollY});
   // Promotion can rerasterize unrelated siblings sharing the old compositor
   // layer. Prove exact equality over the subject's complete observed paint
   // extent, including overflow, rather than grading neighboring components.
   // The viewport guard above prevents any unobserved pixels borrowing proof.
   if(promoted.width!==originalRaster.width||promoted.height!==originalRaster.height||
      clip.x<0||clip.y<0||clip.x+clip.width>promoted.width||clip.y+clip.height>promoted.height)
    return {refused:'paint-extent-blend-promotion-changed-raster'};
   for(let y=clip.y;y<clip.y+clip.height;y++){
    const start=(y*promoted.width+clip.x)*4,end=start+clip.width*4;
    if(!promoted.data.subarray(start,end).equals(originalRaster.data.subarray(start,end)))
     return {refused:'paint-extent-blend-promotion-changed-raster'};
   }
  }
  return {observation:{layout,paint,layers:selected,boxes,...(effects.blend?{blendRasterVerified:true as const}:{})}};
 }finally{
  try{await root.evaluate((el,original)=>{if(original.style===null)el.removeAttribute('style');else el.setAttribute('style',original.style);},initial);}
  finally{try{await before?.dispose();}finally{await cdp?.detach();}}
 }
}
