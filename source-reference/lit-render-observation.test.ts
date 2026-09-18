import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright-core';
import { deriveLitRenderObservationPolicy, installLitRenderObservationProbe, observeLitRender } from './lit-render-observation.js';
const source = `import { LitElement } from 'lit'; import { html, unsafeStatic } from 'lit/static-html.js';
class Note extends LitElement {render(){return html\`<slot></slot>\`;}}
customElements.define('fixture-note',Note);
export class StaticField extends LitElement {
 noteTag=unsafeStatic('fixture-note'); label='Helper'; calls=0;
 render(){this.calls++; return html\`<div><\${this.noteTag}>\${this.label}</\${this.noteTag}></div>\`;}
}
customElements.define('static-field',StaticField);`;
const input = (text = source) => ({source:text,sourceSha256:createHash('sha256').update(text).digest('hex'),modulePath:'fixture.ts',className:'StaticField'});
const declaration = {className:'StaticField',tagName:'static-field'};
const policy = deriveLitRenderObservationPolicy(input(), declaration)!;

test('render observation policy requires exact source identity and a supported static template import', () => {
 assert.ok(policy);
 assert.equal(deriveLitRenderObservationPolicy({...input(),sourceSha256:'0'.repeat(64)},declaration),undefined);
 assert.equal(deriveLitRenderObservationPolicy(input(),{...declaration,className:'Other'}),undefined);
 assert.equal(deriveLitRenderObservationPolicy(input(source.replace("from 'lit/static-html.js'","from 'other'")),declaration),undefined);
 assert.equal(deriveLitRenderObservationPolicy(input(), {...declaration,tagName:'div'}),undefined);
});

async function capture(browser: Browser, code: string, instrument = true) {
 const context=await browser.newContext({viewport:{width:400,height:150}});
 if(instrument) await installLitRenderObservationProbe(context,policy);
 const page=await context.newPage();
 await page.goto('data:text/html,'+encodeURIComponent('<static-field></static-field><script>'+code+'</script>'));
 await page.evaluate(async()=>{const host=document.querySelector('static-field') as any; await host.updateComplete;});
 return {context,page,observation:await observeLitRender(page,['static-field'])};
}

test('real Lit static templates are observed without an extra render or changed pixels; snapshots cannot mutate private records', async () => {
 const code=(await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
 const browser=await chromium.launch();
 try {
  const original=await capture(browser,code,false), observed=await capture(browser,code);
  try {
   assert.equal(original.observation,undefined);
   assert.equal(observed.observation!.status,'captured');
   assert.equal(observed.observation!.renders,1);
   assert.deepEqual(observed.observation!.last,{staticFields:[{property:'noteTag',value:'fixture-note'}],value:{kind:'template',strings:['<div><fixture-note>','</fixture-note></div>'],values:[{kind:'scalar',value:'Helper'}]}});
   assert.deepEqual(await observed.page.screenshot(),await original.page.screenshot());
   assert.equal(await observed.page.evaluate(()=>(document.querySelector('static-field') as any).calls),1);
   await observed.page.evaluate(()=>{const w=window as any;const copy=w.__dsContractsLitRenderObservationV1(document.querySelector('static-field'));copy.last.staticFields[0].value='fake-tag';copy.problems.push('fake');});
   assert.deepEqual(await observeLitRender(observed.page,['static-field']),observed.observation);
   await observed.page.evaluate(async()=>{const host=document.querySelector('static-field') as any;host.label='Changed';host.requestUpdate();await host.updateComplete;});
   const updated=await observeLitRender(observed.page,['static-field']);
   assert.equal(updated!.renders,2);
   assert.equal(updated!.status,'captured');
   assert.deepEqual(updated!.last!.value.kind==='template' && updated!.last!.value.values,[{kind:'scalar',value:'Changed'}]);
   await observed.page.evaluate(()=>{const host=document.querySelector('static-field') as any;host.render=()=>null;});
   assert.ok((await observeLitRender(observed.page,['static-field']))!.problems.includes('render-observation-wrapper-changed'));
  } finally {await original.context.close();await observed.context.close();}
 } finally {await browser.close();}
});

test('malformed, cyclic and oversized returns refuse without replacing the original return or invoking getters', async () => {
 const browser=await chromium.launch();
 try {
  const cases: Array<[string,string]> = [
   [`({ '_$litType$':1, get strings(){window.getterCalls++;return [''];},values:[]})`,'render-observation-accessor-refused'],
   [`({ '_$litType$':1, strings:[''],values:[false]})`,'render-observation-template-arity'],
   [`({ '_$litType$':2, strings:[''],values:[]})`,'render-observation-template-kind-unsupported'],
   [`({ '_$litType$':1, strings:['x'.repeat(262145)],values:[]})`,'render-observation-byte-limit'],
   [`({ '_$litType$':1, strings:['',''],values:new Array(1)})`,'render-observation-sparse-array'],
   [`(()=>{const value={'_$litType$':1,strings:['',''],values:[]};value.values.push(value);return value;})()`,'render-observation-cycle'],
   ['Promise.resolve(null)','render-observation-root-not-template'],
  ];
  for(const [expression,problem] of cases){
   const code=`window.getterCalls=0;window.originalReturn=${expression};class StaticField extends HTMLElement{render(){return window.originalReturn;}connectedCallback(){window.delivered=this.render();}}customElements.define('static-field',StaticField);`;
   const {context,page,observation}=await capture(browser,code);
   try {
    assert.equal(observation!.status,'refused');
    assert.ok(observation!.problems.includes(problem),JSON.stringify(observation));
    assert.equal(await page.evaluate(()=>(window as any).delivered===(window as any).originalReturn),true);
    assert.equal(await page.evaluate(()=>(window as any).getterCalls),0);
   } finally {await context.close();}
  }
 } finally {await browser.close();}
});
