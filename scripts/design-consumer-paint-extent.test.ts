import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
import {observeConsumerPaintExtent,paintLayerDocumentBox} from './design-consumer-paint-extent.js';
import {retryCapture,CAPTURE_REFUSED} from './capture-retry.js';
const html=(top=100)=>`<style>body{margin:0;min-height:800px}#subject{position:absolute;left:100px;top:${top}px;width:20px;height:20px;background:blue;box-shadow:2000px 0 red}#far{position:absolute;left:4000px;top:0;width:20px;height:20px;background:lime;will-change:transform}#left{position:absolute;left:-35px;top:0;width:15px;height:20px;background:orange}</style><div id="subject"><div id="far"></div><div id="left"></div></div>`;
test('paint extent includes distant shadows and separately composited children; restoration is exact',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});await page.setContent(html());const before=await page.locator('body').innerHTML();
 const result=await observeConsumerPaintExtent(page,'#subject');assert('observation'in result,JSON.stringify(result));
 assert.deepEqual(result.observation.layout,{x:100,y:100,width:20,height:20});assert.deepEqual(result.observation.paint,{x:65,y:100,width:4055,height:20});
 assert(result.observation.layers.length>=2);assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});
test('paint extent maps scrolling back to document coordinates',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});await page.setContent(html(500));await page.evaluate(()=>scrollTo(0,280));
 const result=await observeConsumerPaintExtent(page,'#subject');assert('observation'in result,JSON.stringify(result));assert.deepEqual(result.observation.paint,{x:65,y:500,width:4055,height:20});
 }finally{await browser.close();}
});
test('an inline subject (a link in running text) is measured, not refused; restoration is exact',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:400,height:200}});
 await page.setContent('<p style="margin:20px;font:16px sans-serif">Read the <a id="subject" href="#" style="box-shadow:0 0 0 3px red">terms</a> today.</p>');
 const before=await page.locator('body').innerHTML(),rect=await page.locator('#subject').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
 const result=await observeConsumerPaintExtent(page,'#subject');assert('observation'in result,JSON.stringify(result));
 assert.deepEqual(result.observation.layout,rect);const p=result.observation.paint; // the 3px ring reaches past the layout box
 assert(p.x<=rect.x-3&&p.y<=rect.y-3&&p.x+p.width>=rect.x+rect.width+3&&p.y+p.height>=rect.y+rect.height+3,JSON.stringify(p));
 assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});
test('promotion cannot silently change fixed descendants or selector-dependent pseudo styles',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 for(const content of ['<style>#subject{position:absolute;left:100px;width:20px;height:20px;background:blue}#child{position:fixed;left:0;width:5px;height:5px;background:red}</style><div id="subject"><div id="child"></div></div>', '<style>#subject{width:20px;height:20px;background:blue}#subject::before{content:"";width:5px;height:5px;display:block}#subject[style]::before{width:10px}</style><div id="subject"></div>']){
 await page.setContent(content);const before=await page.locator('body').innerHTML();assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-promotion-changed-subject'});assert.equal(await page.locator('body').innerHTML(),before);
 }
 }finally{await browser.close();}
});
test('compositor effects not represented by paint layer pixels are explicitly unqualified',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.setContent('<div id="subject" style="width:20px;height:20px;filter:blur(5px);background:red"></div>');assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-compositor-effect-unqualified:filter'});
 }finally{await browser.close();}
});
test('a node that draws nothing cannot change the raster: measured; the same node drawing anything is still refused',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 // A transparent wrapper placed against the viewport, holding a fixed bubble that is not displayed (a closed tooltip).
 const tip=(wrap:string,bubble:string)=>`<style>#subject{display:inline-block;width:20px;height:20px;background:blue}#wrap{position:absolute;inset:0;pointer-events:none;${wrap}}#bubble{position:fixed;left:0;top:0;width:30px;height:10px;background:#333;${bubble}}</style><div id="subject"><span id="wrap"><span id="bubble">Quill tip</span></span></div>`;
 const read=async(content:string)=>{await page.setContent(content);const before=await page.locator('body').innerHTML(),r=await observeConsumerPaintExtent(page,'#subject');assert.equal(await page.locator('body').innerHTML(),before);
  return 'refused' in r?r.refused:[r.observation.paint.width,r.observation.paint.height];};
 assert.deepEqual(await read(tip('','display:none')),[20,20]);
 assert.equal(await read(tip('background:rgba(0,0,0,0.1)','display:none')),'paint-extent-promotion-changed-subject');
 assert.equal(await read(tip('','')),'paint-extent-promotion-changed-subject');
 // A filter on a box that is not rendered changes no pixel; one on a drawn descendant is still unqualified.
 assert.deepEqual(await read('<div id="subject" style="width:20px;height:20px;background:red"><div style="display:none"><div style="backdrop-filter:blur(8px);width:10px;height:10px"></div></div></div>'),[20,20]);
 assert.equal(await read('<div id="subject" style="width:20px;height:20px;background:red"><div style="filter:blur(2px);width:10px;height:10px;background:blue"></div></div>'),'paint-extent-compositor-effect-unqualified:filter');
 }finally{await browser.close();}
});
test('layer transforms compose parent offsets and refuse missing parents or 3D ambiguity',()=>{
 const base={offsetX:0,offsetY:0,width:10,height:20,drawsContent:true};const parent={...base,layerId:'p',offsetX:100,offsetY:50};const child={...base,layerId:'c',parentLayerId:'p',transform:[0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1]};
 assert.deepEqual(paintLayerDocumentBox(child,[parent,child],{x:0,y:20}),{x:80,y:70,width:20,height:10});assert.equal(paintLayerDocumentBox(child,[child],{x:0,y:0}),null);
 const perspective={...child,transform:[1,0,0,.1,0,1,0,0,0,0,1,0,0,0,0,1]};assert.equal(paintLayerDocumentBox(perspective,[parent,perspective],{x:0,y:0}),null);
});

test('observed multi-layer extent feeds original-page capture with every separated paint region',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});await page.setContent(html());
 const before=await page.locator('body').innerHTML(),result=await observeConsumerPaintExtent(page,'#subject');assert('observation'in result,JSON.stringify(result));
 const {layout,paint}=result.observation;const shot=await captureIsolatedRegion(page,page.locator('#subject'),{x:paint.x-layout.x,y:paint.y-layout.y,width:paint.width,height:paint.height});assert('bytes'in shot,JSON.stringify(shot));
 const png=PNG.sync.read(shot.bytes),colors=new Map<string,number>();for(let i=0;i<png.data.length;i+=4){const key=[...png.data.subarray(i,i+4)].join(',');colors.set(key,(colors.get(key)??0)+1);}
 assert.equal(colors.get('0,0,255,255'),400);assert.equal(colors.get('0,255,0,255'),400);assert.equal(colors.get('255,0,0,255'),400);assert.equal(colors.get('255,165,0,255'),300);
 assert.equal(await page.locator('body').innerHTML(),before);assert.deepEqual(await page.evaluate(()=>({w:innerWidth,h:innerHeight})),{w:320,h:240});
 }finally{await browser.close();}
});

test('extent-driven capture preserves ancestor clipping and compositor opacity',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});await page.setContent(html());
 await page.locator('#subject').evaluate(n=>{(n as HTMLElement).style.overflow='hidden';(n as HTMLElement).style.opacity='0.5';});
 const baseline=PNG.sync.read(await page.locator('#subject').screenshot({omitBackground:true}));
 const originalPixel=[...baseline.data.subarray(0,4)];assert.deepEqual(originalPixel.slice(0,3),[0,0,255]);assert(originalPixel[3]>0&&originalPixel[3]<255);
 const alpha=originalPixel[3];
 const result=await observeConsumerPaintExtent(page,'#subject');assert('observation'in result,JSON.stringify(result));
 const {layout,paint}=result.observation;const shot=await captureIsolatedRegion(page,page.locator('#subject'),{x:paint.x-layout.x,y:paint.y-layout.y,width:paint.width,height:paint.height});assert('bytes'in shot);
 const png=PNG.sync.read(shot.bytes),colors=new Map<string,number>();for(let i=0;i<png.data.length;i+=4){if(!png.data[i+3])continue;const key=[...png.data.subarray(i,i+4)].join(',');colors.set(key,(colors.get(key)??0)+1);}
 assert.deepEqual(Object.fromEntries(colors),{['0,0,255,'+alpha]:400,['255,0,0,'+alpha]:400});
 }finally{await browser.close();}
});

test('blend capture requires identical promoted and isolated rasters within the observed viewport',async()=>{
 const {captureObservedSubject}=await import('./design-consumer-observed-capture.js');
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
 await page.setContent('<style>body{margin:0}#subject{position:relative;width:40px;height:40px;background:#4080c0}#ink{position:absolute;inset:0;background:rgba(220,80,140,.5);mix-blend-mode:multiply}</style><div id="cell"><div id="subject"><div id="ink"></div></div></div><div style="margin-top:20px;width:20px;height:20px;background:green"></div>');
 const markup=await page.locator('body').innerHTML(),expected=PNG.sync.read(await page.locator('#subject').screenshot({omitBackground:true}));
 const observed=await observeConsumerPaintExtent(page,'#subject');assert('observation'in observed,JSON.stringify(observed));assert.equal(observed.observation.blendRasterVerified,true);
 const captured=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in captured,JSON.stringify(captured));assert.deepEqual(PNG.sync.read(captured.bytes).data,expected.data);assert.equal(await page.locator('body').innerHTML(),markup);
 // An unrelated overlay can leave promotion unchanged but still alter the
 // isolated subject raster. That second operation needs its own proof.
 await page.setContent('<style>body{margin:0}#subject{position:relative;width:40px;height:40px;background:blue}#ink{position:absolute;inset:0;background:red;mix-blend-mode:multiply}#overlay{position:absolute;left:0;top:0;width:20px;height:20px;background:green;z-index:2}</style><div id="cell"><div id="subject"><div id="ink"></div></div></div><div id="overlay"></div>');
 const withOverlay=await page.locator('body').innerHTML();assert.deepEqual(await captureObservedSubject(page,'#subject','#cell'),{refused:'capture-blend-isolation-changed-raster'});assert.equal(await page.locator('body').innerHTML(),withOverlay);
 // Changing a blend's external backdrop during promotion is not authorized
 // by unchanged geometry or computed styles.
 await page.setContent('<style>body{margin:0}#outside{position:absolute;width:40px;height:40px;background:blue}#subject{position:relative;width:40px;height:40px}#ink{position:absolute;inset:0;background:red;mix-blend-mode:multiply}</style><div id="outside"></div><div id="subject"><div id="ink"></div></div>');
 const original=await page.locator('body').innerHTML();assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-blend-promotion-changed-raster'});assert.equal(await page.locator('body').innerHTML(),original);
 await page.setContent('<style>body{margin:0}#subject{position:relative;width:40px;height:40px;background:blue;box-shadow:400px 0 blue}#ink{position:absolute;inset:0;background:red;mix-blend-mode:multiply}</style><div id="subject"><div id="ink"></div></div>');
 assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-blend-outside-observed-viewport'});
 }finally{await browser.close();}
});

test('blend promotion proof excludes unrelated sibling paint changes while checking the complete subject',async()=>{
 const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:320,height:240}});
 // Force a sibling-only paint difference during the exact promotion used by
 // the observer. Natural compositor rerasterization differs across platforms.
 // The subject has an opaque backdrop and contains no platform-specific text.
 await page.setContent(`<style>body{margin:0}.sample{position:relative;width:24px;height:24px;overflow:hidden;margin:12px}
 #subject{background:#4080c0}#ink{position:absolute;inset:0;background:rgba(220,80,140,.5);mix-blend-mode:multiply}
 #neighbor{background:lime}body:has(#subject[style]) #neighbor{background:red}</style>
 <div id="subject" class="sample"><div id="ink"></div></div>
 <div id="neighbor" class="sample"></div>`);
 const original=await page.locator('body').innerHTML();
 const before=PNG.sync.read(await retryCapture(()=>page.screenshot({omitBackground:true})));
 await page.locator('#subject').evaluate(el=>(el as HTMLElement).style.setProperty('will-change','transform','important'));
 const after=PNG.sync.read(await retryCapture(()=>page.screenshot({omitBackground:true})));
 await page.locator('#subject').evaluate(el=>el.removeAttribute('style'));
 assert(!before.data.equals(after.data),'fixture must change unrelated sibling pixels');
 const box=await page.locator('#subject').boundingBox(),neighbor=await page.locator('#neighbor').boundingBox();assert(box&&neighbor);
 const pixel=(png:PNG,x:number,y:number)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];
 assert.deepEqual(pixel(before,neighbor.x,neighbor.y),[0,255,0,255]);
 assert.deepEqual(pixel(after,neighbor.x,neighbor.y),[255,0,0,255]);
 for(let y=box.y;y<box.y+box.height;y++){
  const start:number=(y*before.width+box.x)*4,end:number=start+box.width*4;
  assert(before.data.subarray(start,end).equals(after.data.subarray(start,end)),'subject pixels remain identical');
 }
 assert(PNG.sync.read(await retryCapture(()=>page.screenshot({omitBackground:true}))).data.equals(before.data),'original page raster is restored');
 const observed=await observeConsumerPaintExtent(page,'#subject');assert('observation'in observed,JSON.stringify(observed));
 assert.equal(observed.observation.blendRasterVerified,true);assert.equal(await page.locator('body').innerHTML(),original);
 assert(PNG.sync.read(await retryCapture(()=>page.screenshot({omitBackground:true}))).data.equals(before.data),'observer restores the original page raster');
 }finally{await browser.close();}
});

test('blend promotion proof still rejects changed pixels in overflow outside the layout box',async()=>{
 const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:320,height:240}});
 await page.setContent('<style>body{margin:0}#outside{position:absolute;left:60px;top:20px;width:20px;height:20px;background:blue}#subject{position:relative;left:20px;top:20px;width:20px;height:20px}#ink{position:absolute;left:40px;top:0;width:20px;height:20px;background:red;mix-blend-mode:multiply}</style><div id="outside"></div><div id="subject"><div id="ink"></div></div>');
 const original=await page.locator('body').innerHTML();
 assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-blend-promotion-changed-raster'});
 assert.equal(await page.locator('body').innerHTML(),original);
 }finally{await browser.close();}
});
test('an out-of-flow descendant that paints nothing may move under promotion; a painted one may not',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 const subject=(child:string,text='label')=>`<style>body{margin:0}#subject{margin:40px;width:20px;height:20px;background:blue}#child{position:absolute;left:0;bottom:0;width:1px;height:1px;${child}}</style><div id="subject"><span id="child">${text}</span></div>`;
 for(const [hidden,text] of [['overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%)','label'],['visibility:hidden','label'],['width:0;height:0;background:red','']]){
  await page.setContent(subject(hidden,text));const result=await observeConsumerPaintExtent(page,'#subject');
  assert('observation'in result,hidden+' '+JSON.stringify(result));assert.deepEqual(result.observation.layout,{x:40,y:40,width:20,height:20});
 }
 for(const painted of [['background:red','label'],['width:0;height:0;box-shadow:0 0 0 4px red','']]){await page.setContent(subject(painted[0]!,painted[1]));
 assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-promotion-changed-subject'});}
 }finally{await browser.close();}
});

test('a capture is retried once on Chromium\'s capture refusal, and never on any other failure',async()=>{
 let calls=0;const fail=(message:string,times:number)=>async()=>{if(calls++<times)throw Error(`page.screenshot: ${message}`);return 'png';};
 assert.equal(await retryCapture(fail(CAPTURE_REFUSED,1)),'png');assert.equal(calls,2);
 calls=0;await assert.rejects(retryCapture(fail(CAPTURE_REFUSED,2)),/Unable to capture screenshot/);assert.equal(calls,2);
 calls=0;await assert.rejects(retryCapture(fail('Timeout 30000ms exceeded',1)),/Timeout/);assert.equal(calls,1);
 calls=0;await assert.rejects(retryCapture(fail('Protocol error (Page.captureScreenshot): Target closed',1)),/Target closed/);assert.equal(calls,1);
 calls=0;await assert.rejects(retryCapture(async()=>{calls++;throw `page.screenshot: ${CAPTURE_REFUSED}`;}),(e)=>typeof e==='string');assert.equal(calls,1);
});
