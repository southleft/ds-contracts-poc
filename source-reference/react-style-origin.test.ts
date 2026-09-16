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
