import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,type Page} from 'playwright-core';
import {PNG} from 'pngjs';
import {observeConsumerPaintExtent} from './design-consumer-paint-extent.js';
import {captureObservedSubject} from './design-consumer-observed-capture.js';

const fixture=(css='',inside='<span class="plane back"></span><span class="plane front"></span>',outside='')=>`<style>
 body{margin:0}#cell{position:relative;margin:24px}#subject{position:relative;isolation:isolate;width:40px;height:40px;border-radius:0;overflow:hidden}
 .plane{position:absolute;inset:0;z-index:-1;pointer-events:none}.back{background:blue}.front{left:20px;background:red;opacity:.5}
 ${css}</style><div id="cell"><div id="subject">${inside}</div></div>${outside}`;
async function state(page:Page){return {dom:await page.locator('html').evaluate(n=>n.outerHTML),view:await page.evaluate(()=>({w:innerWidth,h:innerHeight,x:scrollX,y:scrollY})),raster:PNG.sync.read(await page.screenshot({omitBackground:true,animations:'disabled'})).data};}
async function restored(page:Page,before:Awaited<ReturnType<typeof state>>){const after=await state(page);assert.deepEqual(after,before,'all DOM/style bytes, viewport/scroll and original raster must be restored');}

test('isolated negative planes preserve order, alpha, clipping and exact subject pixels',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage({viewport:{width:320,height:240}});await page.setContent(fixture());const before=await state(page);
  const expected=PNG.sync.read(await page.locator('#subject').screenshot({omitBackground:true}));
  const extent=await observeConsumerPaintExtent(page,'#subject');assert('observation'in extent,JSON.stringify(extent));
  assert.equal(extent.observation.negativeStackRasterVerified,true);assert.equal(extent.observation.blendRasterVerified,undefined);
  assert(extent.observation.layers.length>0);assert(extent.observation.boxes.length===extent.observation.layers.length);
  const shot=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in shot,JSON.stringify(shot));
  const actual=PNG.sync.read(shot.bytes);assert.deepEqual(actual.data,expected.data);
  const pixel=(x:number,y:number)=>[...actual.data.subarray((y*actual.width+x)*4,(y*actual.width+x)*4+4)];
  assert.deepEqual(pixel(10,20),[0,0,255,255]);assert.deepEqual(pixel(30,20),[128,0,128,255]);assert.equal(pixel(0,0)[3],255);
  await restored(page,before);
 }finally{await browser.close();}
});

test('a positioned isolated descendant and a negative pseudo use only existing internal owners',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  for(const [css,inside] of [
   ['#subject{isolation:auto}#owner{position:relative;isolation:isolate;width:40px;height:40px}', '<div id="owner"><span class="plane back"></span></div>'],
   ['#subject::before{content:"";position:absolute;inset:0;z-index:-1;background:blue}', ''],
  ]){await page.setContent(fixture(css,inside));const before=await state(page);const result=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in result,JSON.stringify(result));await restored(page,before);}
 }finally{await browser.close();}
});

test('unisolated, externally isolated, static-owner and root-negative stacks are named refusals',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  for(const [css,reason] of [
   ['#subject{isolation:auto}','negative-stacking-unisolated'],
   ['#subject{isolation:auto}#cell{isolation:isolate}','negative-stacking-unisolated'],
   ['#subject{position:static}','negative-stacking-unisolated'],
   ['#subject{z-index:-1}','negative-stacking-root'],
  ]){await page.setContent(fixture(css));const before=await state(page);assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:`paint-extent-compositor-effect-unqualified:${reason}`});await restored(page,before);}
 }finally{await browser.close();}
});

test('negative stack effect ambiguity remains refused on the plane or containing path',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  for(const css of ['.back{transform:translateX(1px)}','#cell{transform:translateX(1px)}','#subject{clip-path:inset(1px)}','#subject{mask-image:linear-gradient(black,transparent)}','#subject{perspective:100px}','.back{translate:1px}']){
   await page.setContent(fixture(css));const before=await state(page);assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-compositor-effect-unqualified:negative-stacking-effect'});await restored(page,before);
  }
  await page.setContent(fixture('.back{filter:blur(1px)}'));assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-compositor-effect-unqualified:filter'});
 }finally{await browser.close();}
});

test('an unrelated overlapping sibling must survive the independent isolation raster proof',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  await page.setContent(fixture('#overlay{position:absolute;left:24px;top:24px;width:20px;height:20px;background:lime;z-index:2}',undefined,'<div id="overlay"></div>'));
  const before=await state(page),extent=await observeConsumerPaintExtent(page,'#subject');assert('observation'in extent,JSON.stringify(extent));assert.equal(extent.observation.negativeStackRasterVerified,true);
  assert.deepEqual(await captureObservedSubject(page,'#subject','#cell'),{refused:'capture-negative-stack-isolation-changed-raster'});await restored(page,before);
 }finally{await browser.close();}
});

test('negative stacks cannot borrow viewport proof for offscreen paint or distant overflow',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  for(const css of ['#cell{margin-top:300px}','#subject{overflow:visible}.back{box-shadow:400px 0 blue}']){
   await page.setContent(fixture(css));const before=await state(page);assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-negative-stack-outside-observed-viewport'});await restored(page,before);
  }
  await page.setContent(fixture('body{min-height:1000px}#cell{margin-top:500px}'));await page.locator('#subject').scrollIntoViewIfNeeded();const before=await state(page);const result=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in result,JSON.stringify(result));await restored(page,before);
 }finally{await browser.close();}
});

test('promotion proof covers overflow pixels outside layout, and restores the exact original document',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  await page.setContent(fixture('#subject{width:20px;height:20px;overflow:visible;border-radius:0}.back{left:40px;right:auto;width:20px}.front{display:none}#overlay{position:absolute;left:64px;top:24px;width:20px;height:20px;background:lime;z-index:2}body:has(#subject[style]) #overlay{background:yellow}',undefined,'<div id="overlay"></div>'));
  const before=await state(page);assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-negative-stack-promotion-changed-raster'});await restored(page,before);
 }finally{await browser.close();}
});

test('mixed blend and negative planes carry both independent proof flags',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  await page.setContent(fixture('.front{mix-blend-mode:multiply}'));const before=await state(page),result=await observeConsumerPaintExtent(page,'#subject');assert('observation'in result,JSON.stringify(result));assert.equal(result.observation.negativeStackRasterVerified,true);assert.equal(result.observation.blendRasterVerified,true);
  const shot=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in shot,JSON.stringify(shot));await restored(page,before);
 }finally{await browser.close();}
});


test('rounded borders qualify only when their full promoted raster is exactly unchanged',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
  // An already promoted source remains exactly equal, including antialiasing.
  await page.setContent(fixture('#subject{border-radius:12px;will-change:transform}'));
  const before=await state(page),expected=PNG.sync.read(await page.locator('#subject').screenshot({omitBackground:true}));
  const result=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in result,JSON.stringify(result));assert.deepEqual(PNG.sync.read(result.bytes).data,expected.data);assert.equal(expected.data[3],0);await restored(page,before);
  // On this pinned Chromium, fresh promotion rerasterizes the overlapping
  // rounded alpha edges. Geometric eligibility cannot waive pixel equality.
  await page.setContent(fixture('#subject{border-radius:12px}'));const original=await state(page);
  assert.deepEqual(await observeConsumerPaintExtent(page,'#subject'),{refused:'paint-extent-negative-stack-promotion-changed-raster'});await restored(page,original);
 }finally{await browser.close();}
});
