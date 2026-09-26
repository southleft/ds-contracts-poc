import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {createReactElementCreationObserver} from './react-element-creation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

test('original TSX reads preserve erased types, JSX target getters, method receivers, branch order and actual events',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.jsx-source-reads-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.tsx'),helper=path.join(dir,'helper.mjs'),configFile=path.join(dir,'tsconfig.json');
  const source=`import React from 'react';import {createRoot} from 'react-dom/client';import {refine,Leaf,Manual} from './helper.mjs';
import type {NeverRuntime} from './only-types';
type Props={id:string,label:string,choose:boolean,onClick:()=>void};const trace:string[]=[];window.trace=trace;
const meta={prefix:'kept'},holder={prefix:'receiver',method<T>(value:T){trace.push('method:'+this.prefix);return value;}};
const UI={get Leaf(){trace.push('target');return Leaf;}};
let assigned='before',count=0;
const Root=React.forwardRef<HTMLButtonElement,Props>((props,forwardedRef)=>{
 const erased:NeverRuntime|undefined=undefined;void erased;
 type Inside=typeof RuntimeTypeMustNotBeRead;
 const {label,...rest}=refine(props,meta);
 const value=props.choose?unselected:label;
 (assigned as string)='after';count!++;
 const safe=typeof (MissingRuntime as unknown);
 return <UI.Leaf {...rest} ref={forwardedRef} title={holder.method<string>(value as string)} data-missing={safe}>{label}</UI.Leaf>;
});
function App(props:Record<string,never>){
 const proxy=new Proxy({label:'Manual'},{get(t,k,r){trace.push('proxy:get:'+String(k));return Reflect.get(t,k,r)},getPrototypeOf(){trace.push('proxy:prototype');throw Error('observer prototype')},ownKeys(){trace.push('proxy:keys');throw Error('observer keys')},getOwnPropertyDescriptor(){trace.push('proxy:descriptor');throw Error('observer descriptor')}});
 const manual=Manual.render(proxy,null);
 return <section><Root id="selected" label="Original" choose={false} onClick={()=>trace.push('clicked')}/>{manual}</section>;
}
window.rootMetadata={name:Root.render.name,length:Root.render.length};window.mutationResult=()=>({assigned,count});createRoot(document.getElementById('root')!).render(<App/>);const unselected='unused';`;
  const helperSource=`import React from 'react';import {jsx} from 'react/jsx-runtime';
export function refine(props,meta){window.trace.push('helper:'+meta.prefix);const {choose,...rest}=props;return rest;}
export const Leaf=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));
export const Manual=React.forwardRef((props,ref)=>jsx('button',{id:'manual',children:props.label,ref}));`;
  const config='{"compilerOptions":{"target":"ES2022","jsx":"react-jsx"}}';writeFileSync(file,source);writeFileSync(helper,helperSource);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(source),[helper]:sha(helperSource),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:dir,files,runtimeImports:[file,helper].map(importer=>({importer,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}))};
  const observer=createReactElementCreationObserver(reference),browser=await chromium.launch();t.after(()=>browser.close());const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path===file?'tsx':'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:450,height:150}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#selected').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot();await page.locator('#selected').click();
      const metadata=await page.evaluate<{trace:string[];root:unknown;mutation:unknown}>('({trace:window.trace,root:window.rootMetadata,mutation:window.mutationResult()})');rows.push({dom,png,metadata});if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected')),parent=ownership.nodes[0].creationLineage!.parents[0],invocation=parent.invocation!;
      assert.equal(invocation.status,'observed');if(invocation.status!=='observed')throw Error('invocation missing');
      assert.equal(invocation.effectsVerified,false);assert.equal(invocation.acceptedContract,null);
      assert.equal(invocation.function.observation,'original-function-invocation-only');
      assert(invocation.function.bindingReads!.some(r=>r.name==='unselected'));
      assert(!invocation.function.bindingReads!.some(r=>['UI','Leaf','NeverRuntime','RuntimeTypeMustNotBeRead','Inside','string','title'].includes(r.name)));
      assert.deepEqual(invocation.closureReads.map(r=>({name:invocation.function.bindingReads![r.read].name,...r.value})),[
        {name:'undefined',kind:'undefined'},
        {name:'refine',kind:'function'},{name:'meta',kind:'object'},{name:'MissingRuntime',kind:'string',value:'undefined'},{name:'holder',kind:'object'},
      ]);
      assert.equal(invocation.inputProvenance.status,'verified');assert.equal(invocation.outputProvenance.status,'verified');
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);
      const manual=await page.evaluate<ReactOwnership>(reactOwnershipRead('#manual')),unknown=manual.nodes[0].creationInvocation!;
      assert.equal(unknown.status,'refused');if(unknown.status==='refused')assert.equal(unknown.reason,'element-invocation-input-not-data');
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rows[0],rows[1]);
  assert.deepEqual(rows[1].metadata.mutation,{assigned:'after',count:1});
  assert.deepEqual(rows[1].metadata.trace,['proxy:get:label','helper:kept','target','method:receiver','clicked']);
});
