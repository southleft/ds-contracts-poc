import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {readReactStyleOrigin,selectorSubjectIsOwn} from './react-style-origin.js';
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
  let depth:number|undefined;
  const fill=async(css:string,host='',outer='width:500px')=>{
   await page.setContent(`<style>body{margin:0}#host{box-sizing:border-box;width:360px;padding:0 20px;border:2px solid;${host}}.subject{display:grid;box-sizing:border-box;${css}}</style><div id="outer" style="${outer}"><div id="host"><button id="subject" class="subject">Replaceable content</button><i>sibling</i></div></div>`);
   const root=(await readReactStyleOrigin(page,'#subject',ownership)).roots[0];depth=root.fillWidthContainer?.depth;
   return root.sizes!.find(r=>r.channel==='width')!;
  };
  assert.deepEqual(await fill('width:100%'),{channel:'width',selectors:['.subject'],authoredValue:'100%',status:'fill',value:'100%'});
  assert.equal(depth,1,'the parent itself supplied the width');
  assert.equal((await fill('width:100%','box-sizing:content-box')).status,'fill','the containing width is the parent content box either way');
  await fill('height:100%','height:200px');
  assert.deepEqual((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(r=>r.channel==='height'),
   {channel:'height',selectors:['.subject'],authoredValue:'100%',status:'unresolved',reason:'responsive-or-unsupported-size-expression'},'only the inline axis has a fill rule');
  // The containing width must itself be definite: up through in-flow block-level boxes to an own px length or the viewport.
  for(const host of ['width:auto','width:50%','width:auto;display:flex;flex-direction:column']){assert.equal((await fill('width:100%',host)).status,'fill',host);assert.equal(depth,2,'which ancestor supplied the width is recorded, never a selector');}
  // The harness stage, body and viewport are never a caller's place: a chain only they bound is named, not used.
  for(const [host,outer] of [['width:auto','width:auto'],['width:50%','width:80%']]){
   const row=await fill('width:100%',host,outer);assert.deepEqual([row.status,row.reason,depth],['unresolved','declared-fill-width-containing-block-viewport-only',undefined],host);
  }
  await page.setContent('<style>*{box-sizing:border-box}#root{width:360px}.subject{display:grid;width:100%}</style><div id="root"><button id="subject" class="subject">x</button></div>');
  assert.equal((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes![0].reason,'declared-fill-width-containing-block-viewport-only','a width on the harness stage is a harness fact');
  assert.equal((await readReactStyleOrigin(page,'#subject',ownership,'#elsewhere')).roots[0].sizes![0].status,'fill');
  // The witness claims only what it saw: in flow, width as the used-width source, no zoom, a horizontal chain.
  for(const [css,host,reason] of [['width:100%;position:absolute','position:relative','declared-fill-width-out-of-flow'],['width:100%;float:left','','declared-fill-width-out-of-flow'],
    ['width:100%;flex:1 1 0%','display:flex','declared-fill-width-not-used'],['width:100%','zoom:2','declared-fill-width-zoomed-context'],['width:100%;zoom:1.5','','declared-fill-width-zoomed-context']]){
   const row=await fill(css,host);assert.deepEqual([row.status,row.reason],['unresolved',reason],css+'|'+host);
  }
  await page.setContent('<style>*{box-sizing:border-box}body{margin:0}#w{writing-mode:vertical-rl}.subject{display:grid;width:100%;writing-mode:horizontal-tb}</style><div id="outer" style="width:500px"><div id="w"><button id="subject" class="subject">x</button></div></div>');
  assert.equal((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes![0].reason,'declared-fill-width-containing-block-indefinite','a vertical ancestor\'s width is its block size');
  // A size is the component's OWN only when the winning selector's subject is carried by the element itself.
  const outerRule=async(rule:string,markup='<button id="subject">x</button>')=>{
   await page.setContent(`<style>*{box-sizing:border-box}#w{width:360px}#subject{display:grid}${rule}</style><div id="w" class="group" data-size="default">${markup}</div>`);
   return (await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(r=>r.channel==='width')!;
  };
  for(const rule of ['#w > *{width:100%}','#w > *{width:320px}','div > button{width:320px}','#w button{width:100%}',':is(#w > *){width:100%}','#w > :where(button){width:320px}'])
   assert.deepEqual([(await outerRule(rule)).status,(await outerRule(rule)).reason],['unresolved','size-declared-by-outer-selector'],rule);
  assert.equal((await outerRule('.thumb, #w > *{width:320px}','<button id="subject" class="thumb">x</button>')).reason,'size-declared-by-outer-selector','every matching selector of the winning rule must be own');
  // ...while an ancestor or sibling part is only a CONDITION on the author's own rule.
  for(const [rule,status] of [['.group[data-size=default] .thumb{width:320px}','fixed'],['.thumb:is(:where(.group)[data-size="default"] *){width:320px}','fixed'],['#w > .thumb{width:100%}','fill'],
    ['[data-slot=thumb]{width:320px}','fixed'],['.thumb:has(> svg), .thumb{width:320px}','fixed'],['.data-\\[size\\=default\\]\\:w-8{width:320px}','fixed']] as const)
   assert.equal((await outerRule(rule,'<button id="subject" class="thumb data-[size=default]:w-8" data-slot="thumb">x</button>')).status,status,rule);
  assert.equal((await outerRule('#w > *{width:auto}')).status,'auto','an outer rule that declares no size leaves the width automatic');

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

test('a selector is the element\'s own by its subject compound, read through escapes, strings and functional pseudo-classes',()=>{
 for(const own of ['.a','#id','[data-x]','button.a','.a:hover','.a:has(> svg)','.group .a','.group[data-size="default a"] > .a','.g ~ .a','.\\32xl\\:w-full','.\\31 0 .a','.w-\\[calc\\(100\\%-8px\\)\\]',
   '.group-data-\\[size\\=default\\]\\/switch\\:size-4:is(:where(.group\\/switch)[data-size="default"] *)','.a:not(.b)','a[href^="x > y"]'])assert.equal(selectorSubjectIsOwn(own),true,own);
 for(const outer of ['*','#w > *','div > div','button','.a > *','.a *',':is(.a)',':where(#w > *)',':not(.b)','.a ~ *','.a + li','&.a','.a &',':hover','.a > button:hover','.\\*\\:w-full > *','.a [',''])assert.equal(selectorSubjectIsOwn(outer),false,outer);
});
