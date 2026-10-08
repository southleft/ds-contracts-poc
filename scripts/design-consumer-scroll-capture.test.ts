import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';import {PNG} from 'pngjs';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
test('paint crossing the viewport edge preserves original text pixels and scroll position',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:1200,height:800}});
 await page.setContent('<style>body{margin:0}#subject{position:absolute;left:12px;top:764px;width:90px;height:32px;font:14px "Unavailable Font"}#spacer{height:2000px}</style><div id="subject">Toggle</div><div id="spacer"></div>');
 const before=await page.screenshot({omitBackground:true,clip:{x:12,y:764,width:90,height:32}});
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:-2,width:90,height:40});assert.ok(!('refused'in result));
 const a=PNG.sync.read(before),b=PNG.sync.read(result.bytes);
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const ai=(y*a.width+x)*4,bi=((y+2)*b.width+x)*4;
  assert.equal(a.data[ai+3],b.data[bi+3]);if(a.data[ai+3])assert.deepEqual(a.data.subarray(ai,ai+3),b.data.subarray(bi,bi+3));
 }
 assert.equal(await page.evaluate(()=>scrollY),0);
 assert.deepEqual(await page.screenshot({omitBackground:true,clip:{x:12,y:764,width:90,height:32}}),before);
 }finally{await browser.close();}
});
test('scroll-required capture refuses fixed and sticky paint instead of moving it',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150}});
 for(const position of ['fixed','sticky']){
 await page.setContent(`<style>body{margin:0}#subject{position:absolute;top:130px;width:20px;height:20px}#subject::after{content:'x';position:${position};top:0}#spacer{height:600px}</style><div id="subject"></div><div id="spacer"></div>`);
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:20,height:25});
 assert.deepEqual(result,{refused:'isolated-capture-scroll-dependent-position'});assert.equal(await page.evaluate(()=>scrollY),0);
 }
 }finally{await browser.close();}
});
test('scroll-triggered subject changes are refused and original scroll restored',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150}});
 await page.setContent('<style>body{margin:0}#subject{position:absolute;top:130px;width:20px;height:20px}#spacer{height:600px}</style><div id="subject"></div><div id="spacer"></div>');
 await page.evaluate(()=>addEventListener('scroll',()=>{document.querySelector<HTMLElement>('#subject')!.style.color=scrollY?'red':'blue';}));
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:20,height:25});
 assert.deepEqual(result,{refused:'isolated-capture-scroll-changed-subject'});assert.equal(await page.evaluate(()=>scrollY),0);
 }finally{await browser.close();}
});

test('distant fractional SVG paths preserve exact local geometry across scroll',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:1200,height:800}});
 await page.setContent('<style>body{margin:0}#subject{position:absolute;left:15px;top:5427px;width:8px;height:8px}#spacer{height:6000px}</style><svg id="subject" viewBox="0 0 24 24"><path d="M1 1H17.01V17H1Z" fill="red"/></svg><div id="spacer"></div>');
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:8,height:8});
 assert.ok(!('refused'in result),JSON.stringify(result));assert.equal(await page.evaluate(()=>scrollY),0);
 // A path can change shape without changing its bounding box. Its source
 // geometry must remain part of the exact stability witness.
 await page.evaluate(()=>addEventListener('scroll',()=>{if(scrollY)document.querySelector('path')!.setAttribute('d','M1 1H17.01L1 17Z');}));
 const changed=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:8,height:8});
 assert.deepEqual(changed,{refused:'isolated-capture-scroll-changed-subject'});
 }finally{await browser.close();}
});
