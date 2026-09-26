import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {build,transformSync} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactOriginalJsxSites,bindReactOriginalJsxSites,readReactJsxInvocationPlans} from './react-jsx-invocation.js';
import {transformReactElementSource} from './react-element-invocation.js';
import {createReactElementCreationObserver,readReactElementCreationSites} from './react-element-creation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

test('entry and early returns refuse a shadowed observer global even without a free expression read',()=>{
  for(const text of [
    `function C(globalThis){return <span {...globalThis} key="after"/>}`,
    `const globalThis={};const C=(props:any)=><button/>;`,
    `const C=(props:any)=>{if(props.skip){const globalThis={};return null;}return <button/>};`,
  ]){
    const sf=ts.createSourceFile('fixture.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    assert.throws(()=>readReactJsxInvocationPlans(sf,'fixture.tsx',sha(text)),/element-closure-reserved-binding/);
  }
});

test('every original JSX expression retains its exact span across lowering; markers are checked and removed before execution',()=>{
  const text=`const before='💡';\r\nconst C=(props:{label:string})=><><UI.Box header=<i/>><b>{props.label}</b>{props.ok?<em/>:<span/>}</UI.Box></>;`;
  const sf=ts.createSourceFile('fixture.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),original=readReactOriginalJsxSites(sf);
  assert.equal(original.length,6);assert.equal(original[0].kind,'fragment');assert.equal(original[0].tagSpan,undefined);
  assert.deepEqual(original.slice(1).map(s=>text.slice(s.tagSpan!.start,s.tagSpan!.end)),['UI.Box','i','b','em','span']);
  const marked=transformReactElementSource(sf,[],[],undefined,{sites:original}),code=transformSync(marked,{loader:'tsx',jsx:'automatic',target:'esnext'}).code;
  const parse=(value:string)=>ts.createSourceFile('fixture.js',value,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),generated=parse(code);
  const linked=bindReactOriginalJsxSites(generated,original),factories=readReactElementCreationSites(code,'fixture.js','fixture.tsx');
  assert.equal(linked.markers.length,6);assert.equal(factories.length,6);
  for(const factory of factories){const source=linked.bindings.get(JSON.stringify(factory.span));assert(source);assert.equal(source.qualification,'original-jsx-factory-only');assert(text.slice(source.span.start,source.span.end).startsWith('<'));}
  const executable=transformReactElementSource(generated,factories.map((s,index)=>({...s,index})),[],undefined,{markers:linked.markers});
  assert(!executable.includes('.originalJsx('));assert.equal((executable.match(/__DSC_ELEMENT_CREATION.call\(/g)??[]).length,6);
  assert.throws(()=>bindReactOriginalJsxSites(parse(code.replace('.originalJsx(0,','.originalJsx(99,')),original),/marker-unmatched/);
  assert.throws(()=>bindReactOriginalJsxSites(parse(code.replace('.originalJsx(0,','.missing(0,')),original),/marker-missing/);
  assert.throws(()=>bindReactOriginalJsxSites(parse(code+'\nglobalThis.__DSC_ELEMENT_CREATION.originalJsx(0,other());'),original),/marker-unmatched/);
  assert.throws(()=>bindReactOriginalJsxSites(parse('globalThis.__DSC_ELEMENT_CREATION.originalJsx(0,123);'),[original[0]]),/factory-unmodeled/);
  assert.throws(()=>bindReactOriginalJsxSites(parse('globalThis.__DSC_ELEMENT_CREATION.originalJsx(0,other(),extra);'),[original[0]]),/marker-unmodeled/);
});

test('original JSX links preserve nested/attribute JSX, fragments, target getters, refs, key fallback, identity and events',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.jsx-sites-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.tsx'),configFile=path.join(dir,'tsconfig.json');
  const source=`import React from 'react';import {createRoot} from 'react-dom/client';
const trace:string[]=[],ref=React.createRef<HTMLButtonElement>();const read=(key:string,value:any)=>(trace.push(key),value);
const spread={get ['data-spread'](){trace.push('spread');return 'yes';}};
const Leaf=React.forwardRef<HTMLButtonElement,any>((props,ref)=><button {...props} ref={ref}/>);
const UI={get Leaf(){trace.push('target');return Leaf;}};
const clicked=()=>trace.push('clicked');
const Root=(props:any)=>{const element=<UI.Leaf {...spread} id={read('id','selected')} ref={ref} onClick={clicked}><b>{read('text','Original')}</b></UI.Leaf>;window.originalElement=element;return element;};
const WithIcon=(props:any)=><div id="icon">{props.icon}</div>;
function App(){return <><Root/><WithIcon icon=<i>Icon</i>/><span {...{id:'fallback'}} key={read('key','k')}>Fallback</span><div>Kept &amp;
  preserved {' '} whitespace 💡</div></>}
window.fixtureTrace=trace;window.fixtureRef=ref;window.fixtureType=Leaf;window.fixtureCallback=clicked;
createRoot(document.getElementById('root')!).render(<App/>);`;
  const config='{"compilerOptions":{"target":"ES2022","jsx":"react-jsx"}}';writeFileSync(file,source);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(source),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]};
  const observer=createReactElementCreationObserver(reference),receipt=observer.transformedSources[0];
  assert(receipt.originalJsx?.some(s=>s.source.kind==='fragment'&&s.factoryObserved));
  const fallback=receipt.originalJsx!.find(s=>source.slice(s.source.span.start,s.source.span.end).startsWith('<span {...'))!;
  assert(fallback);assert.equal(fallback.factoryObserved,false); // createElement fallback is not an authenticated JSX factory.
  const browser=await chromium.launch();t.after(()=>browser.close());const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path===file?'tsx':'js'):undefined);}}]:[]});
    assert(!built.outputFiles[0].text.includes('.originalJsx('));
    const page=await browser.newPage({viewport:{width:500,height:180}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#selected').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot();await page.locator('#selected').click();
      const metadata=await page.evaluate<{trace:string[];ref:boolean;type:boolean;callback:boolean}>('({trace:window.fixtureTrace,ref:window.fixtureRef.current===document.getElementById("selected"),type:window.originalElement.type===window.fixtureType,callback:window.originalElement.props.onClick===window.fixtureCallback})');rows.push({dom,png,metadata});if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected')),host=ownership.nodes[0],parent=host.creationLineage!.parents[0];
      for(const site of [host.creationSite!,parent.site]){
        assert(site.originalJsx);assert.equal(site.originalJsx.qualification,'original-jsx-factory-only');assert.equal(site.sourceSha256,sha(source));assert.equal(site.transformed?.spanSpace,'generated-javascript');
        assert(receipt.originalJsx!.some(s=>s.factoryObserved&&JSON.stringify(s.source)===JSON.stringify(site.originalJsx)&&JSON.stringify(s.marker.factorySpan)===JSON.stringify(site.span)));
      }
      assert.equal(source.slice(host.creationSite!.originalJsx!.tagSpan!.start,host.creationSite!.originalJsx!.tagSpan!.end),'button');
      assert.equal(source.slice(parent.site.originalJsx!.tagSpan!.start,parent.site.originalJsx!.tagSpan!.end),'UI.Leaf');
      assert.equal(parent.invocation?.status,'observed');assert.equal(parent.invocation?.effectsVerified,false);assert.equal(parent.invocation?.acceptedContract,null);
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);
      const unsupported=await page.evaluate<ReactOwnership>(reactOwnershipRead('#fallback'));assert.equal(unsupported.nodes[0].creationSite,undefined);
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rows[0],rows[1]);assert(rows[1].metadata.ref&&rows[1].metadata.type&&rows[1].metadata.callback);
  assert.deepEqual(rows[1].metadata.trace,['key','target','spread','id','text','clicked']);
});
