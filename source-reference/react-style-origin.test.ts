import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {readReactStyleOrigin} from './react-style-origin.js';
import type {ReactOwnership} from './react-ownership.js';
const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[{id:'one',source:{module:'fixture.tsx',exportName:'Surface',sourceSha256:'0'.repeat(64),span:{start:0,end:1}},props:{},roots:['']}],nodes:[{path:'',tag:'button',createdBy:'one',nearestComponent:'one'}],problems:[]};

test('browser source names follow layer and selector priority, never same-value matching',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const run=async(css:string,inline='')=>{
   await page.setContent(`<style>:root{--brand:rgb(1, 2, 3);--other:rgb(1, 2, 3);--weight:600}${css}</style><button id="subject" class="subject" style="${inline}">Content</button>`);
   const before=await page.screenshot();
   const result=await readReactStyleOrigin(page,'#subject',ownership);
   assert.deepEqual(await page.screenshot(),before,'read must not alter source rendering');
   return result.roots[0].channels;
  };
  const by=(rows:Awaited<ReturnType<typeof run>>,name='background-color')=>rows.find(c=>c.channel===name)!;
  let rows=await run('@layer base, utilities; @layer base {#subject {background-color:var(--other)}} @layer utilities {.subject {background-color:var(--brand);font-weight:var(--weight)}}');
  assert.equal(by(rows).variable,'--brand','layer priority must beat ID specificity');
  assert.equal(by(rows,'font-weight').variable,'--weight');
  assert.equal(by(rows).rawValue,'rgb(1, 2, 3)');
  assert.equal(by(rows).computedValue,'rgb(1, 2, 3)');
  rows=await run('.subject{background-color:var(--brand)} #subject{background-color:rgb(1, 2, 3)}');
  assert.equal(by(rows).status,'unresolved');assert.equal(by(rows).reason,'winning-value-not-direct-variable');
  rows=await run('.subject{background-color:var(--brand)}','background:rgb(1, 2, 3)');
  assert.equal(by(rows).status,'unresolved','same-valued shorthand override cannot inherit the old variable name');
  rows=await run('.subject{background-color:var(--brand)}','background-color:var(--other)');
  assert.equal(by(rows).variable,'--other','inline beats normal rule');
  rows=await run('@layer first, second; @layer first {.subject {background-color:var(--brand)!important}} @layer second {#subject {background-color:var(--other)!important}}','background-color:var(--other)');
  assert.equal(by(rows).variable,'--brand','important layer order reverses normal order: '+JSON.stringify(rows));
  rows=await run('.subject{background-color:var(--brand)} @media (min-width:99999px){#subject{background-color:var(--other)}}');
  assert.equal(by(rows).variable,'--brand','inactive rules cannot supply source identity');
  rows=await run('.subject{background-color:var(--brand)} .subject{background-color:var(--other)}');
  assert.equal(by(rows).reason,'cascade-order-tie','unproved source order cannot break a name tie');
  rows=await run('.subject{background-color:var(--brand)} #subject{all:initial}');
  assert.equal(by(rows).reason,'all-reset-unsupported');
  rows=await run('.subject{background-color:var(--brand, red)}');
  assert.equal(by(rows).reason,'winning-value-not-direct-variable');
 }finally{await browser.close()}
});

test('typed size provenance distinguishes authored constraints from measured auto and responsive sizes',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const read=async(css:string)=>{
   await page.setContent(`<style>:root{--space:.25rem;--alias:var(--space)}.subject{display:inline-flex;box-sizing:border-box}${css}</style><button id="subject" class="subject">Replaceable content</button>`);
   return (await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!;
  };
  let rows=await read('.subject{height:calc(var(--alias) * 9)}');
  assert.equal(rows.find(r=>r.channel==='height')!.value,'36px');
  assert.equal(rows.find(r=>r.channel==='height')!.status,'fixed');
  assert.equal(rows.find(r=>r.channel==='width')!.status,'auto');
  for(const value of ['50%','50vw','calc(100% - 5px)','10em','min(40px,10vw)']){
   rows=await read(`.subject{width:${value}}`);
   assert.equal(rows.find(r=>r.channel==='width')!.status,'unresolved',value);
  }
  // A fractional declaration is used in 1/64 px layout units. It is still the
  // author's fixed size; a clamp (below) is not.
  rows=await read('.subject{height:18.4px}');
  assert.deepEqual([rows.find(r=>r.channel==='height')!.status,rows.find(r=>r.channel==='height')!.value],['fixed','18.3906px']);
  rows=await read('.subject{width:40px;min-width:80px}');
  assert.equal(rows.find(r=>r.channel==='width')!.reason,'size-clamped-or-layout-dependent');
  rows=await read('.subject{width:40px;inline-size:50px}');
  assert.equal(rows.find(r=>r.channel==='width')!.reason,'logical-size-cascade-unsupported');
  rows=await read('.subject{width:40px}.subject{width:50px}');
  assert.equal(rows.find(r=>r.channel==='width')!.reason,'cascade-order-tie');
  rows=await read('.subject{--unit:10vw;width:calc(var(--unit) * 2)}');
  assert.equal(rows.find(r=>r.channel==='width')!.reason,'responsive-or-unsupported-size-expression');
  // An own `width:100%` that really takes its containing width is a declared
  // fill: its own status, never fixed or automatic. Anything near it is not.
  const fill=async(css:string,host='')=>{
   await page.setContent(`<style>body{margin:0}#host{box-sizing:border-box;width:360px;padding:0 20px;border:2px solid;${host}}.subject{display:grid;box-sizing:border-box;${css}}</style><div id="host"><button id="subject" class="subject">Replaceable content</button><i>sibling</i></div>`);
   return (await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(r=>r.channel==='width')!;
  };
  assert.deepEqual(await fill('width:100%'),{channel:'width',selectors:['.subject'],authoredValue:'100%',status:'fill',value:'100%'});
  assert.equal((await fill('width:100%','box-sizing:content-box')).status,'fill','the containing width is the parent content box either way');
  await fill('height:100%','height:200px');
  assert.deepEqual((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(r=>r.channel==='height'),
   {channel:'height',selectors:['.subject'],authoredValue:'100%',status:'unresolved',reason:'responsive-or-unsupported-size-expression'},'only the inline axis has a fill rule');
  // The containing width must itself be definite: up through in-flow block-level boxes to an own px length or the viewport.
  for(const host of ['width:auto','width:50%','width:auto;display:flex;flex-direction:column'])assert.equal((await fill('width:100%',host)).status,'fill',host);
  for(const host of ['width:auto;display:inline-block','width:auto;float:left','width:auto;position:absolute','width:fit-content']){
   const row=await fill('width:100%',host);assert.deepEqual([row.status,row.reason],['unresolved','declared-fill-width-containing-block-indefinite'],host);
  }
  for(const css of ['width:calc(100% - 8px)','width:50%','width:calc(100%)','width:100vw','--w:100%;width:var(--w)']){
   const row=await fill(css);assert.equal(row.status,'unresolved',css);assert.equal(row.reason,'responsive-or-unsupported-size-expression',css);
  }
  for(const [css,host] of [['width:100%;max-width:200px',''],['width:100%;min-width:500px',''],['width:100%','display:flex'],['width:100%;box-sizing:content-box;padding:0 4px','']]){
   const row=await fill(css,host);assert.equal(row.status,'unresolved',css+host);assert.equal(row.reason,'declared-fill-width-not-used',css+host);
  }
 }finally{await browser.close()}
});
