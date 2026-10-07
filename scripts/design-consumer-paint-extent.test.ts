import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
import {observeConsumerPaintExtent,paintLayerDocumentBox} from './design-consumer-paint-extent.js';
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

test('blend promotion proof excludes unrelated sibling rerasterization while checking the complete subject',async()=>{
 const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:320,height:240}});
 await page.setContent(`<style>body{margin:0}.sample{position:relative;width:24px;height:24px;overflow:hidden;margin:12px}
 svg{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:multiply;fill:color(srgb 1 1 1 / .000009999999747378752)}
 span{position:absolute;left:3px;top:3px;font:600 12px Arial;color:#161616}
 #neighbor svg{fill:rgba(22.000000588595867,22.000000588595867,22.000000588595867,1)}#neighbor span{color:white}</style>
 <div id="subject" class="sample"><svg><rect width="100%" height="100%"/></svg><span>AI</span></div>
 <div id="neighbor" class="sample"><svg><rect width="100%" height="100%"/></svg><span>AI</span></div>`);
 const original=await page.locator('body').innerHTML();
 const before=PNG.sync.read(await page.screenshot({omitBackground:true}));
 await page.locator('#subject').evaluate(el=>(el as HTMLElement).style.willChange='transform');
 const after=PNG.sync.read(await page.screenshot({omitBackground:true}));
 await page.locator('#subject').evaluate(el=>el.removeAttribute('style'));
 assert(!before.data.equals(after.data),'fixture must reproduce sibling rerasterization');
 const box=await page.locator('#subject').boundingBox();assert(box);
 for(let y=box.y;y<box.y+box.height;y++){
  const start:number=(y*before.width+box.x)*4,end:number=start+box.width*4;
  assert(before.data.subarray(start,end).equals(after.data.subarray(start,end)),'subject pixels remain identical');
 }
 const observed=await observeConsumerPaintExtent(page,'#subject');assert('observation'in observed,JSON.stringify(observed));
 assert.equal(observed.observation.blendRasterVerified,true);assert.equal(await page.locator('body').innerHTML(),original);
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
