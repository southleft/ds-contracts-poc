import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build,transformSync,version} from 'esbuild';
import {chromium} from 'playwright-core';
import {createReactElementCreationObserver,readReactElementCreationSites} from './react-element-creation.js';
import {readReactCompiledContent} from './react-compiled-content.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');

function fixture(t:test.TestContext,source:string,config='{"compilerOptions":{"target":"ES2022","jsx":"react-jsx"}}'){
  const root=process.cwd(),sourceRoot=mkdtempSync(path.join(root,'source-reference/.jsx-origin-test-'));
  t.after(()=>rmSync(sourceRoot,{recursive:true,force:true}));
  const file=path.join(sourceRoot,'fixture.tsx'),configFile=path.join(sourceRoot,'tsconfig.json');
  writeFileSync(file,source);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(source),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot,files,runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]};
  return {file,configFile,reference,config};
}

test('generated factory spans retain reproducible code and refuse original-source content authority',t=>{
  const source="import React from 'react';export const C=(props:{label:string})=><button>{props.label}</button>;";
  const {reference,file,config}=fixture(t,source),observer=createReactElementCreationObserver(reference);
  assert.equal(observer.sites.length,1);assert.equal(observer.plans.length,1);
  const site=observer.sites[0],receipt=observer.transformedSources[0];
  assert.equal(site.sourceSha256,sha(source));assert.notEqual(site.sourceSha256,site.transformed?.generatedSha256);
  assert.equal(site.transformed?.version,version);assert.equal(site.transformed?.tsconfigSha256,sha(config));
  assert.equal(site.transformed?.spanSpace,'generated-javascript');
  assert(receipt.instrumentedSource);assert.equal(sha(receipt.instrumentedSource),site.transformed?.instrumentedSourceSha256);
  assert.equal(receipt.code,transformSync(receipt.instrumentedSource,{loader:'tsx',jsx:'automatic',target:'esnext',tsconfigRaw:config,sourcefile:file}).code);
  assert.equal(observer.plans[0].observation,'original-function-invocation-only');assert.deepEqual(observer.plans[0].bindingReads,[]);
  assert.equal(source.slice(site.originalFunction!.span.start,site.originalFunction!.span.end),'(props:{label:string})=><button>{props.label}</button>');
  assert.deepEqual(site.originalFunction?.span,observer.plans[0].span);
  assert.equal(sha(receipt.code),site.transformed?.generatedSha256);
  assert.match(receipt.code.slice(site.span.start,site.span.end),/jsx\("button"/);
  const content=readReactCompiledContent(reference,site);assert.equal(content.status,'refused');
  if(content.status==='refused')assert.equal(content.reason,'compiled-content-transformed-source-unmodeled');
  // A forged generated-space marker must refuse even on a valid original JS
  // call. Omitting it from a TSX site cannot make that TSX an original JS file.
  const compiledFile=path.join(reference.sourceRoot,'compiled.mjs'),compiled="import {jsx} from 'react/jsx-runtime';export const C=props=>jsx('button',{children:props.children});";
  writeFileSync(compiledFile,compiled);reference.files[compiledFile]=sha(compiled);
  const originalSite=readReactElementCreationSites(compiled,compiledFile,'compiled.mjs')[0];
  assert.equal(readReactCompiledContent(reference,originalSite).status,'read');
  const forged=readReactCompiledContent(reference,{...originalSite,transformed:site.transformed});
  assert.equal(forged.status,'refused');if(forged.status==='refused')assert.equal(forged.reason,'compiled-content-transformed-source-unmodeled');
  const {transformed:_,...omitted}=site;assert.equal(readReactCompiledContent(reference,omitted).status,'refused');
});

test('unrecorded, inherited, changed config and changed loaders refuse before execution',async t=>{
  const source='export const C=()=> <button/>;';
  const f=fixture(t,source),observer=createReactElementCreationObserver(f.reference);
  await assert.rejects(observer.transform(source,f.file,'js'),/loader-changed/);
  await assert.rejects(observer.transform(source+' ',f.file,'tsx'),/source-changed/);
  writeFileSync(f.configFile,'{}');await assert.rejects(observer.transform(source,f.file,'tsx'),/tsconfig-changed/);
  assert.throws(()=>createReactElementCreationObserver(f.reference),/tsconfig-changed/);
  const unrecorded=fixture(t,source);delete unrecorded.reference.files[unrecorded.configFile];
  assert.throws(()=>createReactElementCreationObserver(unrecorded.reference),/tsconfig-unrecorded/);
  const inherited=fixture(t,source,'{"extends":"./not-captured.json"}');
  const skipped=createReactElementCreationObserver(inherited.reference);
  assert.equal(skipped.sites.length,0);assert.equal(skipped.plans.length,0);
  assert.deepEqual(skipped.transformRefusals,[{file:inherited.file,sourceSha256:sha(source),reason:'element-creation-tsconfig-inheritance-unmodeled'}]);
  assert.deepEqual(await skipped.transform(source,inherited.file,'tsx'),{contents:source,loader:'tsx'});
});

test('a shipped TSX factory supplies exact compiled-child React props without changing render or evaluation order',async t=>{
  const source=`import * as React from 'react';import {createRoot} from 'react-dom/client';import {Leaf} from './leaf.mjs';
const trace:string[]=[];const value=(n:string,v:any)=>(trace.push(n),v);
const ref=React.createRef<HTMLButtonElement>();
const props={get ['data-first'](){trace.push('spread');return 'a';}};
function App(){return <section><Leaf {...props} id={value('id','selected')} ref={ref} data-last={value('last','b')}>{value('text','Original')}</Leaf>
<Leaf {...{id:'fallback'}} key={value('key','k')}>Fallback</Leaf></section>;}
window.fixtureTrace=trace;window.fixtureFunctions={name:App.name,length:App.length};window.fixtureRef=ref;
createRoot(document.getElementById('root')!).render(<App/>);`;
  const {reference,file,configFile}=fixture(t,source),leaf=path.join(reference.sourceRoot,'leaf.mjs');
  const leafSource="import React from 'react';import {jsx} from 'react/jsx-runtime';export const Leaf=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));";
  writeFileSync(leaf,leafSource);reference.files[leaf]=sha(leafSource);reference.runtimeImports.push({importer:leaf,specifier:'react/jsx-runtime',file:reference.runtimeImports[0].file});
  const observer=createReactElementCreationObserver(reference),browser=await chromium.launch();t.after(()=>browser.close());
  const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in reference.files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path===file?'tsx':'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:300,height:150}});try{
      await page.setContent('<div id="root"></div>');
      if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#selected').waitFor();await page.locator('#fallback').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot();
      const metadata=await page.evaluate('({trace:window.fixtureTrace,functions:window.fixtureFunctions,ref:window.fixtureRef.current===document.getElementById("selected")})');
      rows.push({dom,png,metadata});if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected'));assert.deepEqual(ownership.problems,[]);
      const invocation=ownership.nodes[0].creationInvocation!;assert.equal(invocation.status,'observed');if(invocation.status!=='observed')throw Error('missing invocation');
      assert.equal(invocation.inputProvenance.status,'verified');assert.equal(invocation.outputProvenance.status,'verified');
      assert.equal(invocation.effectsVerified,false);assert.equal(invocation.acceptedContract,null);
      const lineage=ownership.nodes[0].creationLineage!;assert.equal(lineage.parents.length,1);assert.equal(lineage.stop,'caller-invocation-unavailable');
      assert.equal(lineage.parents[0].site.module,'fixture.tsx');assert.equal(lineage.parents[0].site.sourceSha256,sha(source));
      assert.equal(lineage.parents[0].site.transformed?.spanSpace,'generated-javascript');assert.equal(lineage.parents[0].invocation,undefined);
      const fallback=await page.evaluate<ReactOwnership>(reactOwnershipRead('#fallback')),unknown=fallback.nodes[0].creationInvocation!;
      assert.equal(unknown.status,'refused');if(unknown.status==='refused')assert.equal(unknown.reason,'element-invocation-input-not-data');
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.equal(rows[0].dom,rows[1].dom);assert.deepEqual(rows[0].png,rows[1].png);assert.deepEqual(rows[0].metadata,rows[1].metadata);
  assert.deepEqual(rows[0].metadata,{trace:['spread','id','last','text','key'],functions:{name:'App',length:0},ref:true});
});
