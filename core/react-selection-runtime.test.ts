import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { build } from 'esbuild';
import { chromium, type Page } from 'playwright-core';
import { REACT_SELECTION_RUNTIME } from './react-selection-runtime.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';

const fixture = REACT_SELECTION_RUNTIME + `
const defaults = [{key:'alpha'}, {key:'disabled',disabled:true}, {key:'beta'}, {key:'gamma'}];
export function ChoiceSurface(props: Partial<SelectionOptions> & { duplicate?: boolean }) {
  const items = props.items ?? defaults;
  const selection = useSingleSelection({items, orientation:'horizontal', direction:'ltr', activation:'automatic', ...props});
  return <section>
    <div {...selection.listProps} aria-label="Choose a view">
      {items.map(item => <button key={item.key} {...selection.itemProps(item.key)}>{item.key}</button>)}
    </div>
    {items.map(item => <div key={item.key} {...selection.panelProps(item.key, true)}>
      <input aria-label={'Persistent input '+item.key} defaultValue={'Content '+item.key}/>
    </div>)}
    <button data-outside="true">Outside</button>
    {props.duplicate && <ChoiceSurface/>}
  </section>;
}
export function HydrationProbe() {
  useEffect(()=>{(window as any).selectionHydrated=true},[]);
  return <ChoiceSurface duplicate/>;
}`;

function serverModule() {
  const source=ts.transpileModule(fixture,{compilerOptions:{target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports: Record<string, React.ComponentType<any>> = {};
  const require=createRequire(import.meta.url);
  vm.runInNewContext(source,{exports,require:(name:string)=>{
    if(name==='react'||name==='react/jsx-runtime')return require(name);
    throw Error('Unexpected dependency '+name);
  }});
  return exports;
}

const selected = (page: Page) => page.locator('[role=tab][aria-selected=true]').allTextContents();
const focused = (page: Page) => page.evaluate(() => document.activeElement?.textContent);
const calls = (page: Page) => page.evaluate('window.calls') as Promise<string[]>;

test('selection runtime exposes typed native controls and explicit policy', () => {
  assert.deepEqual(generatedTypeErrors('ChoiceSurface', fixture + `
    const a = <ChoiceSurface items={[{key:'a'}]} value="a" onValueChange={(key: string) => {}}/>;
    // @ts-expect-error selection is a string identity, not an index
    const b = <ChoiceSurface value={0}/>;
    // @ts-expect-error unknown activation cannot silently change behavior
    const c = <ChoiceSurface activation="hover"/>;
  `), []);
});

test('automatic keyboard selection skips disabled items, wraps and links each panel', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  await mountGenerated(page, 'ChoiceSurface', fixture);
  await page.evaluate('window.calls=[];window.renderSubject({onValueChange:key=>window.calls.push(key)});');
  await page.getByRole('tab', {name:'alpha', exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await selected(page), ['beta']);
  assert.equal(await focused(page), 'beta');
  await page.keyboard.press('End');
  assert.deepEqual(await selected(page), ['gamma']);
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await selected(page), ['alpha']);
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await selected(page), ['gamma']);
  await page.keyboard.press('Home');
  assert.deepEqual(await selected(page), ['alpha']);
  assert.deepEqual(await calls(page), ['beta','gamma','alpha','gamma','alpha']);
  const links = await page.locator('[role=tab]').evaluateAll(tabs => tabs.map(tab => {
    const panel = document.getElementById(tab.getAttribute('aria-controls')!);
    return {labelled:panel?.getAttribute('aria-labelledby')===tab.id,role:panel?.getAttribute('role'),hidden:(panel as HTMLElement)?.hidden};
  }));
  assert.deepEqual(links, [false,true,true,true].map(hidden=>({labelled:true,role:'tabpanel',hidden})));
  assert.equal(await page.locator('[role=tab][tabindex="0"]').count(), 1);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[role=tabpanel]:focus').count(), 1);
});

test('manual activation separates focus from selection and retains inactive panel state', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  await mountGenerated(page, 'ChoiceSurface', fixture);
  await page.evaluate('window.calls=[];window.renderSubject({activation:"manual",onValueChange:key=>window.calls.push(key)});');
  await page.getByRole('textbox',{name:'Persistent input alpha',exact:true}).fill('Retained edit');
  await page.getByRole('tab',{name:'alpha',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await focused(page), 'beta');
  assert.deepEqual(await selected(page), ['alpha']);
  assert.deepEqual(await calls(page), []);
  await page.keyboard.press('Enter');
  assert.deepEqual(await selected(page), ['beta']);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  assert.deepEqual(await selected(page), ['gamma']);
  assert.deepEqual(await calls(page), ['beta','gamma']);
  await page.getByRole('tab',{name:'alpha',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Persistent input alpha',exact:true}).inputValue(),'Retained edit');
  await page.addStyleTag({content:'[role=tabpanel] { display: flex; }'});
  assert.equal(await page.getByRole('textbox',{name:'Persistent input beta',exact:true}).isVisible(),false);
});

test('controlled consumers can hold or accept exactly one callback per pointer or keyboard action', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  await mountGenerated(page,'ChoiceSurface',fixture);
  await page.evaluate('window.calls=[];window.renderSubject({value:"alpha",onValueChange:key=>window.calls.push(key)});');
  await page.getByRole('tab',{name:'beta',exact:true}).click();
  assert.deepEqual(await calls(page),['beta']);
  assert.deepEqual(await selected(page),['alpha']);
  assert.equal(await focused(page),'beta');
  await page.keyboard.press('Enter');
  assert.deepEqual(await calls(page),['beta','beta']);
  await page.getByRole('tab',{name:'beta',exact:true}).click();
  assert.deepEqual(await calls(page),['beta','beta','beta']);
  await page.evaluate('window.calls=[];const accept=value=>window.renderSubject({value,onValueChange:key=>{window.calls.push(key);accept(key)}});accept("alpha");');
  await page.getByRole('tab',{name:'gamma',exact:true}).click();
  assert.deepEqual(await selected(page),['gamma']);
  assert.deepEqual(await calls(page),['gamma']);
  await page.keyboard.press('Home');
  assert.deepEqual(await selected(page),['alpha']);
  assert.deepEqual(await calls(page),['gamma','alpha']);
});

test('orientation and direction choose navigation keys without capturing unrelated keys', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  const render = await mountGenerated(page,'ChoiceSurface',fixture);
  for (const [orientation,direction,next,ignored] of [
    ['horizontal','ltr','ArrowRight','ArrowDown'],
    ['horizontal','rtl','ArrowLeft','ArrowUp'],
    ['vertical','ltr','ArrowDown','ArrowRight'],
    ['vertical','rtl','ArrowDown','ArrowLeft'],
  ]) {
    await render({key:orientation+direction,orientation,direction});
    await page.getByRole('tab',{name:'alpha',exact:true}).focus();
    await page.keyboard.press(ignored);
    assert.equal(await focused(page),'alpha');
    await page.keyboard.press('Control+'+next);
    assert.equal(await focused(page),'alpha');
    await page.keyboard.press(next);
    assert.equal(await focused(page),'beta');
    assert.deepEqual(await selected(page),['beta']);
  }
});

test('stable keys preserve IDs on reorder, replace removed selections and isolate two copies', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  const render=await mountGenerated(page,'ChoiceSurface',fixture);
  const reorder=(props:Record<string,unknown>)=>render({key:'reorder',...props});
  await reorder({items:[{key:'one'},{key:'two'},{key:'three'}],defaultValue:'two'});
  const before=await page.getByRole('tab',{name:'two',exact:true}).getAttribute('id');
  await reorder({items:[{key:'three'},{key:'two'},{key:'one'}],defaultValue:'one'});
  assert.deepEqual(await selected(page),['two'],'changing the initializer does not overwrite user state');
  assert.equal(await page.getByRole('tab',{name:'two',exact:true}).getAttribute('id'),before);
  await page.getByRole('tab',{name:'two',exact:true}).focus();
  await reorder({items:[{key:'three'},{key:'one'}]});
  await page.waitForFunction(()=>document.activeElement?.textContent==='three');
  assert.deepEqual(await selected(page),['three']);
  await reorder({items:[{key:'two'},{key:'three'},{key:'one'}]});
  assert.deepEqual(await selected(page),['three'],'removed selection does not spring back on reinsertion');
  await render({duplicate:true});
  const ids=await page.locator('[role=tab],[role=tabpanel]').evaluateAll(nodes=>nodes.map(n=>n.id));
  assert.equal(new Set(ids).size,ids.length,'each component instance has its own ID namespace');
  await page.getByRole('tablist').nth(1).getByRole('tab',{name:'beta',exact:true}).click();
  assert.deepEqual(await selected(page),['alpha','beta']);
});

test('empty, disabled and unknown controlled selections do not fabricate an active item', async t => {
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();const render=await mountGenerated(page,'ChoiceSurface',fixture);
  for(const props of [{items:[]},{items:[{key:'none',disabled:true}]},{value:'missing'},{value:'disabled'},{value:null}]){
    await render(props);
    assert.deepEqual(await selected(page),[]);
    assert.equal(await page.locator('[role=tabpanel]:not([hidden])').count(),0);
  }
  await render({items:[{key:'none',disabled:true}]});
  assert.equal(await page.locator('[role=tab][tabindex="0"]').count(),0);
  await render({items:[]});
  assert.equal(await page.getByRole('tab').count(),0);
});

test('removing a focused controlled item recovers focus without reporting a user action', async t => {
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();page.setDefaultTimeout(3000);
  await mountGenerated(page,'ChoiceSurface',fixture);
  await page.evaluate(`window.calls=[];window.renderSubject({value:'beta',onValueChange:key=>window.calls.push(key)});`);
  await page.getByRole('tab',{name:'beta',exact:true}).focus();
  await page.evaluate(`window.renderSubject({items:[{key:'alpha'},{key:'gamma'}],value:'beta',onValueChange:key=>window.calls.push(key)});`);
  assert.equal(await focused(page),'alpha');
  assert.deepEqual(await selected(page),[]);
  assert.deepEqual(await calls(page),[]);
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await calls(page),['gamma']);
  assert.deepEqual(await selected(page),[]);
});

test('server rendering and hydration preserve unique item-panel relationships across copies',async t=>{
  const generated=serverModule();
  const html=renderToString(React.createElement(generated.HydrationProbe),{identifierPrefix:'selection-proof'});
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();page.setDefaultTimeout(3000);
  await page.setContent('<!doctype html><div id="root">'+html+'</div>');
  const ids=await page.locator('[role=tab],[role=tabpanel]').evaluateAll(nodes=>nodes.map(n=>n.id));
  const bundle=await build({stdin:{contents:fixture+`
    import {hydrateRoot} from 'react-dom/client';
    window.hydrationErrors=[];
    hydrateRoot(document.getElementById('root'), <HydrationProbe/>, {
      identifierPrefix:'selection-proof',onRecoverableError:error=>window.hydrationErrors.push(String(error))});`,
    resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.waitForFunction('window.selectionHydrated===true');
  assert.deepEqual(await page.evaluate('window.hydrationErrors'),[]);
  assert.deepEqual(await page.locator('[role=tab],[role=tabpanel]').evaluateAll(nodes=>nodes.map(n=>n.id)),ids);
  assert.equal(new Set(ids).size,ids.length);
  await page.getByRole('tablist').nth(0).getByRole('tab',{name:'alpha',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await selected(page),['beta','alpha']);
  await page.getByRole('tablist').nth(1).getByRole('tab',{name:'gamma',exact:true}).click();
  assert.deepEqual(await selected(page),['beta','gamma']);
});

test('duplicate and malformed identities refuse; unusual string keys remain distinct and valid',()=>{
  const {ChoiceSurface}=serverModule();
  for(const [props,reason] of [
    [{items:[{key:'same'},{key:'same'}]},'selection-key-duplicate'],
    [{items:[{key:''}]},'selection-item-invalid'],
    [{items:[{key:0}]},'selection-item-invalid'],
    [{items:[{key:'a',disabled:'false'}]},'selection-item-invalid'],
    [{value:1},'selection-value-invalid'],
    [{defaultValue:1},'selection-initial-value-invalid'],
    [{orientation:'diagonal'},'selection-policy-invalid'],
    [{activation:'hover'},'selection-policy-invalid'],
  ] as const) assert.throws(()=>renderToString(React.createElement(ChoiceSurface,props)),new RegExp(reason));
  const keys=['a-b','a_b','a:b','a b','😀','\ud800'];
  const html=renderToString(React.createElement(ChoiceSurface,{items:keys.map(key=>({key}))}));
  const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,keys.length*2);
  assert.equal(new Set(ids).size,ids.length);
});
