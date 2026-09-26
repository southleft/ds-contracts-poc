import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {build,transform} from 'esbuild';
import {chromium} from 'playwright-core';
import {createReactElementCreationObserver,readReactElementCreationSites,reactElementCreationHook} from './react-element-creation.js';
import {readReactElementInvocationPlans,transformReactElementSource} from './react-element-invocation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');

function plan(text:string){
  const sf=ts.createSourceFile('/fixture.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const sites=readReactElementCreationSites(text,sf.fileName,'fixture.mjs'),plans=readReactElementInvocationPlans(sf,sites);
  return {sites,plans,code:transformReactElementSource(sf,sites.map((s,index)=>({...s,index})),plans.map((p,index)=>({...p,index})))};
}

test('flat named parameter bindings can observe raw React arguments without moving destructuring into the body',()=>{
  const source=`import {jsx} from 'react/jsx-runtime';
export function Flat({mode:kind,...props},ref){return jsx('button',{...props,ref});}
export function Nested({child:{value}}){return jsx('button',{children:value});}
export function Defaulted({value=read()}){return jsx('button',{children:value});}
export function Computed({[key()]:value}){return jsx('button',{children:value});}
export function Shadow({value}){const Shadow=1;return jsx('button',{children:value});}
export function ClassShadow({value}){class ClassShadow{};return jsx('button',{children:value});}
export const anonymous=({value})=>jsx('button',{children:value});`;
  const result=plan(source);assert.equal(result.plans.length,1);assert.equal(result.plans[0].identityName,'Flat');
  assert.equal(result.plans[0].argumentSource,'react-call');
  assert.match(result.code,/function Flat\(\{ mode: kind, \.\.\.props \}, ref\)/);
  assert.match(result.code,/enterReact\(0, Flat\)/);
});

test('unproven proxy parameters retain original getter, rest, exception and function metadata behavior',async()=>{
  const text=`import {jsx} from 'react/jsx-runtime';
function C({value,...rest},ref){return jsx('button',{...rest,children:value,ref});}
globalThis.Component=C;`;
  const prepared=plan(text),results=[];
  for(const observed of [false,true]){
    const context={};
    runInNewContext(`globalThis.owner={};globalThis.factory=(type,props)=>({type,props,_owner:owner});globalThis.require=()=>({jsx:factory});globalThis.exports={};`,context);
    if(observed){runInNewContext(reactElementCreationHook(prepared.sites,prepared.plans),context);runInNewContext('__DSC_ELEMENT_CREATION.register(factory,factory)',context);}
    runInNewContext((await transform(observed?prepared.code:text,{loader:'js',format:'cjs'})).code,context);
    const result=runInNewContext(`(()=>{
      const calls=[],error={message:'same thrown value'},input=new Proxy({value:'Kept',id:'x'},{
       get(t,k,r){calls.push('get:'+String(k));return Reflect.get(t,k,r);},
       ownKeys(t){calls.push('keys');return Reflect.ownKeys(t);},
       getOwnPropertyDescriptor(t,k){calls.push('descriptor:'+String(k));return Object.getOwnPropertyDescriptor(t,k);},
       getPrototypeOf(t){calls.push('prototype');return Object.getPrototypeOf(t);}
      });
      const invoke=${observed?'(props)=>__DSC_ELEMENT_CREATION.reactCall(Component,props,null)':'(props)=>Component(props,null)'};
      const element=invoke(input);let sameError=false;try{invoke({get value(){throw error;}});}catch(e){sameError=e===error;}
      const report=${observed?'__DSC_ELEMENT_CREATION.readInvocation({memoizedProps:element.props,type:element.type,_debugOwner:owner})':'undefined'};
      return JSON.stringify({calls,props:element.props,sameError,name:Component.name,length:Component.length,report});
    })()`,context);
    results.push(JSON.parse(result));
  }
  assert.equal(results[1].report.status,'refused');assert.equal(results[1].report.reason,'element-react-invocation-unproved');
  delete results[1].report;assert.deepEqual(results[0],results[1]);assert.equal(results[1].sameError,true);
  assert(!results[1].calls.includes('prototype'));
});

test('real React preserves pixels and function metadata while linking the exact destructured parent; manual calls remain refused',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.render-boundary-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.mjs'),source=`import React from 'react';import {createRoot} from 'react-dom/client';import {jsx} from 'react/jsx-runtime';
const Primitive=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));
const Trigger=React.forwardRef(function Trigger({mode:kind,...props},ref){return jsx(Primitive,{...props,ref,'data-mode':kind});});
const Recursive=React.forwardRef(function Recursive({remaining,...props},ref){if(remaining>0)return Recursive({remaining:remaining-1,...props},ref);return jsx(Primitive,{...props,ref});});
const render=Trigger.render;
function App(props){return jsx('section',{children:[jsx(Trigger,{mode:'active',id:'selected',children:'Kept'}),manual,jsx(Recursive,{remaining:1,id:'recursive',children:'Recursive'})]});}
const manual=Trigger.render({mode:'manual',id:'manual',children:'Manual'},null);
window.metadata={name:render.name,length:render.length,same:render===Trigger.render,prototype:Object.hasOwn(render,'prototype')};
createRoot(document.getElementById('root')).render(jsx(App,{}));`;
  writeFileSync(file,source);const files:Record<string,string>={[file]:sha(source)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:root,files,runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]};
  const observer=createReactElementCreationObserver(reference),browser=await chromium.launch();t.after(()=>browser.close());
  const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:300,height:150}});try{
      await page.setContent('<div id="root"></div>');
      if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#selected').waitFor();await page.locator('#manual').waitFor();
      const dom=await page.locator('body').evaluate(n=>n.innerHTML.replace(/<script[\s\S]*<\/script>/g,'')),png=await page.screenshot(),metadata=await page.evaluate('window.metadata');
      rows.push({dom,png,metadata});if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected'));assert.deepEqual(ownership.problems,[]);
      const lineage=ownership.nodes[0].creationLineage!;
      assert.equal(lineage.parents.length,3);assert.equal(lineage.stop,'caller-invocation-unavailable');
      const composed=lineage.parents[1].enclosingReturn!;
      assert.equal(composed.invocation.status,'observed');assert.equal(composed.membership?.status,'matched');
      if(composed.membership?.status==='matched'){
        assert.deepEqual(composed.membership.path.map(p=>p.kind),['children','array-index']);
        const array=composed.membership.path[1];assert.equal(array.kind,'array-index');
        if(array.kind==='array-index'){assert.equal(array.index,0);assert.equal(array.factoryFreeze,undefined);}
      }
      const entry=lineage.parents[2].site;assert.equal(source.slice(entry.span.start,entry.span.end),'jsx(App,{})');
      const parent=lineage.parents[0].invocation!;assert.equal(parent.status,'observed');if(parent.status!=='observed')return;
      assert.equal(parent.function.argumentSource,'react-call');assert.equal(parent.function.identityName,'Trigger');assert(parent.reactCall);
      assert.equal(parent.inputProvenance.status,'verified');assert.equal(parent.effectsVerified,false);assert.equal(parent.acceptedContract,null);
      assert.equal(parent.input.find(([key])=>key==='mode')?.[1].value,'active');
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);
      const manual=await page.evaluate<ReactOwnership>(reactOwnershipRead('#manual')),refused=manual.nodes[0].creationLineage!;
      assert.equal(refused.stop,'caller-invocation-refused');assert.equal(refused.parents[0].invocation?.status,'refused');
      const recursive=await page.evaluate<ReactOwnership>(reactOwnershipRead('#recursive'));
      assert.equal(recursive.nodes[0].creationLineage?.stop,'caller-invocation-refused');
      const inner=recursive.nodes[0].creationLineage!.parents[0].invocation!;
      assert.equal(inner.status,'refused');if(inner.status==='refused')assert.equal(inner.reason,'element-react-invocation-unproved');
      assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.equal(rows[0].dom,rows[1].dom);assert.deepEqual(rows[0].png,rows[1].png);assert.deepEqual(rows[0].metadata,rows[1].metadata);
});
