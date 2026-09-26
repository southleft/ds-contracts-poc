import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {readReactStyleOrigin,resolveReactStyleDeclaration,selectorSubjectIsOwn,fixedSizeExpression} from './react-style-origin.js';
import type {ReactOwnership} from './react-ownership.js';
const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[{id:'one',source:{module:'fixture.tsx',exportName:'Surface',sourceSha256:'0'.repeat(64),span:{start:0,end:1}},props:{},roots:['']}],nodes:[{path:'',tag:'button',createdBy:'one',nearestComponent:'one'}],problems:[]};

test('all resets compete in the cascade; losing resets do not hide authored dimensions',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const capture=async(css:string,inline='')=>{
   await page.setContent(`<style>${css}</style><button id="subject" class="subject" style="${inline}">x</button>`);
   const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
   const {root}=await cdp.send('DOM.getDocument'),{nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#subject'});
   const matched=await cdp.send('CSS.getMatchedStylesForNode',{nodeId}),layers=await cdp.send('CSS.getLayersForNode',{nodeId});
   await cdp.detach();return {matched,layers};
  };
  for(const [css,inline] of [
   ['.subject{all:unset}.subject{width:48px}',''],
   ['#subject{width:48px}.subject{all:unset}',''],
   ['.subject{width:48px!important}#subject{all:unset}',''],
   ['@layer reset, component;@layer reset{#subject{all:unset}}@layer component{.subject{width:48px}}',''],
   ['@layer first, second;@layer first{.subject{width:48px!important}}@layer second{#subject{all:unset!important}}',''],
   ['.subject{all:unset}','width:48px'],
   ['#subject{all:unset!important}','width:48px!important'],
   ['.subject{width:48px}@media(min-width:99999px){#subject{all:unset}}',''],
   ['.subject{width:48px}@supports(unknown-property:yes){#subject{all:unset}}',''],
   ['.subject{all:var(--reset);--reset:unset}.subject{width:48px}','']
  ]){
   const {matched,layers}=await capture(css,inline),before=await page.screenshot();
   const result=resolveReactStyleDeclaration(matched,layers,'width');
   assert.equal(result.status,'resolved',css+'; '+inline);assert.equal(result.value,'48px');
   assert.equal(await page.locator('#subject').evaluate(n=>getComputedStyle(n).width),'48px');
   assert.deepEqual(resolveReactStyleDeclaration({...matched,matchedCSSRules:[...matched.matchedCSSRules!].reverse()},layers,'width'),result,'CDP list order is not proof');
   assert.deepEqual(await page.screenshot(),before);
  }
  for(const keyword of ['initial','inherit','unset','revert','revert-layer']){
   const {matched,layers}=await capture(`.subject{width:48px}.subject{all:${keyword}}`);
   const result=resolveReactStyleDeclaration(matched,layers,'width');
   if(['initial','unset'].includes(keyword)){assert.equal(result.status,'resolved');assert.equal(result.value,keyword);}
   else assert.equal(result.reason,'all-reset-unsupported',keyword);
  }
  for(const [css,inline] of [
   ['.subject{width:48px}#subject{all:unset}',''],
   ['#subject{width:48px}.subject{all:unset!important}',''],
   ['.subject{width:48px!important}','all:unset!important'],
   ['@layer first, second;@layer first{.subject{all:unset!important}}@layer second{#subject{width:48px!important}}','']
  ]){
   const {matched,layers}=await capture(css,inline),result=resolveReactStyleDeclaration(matched,layers,'width');
   assert.equal(result.status,'resolved',css+'; '+inline);assert.equal(result.value,'unset');
   assert.equal((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(s=>s.channel==='width')!.status,'auto');
  }
  for(const [css,inline] of [
   ['.subject{all:unset;width:48px}',''],
   ['.subject{width:48px;all:unset}',''],
   ['', 'all:unset;width:48px'],
   ['', 'width:48px;all:unset']
  ]){
   const {matched,layers}=await capture(css,inline);
   assert.equal(resolveReactStyleDeclaration(matched,layers,'width').reason,'all-reset-unsupported',css+'; '+inline);
  }
  const {matched,layers}=await capture('.subject{all:unset}.subject{width:48px}');
  const mutate=(change:(rule:NonNullable<typeof matched.matchedCSSRules>[number]['rule'])=>void)=>{
   const copy=structuredClone(matched),rule=copy.matchedCSSRules!.find(m=>m.rule.origin==='regular'&&m.rule.style.cssProperties.some(p=>p.name==='all'))!.rule;
   change(rule);assert.equal(resolveReactStyleDeclaration(copy,layers,'width').status,'unresolved','unproven ordering cannot discard a reset');
  };
  mutate(rule=>{delete rule.style.range});mutate(rule=>{delete rule.originTreeScopeNodeId});
  mutate(rule=>{rule.styleSheetId='another';rule.style.styleSheetId='another'});
  mutate(rule=>{rule.nestingSelectors=['.outer']});
  for(const channel of ['direction','unicode-bidi','--custom']){
   const {matched,layers}=await capture(`.subject{${channel}:${channel==='direction'?'rtl':channel==='unicode-bidi'?'isolate':'48px'}}#subject{all:unset}`);
   assert.equal(resolveReactStyleDeclaration(matched,layers,channel).status,'resolved',channel+' is exempt from all');
  }
  // A real fixed-size read, including a variable, still proves the used box.
  await page.setContent('<style>.subject{all:unset}.subject{--size:48px;width:var(--size);height:24px;display:block;box-sizing:border-box}</style><button id="subject" class="subject">x</button>');
  assert.deepEqual((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.map(s=>[s.status,s.value]),[['fixed','48px'],['fixed','24px']]);
 }finally{await browser.close()}
});

test('size provenance follows the selected var fallback and preserves empty versus invalid custom properties',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const read=async(declaration:string)=>{
   await page.setContent(`<style>.subject{display:block;box-sizing:border-box;padding:0;border:0;width:48px;${declaration}}</style><button class="subject" id="subject">x</button>`);
   return (await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(s=>s.channel==='height')!;
  };
  for(const [css,expected] of [
   ['height:var(--missing,24px)','24px'],
   ['--unit:12px;height:var(--missing,var(--also-missing,calc(var(--unit) * 2)))','24px'],
   ['--unit:24px;height:var(--unit,50vw)','24px'],
   ['--unit:initial;height:var(--unit,24px)','24px'],
   ['--a:var(--b);--b:var(--a);height:var(--a,24px)','24px'],
   ['height:var(--missing,var(--missing,24px))','24px'],
   ['--unit:0px;height:var(--unit,24px)','0px']
  ]){const result=await read(css);assert.equal(result.status,'fixed',css+': '+JSON.stringify(result));assert.equal(result.value,expected);}
  for(const css of [
   '--unit: ;height:var(--unit,24px)',
   '--unit:red;height:var(--unit,24px)',
   '--unit:50vw;height:var(--unit,24px)',
   'height:var(--missing,var(--other,50%))',
   'height:var(--missing,24px);min-height:48px'
  ])assert.notEqual((await read(css)).status,'fixed',css);
  assert.equal(fixedSizeExpression('var(--x,24px)',{'--x':''}),false,'a present empty value cannot choose fallback');
  assert.equal(fixedSizeExpression('var(--x,24px)',{'--x':'var(--x)'}),false,'unresolved cyclic substitution is not fixed');
  assert.equal(fixedSizeExpression('var(--x,'.repeat(70)+'24px'+')'.repeat(70),{}),false,'bounded recursion');
  for(const keyword of ['auto','initial','unset']){
   assert.equal((await read(`height:${keyword}`)).status,'auto',keyword);
   if(keyword!=='auto'){
    await page.setContent(`<style>.subject{height:48px}.subject{all:${keyword}}</style><button class="subject" id="subject">x</button>`);
    assert((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.every(s=>s.status==='auto'));
   }
  }
 }finally{await browser.close()}
});

test('registered custom properties cannot disguise viewport dimensions as fixed pixels, including through aliases',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  for(const registration of ['rule','script']){
   await page.goto('about:blank');
   if(registration==='script')await page.evaluate(()=>CSS.registerProperty({name:'--measure',syntax:'<length>',inherits:true,initialValue:'24px'}));
   for(const expression of ['var(--measure)','var(--missing,var(--alias))']){
    await page.setContent(`<style>${registration==='rule'?'@property --measure{syntax:"<length>";inherits:true;initial-value:24px}':''}.subject{--measure:50vw;--alias:var(--measure);display:block;box-sizing:border-box;border:0;padding:0;width:48px;height:${expression}}</style><button id="subject" class="subject">x</button>`);
    const size=(await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(s=>s.channel==='height')!;
    assert.equal(size.status,'unresolved',registration+':'+expression);
    assert.equal(size.reason,'registered-size-variable-provenance-unqualified');
   }
  }
 }finally{await browser.close()}
});

test('an unregistered variable chain is fixed although the page registers unrelated properties',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const size=async(css:string,height:string)=>{
   await page.goto('about:blank');
   await page.setContent(`<style>@property --tw-x{syntax:"<length>";inherits:false;initial-value:0px}${css}.subject{display:block;box-sizing:border-box;border:0;padding:0;width:48px;height:${height}}</style><button id="subject" class="subject">x</button>`);
   return (await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(s=>s.channel==='height')!;
  };
  // Tailwind v4 shape: theme variable on :root, utilities register --tw-* only.
  for(const [css,height] of [['@layer theme{:root,:host{--spacing:0.25rem}}','calc(var(--spacing) * 4)'],
    ['.subject{--spacing:0.25rem}','calc(var(--spacing) * 4)'],['@layer theme{:root{--spacing:0.25rem}}','calc(var(--missing,var(--spacing)) * 4)']]) {
   const h=await size(css,height);
   assert.deepEqual([h.status,h.value],['fixed','16px'],css+' '+height);
  }
  // Anything that can reach a registered property still refuses, whatever its value.
  for(const css of ['@property --spacing{syntax:"<length>";inherits:true;initial-value:4px}:root{--spacing:4px}',
    '@property --reg{syntax:"<length>";inherits:true;initial-value:4px}:root{--reg:4px;--spacing:var(--reg)}',
    '@property --reg{syntax:"<length>";inherits:true;initial-value:4px}:root{--reg:4px;--spacing:var(--nope,var(--reg))}']) {
   const h=await size(css,'calc(var(--spacing) * 4)');
   assert.deepEqual([h.status,h.reason],['unresolved','registered-size-variable-provenance-unqualified'],css);
  }
  await page.goto('about:blank');await page.evaluate(()=>CSS.registerProperty({name:'--spacing',syntax:'<length>',inherits:true,initialValue:'4px'}));
  await page.setContent('<style>:root{--spacing:4px}.subject{display:block;box-sizing:border-box;border:0;padding:0;width:48px;height:calc(var(--spacing) * 4)}</style><button id="subject" class="subject">x</button>');
  const scripted=(await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(s=>s.channel==='height')!;
  assert.deepEqual([scripted.status,scripted.reason],['unresolved','registered-size-variable-provenance-unqualified'],'script registration');
  // Unregistered but responsive units are still judged by the fixed-expression rule.
  for(const unit of ['1vw','1em']) {
   const h=await size(`:root{--spacing:${unit}}`,'calc(var(--spacing) * 4)');
   assert.deepEqual([h.status,h.reason],['unresolved','responsive-or-unsupported-size-expression'],unit);
  }
 }finally{await browser.close()}
});

test('rule-order proof requires complete, non-overlapping positions in one stylesheet and ignores CDP list order',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const capture=async(html:string)=>{
   await page.setContent(html);
   const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
   const {root}=await cdp.send('DOM.getDocument'),{nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#subject'});
   const matched=await cdp.send('CSS.getMatchedStylesForNode',{nodeId}),layers=await cdp.send('CSS.getLayersForNode',{nodeId});
   await cdp.detach();return {matched,layers};
  };
  const html='<style>.subject{width:40px}\n.subject{width:50px}</style><button id="subject" class="subject">x</button>';
  const {matched,layers}=await capture(html),read=(m=matched)=>resolveReactStyleDeclaration(m,layers,'width');
  assert.equal(read().status,'resolved');assert.equal((read() as {value:string}).value,'50px');
  const reversed=structuredClone(matched);reversed.matchedCSSRules!.reverse();assert.deepEqual(read(reversed),read());
  const rules=matched.matchedCSSRules!.filter(m=>m.rule.origin==='regular'&&m.rule.style.cssProperties.some(p=>p.name==='width'));
  assert.equal(rules.length,2);
  const duplicate=structuredClone(matched);duplicate.matchedCSSRules!.push(structuredClone(rules[0]));assert.deepEqual(read(duplicate),read());
  const tamper=(change:(rule:typeof rules[number]['rule'],first:typeof rules[number]['rule'])=>void)=>{
   const m=structuredClone(matched),rs=m.matchedCSSRules!.filter(m=>m.rule.origin==='regular'&&m.rule.style.cssProperties.some(p=>p.name==='width'));
   change(rs[1].rule,rs[0].rule);assert.equal(read(m).status,'unresolved');assert.equal((read(m) as {reason:string}).reason,'cascade-order-tie');
  };
  tamper(r=>{delete r.style.range});
  tamper(r=>{delete r.style.styleSheetId});
  tamper(r=>{delete r.originTreeScopeNodeId});
  tamper(r=>{r.originTreeScopeNodeId=0});
  tamper(r=>{r.originTreeScopeNodeId=NaN});
  tamper(r=>{r.style.range!.startLine=-1});
  tamper(r=>{r.style.range!.startColumn=NaN});
  tamper(r=>{r.style.range!.endLine=0;r.style.range!.endColumn=0});
  tamper((r,first)=>{r.style.range={...first.style.range!,endColumn:first.style.range!.endColumn+1}});
  tamper((r,first)=>{r.style.range={...first.style.range!}});
  tamper(r=>{r.styleSheetId='another-sheet';r.style.styleSheetId='another-sheet'});
  tamper(r=>{r.nestingSelectors=['.parent']});
  const cross=await capture('<style>.subject{width:40px}</style><style>.subject{width:50px}</style><button id="subject" class="subject">x</button>');
  assert.equal(resolveReactStyleDeclaration(cross.matched,cross.layers,'width').status,'unresolved','different sheet order remains outside the proof');
  assert.equal((await readReactStyleOrigin(page,'#subject',ownership)).roots[0].sizes!.find(r=>r.channel==='width')!.reason,'cascade-order-tie');
 }finally{await browser.close()}
});

test('one stylesheet shared across document and shadow contexts cannot use source order or specificity as encapsulation order',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  for(const inner of [':host',':host(.subject)'])for(const important of ['', '!important']){
   await page.setContent('<div id="subject" class="subject" style="--outer:red;--inner:blue">x</div>');
   await page.evaluate(({inner,important})=>{
    const sheet=new CSSStyleSheet();
    sheet.replaceSync(`.subject{background-color:var(--outer)${important}}\n${inner}{background-color:var(--inner)${important}}`);
    document.adoptedStyleSheets=[sheet];
    document.querySelector('#subject')!.attachShadow({mode:'open'}).adoptedStyleSheets=[sheet];
   },{inner,important});
   assert.equal(await page.locator('#subject').evaluate(n=>getComputedStyle(n).backgroundColor),important?'rgb(0, 0, 255)':'rgb(255, 0, 0)');
   const result=await readReactStyleOrigin(page,'#subject',{...ownership,nodes:[{...ownership.nodes[0],tag:'div'}]});
   const channel=result.roots[0].channels.find(c=>c.channel==='background-color')!;
   assert.equal(channel.status,'unresolved');assert.equal(channel.reason,'encapsulation-cascade-unsupported');
  }
 }finally{await browser.close()}
});

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
  assert.equal(by(rows).variable,'--other','later captured rule in the same stylesheet breaks the specificity tie');
  rows=await run('.subject{background-color:var(--other)} .subject{background-color:var(--brand)}');
  assert.equal(by(rows).variable,'--brand','source position wins independently of the variable name or equal color');
  rows=await run('.subject{background-color:var(--brand);background-color:var(--other)}');
  assert.equal(by(rows).reason,'cascade-order-tie','declaration order within one rule is still outside the bounded proof');
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
  // The declaration must BE the box. Where width/height do not apply, getComputedStyle answers with the computed value
  // itself, so a computed-vs-used comparison passes vacuously: the MEASURED border box decides.
  const span:ReactOwnership={...ownership,nodes:[{...ownership.nodes[0],tag:'span'}]};
  for(const display of ['inline','contents','table-row']){ // a button blockifies `inline`; a span in a block parent does not
   await page.setContent(`<style>.subject{display:${display};width:16px;height:16px}</style><div style="display:${display==='table-row'?'table':'block'};width:100px"><span id="subject" class="subject">x</span></div>`);
   assert.deepEqual((await readReactStyleOrigin(page,'#subject',span)).roots[0].sizes!.map(r=>[r.status,r.reason]),Array(2).fill(['unresolved',display==='table-row'?'size-clamped-or-layout-dependent':'size-declaration-does-not-apply']),display);
  }
  for(const [css,reason] of [
    ['.subject{box-sizing:content-box;width:12px;height:12px;padding:2px;border:1px solid}','size-is-content-box'],['.subject{width:16px;height:16px;zoom:2}','size-zoomed-context'],
    ['body{zoom:1.5}.subject{width:16px;height:16px}','size-zoomed-context'],['.subject{width:16px;height:16px;scale:2}','size-clamped-or-layout-dependent']]){
   rows=await read(css);assert.deepEqual(rows.map(r=>[r.status,r.reason]),[['unresolved',reason],['unresolved',reason]],css);
  }
  for(const css of ['.subject{box-sizing:content-box;padding:0;border:0;width:16px;height:16px}','.subject{width:16px;height:16px;padding:2px;border:1px solid}','.subject{width:16px;height:18.4px;translate:40px}'])
   assert.deepEqual((await read(css)).map(r=>r.status),['fixed','fixed'],css);
  rows=await read('.subject{width:40px;min-width:80px}');
  assert.equal(rows.find(r=>r.channel==='width')!.reason,'size-clamped-or-layout-dependent');
  rows=await read('.subject{width:40px;inline-size:50px}');
  assert.equal(rows.find(r=>r.channel==='width')!.reason,'logical-size-cascade-unsupported');
  rows=await read('.subject{width:40px}.subject{width:50px}');
  assert.deepEqual([rows.find(r=>r.channel==='width')!.status,rows.find(r=>r.channel==='width')!.value],['fixed','50px']);
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
