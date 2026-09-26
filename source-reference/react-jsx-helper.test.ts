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
import type {ReactReference} from './react-reference.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

test('whole JSX guarded calls follow argument order, exclude module initialization, preserve callbacks/refs and reject changed metadata or helper identity',async t=>{
  const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.jsx-helper-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.tsx'),helper=path.join(dir,'helper.mjs'),targetFile=path.join(dir,'targets.tsx'),configFile=path.join(dir,'tsconfig.json');
  const text=`import React from 'react';import {normalize,decorate,defs} from './helper.mjs';
import {Root} from './targets.tsx';
export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}><b>{decorate(normalize(props.label),defs)}</b></Root>);`;
  const targets=`import React from 'react';export const Root=React.forwardRef((props,ref)=><button {...props} ref={ref}/>);export const Other=React.forwardRef((props,ref)=><button {...props} ref={ref}/>);`;
  const helpers=`function makeDefs(){return {prefix:'ok:'};}export const defs=makeDefs();
export function normalize(value){return '['+value+']';}
export function decorate(value,metadata){return metadata.prefix+value;}
export function replace(){normalize=value=>'['+value+']';}`;
  const config='{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}';
  writeFileSync(file,text);writeFileSync(helper,helpers);writeFileSync(targetFile,targets);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(text),[helper]:sha(helpers),[targetFile]:sha(targets),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=repo+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  // This bundler fixture uses only the source/edge portion of a reference.
  const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./helper.mjs',file:helper},{importer:file,specifier:'./targets.tsx',file:targetFile}]} as unknown as ReactReference;
  const target=readReactRuntimeExport(reference,'targets.tsx',['Root']),other=readReactRuntimeExport(reference,'targets.tsx',['Other']);
  assert.equal(target.status,'resolved');assert.equal(other.status,'resolved');if(target.status!=='resolved'||other.status!=='resolved')return;
  const point=(definition:typeof target.definition)=>({file:definition.module,sha256:definition.sourceSha256,...definition.span});
  const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
  const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
  const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:name=>name.getText()==='Root'?point(target.definition):undefined});
  assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
  assert.equal(model.calls.filter(c=>c.phase==='module-initialization').length,1);
  const calls=model.calls.filter(c=>c.site&&c.phase!=='module-initialization');assert.equal(calls.length,2);
  assert(helpers.slice(calls[0].source.start,calls[0].source.end).startsWith('export function normalize'));
  const browser=await chromium.launch();t.after(()=>browser.close());const pairs=[];
  for(const mode of ['original','guarded','reordered-trace','metadata-changed','helper-replaced','wrong-target'] as const){
    const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {defs,replace} from './helper.mjs';
window.clicks=0;const ref=React.createRef();window.testRef=ref;window.testDefs=defs;
${mode==='metadata-changed'?"defs.prefix='wrong:';":mode==='helper-replaced'?'replace();':''}
createRoot(document.getElementById('root')).render(React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref}));`;
    const runtimeModel=structuredClone(model);
    if(mode==='reordered-trace')runtimeModel.calls=[...runtimeModel.calls].reverse();
    if(mode==='wrong-target'){
      runtimeModel.output.tag={kind:'source-binding',source:point(other.definition)};
      runtimeModel.jsxTargets[0].binding=point(other.definition);
    }
    const observed=mode!=='original',observer=createReactHelperObserver(reference,{kind:'jsx-component',models:[model],component:model.component,targets:[mode==='wrong-target'?other.definition:target.definition]});
    const input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
    const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:350,height:150}});try{
      await page.setContent('<div id="root"></div>');
      if(observed)await page.evaluate(reactHelperRuntimeHook([],[runtimeModel],true));
      const failure=mode!=='original'&&mode!=='guarded'?page.waitForEvent('pageerror',{timeout:5000}):undefined;
      await page.addScriptTag({content:bundle.outputFiles[0].text});
      if(failure){await failure;const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'refused');if(report.status==='refused')assert.match(report.reason,mode==='reordered-trace'?/call-trace-changed/:mode==='metadata-changed'?/value-changed/:mode==='wrong-target'?/jsx-target-read-value-changed/:/function-unregistered-or-changed/);continue;}
      await page.locator('#selected').waitFor();await page.locator('#selected').click();
      const dom=await page.locator('#selected').evaluate(n=>n.outerHTML),png=await page.screenshot(),state=await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected")})');pairs.push({dom,png,state});
      if(observed){
        const report=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(report.status,'observed',JSON.stringify(report));
        if(report.status==='observed'){assert.equal(report.helperCalls,0);assert.equal(report.components?.length,1);assert.equal(report.components![0].checkedCalls,2);assert(report.bindings.registeredBindings>=3);assert.equal(report.bindings.checkedCalls,3);}
        assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),report);observer.complete();
        await page.evaluate("window.testDefs.prefix='changed-after-render:'");
        const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.match(changed.reason,/value-changed/);
      }
    }finally{await page.close();}
  }
  assert.deepEqual(pairs[0],pairs[1]);assert.deepEqual(pairs[0].state,{clicks:1,ref:true});
});
