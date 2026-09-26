import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {reactRuntimeAdapters,createReactHelperObserver} from './react-helper-transform.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import type {ReactReference} from './react-reference.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

test('ESM namespace JSX lookups resolve to exact lexical bindings and retain rendering, ref and event identity',async t=>{
  const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.jsx-helper-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.tsx'),helper=path.join(dir,'helper.mjs'),targetFile=path.join(dir,'targets.tsx'),barrelFile=path.join(dir,'barrel.ts'),configFile=path.join(dir,'tsconfig.json');
  const text=`import React from 'react';import {normalize,decorate,defs} from './helper.mjs';
import {Group as Library} from './barrel.ts';
export const Control=React.forwardRef((props,ref)=><Library.Root id={props.id} onClick={props.onClick} ref={ref}><b>{decorate(normalize(props.label),defs)}</b></Library.Root>);`;
  const targets=`import React from 'react';export let Root=React.forwardRef((props,ref)=><button {...props} ref={ref}/>);export const Other=React.forwardRef((props,ref)=><button {...props} ref={ref}/>);export function replaceTarget(){Root=Other;}const [extra]=[1];export {extra};`;
  const helpers=`function makeDefs(){return {prefix:'ok:'};}export const defs=makeDefs();
export function normalize(value){return '['+value+']';}
export function decorate(value,metadata){return metadata.prefix+value;}
export function replace(){normalize=value=>'['+value+']';}`;
  const config='{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}';
  const barrel="export * as Group from './targets.tsx';";writeFileSync(barrelFile,barrel);writeFileSync(file,text);writeFileSync(helper,helpers);writeFileSync(targetFile,targets);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(text),[helper]:sha(helpers),[targetFile]:sha(targets),[barrelFile]:sha(barrel),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=repo+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  // This bundler fixture uses only the source/edge portion of a reference.
  const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./helper.mjs',file:helper},{importer:file,specifier:'./barrel.ts',file:barrelFile},{importer:barrelFile,specifier:'./targets.tsx',file:targetFile}]} as unknown as ReactReference;
  const target=readReactRuntimeExport(reference,'targets.tsx',['Root']),other=readReactRuntimeExport(reference,'targets.tsx',['Other']);
  assert.equal(target.status,'resolved');assert.equal(other.status,'resolved');if(target.status!=='resolved'||other.status!=='resolved')return;
  const point=(definition:typeof target.definition)=>({file:definition.module,sha256:definition.sourceSha256,...definition.span});
  const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
  const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
  const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:name=>name.getText()==='Library.Root'?point(target.definition):undefined});
  assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
  assert.equal(model.calls.filter(c=>c.phase==='module-initialization').length,1);
  const calls=model.calls.filter(c=>c.site&&c.phase!=='module-initialization');assert.equal(calls.length,2);
  assert(helpers.slice(calls[0].source.start,calls[0].source.end).startsWith('export function normalize'));
  const browser=await chromium.launch();t.after(()=>browser.close());const pairs=[];
  for(const mode of ['original','guarded'] as const){
    const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {defs,replace} from './helper.mjs';import {replaceTarget} from './targets.tsx';import {Group as Library} from './barrel.ts';
window.clicks=0;const ref=React.createRef();window.testRef=ref;window.testDefs=defs;window.replaceTarget=replaceTarget;window.testNamespace=Library;
createRoot(document.getElementById('root')).render(React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref}));`;
    const runtimeModel=structuredClone(model);
    const observed=mode!=='original',plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition]},observer=createReactHelperObserver(reference,plan);
    const input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
    const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.ts')?'ts':'js'):undefined);}}]:[]});
    let javascript=bundle.outputFiles[0].text;
    if(observed){
      const prepared=prepareReactJsxLookupBundle(javascript,plan),proof=prepared.proof;
      assert.equal(proof.namespaces,1);assert.equal(proof.reads.length,1);assert.equal(proof.effectsVerified,false);assert.equal(proof.acceptedContract,null);
      // Reject executable getters/calls and same-spelled shadow bindings before
      // any candidate bundle executes. No evaluation is used for this proof.
      for(const [from,to,reason] of [
        ['Root: () => Root','Root: () => (window.getterRan++, Root)',/nonlexical-read/],
        ['() => targets_exports.Root','() => targets_exports.Other',/read-binding-differs/],
        ['() => targets_exports.Root','() => targets_exports["Root"]',/nonlexical-read/],
        ['() => targets_exports.Root','() => (() => targets_exports.Root)()',/nonlexical-read/],
        ['() => targets_exports.Root','() => { const Root = Other; return Root; }',/callback-unmodeled/],
        ['var targets_exports = {};','var targets_exports = new Proxy({}, {});',/namespace-origin-unproved/],
        ['.targetRead(','.missingRead(',/coverage-incomplete/],
      ] as const){assert(javascript.includes(from),from);assert.throws(()=>prepareReactJsxLookupBundle(javascript.replace(from,to),plan),reason);}
      const direct=prepareReactJsxLookupBundle(javascript.replace('() => targets_exports.Root','() => Root'),plan);assert.equal(direct.proof.namespaces,0);assert.equal(direct.proof.reads.length,1);
      javascript=prepared.javascript;
    }
    const page=await browser.newPage({viewport:{width:350,height:150}});try{
      await page.setContent('<div id="root"></div>');
      if(observed)await page.evaluate(reactHelperRuntimeHook([],[runtimeModel],true));
      await page.addScriptTag({content:javascript});
      await page.locator('#selected').waitFor();await page.locator('#selected').click();
      const dom=await page.locator('#selected').evaluate(n=>n.outerHTML),png=await page.screenshot(),state=await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected")})');pairs.push({dom,png,state});
      if(observed){
        const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));
        if(report.status==='observed'){assert.equal(report.helperCalls,0);assert.equal(report.components?.length,1);assert.equal(report.components![0].checkedCalls,2);assert.equal(report.components![0].targetReads,1);assert(report.bindings.registeredBindings>=3);assert.equal(report.bindings.checkedCalls,3);}
        assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);observer.complete();
        for(const attack of ['proxy','extra-field','prototype'] as const){
          const probe=await browser.newPage();try{
            await probe.setContent('<div id="root"></div>');await probe.evaluate(reactHelperRuntimeHook([],[model],true));await probe.addScriptTag({content:javascript});await probe.locator('#selected').waitFor();
            const outcome=await probe.evaluate(attack=>{
              const w=window as unknown as {testNamespace:object;__DSC_RUNTIME_PROOF:{namespaceRead(value:object,key:string):unknown}};
              let traps=0,value=w.testNamespace;
              if(attack==='proxy')value=new Proxy(value,{get(){traps++;throw Error('trap');},ownKeys(){traps++;throw Error('trap');},getPrototypeOf(){traps++;throw Error('trap');}});
              if(attack==='extra-field')Object.defineProperty(value,'unexpected',{value:1});
              if(attack==='prototype')Object.setPrototypeOf(value,{});
              let reason='';try{w.__DSC_RUNTIME_PROOF.namespaceRead(value,'Root');}catch(error){reason=(error as Error).message;}
              return {traps,reason};
            },attack);
            assert.equal(outcome.traps,0);assert.match(outcome.reason,attack==='proxy'?/namespace-origin-unproved/:attack==='prototype'?/namespace-prototype-changed/:/namespace-mutated/);
            assert.equal((await probe.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead)).status,'refused');
          }finally{await probe.close();}
        }
        await page.evaluate('window.replaceTarget()');
        const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.match(changed.reason,/jsx-target-binding-changed/);
      }
    }finally{await page.close();}
  }
  assert.deepEqual(pairs[0],pairs[1]);assert.deepEqual(pairs[0].state,{clicks:1,ref:true});
});
