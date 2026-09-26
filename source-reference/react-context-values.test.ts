import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextCalls,planReactContextRests} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('native rest context values keep memoized identity, source getters, opaque fields, updates, clicks and refs; changed fields refuse',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-values-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} label={props.label} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import React from 'react';import {jsx} from 'react/jsx-runtime';
 export const Context=React.createContext(window.opaque),Hidden=React.createContext(window.opaque);
 export function Provider(props){
  const input={...props};Object.defineProperty(input,'label',{enumerable:true,get(){window.inputReads++;return props.label;}});
  const {children,ignored,...value}=input;
  const stable=React.useMemo(()=>value,[value.label,value.opaque]);window.retained=stable;
  if(window.mode==='accessor')Object.defineProperty(stable,'label',{get(){window.proxyReads++;return 'wrong';},configurable:true});
  return jsx(Context.Provider,{value:stable,children});
 }
 function Sink(props){window.received=props.payload;return jsx('button',{id:props.id,onClick:props.onClick,ref:props.ref,children:props.children});}
 export const Root=React.forwardRef(function Reader(props,ref){
  const value=React.useContext(Context);React.useContext(Hidden);
  return jsx(Sink,{id:props.id,onClick:props.onClick,ref,payload:window.mode.endsWith('copied-payload')?{}:value.opaque,children:props.label+':'+value.label});
 });`;
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[config,'{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}']]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['label','Original'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const calls=planReactContextCalls(reference),rests=planReactContextRests(reference,calls);
 assert.equal(rests.length,1);assert.deepEqual(rests[0].excluded,['children','ignored']);
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextCalls:calls,contextRests:rests};
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextRests:[]}),/context-rest-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';import {Provider} from './targets.mjs';
 window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));
 window.render=(label,ignored)=>root.render(React.createElement(Provider,{label,ignored,opaque:window.opaque},React.createElement(Control,{id:'selected',label:'Original',onClick:()=>window.clicks++,ref:window.testRef})));window.render('first',0);`;
 const browser=await chromium.launch();t.after(()=>browser.close());const pairs:Record<string,unknown>={},accessors:Record<string,unknown>={};
 for(const mode of ['original','guarded','original-accessor','accessor','late-mutation','original-copied-payload','copied-payload']){
  t.diagnostic(mode);const observed=!mode.startsWith('original'),observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const javascript=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan).javascript:bundle.outputFiles[0].text;
  const page=await browser.newPage({viewport:{width:600,height:150}});try{
   await page.setContent('<div id="root"></div>');await page.evaluate(mode=>Object.assign(window,{mode,inputReads:0,proxyReads:0,opaque:new Proxy({}, {get(){throw Error('opaque reflected');}})}),mode==='original-accessor'?'accessor':mode);
   if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,plan.initializers,[],[],[],calls,rests));
   const failure=mode.endsWith('accessor');await page.addScriptTag({content:javascript});
   if(failure){
    await page.locator('#selected').filter({hasText:'Original:wrong'}).waitFor({timeout:5000});
    accessors[mode]={dom:await page.locator('#root').innerHTML(),state:await page.evaluate('({reads:window.inputReads,getters:window.proxyReads})')};
    if(observed){const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'refused',JSON.stringify(r));if(r.status==='refused')assert.equal(r.reason,'context-rest-value-mutated');}
    assert.equal(await page.evaluate('window.proxyReads'),1);assert.equal(await page.evaluate('window.inputReads'),1);continue;
   }
   await page.locator('#selected').filter({hasText:'Original:first'}).waitFor({timeout:5000});
   await page.evaluate('window.render("second",1)');await page.locator('#selected').filter({hasText:'Original:second'}).waitFor({timeout:5000});
   await page.evaluate('window.beforeMemo=window.retained;window.render("second",2)');await page.waitForFunction('window.inputReads===3');
   assert.equal(await page.evaluate('window.beforeMemo===window.retained'),true);await page.locator('#selected').click();
   pairs[mode]={dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),inputReads:window.inputReads,proxyReads:window.proxyReads})')};
   if(observed){observer.complete();const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'observed',JSON.stringify(r));if(r.status!=='observed')continue;
    const c=r.contexts!;assert.equal(c.values.qualification,'source-object-rest-values-only');assert.equal(c.values.effectsVerified,false);assert.equal(c.values.acceptedContract,null);assert.equal(c.values.allocations,3);assert.equal(c.values.origins.length,2);
    assert.deepEqual(c.values.origins.map(o=>o.source),[rests[0].binding,rests[0].binding]);
    assert.deepEqual(c.values.origins.map(o=>o.fields),[[['label',{kind:'string',value:'first'}],['opaque',{kind:'object'}]],[['label',{kind:'string',value:'second'}],['opaque',{kind:'object'}]]]);
    assert.deepEqual(c.providers.map(p=>p.valueOrigin),[0,1,1]);
    assert.notEqual(c.values.origins[0].identity,c.values.origins[1].identity);
    const identities=c.values.origins.map(o=>new Map(o.witnesses!).get('opaque')!.identity);assert.equal(identities[0],identities[1]);
    const renders=c.renders.invocations,boundaries=r.targetInitializers!.targets[0].invocations;
    assert.equal(renders.length,3);assert.equal(boundaries.length,3);
    for(const [index,render] of renders.entries()){
     assert.equal(render.id,index);assert.equal(render.completion,'returned');assert.deepEqual(render.source,initializer.render);
     const boundary=boundaries.find(b=>b.input.render===index);assert(boundary);assert.equal(boundary.output.render,index);
     const output=new Map(boundary.output.fields),payload=output.get('payload');assert.equal(payload?.kind,'object');assert.notEqual(payload?.identity,undefined);
     if(mode.endsWith('copied-payload'))assert.notEqual(payload?.identity,identities[0]);else assert.equal(payload?.identity,identities[0]);
     assert.equal(output.get('children')?.value,index===0?'Original:first':'Original:second');
     const contextRead=c.reads[render.reads[0]],origin=c.values.origins.find(o=>o.id===contextRead.valueOrigin);assert(origin);
     assert.equal(output.get('children')?.value,'Original:'+new Map(origin.fields!).get('label')?.value);
     assert.deepEqual(output.get('ref'),boundary.input.refValue);
    }
    assert.equal(await page.evaluate('window.received===window.opaque'),!mode.endsWith('copied-payload'));
    for(const read of c.reads)assert.equal(read.valueOrigin,read.provider===null?null:c.providers[read.provider].valueOrigin);
    await page.evaluate('window.__DSC_RUNTIME_READ().contexts.values.origins[0].fields[0][1].value="forged"');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
    await page.evaluate('window.__DSC_RUNTIME_READ().contexts.values.origins[0].witnesses[1][1].identity=-1');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
    if(mode==='late-mutation'){await page.evaluate('window.retained.label="changed"');const changed=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(changed.status,'refused');if(changed.status==='refused')assert.equal(changed.reason,'context-rest-value-mutated');}
   }
  }finally{await page.close();}
 }
 assert.deepEqual(accessors['original-accessor'],accessors.accessor);
 assert.deepEqual(pairs.original,pairs.guarded);assert.deepEqual(pairs.original,pairs['late-mutation']);
 assert.deepEqual(pairs['original-copied-payload'],pairs['copied-payload']);
});
