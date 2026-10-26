import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {readFileSync} from 'node:fs';
import {captureIsolatedRegion} from './design-consumer-isolated-capture.js';
const currentSnapshot=()=>{
 const source=readFileSync(new URL('./design-consumer-isolated-capture.ts',import.meta.url),'utf8');
 const marker="const exactSnapshot = new Function('el','before', `",begin=source.indexOf(marker)+marker.length,end=source.indexOf('\n`);',begin);
 assert(begin>=marker.length&&end>begin);
 return new Function('el','before',source.slice(begin,end));
};
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

test('scrolling past non-rendering SVG definitions preserves paint and still rejects actual subject changes',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150},deviceScaleFactor:1});
 const html='<style>body{margin:0;min-height:600px}#subject{position:absolute;left:30px;top:300px;width:20px;height:20px;background:red}#zero{position:absolute;left:0;top:0;width:0;height:0}</style><div id="subject"><span id="zero"></span><svg width="20" height="20"><defs><clipPath id="clip"><path id="clip-shape" d="M0 0H10V20H0Z"/></clipPath></defs><path d="M0 0H20V20H0Z" clip-path="url(#clip)" fill="blue"/></svg></div>';
 for(const mutation of ['',"document.querySelector('defs').style.setProperty('--guard','changed')","document.querySelector('#zero').style.left='1px'","document.querySelector('#clip-shape').setAttribute('d','M0 0H15V20H0Z')"]){
  await page.goto('about:blank');await page.setContent(html);await page.evaluate(()=>scrollTo(0,0));
  const root=page.locator('#subject'),before=await page.content();
  assert.equal(await page.locator('defs').evaluate(n=>n.getClientRects().length),0);
  assert.equal(await page.locator('#zero').evaluate(n=>n.getClientRects().length),1);
  if(mutation)await page.evaluate(code=>window.addEventListener('scroll',()=>new Function(code)(),{once:true}),mutation);
  const result=await captureIsolatedRegion(page,root,{x:0,y:0,width:20,height:20});
  if(mutation)assert.deepEqual(result,{refused:'isolated-capture-scroll-changed-subject'},mutation);
  else{
   assert('bytes'in result,JSON.stringify(result));assert.equal(count(result.bytes,0,0,255),200);assert.equal(count(result.bytes,255,0,0),200);
   assert.deepEqual(result.frame.layout,{x:30,y:300,width:20,height:20});assert.equal(await page.content(),before);
  }
  assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY})),{x:0,y:0});
 }
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

test('isolation compares late hidden and pseudo custom properties, including added names',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage();
 const leaves=Array.from({length:240},(_,i)=>`<span id="leaf${i}" style="display:none;--source-index:${i}"></span>`).join('');
 for(const rule of ['--source-index:changed!important','--new-property:added','font-variant-numeric:tabular-nums']){
  await page.setContent('<style>#subject{width:20px;height:20px;background:blue}#leaf239::before{content:""}body:has(#neighbor[style]) #leaf239'+(rule.startsWith('font-')?'::before':'')+'{'+rule+'}</style><div id="subject">'+leaves+'</div><div id="neighbor"></div>');
  const before=await page.locator('body').innerHTML();
  assert.deepEqual(await captureIsolatedRegion(page,page.locator('#subject'),{x:0,y:0,width:20,height:20}),{refused:'isolated-capture-subject-changed'},rule);
  assert.equal(await page.locator('body').innerHTML(),before,rule);
 }
 }finally{await browser.close();}
});

test('the direct comparator agrees with the previous serialized snapshot across every recorded field',async()=>{
 const text=readFileSync(new URL('./design-consumer-isolated-capture.ts',import.meta.url),'utf8');
 const begin=text.indexOf("const exactSnapshot = new Function('el','before', `")+"const exactSnapshot = new Function('el','before', `".length;
 const end=text.indexOf('\n`);',begin);assert(begin>0&&end>begin);
 const direct=new Function('el','before',text.slice(begin,end));
 // This is the previous production observation, retained verbatim as an
 // independent comparison oracle. It does not call the candidate reader.
 const previous=new Function('el',`return [el,...el.querySelectorAll('*')].map(n=>{
  const b=n.getBoundingClientRect(),s=getComputedStyle(n);
  const matrix=n instanceof SVGPathElement?n.getScreenCTM():null;
  const local=n instanceof SVGPathElement&&matrix?n.getBBox():null;
  const geometry=local&&matrix?{local:[local.x,local.y,local.width,local.height],
   transform:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e+scrollX,matrix.f+scrollY],path:n.getAttribute('d')}:{box:[b.x+scrollX,b.y+scrollY,b.width,b.height]};
  return {geometry,style:[...s].map(k=>[k,s.getPropertyValue(k)]),pseudos:['::before','::after'].map(p=>{const ps=getComputedStyle(n,p);return [...ps].map(k=>[k,ps.getPropertyValue(k)]);})};
 });`);
 const browser=await chromium.launch();try{const page=await browser.newPage();
 const html='<style>body{margin:0}#subject{width:20px;height:20px;--original:1}#hidden{display:none}#subject::before{content:"";font-variant-numeric:normal}</style><div id="subject"><svg width="20" height="20"><path d="M0 0H20V20H0Z"/></svg><span id="hidden">hidden</span></div>';
 const mutations=[
  '',"el.style.setProperty('--original','2')","el.style.setProperty('--added','value')",
  "el.style.width='21px'","el.querySelector('#hidden').style.display='block'",
  "el.querySelector('path').setAttribute('d','M0 0H20L20 20H0Z')",
  "el.querySelector('svg').style.transform='translateX(.25px)'",
  "el.querySelector('#hidden').style.setProperty('--hidden','changed')",
  "el.appendChild(document.createElement('span'))","el.querySelector('svg').remove()",
  "const style=document.createElement('style');style.textContent='#subject::before{font-variant-numeric:tabular-nums}';document.head.appendChild(style)",
 ];
 for(const mutate of mutations){
  await page.setContent(html);const root=page.locator('#subject');
  const expected=await root.evaluateHandle(direct as (el:Element)=>unknown);
  try{
   const baseline=await expected.jsonValue() as Array<{geometry:{hasClientRect?:boolean};style:unknown;pseudos:unknown}>;
   // The candidate additionally records client-rectangle presence. At this
   // unscrolled origin every pre-existing geometry/style field stays exact.
   const legacy=baseline.map(({geometry,...rest})=>{const {hasClientRect:_,...priorGeometry}=geometry;return {geometry:priorGeometry,...rest};});
   const old=await root.evaluate(previous as (el:Element)=>unknown);assert.deepEqual(legacy,old);
   if(mutate)await root.evaluate(new Function('el',mutate) as (el:Element)=>void);
   const after=await root.evaluate(previous as (el:Element)=>unknown);
   const oldEqual=JSON.stringify(old)===JSON.stringify(after);
   assert.equal(await root.evaluate(direct as (el:Element,before:unknown)=>boolean,expected),oldEqual,mutate);
   assert.deepEqual(await expected.jsonValue(),baseline,'comparison cannot mutate its detached baseline');
  }finally{await expected.dispose();}
 }
 }finally{await browser.close();}
});

test('an unrendered identity SVG path survives scroll while its path and styles remain guarded',async()=>{
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150},deviceScaleFactor:1});
 const html='<style>body{margin:0;min-height:600px}#subject{position:absolute;left:30px;top:300px;width:20px;height:20px;background:blue}#zero{position:absolute;left:0;top:0;width:0;height:0}</style><div id="subject"><span id="zero"></span><div style="display:none"><svg width="0" height="0"><defs><clipPath id="hiddenClip"><path id="hiddenPath" d="M0 0H10V10H0Z"/></clipPath></defs></svg></div></div>';
 for(const mutation of ['',"document.querySelector('#hiddenPath').setAttribute('d','M0 0H15V10H0Z')","document.querySelector('#hiddenPath').style.setProperty('--owned','changed')","document.querySelector('#zero').style.left='1px'"]){
  await page.goto('about:blank');await page.setContent(html);await page.evaluate(()=>scrollTo(0,0));
  const root=page.locator('#subject'),before=await page.content();
  const facts=await page.locator('#hiddenPath').evaluate(n=>{const b=n.getBoundingClientRect(),p=n as SVGPathElement,l=p.getBBox(),m=p.getScreenCTM()!;return{rect:[b.x,b.y,b.width,b.height],local:[l.x,l.y,l.width,l.height],matrix:[m.a,m.b,m.c,m.d,m.e,m.f],rects:n.getClientRects().length};});
  assert.deepEqual(facts,{rect:[0,0,0,0],local:[0,0,0,0],matrix:[1,0,0,1,0,0],rects:0});
  if(mutation)await page.evaluate(code=>window.addEventListener('scroll',()=>new Function(code)(),{once:true}),mutation);
  const result=await captureIsolatedRegion(page,root,{x:0,y:0,width:20,height:20});
  if(mutation)assert.deepEqual(result,{refused:'isolated-capture-scroll-changed-subject'},mutation);
  else{assert('bytes'in result,JSON.stringify(result));assert.equal(count(result.bytes,0,0,255),400);assert.equal(await page.content(),before);}
  assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY})),{x:0,y:0});
 }
 }finally{await browser.close();}
});

test('unrendered identity-path handling excludes rendered zero paths, nonidentity matrices and nonzero local boxes',async()=>{
 const reader=currentSnapshot(),browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:200,height:150},deviceScaleFactor:1});
 await page.setContent('<style>body{margin:0;min-height:600px}#subject{position:absolute;left:30px;top:300px}</style><div id="subject"><div style="display:none"><svg width="0" height="0"><path id="hidden" d="M0 0H10V10H0Z"/></svg></div><svg width="20" height="20"><path id="renderedZero" d="M0 0"/><g transform="translate(2 3)"><path id="transformedZero" d="M0 0"/></g><defs><clipPath id="clip"><path id="nonzeroLocal" d="M0 0H10V10H0Z"/></clipPath></defs></svg></div>');
 await page.evaluate(()=>scrollTo(0,150));
 for(const id of ['hidden','renderedZero','transformedZero','nonzeroLocal']){
  const path=page.locator('#'+id),observation=await path.evaluate(reader as (el:Element)=>Array<{geometry:Record<string,unknown>}>);
  const facts=await path.evaluate(n=>{const p=n as SVGPathElement,l=p.getBBox(),m=p.getScreenCTM()!;return{rects:p.getClientRects().length,local:[l.x,l.y,l.width,l.height],matrix:[m.a,m.b,m.c,m.d,m.e,m.f],scroll:scrollY};});
  if(id==='hidden'){assert.equal(observation[0].geometry.unrenderedIdentityPath,true);assert.deepEqual(observation[0].geometry.transform,[1,0,0,1,0,0]);}
  else{assert.equal(observation[0].geometry.unrenderedIdentityPath,undefined,id);assert.deepEqual(observation[0].geometry.transform,[...facts.matrix.slice(0,5),facts.matrix[5]+facts.scroll],id);}
  if(id==='renderedZero'){assert(facts.rects>0);assert.deepEqual(facts.local,[0,0,0,0]);}
  if(id==='transformedZero')assert.notDeepEqual(facts.matrix,[1,0,0,1,0,0]);
  if(id==='nonzeroLocal')assert.deepEqual(facts.local,[0,0,10,10]);
 }
 }finally{await browser.close();}
});
