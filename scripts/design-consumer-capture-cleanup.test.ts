import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,type Page} from 'playwright-core';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
import {observeConsumerPaintExtent} from './design-consumer-paint-extent.js';

function failingScreenshot(page:Page):Page {
 return new Proxy(page,{get(target,key){
  if(key==='screenshot')return async()=>{throw new Error('injected screenshot failure');};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}
test('capture failure restores sibling styles and removes the extent marker',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  await page.setContent('<style>body{margin:0}</style><div id="subject" style="width:20px;height:20px;background:blue"></div><div id="neighbor" style="opacity:.75!important;width:10px;height:10px"></div>');
  const before=await page.locator('body').innerHTML();
  await assert.rejects(captureIsolatedRegion(failingScreenshot(page),page.locator('#subject'),{x:0,y:0,width:20,height:20}),/injected screenshot failure/);
  assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});
test('paint observation failure restores the exact original will-change declaration',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  await page.setContent('<div id="subject" style="width:20px;height:20px;background:blue;will-change:opacity!important"></div>');
  const before=await page.locator('#subject').getAttribute('style');
  await assert.rejects(observeConsumerPaintExtent(failingScreenshot(page),'#subject'),/injected screenshot failure/);
  assert.equal(await page.locator('#subject').getAttribute('style'),before);
 }finally{await browser.close();}
});
