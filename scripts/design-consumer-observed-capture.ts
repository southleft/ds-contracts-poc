/** Join engine-observed paint bounds with original-page isolated capture.
 * Translation belongs to the consumer instrument cell, never component CSS. */
import {PNG} from 'pngjs';
import type {Page} from 'playwright-core';
import {observeConsumerPaintExtent} from './design-consumer-paint-extent.js';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
import {enclosingFrame,imageSha256,type FrameBox,type ConsumerFrame} from './design-consumer-framing-v2.js';
export type ObservedCapture = {bytes:Buffer;frame:ConsumerFrame;paint:FrameBox;translation?:{
 x:number;y:number;beforeLayout:FrameBox;afterLayout:FrameBox;beforeLayoutSha256:string;afterLayoutSha256:string;
}}|{refused:string};
/** Acquire subject pixels without an external canvas color. Only ancestor
 * background colors may change; inherited styles, pseudo styles, markup and
 * geometry must remain identical. Painted borders/images/effects still refuse
 * through the ordinary capture guards. The caller authenticates the page. */
export async function captureSubjectWithoutBackdrop(page:Page,selector:string,instrumentSelector:string):Promise<
 Exclude<ObservedCapture,{refused:string}>&{ancestorBackgrounds:Array<{tag:string;background:string}>}|{refused:string}> {
 const root=page.locator(selector);
 if(await root.count()!==1)return {refused:'backdrop-capture-subject-not-unique'};
 const snapshot=()=>root.evaluate(el=>JSON.stringify([el,...el.querySelectorAll('*')].map(n=>({
  html:n.outerHTML,box:n.getBoundingClientRect().toJSON(),styles:[null,'::before','::after'].map(p=>{
   const s=getComputedStyle(n,p);return [...s].map(k=>[k,s.getPropertyValue(k)]);
  }),
 }))));
 const before=await snapshot();
 const ancestors=await root.evaluateHandle(el=>{
  const records:Array<{node:HTMLElement;style:string|null;background:string}>=[];
  for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);
   records.push({node:p,style:p.getAttribute('style'),background:s.backgroundColor});
  }return records;
 });
 let result:Awaited<ReturnType<typeof captureSubjectWithoutBackdrop>>={refused:'backdrop-capture-incomplete'};
 try{
  const unsafe=await ancestors.evaluate(rs=>rs.some(({node})=>{
   const s=getComputedStyle(node);return s.backgroundImage!=='none'||s.filter!=='none'||s.backdropFilter!=='none'||s.mixBlendMode!=='normal'||s.opacity!=='1';
  }));
  if(unsafe)return {refused:'backdrop-capture-ancestor-compositing-unsupported'};
  const ancestorBackgrounds=await ancestors.evaluate(rs=>rs.filter(r=>!['transparent','rgba(0, 0, 0, 0)'].includes(r.background)).map(r=>({tag:r.node.tagName,background:r.background})));
  await ancestors.evaluate(rs=>rs.forEach(r=>{if(!['transparent','rgba(0, 0, 0, 0)'].includes(r.background))r.node.style.setProperty('background-color','transparent','important');}));
  if(await snapshot()!==before)result={refused:'backdrop-capture-subject-changed'};
  else{
   const captured=await captureObservedSubject(page,selector,instrumentSelector);
   result='refused'in captured?captured:{...captured,ancestorBackgrounds};
   if(await snapshot()!==before)result={refused:'backdrop-capture-subject-changed'};
  }
 }finally{
  try{await ancestors.evaluate(rs=>rs.forEach(r=>r.style===null?r.node.removeAttribute('style'):r.node.setAttribute('style',r.style)));}
  finally{await ancestors.dispose();}
 }
 if(await snapshot()!==before)return {refused:'backdrop-capture-restoration-changed-subject'};
 return result;
}
export async function captureObservedSubject(page:Page,selector:string,instrumentSelector:string):Promise<ObservedCapture>{
 const initial=await observeConsumerPaintExtent(page,selector);if('refused'in initial)return initial;
 const {layout,paint}=initial.observation;
 const region=(box:FrameBox,origin:FrameBox)=>({x:box.x-origin.x,y:box.y-origin.y,width:box.width,height:box.height});
 const root=page.locator(selector),instrument=page.locator(instrumentSelector);
 const dx=Math.max(0,-Math.floor(paint.x)),dy=Math.max(0,-Math.floor(paint.y));
 if(!dx&&!dy){
  // A blending subtree must also survive removal of unrelated neighboring
  // paint. Compare actual composited pixels, not just unchanged CSS values.
  const clip=enclosingFrame(paint),scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  const before=initial.observation.blendRasterVerified?PNG.sync.read(await page.screenshot({omitBackground:true,animations:'disabled',clip:{...clip,x:clip.x-scroll.x,y:clip.y-scroll.y}})):undefined;
  const capture=await captureIsolatedRegion(page,root,region(paint,layout));if('refused'in capture)return capture;
  if(before){const after=PNG.sync.read(capture.bytes);if(before.width!==after.width||before.height!==after.height||!before.data.equals(after.data))return {refused:'capture-blend-isolation-changed-raster'};}
  return {...capture,paint};
 }
 if(await instrument.count()!==1)return {refused:'capture-translation-instrument-not-unique'};
 const correct=await root.evaluate((el,selector)=>{const wrapper=document.querySelector(selector);return !!wrapper&&wrapper!==el&&wrapper!==document.body&&wrapper!==document.documentElement&&wrapper.contains(el);},instrumentSelector);
 if(!correct)return {refused:'capture-translation-instrument-not-ancestor'};
 const old=await instrument.evaluate(el=>({value:(el as HTMLElement).style.getPropertyValue('translate'),priority:(el as HTMLElement).style.getPropertyPriority('translate'),style:el.getAttribute('style'),computed:getComputedStyle(el).translate,transform:getComputedStyle(el).transform}));
 if(old.computed!=='none'||old.transform!=='none')return {refused:'capture-translation-instrument-already-transformed'};
 const observe=()=>root.evaluate(el=>[el,...el.querySelectorAll('*')].map(n=>{
  const b=n.getBoundingClientRect();return {box:{x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height},styles:[null,'::before','::after'].map(p=>{const s=getComputedStyle(n,p);return [...s].map(k=>[k,s.getPropertyValue(k)]);})};
 }));
 const before=await observe(),view=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollX,scrollY}));
 const baseline=await captureIsolatedRegion(page,root,{x:0,y:0,width:layout.width,height:layout.height});if('refused'in baseline)return baseline;
 let result:ObservedCapture={refused:'capture-translation-incomplete'};
 try{
  await instrument.evaluate((el,shift)=>(el as HTMLElement).style.setProperty('translate',`${shift.x}px ${shift.y}px`,'important'),{x:dx,y:dy});
  const expected=before.map(item=>({...item,box:{...item.box,x:item.box.x+dx,y:item.box.y+dy}}));
  if(JSON.stringify(expected)!==JSON.stringify(await observe()))result={refused:'capture-translation-changed-subject'};
  else if(JSON.stringify(view)!==JSON.stringify(await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollX,scrollY}))))result={refused:'capture-translation-changed-view'};
  else{
   const shifted=await observeConsumerPaintExtent(page,selector);
   if('refused'in shifted)result=shifted;
   else if(JSON.stringify(shifted.observation.paint)!==JSON.stringify({...paint,x:paint.x+dx,y:paint.y+dy}))result={refused:'capture-translation-changed-paint-extent'};
   else{
    const sample=await captureIsolatedRegion(page,root,{x:0,y:0,width:layout.width,height:layout.height});
    if('refused'in sample)result=sample;
    else{
     const a=PNG.sync.read(baseline.bytes),b=PNG.sync.read(sample.bytes);
     if(a.width!==b.width||a.height!==b.height||!a.data.equals(b.data))result={refused:'capture-translation-changed-layout-pixels'};
     else{
      const shot=await captureIsolatedRegion(page,root,region(shifted.observation.paint,shifted.observation.layout));
      result='refused'in shot?shot:{...shot,paint:shifted.observation.paint,translation:{x:dx,y:dy,beforeLayout:layout,afterLayout:shifted.observation.layout,beforeLayoutSha256:imageSha256(baseline.bytes),afterLayoutSha256:imageSha256(sample.bytes)}};
     }
    }
   }
  }
 }finally{
  await instrument.evaluate((el,s)=>{const style=(el as HTMLElement).style;if(s.value)style.setProperty('translate',s.value,s.priority);else style.removeProperty('translate');if(s.style===null&&!style.length)el.removeAttribute('style');},old);
 }
 if(JSON.stringify(before)!==JSON.stringify(await observe()))return {refused:'capture-translation-restoration-changed-subject'};
 return result;
}
