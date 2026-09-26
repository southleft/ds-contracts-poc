import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {createReactElementCreationObserver,readReactElementCreationSites} from './react-element-creation.js';
import {readReactCompiledContent} from './react-compiled-content.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

test('createElement recognition is opt-in and uses the import binder, preserving namespace receivers and child counts',()=>{
  const text=`import React,{createElement as h} from 'react';import * as R from 'react';import {default as Default} from 'react';import {jsx} from 'react/jsx-runtime';
React.createElement(C,null,'a','b');h(C,{label:'a'});R.createElement(C,null);Default.createElement(C,null);jsx(C,{});
function shadow(React,h){React.createElement(C,{});h(C,{})} React.createElement?.(C,{});React.createElement(C,...args);`;
  assert.equal(readReactElementCreationSites(text,'fixture.mjs','fixture.mjs').length,1);
  const sites=readReactElementCreationSites(text,'fixture.mjs','fixture.mjs',true);assert.equal(sites.length,5);
  assert.deepEqual(sites.map(p=>p.factory),['createElement','createElement','createElement','createElement','jsx']);
  assert.deepEqual(sites.map(p=>p.receiver),['React',undefined,'R','Default',undefined]);
  assert.equal(text.slice(sites[0].span.start,sites[0].span.end),"React.createElement(C,null,'a','b')");
  assert.throws(()=>readReactElementCreationSites("import React from 'react';function C(globalThis){return React.createElement('button',{})}",'fixture.mjs','fixture.mjs',true),/reserved-binding/);
});

function fixture(t:test.TestContext){
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.reference-entry-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'components.tsx'),configFile=path.join(dir,'tsconfig.json');
  const source=`import React from 'react';
export const Root=React.forwardRef<HTMLButtonElement,any>((props,ref)=><button {...props} ref={ref}/>);
export function Plain(props:any){return <button id="default">{props.label}</button>};Plain.defaultProps={label:'Default'};
export function Empty(props:any){return <button id="empty">Empty</button>};`;
  const entry=`import React,{createElement as h} from 'react';import {createRoot} from 'react-dom/client';import {Root,Plain,Empty} from './components.tsx';
const trace:string[]=[],ref=React.createRef<HTMLButtonElement>();
const proxy=new Proxy({id:'proxy',children:'Proxy'},{get(t,k,r){trace.push('get:'+String(k));return Reflect.get(t,k,r)},has(t,k){trace.push('has:'+String(k));return Reflect.has(t,k)},ownKeys(t){trace.push('keys');return Reflect.ownKeys(t)},getOwnPropertyDescriptor(t,k){trace.push('descriptor:'+String(k));return Reflect.getOwnPropertyDescriptor(t,k)},getPrototypeOf(t){trace.push('prototype');return Reflect.getPrototypeOf(t)}});
const accessor={id:'accessor',get children(){trace.push('accessor');return 'Accessor'}};
window.fixtureTrace=trace;window.fixtureRef=ref;window.factoryIdentity=React.createElement===h;
createRoot(document.getElementById('root')!).render(React.createElement('section',null,
 React.createElement(Root,{id:'selected',ref,key:'k',children:'Replaced'},'First','Second'),
 h(Plain,{label:undefined}),h(Empty,null),h(Root,proxy),h(Root,accessor)));`;
  const config='{"compilerOptions":{"target":"ES2022","jsx":"react-jsx"}}';writeFileSync(file,source);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(source),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={id:sha(entry),sourceRoot:dir,files,cohort:{entry},runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]};
  return {root,dir,file,entry,configFile,reference};
}

test('changed or unbound entry/config/runtime refuses, and an entry never becomes authored content authority',async t=>{
  const f=fixture(t),observer=createReactElementCreationObserver(f.reference,f.entry);
  const sites=observer.sites.filter(p=>p.referenceEntry);assert.equal(sites.length,6);assert(sites.every(p=>p.factory==='createElement'));
  assert(sites.every(p=>p.sourceSha256===sha(f.entry)&&p.referenceEntry?.cohortEntrySha256===sha(f.entry)&&p.referenceEntry.referenceId===f.reference.id));
  const result=readReactCompiledContent(f.reference,sites[0]);assert.equal(result.status,'refused');if(result.status==='refused')assert.equal(result.reason,'compiled-content-reference-entry-unmodeled');
  await assert.rejects(observer.transform(f.entry+' ','react-reference.tsx','tsx'),/entry-source-or-loader-changed/);
  await assert.rejects(observer.transform(f.entry,'react-reference.tsx','js'),/entry-source-or-loader-changed/);
  assert.throws(()=>createReactElementCreationObserver(f.reference,'different'),/entry-source-unbound/);
  assert.throws(()=>createReactElementCreationObserver({...f.reference,id:undefined},f.entry),/entry-source-unbound/);
  const badFiles={...f.reference.files};delete badFiles[f.root+reactRuntimeAdapters[0].suffix];
  assert.throws(()=>createReactElementCreationObserver({...f.reference,files:badFiles},f.entry),/entry-react-runtime-unsupported/);
  for(const [file] of Object.entries(f.reference.files))if(file!==f.configFile)await observer.transform(readFileSync(file,'utf8'),file,file===f.file?'tsx':'js');
  assert.throws(()=>observer.complete(),/transform-incomplete/);
  await observer.transform(f.entry,'react-reference.tsx','tsx');observer.complete();
  writeFileSync(f.configFile,'{}');await assert.rejects(observer.transform(f.entry,'react-reference.tsx','tsx'),/entry-tsconfig-changed/);
});

test('pinned entry createElement preserves refs, keys, defaults, null config, children and proxy/accessor evaluation',async t=>{
  const f=fixture(t),observer=createReactElementCreationObserver(f.reference,f.entry),browser=await chromium.launch();t.after(()=>browser.close());const rows=[];
  for(const observed of [false,true]){
    const stdin=observed?await observer.transform(f.entry,'react-reference.tsx','tsx'):{contents:f.entry,loader:'tsx' as const};
    const built=await build({stdin:{...stdin,resolveDir:f.dir,sourcefile:'react-reference.tsx'},tsconfig:f.configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in f.reference.files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path===f.file?'tsx':'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:600,height:150}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#accessor').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot(),metadata=await page.evaluate<{trace:string[];ref:boolean;identity:boolean}>('({trace:window.fixtureTrace,ref:window.fixtureRef.current===document.getElementById("selected"),identity:window.factoryIdentity})');rows.push({dom,png,metadata});if(!observed)continue;
      for(const id of ['selected','default','empty']){
        const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#'+id));assert.deepEqual(ownership.problems,[]);
        const node=ownership.nodes[0],invocation=node.creationInvocation!;assert.equal(invocation.status,'observed',id);if(invocation.status!=='observed')throw Error('missing invocation');
        assert.equal(invocation.effectsVerified,false);assert.equal(invocation.acceptedContract,null);assert.equal(invocation.inputProvenance.status,'verified');
        if(invocation.inputProvenance.status==='verified'){
          assert.equal(invocation.inputProvenance.kind,id==='selected'?'forward-ref-copy':'create-element');assert.equal(invocation.inputProvenance.source.factory,'createElement');assert.equal(invocation.inputProvenance.source.referenceEntry?.qualification,'reference-entry-origin-only');
        }
        const lineage=node.creationLineage!;assert.equal(lineage.stop,'reference-entry-boundary');assert.equal(lineage.parents.length,1);assert.equal(lineage.parents[0].invocation,undefined);
        assert.equal(lineage.parents[0].site.module,'react-reference.tsx');assert.equal(lineage.parents[0].site.referenceEntry?.entrySha256,sha(f.entry));
        assert.deepEqual(await page.evaluate(reactOwnershipRead('#'+id)),ownership);
      }
      for(const id of ['proxy','accessor']){
        const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#'+id)),invocation=ownership.nodes[0].creationInvocation!;assert.equal(invocation.status,'refused');if(invocation.status==='refused')assert.equal(invocation.reason,'element-invocation-input-not-data');
      }
      assert.equal(await page.locator('#selected').textContent(),'FirstSecond');assert.equal(await page.locator('#default').textContent(),'Default');assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rows[0],rows[1]);assert(rows[1].metadata.ref);assert(rows[1].metadata.identity);
  // React's original for-in config copy can itself request the prototype.
  // The entire trace above must match, including those original operations.
  assert.equal(rows[1].metadata.trace.filter(x=>x==='accessor').length,1);
});
