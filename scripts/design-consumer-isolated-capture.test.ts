import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
const count=(bytes:Buffer,r:number,g:number,b:number)=>{const p=PNG.sync.read(bytes);let n=0;for(let i=0;i<p.data.length;i+=4)if(p.data[i]===r&&p.data[i+1]===g&&p.data[i+2]===b&&p.data[i+3]===255)n++;return n;};
test('expanded isolated capture retains overflow, excludes neighbors, preserves clipping and restores styles',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150},deviceScaleFactor:1});
 await page.setContent('<style>body{margin:0}#cell{position:absolute;left:40px;top:40px}#subject{position:relative;width:20px;height:20px;background:blue}#paint{position:absolute;left:-15px;top:0;width:15px;height:20px;background:red}#neighbor{position:absolute;left:20px;top:35px;width:50px;height:30px;background:lime;opacity:1!important}</style><div id="cell"><div id="subject"><div id="paint"></div></div></div><div id="neighbor"></div>');
 const root=page.locator('#subject'),neighbor=page.locator('#neighbor');const before=await neighbor.getAttribute('style');
 const shot=await captureIsolatedRegion(page,root,{x:-15,y:0,width:35,height:20});assert('bytes'in shot);
 assert.equal(count(shot.bytes,255,0,0),300);assert.equal(count(shot.bytes,0,0,255),400);assert.equal(count(shot.bytes,0,255,0),0);
 assert.deepEqual(shot.frame.layout,{x:40,y:40,width:20,height:20});assert.deepEqual(shot.frame.capture,{x:25,y:40,width:35,height:20});
 assert.equal(await neighbor.evaluate(n=>getComputedStyle(n).opacity),'1');assert.equal((await neighbor.getAttribute('style'))??'',before??'');
 await root.evaluate(n=>(n as HTMLElement).style.overflow='hidden');
 const clipped=await captureIsolatedRegion(page,root,{x:-15,y:0,width:35,height:20});assert('bytes'in clipped);assert.equal(count(clipped.bytes,255,0,0),0);assert.equal(count(clipped.bytes,0,0,255),400);
 }finally{await browser.close();}
});
test('isolation refuses selector-induced subject changes and still restores the neighbor',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.setContent('<style>#subject{width:20px;height:20px;background:red}body:has(#neighbor[style]) #subject{width:25px}</style><div id="subject"></div><div id="neighbor"></div>');
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:20,height:20});assert.deepEqual(result,{refused:'isolated-capture-subject-changed'});
 assert.equal(await page.locator('#neighbor').evaluate(n=>(n as HTMLElement).style.opacity),'');
 assert.equal(await page.locator('#neighbor').getAttribute('style'),null);
 assert.equal(await page.locator('#subject').evaluate(n=>n.getBoundingClientRect().width),20);
 }finally{await browser.close();}
});

test('shifted and truncated requested regions are refused; transparent margins remain',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:200},deviceScaleFactor:1});
 await page.setContent('<style>body{margin:0}#subject{position:absolute;left:30px;top:30px;width:20px;height:20px;background:blue}</style><div id="subject"></div>');
 const root=page.locator('#subject');
 for(const region of [{x:1,y:0,width:20,height:20},{x:0,y:0,width:19,height:20}])assert.deepEqual(await captureIsolatedRegion(page,root,region),{refused:'isolated-capture-layout-truncated'});
 const result=await captureIsolatedRegion(page,root,{x:-10,y:-10,width:40,height:40});assert('bytes'in result);
 const p=PNG.sync.read(result.bytes);assert.equal(p.width,40);assert.equal(p.height,40);assert.equal(count(result.bytes,0,0,255),400);
 assert.equal([...p.data].filter((_,i)=>i%4===3&&p.data[i]===0).length,1200);
 }finally{await browser.close();}
});

test('document coordinates survive scrolling and painted ancestors remain unqualified',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150},deviceScaleFactor:1});
 await page.setContent('<style>body{margin:0;min-height:500px}#subject{position:absolute;left:30px;top:250px;width:20px;height:20vh;background:blue}</style><div id="subject"></div>');
 await page.evaluate(()=>scrollTo(0,200));
 const root=page.locator('#subject'),result=await captureIsolatedRegion(page,root,{x:-5,y:-5,width:30,height:40});
 assert('bytes'in result);assert.equal(result.frame.layout.y,250);assert.equal(result.frame.capture.y,245);assert.equal(result.frame.layout.height,30);assert.equal(count(result.bytes,0,0,255),600);
 await page.evaluate(()=>document.body.style.background='white');
 assert.deepEqual(await captureIsolatedRegion(page,root,{x:0,y:0,width:20,height:30}),{refused:'isolated-capture-painted-ancestor:body'});
 }finally{await browser.close();}
});

test('canvas extension captures distant shadow beyond scroll bounds without retaining instrumentation',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:320,height:240},deviceScaleFactor:1});
 await page.setContent('<style>body{margin:0}#subject{position:absolute;left:100px;top:100px;width:20px;height:20px;background:blue;box-shadow:2000px 0 red}#far{position:absolute;left:1000px;width:20px;height:20px;background:lime}#left{position:absolute;left:-35px;width:15px;height:20px;background:orange}</style><div id="subject"><div id="far"></div><div id="left"></div></div>');
 const state=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.scrollingElement!.scrollWidth,html:document.body.innerHTML}));
 const before=await state();assert.equal(before.scrollWidth,1120);
 const result=await captureIsolatedRegion(page,page.locator('#subject'),{x:-35,y:0,width:2055,height:20});assert('bytes'in result);
 assert.equal(count(result.bytes,0,0,255),400);assert.equal(count(result.bytes,0,255,0),400);assert.equal(count(result.bytes,255,0,0),400);assert.equal(count(result.bytes,255,165,0),300);
 assert.deepEqual(await state(),before);
 }finally{await browser.close();}
});

test('canvas extension refuses pseudo-style side effects and removes its marker',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 await page.setContent('<style>#subject{width:20px;height:20px;background:blue}#subject::before{content:"";display:block;width:2px;height:2px;background:red}body:has(>div+div) #subject::before{width:5px}</style><div id="subject"></div>');
 const before=await page.locator('body').innerHTML();
 assert.deepEqual(await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:20,height:20}),{refused:'isolated-capture-subject-changed'});
 assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});

test('a hidden sibling cannot become visible as a side effect of isolation',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 await page.setContent('<style>#subject{width:20px;height:20px;background:blue}#hidden{display:none}body:has(#neighbor[style]) #hidden{display:block}</style><div id="subject"></div><div id="neighbor"></div><div id="hidden">Hidden</div>');
 const before=await page.locator('body').innerHTML();assert.deepEqual(await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:20,height:20}),{refused:'isolated-capture-hidden-sibling-became-visible'});assert.equal(await page.locator('body').innerHTML(),before);
 }finally{await browser.close();}
});
