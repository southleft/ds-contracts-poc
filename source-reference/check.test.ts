import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { checkSource, type SourceProfile } from './check.js';
import { observeSource, watchSourceFailures } from './observe.js';

const profile: SourceProfile = {
  id:'negative-control-fixture', provenance:'source-reference/check.test.ts (instrument test, not a design-system proof)',
  path:['button'], requiredStyles:{display:'inline-flex', 'background-color':'rgb(40, 80, 160)'},
  requiredTokens:{'--theme-accent':'#2850a0'}, fontFamily:'IBM Plex Sans',
};
const font = readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
function html(options: {css?:boolean; theme?:boolean; font?:boolean; empty?:boolean; hidden?:boolean} = {}) {
  return `<style>${options.font === false ? '' : `@font-face{font-family:'IBM Plex Sans';src:url(data:font/woff2;base64,${font})}`}
    ${options.theme === false ? '' : ':root{--theme-accent:#2850a0}'}
    ${options.css === false ? '' : 'button{display:inline-flex;background:var(--theme-accent);font:16px "IBM Plex Sans";padding:12px;color:white}'}
    </style>${options.empty ? '' : `<button style="${options.hidden ? 'visibility:hidden' : ''}">Reference</button>`}`;
}

test('real Chromium rejects invalid answer keys, not just tampered JSON', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const [name, options, reason] of [
      ['healthy', {}, null], ['no CSS', {css:false}, 'style-mismatch:display'],
      ['no provider', {theme:false}, 'theme-token-missing:--theme-accent'],
      ['no font', {font:false}, 'font-substitution'], ['empty', {empty:true}, 'component-missing'],
      ['hidden', {hidden:true}, 'component-not-visible'],
    ] as const) {
      const page = await browser.newPage();
      const failures = watchSourceFailures(page);
      await page.setContent(html(options)); await page.evaluate(() => document.fonts.ready);
      const result = checkSource(profile, await observeSource(page, profile, failures));
      if (reason) assert.ok(result.problems.includes(reason), `${name}: ${JSON.stringify(result)}`);
      else assert.deepEqual(result, {status:'valid', problems:[]});
      failures.dispose(); await page.close();
    }
    const page = await browser.newPage();
    const failures = watchSourceFailures(page);
    await page.route('https://source-reference.invalid/**', route => route.fulfill({status:404, body:'missing'}));
    await page.setContent(html() + '<img src="https://source-reference.invalid/required-icon.png">');
    await page.evaluate(() => document.fonts.ready);
    assert.ok(checkSource(profile, await observeSource(page, profile, failures)).problems.includes('resource-failure'));
    failures.dispose(); await page.close();
    const delayed = await browser.newPage();
    const delayedFailures = watchSourceFailures(delayed);
    await delayed.setContent(html({css:false}));
    assert.equal(checkSource(profile, await observeSource(delayed, profile, delayedFailures)).status, 'invalid', 'mounted DOM before CSS is not ready');
    await delayed.addStyleTag({content:'button{display:inline-flex;background:var(--theme-accent);font:16px "IBM Plex Sans";padding:12px;color:white}'});
    await delayed.evaluate(() => document.fonts.ready);
    assert.equal(checkSource(profile, await observeSource(delayed, profile, delayedFailures)).status, 'valid', 'same DOM becomes valid only after the actual stylesheet and font load');
    await delayed.addStyleTag({content:':root{--theme-accent:#ff0000}'});
    assert.ok(checkSource(profile, await observeSource(delayed, profile, delayedFailures)).problems.includes('theme-token-mismatch:--theme-accent'), 'loaded but wrong theme is not valid');
    const errorSeen = delayed.waitForEvent('pageerror');
    await delayed.addScriptTag({content:'setTimeout(() => { throw new Error("planted render error"); }, 0)'});
    await errorSeen;
    assert.ok(checkSource(profile, await observeSource(delayed, profile, delayedFailures)).problems.includes('runtime-error'));
    delayedFailures.dispose(); await delayed.close();
  } finally { await browser.close(); }
});

test('an empty profile cannot confer validity', () => {
  const result = checkSource({...profile, requiredStyles:{}, requiredTokens:{}}, {
    found:true, visible:true, width:1, height:1, text:'x', styles:{}, tokens:{}, fontsReady:true,
    platformFonts:[{familyName:'IBM Plex Sans', glyphCount:1}], failedResources:[], runtimeErrors:[],
  });
  assert.ok(result.problems.includes('profile-incomplete'));
});

test('state and slotted font witnesses reject plausible but wrong stories', async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const failures = watchSourceFailures(page);
  const stateProfile: SourceProfile = {...profile, fontPath:['label-host', 'span'], probes:{
    input:{path:['input'], properties:{checked:true, disabled:false}},
    icon:{path:['svg'], styles:{width:'20px'}},
  }};
  try {
    await page.setContent(html() + '<input type="checkbox" checked><svg width="20" height="20"><rect width="20" height="20"/></svg><label-host></label-host>');
    await page.evaluate(() => {
      document.querySelector('label-host')!.attachShadow({mode:'open'}).innerHTML = '<span style="font:16px IBM Plex Sans">Slotted label</span>';
    });
    await page.evaluate(() => document.fonts.ready);
    const check = async () => checkSource(stateProfile, await observeSource(page,stateProfile,failures));
    assert.equal((await check()).status,'valid');
    await page.evaluate(() => { document.querySelector('input')!.disabled = true; });
    assert.ok((await check()).problems.includes('probe-state-mismatch:input:disabled'));
    await page.evaluate(() => { document.querySelector('input')!.disabled = false; });
    await page.evaluate(() => { document.querySelector('input')!.checked = false; });
    assert.ok((await check()).problems.includes('probe-state-mismatch:input:checked'));
    await page.evaluate(() => { document.querySelector('input')!.checked = true; document.querySelector('svg')!.remove(); });
    assert.ok((await check()).problems.includes('probe-not-visible:icon'));
    await page.evaluate(() => { (document.querySelector('label-host')!.shadowRoot!.querySelector('span')!).style.fontFamily = 'serif'; });
    assert.ok((await check()).problems.includes('font-substitution'));
  } finally { failures.dispose(); await browser.close(); }
});

test('textless controls require their actual visible unique label and its painted font',async()=>{
  const browser=await chromium.launch();const page=await browser.newPage();const failures=watchSourceFailures(page);
  const labeled:SourceProfile={...profile,path:['#control'],associatedLabelText:'Receive updates'};
  const original=()=>html().replace('<button style="">Reference</button>','<button id="control" role="checkbox" aria-checked="false"></button><label for="control" style="font:16px IBM Plex Sans">Receive updates</label>');
  const check=async()=>checkSource(labeled,await observeSource(page,labeled,failures));
  try{
    for(const [mutation,problem] of [
      [()=>{},null],
      [()=>{document.querySelector('label')!.htmlFor='unrelated';},'label-association-invalid'],
      [()=>{document.querySelector('label')!.style.display='none';},'label-not-visible'],
      [()=>{document.querySelector('label')!.textContent='Different label';},'label-text-mismatch'],
      [()=>{document.querySelector('label')!.style.fontFamily='serif';},'font-substitution'],
      [()=>{const duplicate=document.createElement('div');duplicate.id='control';document.body.append(duplicate);},'label-association-invalid'],
    ] as const){await page.setContent(original());await page.evaluate(()=>document.fonts.ready);await page.evaluate(mutation);const result=await check();if(problem)assert.ok(result.problems.includes(problem),JSON.stringify(result));else assert.equal(result.status,'valid',JSON.stringify(result));}
  }finally{failures.dispose();await browser.close();}
});

test('explicit text absence is independently observed and never inferred from empty rendered text', async () => {
  const browser=await chromium.launch();const page=await browser.newPage();const failures=watchSourceFailures(page);
  const absent:SourceProfile={id:'absence-probe',provenance:'bounded browser instrument',path:['#subject'],textContent:'absent',
    requiredStyles:{display:'block',width:'16px',height:'1px'},requiredTokens:{'--paint':'#2850a0'},fontFamily:'Inter'};
  const setup=async(markup:string,css='')=>{
    await page.setContent(`<style>:root{--paint:#2850a0}#subject{display:block;box-sizing:border-box;width:16px;height:1px;background:var(--paint)}${css}</style>${markup}`);
    await page.evaluate(()=>document.fonts.ready);
  };
  const read=()=>observeSource(page,absent,failures);
  try {
    for(const markup of ['<span id="subject"></span>','<span id="subject"><!-- source comment --></span>',
      '<svg id="subject"><rect width="16" height="1"/></svg>']) {
      await setup(markup);const observed=await read();assert.deepEqual(checkSource(absent,observed),{status:'valid',problems:[]});
      assert.equal(observed.textAbsence?.status,'observed');assert.equal(observed.platformFonts.filter(f=>f.glyphCount>0).length,0);
    }
    await setup('<span id="subject"></span>');
    const original={...absent};delete original.textContent;
    const oldObserved=await observeSource(page,original,failures);
    assert.equal(oldObserved.textAbsence,undefined,'old observations retain their field shape');
    assert.ok(checkSource(original,oldObserved).problems.includes('text-witness-missing'));
    assert.ok(checkSource(original,oldObserved).problems.includes('font-substitution'));
    const observed=await read();
    for(const textAbsence of [undefined,{status:'observed' as const,inspectedNodes:0,problems:[]},
      {status:'observed' as const,inspectedNodes:10001,problems:[]}])
      assert.ok(checkSource(absent,{...observed,textAbsence}).problems.includes('text-absence-unverified'));
    assert.ok(checkSource(absent,{...observed,platformFonts:[{familyName:'Inter',glyphCount:1}]}).problems.includes('unexpected-source-glyphs'));
    for(const extra of [{fontPath:['#nearby']},{associatedLabelText:'Nearby'}])
      assert.ok(checkSource({...absent,...extra},observed).problems.includes('profile-incomplete'));
    for(const [markup,css,problem] of [
      ['<span id="subject">Visible</span>','','unexpected-source-text'],
      ['<span id="subject"><b hidden>Hidden</b></span>','','unexpected-source-text'],
      ['<span id="subject"></span>','#subject::before{content:"Generated"}','text-absence-generated-content'],
      ['<span id="subject"></span>','#subject::after{content:attr(id)}','text-absence-generated-content'],
      ['<span id="subject"></span>','#subject{content:"Replacement"}','text-absence-generated-content'],
      ['<li id="subject"></li>','#subject{display:list-item}','text-absence-generated-content'],
      ['<x-unknown id="subject"></x-unknown>','','text-absence-scope-unavailable'],
      ['<span id="subject" is="x-customized"></span>','','text-absence-scope-unavailable'],
      ['<span id="subject"><slot></slot></span>','','text-absence-scope-unavailable'],
      ['<input id="subject" value="Native field text">','','text-absence-scope-unavailable'],
      ['<svg id="subject"><use href="#external"/></svg>','','text-absence-scope-unavailable'],
      ['<span id="subject">'+ '<!---->'.repeat(10000) +'</span>','','text-absence-scope-too-large'],
      ['<span id="subject"></span>','#subject{visibility:hidden}','component-not-visible'],
      ['<span id="subject"></span>','#subject{width:0}','component-not-visible'],
      ['<span id="subject"></span>',':root{--paint:blue}','theme-token-mismatch:--paint'],
      ['<span></span>','','component-missing'],
    ]) {
      await setup(markup,css);const result=checkSource(absent,await read());assert.ok(result.problems.includes(problem),`${problem}: ${JSON.stringify(result)}`);
    }
    await setup('<span id="subject"></span>');
    await page.evaluate(()=>document.querySelector('#subject')!.attachShadow({mode:'open'}).innerHTML='<b>Shadow</b>');
    assert.ok(checkSource(absent,await read()).problems.includes('text-absence-scope-unavailable'));
    for(const nested of [false,true]) {
      await setup(nested ? '<span id="subject"><span id="closed"></span></span>' : '<span id="subject"></span>');
      await page.evaluate(nested=>{
        document.querySelector(nested ? '#closed' : '#subject')!.attachShadow({mode:'closed'}).innerHTML='<canvas width="16" height="1"></canvas>';
      },nested);
      assert.ok(checkSource(absent,await read()).problems.includes('text-absence-scope-unavailable'),nested ? 'nested closed shadow' : 'root closed shadow');
    }
    await setup('<span id="subject"></span>');
    await page.evaluate(()=>{
      const query=document.querySelector.bind(document);let reads=0;
      document.querySelector=((selector:string)=>{
        const node=query(selector);
        if(selector==='#subject' && ++reads===2) {node?.remove();return null;}
        return node;
      }) as typeof document.querySelector;
    });
    assert.ok(checkSource(absent,await read()).problems.includes('text-absence-scope-unavailable'),
      'a root disappearing before the protocol read cannot establish zero painted glyphs');
  } finally {failures.dispose();await browser.close();}
});
