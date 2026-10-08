/** Capture an explicitly requested region without neighboring cases. This
 * helper preserves layout and clipping; callers must separately establish that
 * the requested region contains all paint. It does not infer paint bounds. */
import {PNG} from 'pngjs';
import type {JSHandle, Locator, Page} from 'playwright-core';
import {enclosingFrame,imageSha256,type FrameBox,type ConsumerFrame} from './design-consumer-framing-v2.js';

// Keep the complete snapshot in Chromium. Sending these multi-megabyte
// objects through the protocol dominated capture time. Equality is exact;
// no computed properties, pseudo styles, or geometry fields are omitted.
type SnapshotHandle = JSHandle<{snapshot:string}>;
async function sameSnapshot(before:SnapshotHandle,after:SnapshotHandle):Promise<boolean> {
 try{return await before.evaluate((left,right)=>left.snapshot===right.snapshot,after);}
 finally{await after.dispose();}
}

export async function captureIsolatedRegion(page:Page,root:Locator,relative:FrameBox):Promise<
 {bytes:Buffer;frame:ConsumerFrame}|{refused:string}> {
 if(![relative.x,relative.y,relative.width,relative.height].every(Number.isFinite)||relative.width<=0||relative.height<=0)
  return {refused:'isolated-capture-invalid-region'};
 if(await page.evaluate(()=>devicePixelRatio)!==1)return {refused:'isolated-capture-scale-not-one'};
 const bounds=()=>root.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height};});
 const layout=await bounds();
 const capture=enclosingFrame({x:layout.x+relative.x,y:layout.y+relative.y,width:relative.width,height:relative.height});
 if(capture.x>layout.x||capture.y>layout.y||capture.x+capture.width<layout.x+layout.width||capture.y+capture.height<layout.y+layout.height)
  return {refused:'isolated-capture-layout-truncated'};
 if(capture.x<0||capture.y<0)return {refused:'isolated-capture-outside-document'};
 // Keep original inline values AND priorities on the actual DOM nodes; no
 // source or generated component markup is replaced or reparented.
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 const originalScroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));
 let scrolled=false;
 const restoreScroll=async()=>{if(scrolled)await page.evaluate(({x,y})=>window.scrollTo({left:x,top:y,behavior:'instant'}),originalScroll);};
 const restore=await root.evaluateHandle(el=>{
   const records:Array<{node:HTMLElement|SVGElement;style:string|null;hidden:boolean}>=[];
   let child:Element=el;
   for(let parent=child.parentElement;parent;child=parent,parent=parent.parentElement){
     for(const sibling of parent.children){
       if(sibling===child||!(sibling instanceof HTMLElement||sibling instanceof SVGElement))continue;
       records.push({node:sibling,hidden:getComputedStyle(sibling).display==='none',style:sibling.getAttribute('style')});
     }
   }
   return records;
 });
 const observation=()=>root.evaluateHandle(el=>({snapshot:JSON.stringify([el,...el.querySelectorAll('*')].map(n=>{
   const b=n.getBoundingClientRect(),s=getComputedStyle(n);
   // Chromium rounds distant SVG path client rectangles differently after
   // scrolling. Preserve exact local geometry and the document transform
   // instead of introducing an epsilon into the stability check.
   const matrix=n instanceof SVGPathElement?n.getScreenCTM():null;
   const local=n instanceof SVGPathElement&&matrix?n.getBBox():null;
   const geometry=local&&matrix?{local:[local.x,local.y,local.width,local.height],
     transform:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e+scrollX,matrix.f+scrollY],
     path:n.getAttribute('d')}:{box:[b.x+scrollX,b.y+scrollY,b.width,b.height]};
   return {geometry,style:[...s].map(k=>[k,s.getPropertyValue(k)]),
     pseudos:['::before','::after'].map(p=>{const ps=getComputedStyle(n,p);return [...ps].map(k=>[k,ps.getPropertyValue(k)]);})};
 }))}));
 let before:SnapshotHandle|undefined;
 let extent: Awaited<ReturnType<Page['evaluateHandle']>> | undefined;
 try{
   before=await observation();
   const ancestorPaint=await root.evaluate(el=>{
     for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);
       if(!['transparent','rgba(0, 0, 0, 0)'].includes(s.backgroundColor)||s.backgroundImage!=='none'||s.boxShadow!=='none'||
         ['Top','Right','Bottom','Left'].some(side=>parseFloat(s.getPropertyValue('border-'+side.toLowerCase()+'-width'))>0)||
         (s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0))return p.localName;
       for(const pseudo of ['::before','::after'])if(!['none','normal'].includes(getComputedStyle(p,pseudo).content))return p.localName+pseudo;
     }return null;
   });
   if(ancestorPaint)return {refused:'isolated-capture-painted-ancestor:'+ancestorPaint};
   await restore.evaluate(records=>{for(const r of records)if(!r.hidden)r.node.style.setProperty('opacity','0','important');});
   if(await restore.evaluate(records=>records.some(r=>r.hidden&&getComputedStyle(r.node).display!=='none')))return {refused:'isolated-capture-hidden-sibling-became-visible'};
   // Scroll bounds omit shadows. Allocate the requested raster plane without
   // changing viewport units or keeping the component on a promoted layer.
   extent=await page.evaluateHandle(({right,bottom})=>{const marker=document.createElement('div');
     marker.style.cssText=`position:absolute;left:${right-1}px;top:${bottom-1}px;width:1px;height:1px;opacity:0;pointer-events:none`;
     document.body.appendChild(marker);return marker;
   },{right:capture.x+capture.width,bottom:capture.y+capture.height});
   if(!await sameSnapshot(before,await observation()))return {refused:'isolated-capture-subject-changed'};
   // Beyond-viewport rasterization can change text antialiasing even inside
   // the current viewport. Keep visible regions on the ordinary viewport path.
   const tiles=(origin:number,size:number,span:number)=>{
     if(size<=span)return [{origin,size}];
     const overlap=Math.min(32,Math.floor(span/2)),step=span-overlap;
     const positions:number[]=[];for(let p=origin;;p=Math.min(p+step,origin+size-span)){
       positions.push(p);if(p+span>=origin+size)break;
     }
     return positions.map(origin=>({origin,size:span}));
   };
   const xs=tiles(capture.x,capture.width,viewport.width),ys=tiles(capture.y,capture.height,viewport.height);
   const composite=new PNG({width:capture.width,height:capture.height});
   const written=new Uint8Array(capture.width*capture.height);
   let bytes:Buffer|undefined;
   for(const y of ys)for(const x of xs){
     const tile={x:x.origin,y:y.origin,width:x.size,height:y.size};
     let scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));
     const contains=()=>tile.x>=scroll.x&&tile.y>=scroll.y&&tile.x+tile.width<=scroll.x+viewport.width&&tile.y+tile.height<=scroll.y+viewport.height;
     if(!contains()){
       const scrollDependent=await root.evaluate(el=>{
         const nodes=[el,...el.querySelectorAll('*')];for(let p=el.parentElement;p;p=p.parentElement)nodes.push(p);
         return nodes.some(n=>[null,'::before','::after'].some(p=>['fixed','sticky'].includes(getComputedStyle(n,p).position)));
       });
       if(scrollDependent)return {refused:'isolated-capture-scroll-dependent-position'};
       scrolled=true;
       await page.evaluate(({x,y})=>window.scrollTo({left:x,top:y,behavior:'instant'}),{
         x:Math.max(0,Math.floor(tile.x-(viewport.width-tile.width)/2)),
         y:Math.max(0,Math.floor(tile.y-(viewport.height-tile.height)/2)),
       });
       await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
       scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));
       if(!contains())return {refused:'isolated-capture-scroll-region-unreachable'};
       if(!await sameSnapshot(before,await observation()))return {refused:'isolated-capture-scroll-changed-subject'};
     }
     const tileBytes=await page.screenshot({omitBackground:true,fullPage:false,
       clip:{...tile,x:tile.x-scroll.x,y:tile.y-scroll.y},animations:'disabled',timeout:10000});
     const png=PNG.sync.read(tileBytes);
     if(png.width!==tile.width||png.height!==tile.height)return {refused:'isolated-capture-image-span-mismatch'};
     if(!await sameSnapshot(before,await observation())||JSON.stringify(layout)!==JSON.stringify(await bounds())||
        JSON.stringify(viewport)!==JSON.stringify(await page.evaluate(()=>({width:innerWidth,height:innerHeight}))))
       return {refused:'isolated-capture-subject-changed'};
     for(let py=0;py<tile.height;py++)for(let px=0;px<tile.width;px++){
       const from=(py*tile.width+px)*4,index=(tile.y-capture.y+py)*capture.width+tile.x-capture.x+px,to=index*4;
       if(written[index]){
         if(composite.data[to+3]!==png.data[from+3]||(png.data[from+3]&&[0,1,2].some(k=>composite.data[to+k]!==png.data[from+k])))
           return {refused:'isolated-capture-tile-overlap-mismatch'};
       }else{png.data.copy(composite.data,to,from,from+4);written[index]=1;}
     }
     if(xs.length===1&&ys.length===1)bytes=tileBytes;
   }
   if(written.some(value=>value!==1))return {refused:'isolated-capture-tile-coverage-incomplete'};
   bytes??=PNG.sync.write(composite);
   await restoreScroll();
   if(JSON.stringify(originalScroll)!==JSON.stringify(await page.evaluate(()=>({x:scrollX,y:scrollY})))||
      !await sameSnapshot(before,await observation()))return {refused:'isolated-capture-scroll-restoration-changed-subject'};
   return {bytes,frame:{layout,capture,deviceScaleFactor:1,pngSha256:imageSha256(bytes)}};
 }finally{
   try{await restoreScroll();}finally{try{
    if(extent){try{await extent.evaluate((node:unknown)=>(node as HTMLElement).remove());}finally{await extent.dispose();}}
   }finally{try{
   await restore.evaluate(records=>{for(const r of records){
    if(r.hidden)continue;
    if(r.style===null){
     r.node.removeAttribute('style');
     // Flush pending CSSOM attribute synchronization: reading/serializing an
     // opacity-mutated element can otherwise recreate an empty style attribute.
     if(r.node.getAttribute('style')!==null)r.node.removeAttribute('style');
    }else r.node.setAttribute('style',r.style);
   }});
   }finally{try{await before?.dispose();}finally{await restore.dispose();}}}}
 }
}
