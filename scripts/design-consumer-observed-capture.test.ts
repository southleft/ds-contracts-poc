import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {PNG} from 'pngjs';
import {captureObservedSubject,captureSubjectWithoutBackdrop} from './design-consumer-observed-capture.js';
const html='<style>body{margin:0}#cell{position:absolute;left:10px;top:10px}#subject{position:relative;width:20px;height:20px;background:blue}#outside{position:absolute;left:-25px;top:-25px;width:15px;height:15px;background:red}</style><div id="cell"><div id="subject"><div id="outside"></div></div></div>';
test('external backdrop removal preserves subject alpha, inherited color and original page',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});
 await page.setContent('<style>body{margin:0;background:white}#cell{background:yellow;color:rgb(10,20,30);padding:10px}#subject{width:20px;height:20px;background:rgba(200,100,50,.5)}</style><div id="cell"><div id="subject"></div></div>');
 const before=await page.content(),original=await page.screenshot();
 const result=await captureSubjectWithoutBackdrop(page,'#subject','#cell');assert('bytes'in result,JSON.stringify(result));
 const png=PNG.sync.read(result.bytes);assert.equal(png.width,20);assert.equal(png.height,20);assert.equal(png.data[3],128);
 assert.deepEqual(result.ancestorBackgrounds,[{tag:'DIV',background:'rgb(255, 255, 0)'},{tag:'BODY',background:'rgb(255, 255, 255)'}]);
 assert.equal(await page.content(),before);assert.deepEqual(await page.screenshot(),original);
 }finally{await browser.close();}
});
test('backdrop acquisition refuses selector changes and ancestor blending, restoring styles',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 await page.setContent('<style>#cell{background:white}#subject{width:20px;height:20px;background:blue}#cell[style] #subject::before{content:"changed"}</style><div id="cell"><div id="subject"></div></div>');
 const before=await page.content();assert.deepEqual(await captureSubjectWithoutBackdrop(page,'#subject','#cell'),{refused:'backdrop-capture-subject-changed'});assert.equal(await page.content(),before);
 await page.locator('#cell').evaluate(n=>(n as HTMLElement).style.opacity='.5');
 const composited=await page.content();assert.deepEqual(await captureSubjectWithoutBackdrop(page,'#subject','#cell'),{refused:'backdrop-capture-ancestor-compositing-unsupported'});assert.equal(await page.content(),composited);
 }finally{await browser.close();}
});
test('negative-origin paint is captured after a guarded integer instrument translation and restored',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240}});await page.setContent(html);const before=await page.locator('body').innerHTML();
 const result=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in result,JSON.stringify(result));assert(result.translation);assert.equal(result.translation.x,15);assert.equal(result.translation.y,15);
 assert.deepEqual(result.frame.layout,{x:25,y:25,width:20,height:20});assert.deepEqual(result.frame.capture,{x:0,y:0,width:45,height:45});
 assert.equal(result.translation.beforeLayoutSha256,result.translation.afterLayoutSha256);
 const png=PNG.sync.read(result.bytes),colors=new Map<string,number>();for(let i=0;i<png.data.length;i+=4){const key=[...png.data.subarray(i,i+4)].join(',');colors.set(key,(colors.get(key)??0)+1);}
 assert.equal(colors.get('255,0,0,255'),225);assert.equal(colors.get('0,0,255,255'),400);assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});
test('translation rejects selector-induced pseudo changes and existing instrument transforms',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.setContent(html+'<style>#subject::before{content:"";display:block;width:2px;height:2px;background:lime}#cell[style] #subject::before{width:5px}</style>');
 const before=await page.locator('body').innerHTML();assert.deepEqual(await captureObservedSubject(page,'#subject','#cell'),{refused:'capture-translation-changed-subject'});assert.equal(await page.locator('body').innerHTML(),before);
 await page.setContent(html);await page.locator('#cell').evaluate(n=>(n as HTMLElement).style.transform='translateX(1px)');assert.deepEqual(await captureObservedSubject(page,'#subject','#cell'),{refused:'capture-translation-instrument-already-transformed'});
 }finally{await browser.close();}
});
test('an absolute subject cannot acquire a different containing block without refusal',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.setContent('<style>body{margin:0}#cell{margin-left:50px}#subject{position:absolute;left:10px;top:10px;width:20px;height:20px;background:blue}#outside{position:absolute;left:-25px;top:0;width:15px;height:15px;background:red}</style><div id="cell"><div id="subject"><div id="outside"></div></div></div>');
 const before=await page.locator('body').innerHTML();assert.deepEqual(await captureObservedSubject(page,'#subject','#cell'),{refused:'capture-translation-changed-subject'});assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});
test('visible text capture preserves the original raster despite a taller document',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.setContent('<style>body{margin:0;background:transparent}#cell{margin:8px;padding:4px;width:fit-content}#subject{width:486px;font:12px "Unavailable Font";color:#172b4d}p{margin:0;height:40px}#neighbor{height:1100px}</style><div id="cell"><div id="subject"><b>Blog</b><p>Text and description</p><p>Another description</p></div></div><div id="neighbor"></div>');
 const root=page.locator('#subject'),before=PNG.sync.read(await root.screenshot({omitBackground:true}));
 const result=await captureObservedSubject(page,'#subject','#cell');assert('bytes'in result,JSON.stringify(result));
 const during=PNG.sync.read(result.bytes),after=PNG.sync.read(await root.screenshot({omitBackground:true}));
 assert.deepEqual(during.data,before.data);assert.deepEqual(after.data,before.data);
 }finally{await browser.close();}
});
