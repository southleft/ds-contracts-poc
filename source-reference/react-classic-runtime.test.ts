import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {createReactElementCreationObserver} from './react-element-creation.js';
import {createReactHelperObserver,reactRuntimeAdapters,selectReactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {readReactAuthoredClasses} from './react-authored-classes.js';
import type {ReactReference} from './react-reference.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const point={file:'not-a-source.mjs',sha256:'0'.repeat(64),start:0,end:1};
const helperPlan={models:[],call:point,helper:point,metadata:[]};
function runtimeFiles(index:number,jsx:boolean){return Object.fromEntries(reactRuntimeAdapters.filter(a=>jsx||a.kind!=='jsx').map(a=>['/fixture'+a.suffix,a.hashes[index]]));}

test('classic runtime admission retains coherent version, cardinality and hash requirements',()=>{
  for(const version of [0,1])for(const jsx of [false,true]){
    const result=selectReactRuntimeAdapters({files:runtimeFiles(version,jsx)});
    assert.equal(result?.version,version);assert.deepEqual(result?.adapters.map(a=>a.kind),jsx?['create-element','jsx','forward-ref']:['create-element','forward-ref']);
  }
  const base=runtimeFiles(1,false),core=reactRuntimeAdapters[0],jsx=reactRuntimeAdapters[1],renderer=reactRuntimeAdapters[2];
  const variants:Record<string,Record<string,string>>={
    missingCore:Object.fromEntries(Object.entries(base).filter(([f])=>!f.endsWith(core.suffix))),
    missingRenderer:Object.fromEntries(Object.entries(base).filter(([f])=>!f.endsWith(renderer.suffix))),
    unknownCore:{...base,['/fixture'+core.suffix]:'0'.repeat(64)},
    unknownRenderer:{...base,['/fixture'+renderer.suffix]:'0'.repeat(64)},
    mixed:{...base,['/fixture'+renderer.suffix]:renderer.hashes[0]},
    duplicateCore:{...base,['/another'+core.suffix]:core.hashes[1]},
    duplicateRenderer:{...base,['/another'+renderer.suffix]:renderer.hashes[1]},
    unknownPresentJsx:{...base,['/fixture'+jsx.suffix]:'0'.repeat(64)},
    duplicatePresentJsx:{...base,['/fixture'+jsx.suffix]:jsx.hashes[1],['/another'+jsx.suffix]:jsx.hashes[1]},
  };
  for(const [name,files]of Object.entries(variants)){
    assert.equal(selectReactRuntimeAdapters({files}),undefined,name);
    assert.throws(()=>createReactHelperObserver({files} as ReactReference,helperPlan),/helper-react-runtime-unsupported/,name);
  }
  assert.equal(selectReactRuntimeAdapters({files:base,runtimeImports:[{importer:'/fixture/source.js',specifier:'react/jsx-runtime',file:'/missing.js'}]}),undefined);
});

function fixture(t:test.TestContext,source=`import React from 'react';
export const Control=React.forwardRef((props,ref)=>React.createElement('button',{...props,ref},props.children));`,filename='control.mjs'){
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.classic-runtime-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,filename),config=path.join(dir,'tsconfig.json');writeFileSync(file,source);writeFileSync(config,'{"compilerOptions":{"target":"ES2022","jsx":"react-jsx"}}');
  const files:Record<string,string>={[file]:sha(source),[config]:sha(readFileSync(config,'utf8'))};
  for(const a of reactRuntimeAdapters.filter(a=>a.kind!=='jsx')){const f=root+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './${filename}';
window.ref=React.createRef();window.count=0;window.callback=()=>window.count++;
createRoot(document.getElementById('root')).render(React.createElement(Control,{id:'selected',ref:window.ref,key:'original',onClick:window.callback},'First','Second'));`;
  const reference={id:sha(entry),sourceRoot:dir,files,cohort:{entry},runtimeImports:[{importer:file,specifier:'react',file:root+'/node_modules/react/index.js'}]};
  return {root,dir,file,source,config,entry,reference};
}

test('classic observers complete without a JSX adapter, but still require every active registration',async t=>{
  const f=fixture(t),observer=createReactElementCreationObserver(f.reference,f.entry);
  assert(observer.sites.length>0);assert(observer.sites.every(site=>site.factory==='createElement'));
  await observer.transform(f.source,f.file,'js');await observer.transform(f.entry,'react-reference.tsx','tsx');
  assert.throws(()=>observer.complete(),/transform-incomplete/);
  const core=f.root+reactRuntimeAdapters[0].suffix,renderer=f.root+reactRuntimeAdapters[2].suffix;
  await observer.transform(readFileSync(core,'utf8'),core,'js');assert.throws(()=>observer.complete(),/transform-incomplete/);
  await observer.transform(readFileSync(renderer,'utf8'),renderer,'js');observer.complete();
  const helper=createReactHelperObserver(f.reference as unknown as ReactReference,helperPlan);
  assert.throws(()=>helper.complete(),/registration-missing/);
  await helper.transform(readFileSync(core,'utf8'),core,'js');assert.throws(()=>helper.complete(),/registration-missing/);
  await helper.transform(readFileSync(renderer,'utf8'),renderer,'js');helper.complete();
});

test('missing JSX runtime rejects actual source factories and automatic JSX in the entry',async t=>{
  for(const source of [
    `import {jsx as h} from 'react/jsx-runtime';export const Control=()=>h('button',{});`,
    `import * as J from 'react/jsx-runtime';export const Control=()=>J.jsxs('button',{children:[]});`,
  ]){
    const f=fixture(t,source);
    // Even an incomplete edge list cannot turn an actual JSX factory into classic source.
    assert.throws(()=>createReactElementCreationObserver(f.reference),/react-runtime-unsupported/);
    const helper=createReactHelperObserver(f.reference as unknown as ReactReference,helperPlan);
    await assert.rejects(helper.transform(source,f.file,'js'),/helper-react-runtime-unsupported/);
  }
  const f=fixture(t),jsxEntry=f.entry.replace("React.createElement(Control,{id:'selected',ref:window.ref,key:'original',onClick:window.callback},'First','Second')",'<Control>Original</Control>');
  assert.throws(()=>createReactElementCreationObserver({...f.reference,id:sha(jsxEntry),cohort:{entry:jsxEntry}},jsxEntry),/react-runtime-unsupported/);
  const helper=createReactHelperObserver(f.reference as unknown as ReactReference,helperPlan);
  await assert.rejects(helper.transform(jsxEntry,'react-reference.tsx','tsx'),/helper-react-runtime-unsupported/);
});

test('classic original and observed source preserve DOM, pixels, refs, callbacks and child order',async t=>{
  const f=fixture(t),observer=createReactElementCreationObserver(f.reference,f.entry),browser=await chromium.launch();t.after(()=>browser.close());const results=[];
  for(const observed of [false,true]){
    const input=observed?await observer.transform(f.entry,'react-reference.tsx','tsx'):{contents:f.entry,loader:'tsx' as const};
    const output=await build({stdin:{...input,resolveDir:f.dir,sourcefile:'react-reference.tsx'},tsconfig:f.config,bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'classic-observer',setup(b){b.onLoad({filter:/./},args=>args.path in f.reference.files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    assert(!output.metafile);assert(!output.outputFiles[0].text.includes('react-jsx-runtime.development.js'));
    const page=await browser.newPage({viewport:{width:360,height:120}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:output.outputFiles[0].text});await page.locator('#selected').waitFor();await page.locator('#selected').click();
      const row={dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),facts:await page.evaluate('({text:document.getElementById("selected").textContent,ref:window.ref.current===document.getElementById("selected"),clicks:window.count})')};results.push(row);
      if(observed){const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected'));assert.deepEqual(ownership.problems,[]);assert.equal(ownership.nodes[0].creationSite?.factory,'createElement');assert.equal(ownership.nodes[0].creationInvocation?.status,'observed');}
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1].facts,{text:'FirstSecond',ref:true,clicks:1});
});

test('classic helper runtime observes real factories without requiring automatic JSX',async t=>{
  const f=fixture(t,`import React from 'react';
export class Control extends React.Component {
  render(){return React.createElement('button',{id:this.props.id,ref:this.props.buttonRef,onClick:this.props.onClick},this.props.children);}
}`);
  const entry=f.entry.replace('ref:window.ref,key:', 'buttonRef:window.ref,key:');
  const classes=readReactAuthoredClasses(f.reference,[{module:'control.mjs',exportName:'Control'}]);
  assert.equal(classes.length,1);assert.equal(classes[0].qualification,'original-class-render-boundary-only');
  const plan={kind:'jsx-component' as const,boundaryOnly:true as const,models:[],targets:[],authoredClasses:classes};
  const hook=reactHelperRuntimeHook([],[],true,[],[],[],[],[],[],[],[],[],undefined,undefined,undefined,[],[],undefined,undefined,[],true,[],classes);
  const browser=await chromium.launch();t.after(()=>browser.close());const results=[];
  for(const observed of [false,true]){
    const observer=createReactHelperObserver(f.reference as unknown as ReactReference,plan);
    const input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
    const output=await build({stdin:{...input,resolveDir:f.dir,sourcefile:'react-reference.tsx'},tsconfig:f.config,bundle:true,write:false,metafile:true,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'classic-helper-observer',setup(b){b.onLoad({filter:/./},args=>args.path in f.reference.files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    assert(!Object.keys(output.metafile!.inputs).some(file=>/react[\\/]jsx|react-jsx-runtime/.test(file)));
    const page=await browser.newPage({viewport:{width:360,height:120}});try{
      page.setDefaultTimeout(5000);
      await page.setContent('<div id="root"></div>');if(observed)await page.evaluate(hook);
      await page.addScriptTag({content:output.outputFiles[0].text});await page.locator('#selected').waitFor();await page.locator('#selected').click();
      results.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),facts:await page.evaluate('({text:document.getElementById("selected").textContent,ref:window.ref.current===document.getElementById("selected"),clicks:window.count})')});
      if(observed){observer.complete();const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));if(report.status==='observed'){assert(report.elementCalls>0);assert.equal(report.jsxCalls,0);assert.equal(report.authoredClasses?.registered,1);assert.equal(report.authoredClasses?.calls.length,1);assert.equal(report.authoredClasses?.effectsVerified,false);}}
    }finally{await page.close();}
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1].facts,{text:'FirstSecond',ref:true,clicks:1});
});


test('erased JSX type imports do not require a runtime factory',async t=>{
  for(const typeDeclarations of [
    `import type { JSX } from 'react/jsx-runtime';export type { JSX } from 'react/jsx-runtime';`,
    `import { type JSX } from 'react/jsx-runtime';export { type JSX } from 'react/jsx-runtime';`,
    `import type * as JSX from 'react/jsx-runtime';export type * from 'react/jsx-runtime';`,
  ]){
    const source=`import React from 'react';${typeDeclarations}export const Control=()=>React.createElement('button',null,'Original');`;
    const f=fixture(t,source,'control.ts'),helper=createReactHelperObserver(f.reference as unknown as ReactReference,helperPlan);
    const result=await helper.transform(source,f.file,'ts');assert(!result.contents.includes('jsx-runtime'));
    const elements=createReactElementCreationObserver(f.reference);assert(elements.sites.length>0);assert(elements.sites.every(site=>site.factory==='createElement'));
  }
});

test('actual JSX runtime imports still refuse classic-only adapter sets after compilation',async t=>{
  for(const [source,filename,loader] of [
    [`import J = require('react/jsx-runtime');export const Control=()=>J.jsx('button',{});`,'control.ts','ts'],
    [`const J=require('react/jsx-runtime');export const Control=()=>J.jsx('button',{});`,'control.mjs','js'],
    [`export const load=()=>import('react/jsx-runtime');`,'control.mjs','js'],
    [`export * as J from 'react/jsx-runtime';`,'control.mjs','js'],
  ] as const){
    const f=fixture(t,source,filename),helper=createReactHelperObserver(f.reference as unknown as ReactReference,helperPlan);
    await assert.rejects(helper.transform(source,f.file,loader),/helper-react-runtime-unsupported/);
  }
});

test('JSX-only source links retain their prior limited mode without admitting bad runtime tuples',async t=>{
  const source=`import {jsx} from 'react/jsx-runtime';export const Control=()=>jsx('button',{children:'Original'});`;
  const f=fixture(t,source),jsx=reactRuntimeAdapters[1],jsxFile=f.root+jsx.suffix;
  const files={[f.file]:sha(source),[jsxFile]:sha(readFileSync(jsxFile,'utf8'))};
  const reference={...f.reference,files,runtimeImports:[{importer:f.file,specifier:'react/jsx-runtime',file:jsxFile}]};
  const observer=createReactElementCreationObserver(reference);assert(observer.sites.length>0);
  await observer.transform(source,f.file,'js');await observer.transform(readFileSync(jsxFile,'utf8'),jsxFile,'js');observer.complete();
  assert.throws(()=>createReactElementCreationObserver(reference,f.entry),/reference-entry-react-runtime-unsupported/);
  const core=reactRuntimeAdapters[0],renderer=reactRuntimeAdapters[2];
  for(const extra of [
    {[f.root+core.suffix]:'0'.repeat(64)},
    {[f.root+core.suffix]:core.hashes[1]},
    {[f.root+core.suffix]:core.hashes[1],[f.root+renderer.suffix]:renderer.hashes[0]},
    {...runtimeFiles(1,false),['/another'+core.suffix]:core.hashes[1]},
  ])assert.throws(()=>createReactElementCreationObserver({...reference,files:{...files,...extra}}),/react-runtime-unsupported/);
});
