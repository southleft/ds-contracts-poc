import test from 'node:test';import assert from 'node:assert/strict';
import {chromium,type Page} from 'playwright-core';import {PNG} from 'pngjs';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
test('two-dimensional viewport tiles preserve every pixel across both seams',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150}});
 await page.setContent('<style>body{margin:0}#subject{position:absolute;left:10px;top:10px;width:460px;height:340px;background:blue}#patch{position:absolute;left:150px;top:100px;width:240px;height:180px;background:red}</style><div id="subject"><div id="patch"></div></div>');
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:460,height:340});assert.ok(!('refused'in result),JSON.stringify(result));
 const png=PNG.sync.read(result.bytes);assert.equal(png.width,460);assert.equal(png.height,340);
 for(let y=0;y<340;y++)for(let x=0;x<460;x++){
 const red=x>=150&&x<390&&y>=100&&y<280,at=(y*460+x)*4;
 assert.deepEqual([...png.data.subarray(at,at+4)],red?[255,0,0,255]:[0,0,255,255]);
 }
 assert.deepEqual(await page.evaluate(()=>[scrollX,scrollY]),[0,0]);
 }finally{await browser.close();}
});
test('pixel changes in tile overlap are refused even when DOM styles and boxes match',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150}});
 await page.setContent('<style>body{margin:0}#subject{width:400px;height:40px;background:blue}</style><div id="subject"></div>');
 let screenshots=0;
 const instrument=new Proxy(page,{get(target,key){
 if(key==='screenshot')return async(...args:Parameters<Page['screenshot']>)=>{
  const bytes=await target.screenshot(...args);if(++screenshots!==2)return bytes;
  const png=PNG.sync.read(bytes);png.data[0]=255;return PNG.sync.write(png);
 };
 const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 const result=await captureIsolatedRegion(instrument,page.locator('#subject'),{x:0,y:0,width:400,height:40});
 assert.deepEqual(result,{refused:'isolated-capture-tile-overlap-mismatch'});
 assert.deepEqual(await page.evaluate(()=>[scrollX,scrollY]),[0,0]);
 }finally{await browser.close();}
});
test('oversized text capture leaves later viewport text raster unchanged',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:300,height:150}});
 await page.setContent('<style>body{margin:0}#subject{width:180px;height:600px;font:14px "Unavailable Font"}p{margin:0;height:50px}</style><div id="subject">'+Array.from({length:12},()=>'<p>Text and description</p>').join('')+'</div>');
 const before=await page.screenshot({omitBackground:true,clip:{x:0,y:0,width:180,height:50}});
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:180,height:600});assert.ok(!('refused'in result),JSON.stringify(result));
 assert.deepEqual(await page.screenshot({omitBackground:true,clip:{x:0,y:0,width:180,height:50}}),before);
 }finally{await browser.close();}
});
