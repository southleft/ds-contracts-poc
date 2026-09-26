import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactElementCreationSites,createReactElementCreationObserver,reactElementCreationHook} from './react-element-creation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');

test('compiled factory locations use import bindings, including aliases and namespace receivers',()=>{
  const text=`import {jsx as h,jsxs} from 'react/jsx-runtime';import * as J from 'react/jsx-runtime';
export const Component=()=>h('button',{children:J.jsx('span',{})});
function Shadow(h){return h('div',{});}
function Local(J){return J.jsx('div',{});}
function Unsupported(){jsxs?.('div',{});jsxs(...unknown);return jsxs('div',{children:[]});}`;
  const sites=readReactElementCreationSites(text,'/fixture.mjs','fixture.mjs');
  assert.equal(sites.length,3);assert.deepEqual(sites.map(s=>s.factory),['jsx','jsx','jsxs']);
  assert.deepEqual(sites.map(s=>s.receiver),[undefined,'J',undefined]);
  assert(sites.every(s=>s.sourceSha256===sha(text)&&s.functionSpan));
  assert.equal(text.slice(sites[0].functionSpan!.start,sites[0].functionSpan!.end),"()=>h('button',{children:J.jsx('span',{})})");
  assert.equal(text.slice(sites[1].span.start,sites[1].span.end),"J.jsx('span',{})");
  assert.equal(readReactElementCreationSites("import {jsx} from 'react/jsx-runtime';function C(){return jsx('span',{children:globalThis.label});}",'/global.mjs','global.mjs').length,1);
  assert.equal(readReactElementCreationSites("import {jsx} from 'react/jsx-runtime';const C=props=>jsx('span',{...props});globalThis.result=C({});",'/global-write.mjs','global-write.mjs').length,1);
  assert.throws(()=>readReactElementCreationSites("import {jsx} from 'react/jsx-runtime';const globalThis={};const C=props=>jsx('span',{...props});",'/shadow.mjs','shadow.mjs'),/reserved-binding/);
});

test('source analysis does not execute initializer or wrapper factories',()=>{
  const text=`import {jsx} from 'react/jsx-runtime';throw Error('do not execute');
const Element=unknownWrapper(()=>jsx('span',{}));const forged={jsx};forged.jsx('button',{});`;
  const sites=readReactElementCreationSites(text,'/fixture.mjs','fixture.mjs');assert.equal(sites.length,1);assert.equal(sites[0].factory,'jsx');
  assert.throws(()=>readReactElementCreationSites('export const = 1','/broken.mjs','broken.mjs'),/source-syntax/);
});

function fixture(t:test.TestContext,text:string){
  const sourceRoot=process.cwd(),dir=mkdtempSync(path.join(sourceRoot,'source-reference/.element-creation-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'fixture.mjs');writeFileSync(file,text);
  const runtime=path.join(sourceRoot,'node_modules/react/cjs/react-jsx-runtime.development.js');
  const reference={sourceRoot,files:{[file]:sha(text),[runtime]:sha(readFileSync(runtime,'utf8'))},runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(sourceRoot,'node_modules/react/jsx-runtime.js')}]};
  for(const adapter of reactRuntimeAdapters){const f=sourceRoot+adapter.suffix;reference.files[f]=sha(readFileSync(f,'utf8'));}
  return {reference,file,runtime};
}

test('changed, reserved and unsupported runtime inputs refuse before a transformed build',t=>{
  const text="import {jsx} from 'react/jsx-runtime';export const C=()=>jsx('button',{});",{reference,file}=fixture(t,text);
  const observer=createReactElementCreationObserver(reference);assert.equal(observer.sites.length,1);
  assert.throws(()=>observer.complete(),/transform-incomplete/);
  assert.throws(()=>createReactElementCreationObserver({...reference,files:{...reference.files,[file]:'wrong'}}),/source-changed/);
  const reserved=fixture(t,"import {jsx} from 'react/jsx-runtime';function C(globalThis){return jsx('button',{});}");
  assert.throws(()=>createReactElementCreationObserver(reserved.reference),/reserved-binding/);
  assert.throws(()=>createReactElementCreationObserver({...reference,files:{[file]:reference.files[file]}}),/runtime-unsupported/);
});

test('real compiled closures retain exact DOM and pixels while host creation maps to source call sites',async t=>{
  const source=`import React from 'react';import {createRoot} from 'react-dom/client';import * as J from 'react/jsx-runtime';
const trace=[];const value=(n,v)=>(trace.push(n),v);
const controls=['button','span'].map(tag=>React.forwardRef((props,ref)=>J.jsx(tag,{...props,ref})));
const [Button,Span]=controls;
window.fixtureFunctions=controls.map(control=>({name:control.render.name,length:control.render.length,prototype:Object.hasOwn(control.render,'prototype')}));
function App(){return J.jsx(Button,{id:'selected',children:J.jsx(Span,{children:value('text','Original')})});}
window.fixtureTrace=trace;
createRoot(document.getElementById('root')).render(J.jsx(App,{}));`;
  const {reference,file,runtime}=fixture(t,source),observer=createReactElementCreationObserver(reference);
  const browser=await chromium.launch();const rows=[];
  try{for(const observed of [false,true]){
    const output=await build({entryPoints:[file],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in reference.files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:400,height:200}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:output.outputFiles[0].text});await page.locator('#selected').waitFor();
      const dom=await page.locator('#selected').evaluate(n=>n.outerHTML),png=await page.screenshot();
      const trace=await page.evaluate('window.fixtureTrace');assert.deepEqual(trace,['text']);
      const functions=await page.evaluate('window.fixtureFunctions');
      const ownership=observed?await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected')):undefined;
      if(ownership){
        assert.deepEqual(ownership.problems,[]);assert.equal(ownership.components.length,0);
        assert.equal(ownership.nodes.length,2);assert(ownership.nodes.every(n=>!n.createdBy&&!n.nearestComponent&&n.creationSite));
        const sites=ownership.nodes.map(n=>n.creationSite!);assert.deepEqual(sites[0],sites[1]);
        assert.equal(source.slice(sites[0].span.start,sites[0].span.end),'J.jsx(tag,{...props,ref})');
        assert.equal(source.slice(sites[0].functionSpan!.start,sites[0].functionSpan!.end),'(props,ref)=>J.jsx(tag,{...props,ref})');
        const invocations=ownership.nodes.map(n=>n.creationInvocation!);
        assert(invocations.every(i=>i.status==='observed'&&i.childrenIdentity==='same-value'&&i.effectsVerified===false&&i.acceptedContract===null));
        assert(invocations.every(i=>i.status==='observed'&&i.inputProvenance.status==='verified'&&i.inputProvenance.kind==='forward-ref-copy'&&i.outputProvenance.status==='verified'));
        if(invocations[0].status==='observed'&&invocations[1].status==='observed')assert.notEqual(invocations[0].invocation,invocations[1].invocation);
        assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);
      }
      rows.push({dom,png,functions});
    }finally{await page.close();}
  }}finally{await browser.close();}
  observer.complete();assert.equal(rows[0].dom,rows[1].dom);assert.deepEqual(rows[0].png,rows[1].png);assert.deepEqual(rows[0].functions,rows[1].functions);
});

test('runtime joins require exact type, props and reciprocal owner identities; fake factories and mutations refuse',async()=>{
  const browser=await chromium.launch();const page=await browser.newPage();
  try{
    await page.evaluate(reactElementCreationHook([{module:'fixture.mjs',sourceSha256:'test',span:{start:0,end:1},factory:'jsx'}]));
    const result=await page.evaluate(`(()=>{
      const api=globalThis.__DSC_ELEMENT_CREATION,owner={},alternate={};owner.alternate=alternate;alternate.alternate=owner;
      const factory=(type,props)=>({type,props,_owner:owner});api.register(factory,factory);
      const props={},element=api.call(0,factory,undefined,['button',props]);
      const fiber={memoizedProps:props,type:'button',_debugOwner:owner};
      const matched=!!api.read(fiber),reciprocal=!!api.read({...fiber,_debugOwner:alternate});
      const wrongProps=api.read({...fiber,memoizedProps:{}}),wrongType=api.read({...fiber,type:'span'}),wrongOwner=api.read({...fiber,_debugOwner:{alternate:owner}});
      const refused=[];try{api.call(0,()=>element,undefined,['button',{}]);}catch(e){refused.push(e.message);}
      element.type='span';try{api.read(fiber);}catch(e){refused.push(e.message);}
      return {matched,reciprocal,wrongProps:!!wrongProps,wrongType:!!wrongType,wrongOwner:!!wrongOwner,refused};
    })()`);
    assert.deepEqual(result,{matched:true,reciprocal:true,wrongProps:false,wrongType:false,wrongOwner:false,refused:['element-creation-factory-unproved','element-creation-result-changed']});
  }finally{await browser.close();}
});
