import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {planReactContextFactoryCalls,planReactContextTargets} from './react-context-calls.js';
import {modelReactJsxComponent} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {createReactHelperObserver,reactRuntimeAdapters} from './react-helper-transform.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactReference} from './react-reference.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');

test('imported component tables retain original fresh allocations and own-data reads; getters and unknown proxies gain no read authority',async t=>{
 const repo=process.cwd(),dir=mkdtempSync(path.join(repo,'source-reference/.context-targets-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const text=`import React from 'react';import {Root} from './targets.mjs';export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} ref={ref}/>);`;
 const targetSource=`import React from 'react';import {jsx} from 'react/jsx-runtime';import {Collection as Controls} from './barrel.mjs';
 export const Root=React.forwardRef(function Reader(props,ref){window.renders++;return jsx(Controls['control'],{id:props.id,onClick:props.onClick,ref,children:'actual'});});`;
 const tableSource=`import React from 'react';import {jsx} from 'react/jsx-runtime';
 const Node=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));
 export let Table=['control'].reduce((table,key)=>({...table,[key]:Node}),{});
 window.changeTable=mode=>{
  if(mode==='copy')Table={control:Node};
  if(mode==='getter')Object.defineProperty(Table,'control',{get(){window.traps++;return Node;},configurable:true});
  if(mode==='proxy')Table=window.proxy(Table);
  if(mode==='unknown')Table=window.unknown(Node);
  if(mode==='inherited'){delete Table.control;Object.setPrototypeOf(Table,{control:Node});}
  if(mode==='opaque-prototype')Object.setPrototypeOf(Table,window.proxy({}));
 };
 // These are destructuring targets, not fresh object allocations.
 export function unused(value){let x;({x:{x}}=value);for({x} of value){}return x;}`;
 const configText='{"compilerOptions":{"jsx":"react-jsx","module":"ESNext","target":"ES2022","moduleResolution":"Bundler"}}';
 const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs'),tableFile=path.join(dir,'tables.mjs'),barrelFile=path.join(dir,'barrel.mjs'),config=path.join(dir,'tsconfig.json'),files:Record<string,string>={};
 for(const [f,s] of [[file,text],[targetFile,targetSource],[tableFile,tableSource],[barrelFile,"export {Table as Collection} from './tables.mjs';"],[config,configText]]){writeFileSync(f,s);files[f]=sha(s);}
 for(const a of reactRuntimeAdapters){const f=repo+a.suffix;files[f]=sha(readFileSync(f,'utf8'));}
 const reference={sourceRoot:dir,files,runtimeImports:[{importer:file,specifier:'./targets.mjs',file:targetFile},{importer:targetFile,specifier:'./barrel.mjs',file:barrelFile},{importer:barrelFile,specifier:'./tables.mjs',file:tableFile}]} as unknown as ReactReference;
 const target=readReactRuntimeExport(reference,'targets.mjs',['Root']);assert.equal(target.status,'resolved');if(target.status!=='resolved')return;
 const initializer=readReactTargetInitializer(reference,target.definition),{program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});let component:ts.ArrowFunction|undefined;
 const find=(n:ts.Node)=>{if(ts.isArrowFunction(n)&&n.parameters.length===2)component=n;ts.forEachChild(n,find);};find(sf);assert(component&&ts.isIdentifier(component.parameters[0].name));
 const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:[['id','selected'],['onClick',{opaque:'function'}]],contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget:()=>({file:target.definition.module,sha256:target.definition.sourceSha256,...target.definition.span})});assert.equal(model.status,'modeled');if(model.status!=='modeled')return;
 const factories=planReactContextFactoryCalls(reference,[initializer]),targets=planReactContextTargets(reference,factories);assert.equal(factories.length,1);assert.equal(targets.reads.length,1);assert.equal(targets.reads[0].origin.module,'tables.mjs');assert.equal(targets.reads[0].property,'control');
 assert(targets.objects.some(o=>tableSource.slice(o.start,o.end)==='{...table,[key]:Node}'));assert(!targets.objects.some(o=>['{x:{x}}','{x}'].includes(tableSource.slice(o.start,o.end))));
 const plan={kind:'jsx-component' as const,models:[model],component:model.component,targets:[target.definition],initializers:[initializer],contextFactories:factories,contextTargets:targets};
 assert.throws(()=>createReactHelperObserver(reference,{...plan,contextTargets:{...targets,objects:[]}}),/context-target-plan-changed/);
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';window.clicks=0;window.testRef=React.createRef();const root=createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(Control,{id:'selected',onClick:()=>window.clicks++,ref:window.testRef}));window.render();`;
 const bundles=new Map<boolean,string>();
 for(const observed of [false,true]){
  const observer=createReactHelperObserver(reference,plan),input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
  const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:config,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'guard',setup(b){b.onLoad({filter:/./},args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path.endsWith('.tsx')?'tsx':'js'):undefined);}}]:[]});
  const prepared=observed?prepareReactJsxLookupBundle(bundle.outputFiles[0].text,plan):undefined;
  if(prepared){
   assert.equal(prepared.proof.contextTargets?.reads,1);observer.complete();
   const code=bundle.outputFiles[0].text,tree=ts.createSourceFile('bundle.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let read:ts.CallExpression|undefined;
   const scan=(n:ts.Node)=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='contextTargetRead')read=n;ts.forEachChild(n,scan);};scan(tree);assert(read);
   const expression=read.arguments[1],changed=code.slice(0,expression.getStart(tree))+'(window.traps++, '+expression.getText(tree)+')'+code.slice(expression.end);
   assert.throws(()=>prepareReactJsxLookupBundle(changed,plan),/context-target-object-binding-nonlexical/);
  }
  bundles.set(observed,prepared?.javascript??bundle.outputFiles[0].text);
 }
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const mode of ['normal','copy','opaque-prototype','getter','proxy','unknown','inherited']){
  const attack=['getter','proxy','unknown','inherited'].includes(mode),pairs:unknown[]=[];
  for(const observed of attack?[true]:[false,true]){
   const page=await browser.newPage({viewport:{width:400,height:120}});try{
    await page.setContent('<div id="root"></div>');await page.evaluate(()=>{const w=window as any;w.renders=0;w.traps=0;w.proxy=(value:object)=>new Proxy(value,{get(){w.traps++;throw Error('get trap');},ownKeys(){w.traps++;throw Error('keys trap');},getPrototypeOf(){w.traps++;throw Error('prototype trap');}});w.unknown=(value:unknown)=>({control:value});});
    if(observed)await page.evaluate(reactHelperRuntimeHook([],[model],true,[initializer],[],[],[],[],[],[],[],factories,undefined,targets));
    await page.addScriptTag({content:bundles.get(observed)!});await page.locator('#selected').waitFor();
    const failure=attack?page.waitForEvent('pageerror',{timeout:5000}):undefined;
    await page.evaluate(mode=>{const w=window as any;w.changeTable(mode);w.render();},mode);
    if(failure){await failure;const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'refused');if(r.status==='refused')assert.match(r.reason,mode==='getter'||mode==='inherited'?/context-target-property-not-own-data/:/context-target-object-origin-unproved/);assert.equal(await page.evaluate('window.traps'),0);continue;}
    await page.waitForFunction('window.renders===2');await page.locator('#selected').click();pairs.push({dom:await page.locator('#root').innerHTML(),png:await page.screenshot(),state:await page.evaluate('({clicks:window.clicks,ref:window.testRef.current===document.getElementById("selected"),traps:window.traps})')});
    if(observed){const r=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);assert.equal(r.status,'observed',JSON.stringify(r));if(r.status!=='observed')continue;
     const c=r.contexts!,reads=c.targetReads;assert.equal(reads.planned,1);assert.equal(reads.reads.length,2);assert.equal(reads.effectsVerified,false);assert.equal(reads.acceptedContract,null);
     for(const read of reads.reads){const f=c.factories.invocations[read.factory];assert.equal(f.targetRead,read.id);assert.equal(f.render,read.render);assert.deepEqual(f.arguments[0],read.value);assert.equal(read.propertyEffectsVerified,true);assert.equal(read.property,'control');}
     assert.equal(JSON.stringify(reads.reads[0].objectSource)===JSON.stringify(reads.reads[1].objectSource),mode!=='copy');
     await page.evaluate('window.__DSC_RUNTIME_READ().contexts.targetReads.reads[0].propertyEffectsVerified=false');assert.deepEqual(await page.evaluate(reactHelperRuntimeRead),r);
    }
   }finally{await page.close();}
  }
  if(!attack)assert.deepEqual(pairs[0],pairs[1],mode);
 }
});
