import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {build,transform} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactElementSourceCalls} from './react-element-source-call.js';
import {readReactElementInvocationPlans,transformReactElementSource} from './react-element-invocation.js';
import {readReactElementCreationSites,reactElementCreationHook,createReactElementCreationObserver} from './react-element-creation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
function prepare(text:string){
  const sf=ts.createSourceFile('/fixture.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const sites=readReactElementCreationSites(text,sf.fileName,'fixture.mjs'),plans=readReactElementInvocationPlans(sf,sites),sources=readReactElementSourceCalls(sf,'fixture.mjs',sha(text));
  const indexed={objects:sources.objects.map((p,index)=>({...p,index})),calls:sources.calls.map((p,index)=>({...p,index}))};
  return {sites,plans,sources,code:transformReactElementSource(sf,sites.map((p,index)=>({...p,index})),plans.map((p,index)=>({...p,index})),indexed)};
}

test('source callback plans require static unique data properties and preserve original parameter patterns',()=>{
  const text=`import {jsx} from 'react/jsx-runtime';
const good={view:({label,...rest})=>jsx('button',{...rest,children:label})};
const computed={[key]:({label})=>jsx('button',{children:label})};
const duplicate={view:({label})=>jsx('button',{children:label}),view:other};
const spread={view:({label})=>jsx('button',{children:label}),...other};
const defaulted={view:({label=read()})=>jsx('button',{children:label})};
const nested={view:({item:{label}})=>jsx('button',{children:label})};
const accessor={get item(){return 1},view:({label})=>jsx('button',{children:label})};
const changedProto={__proto__:proto,view:({label})=>jsx('button',{children:label})};
const context={label:'a'};good.view(context);const callback=good.view;callback(context);
let unknown={label:'b'};callback(unknown);callback?.(context);callback(...context);callback({label:'c'});
function shadow(globalThis){callback({label:'d'});}`;
  const p=prepare(text);assert.equal(p.plans.length,1);assert.equal(p.plans[0].argumentSource,'source-call');
  assert.equal(p.plans[0].identityProperty?.key,'view');assert.equal(p.sources.calls.length,2);assert.equal(p.sources.objects.length,2);
  assert.match(p.code,/view: \(\{ label, \.\.\.rest \}\) =>/);assert.match(p.code,/callbackObject/);assert.match(p.code,/enterSource/);
});

test('source calls retain function identity, inferred name, this, argument order and thrown values; unknown inputs cannot borrow proof',async()=>{
  const text=`import {jsx} from 'react/jsx-runtime';
const trace=[],error={},opaque={};let inner,fromGetter;
const object={view:function({value,...rest}){trace.push('body:'+value+':'+(this===object));if(value==='throw')throw error;if(value==='outer')inner=object.view({value:'inner'});return jsx('button',{...rest,children:value});}};
const callback=object.view;
const context={value:'ok',opaque};const result=callback(context);
const changed={value:'before'};changed.value='after';const changedResult=callback(changed);
const unknown=new Proxy({value:'unknown'}, {get(t,k,r){trace.push('get:'+String(k));return Reflect.get(t,k,r)},ownKeys(t){trace.push('keys');return Reflect.ownKeys(t)},getOwnPropertyDescriptor(t,k){trace.push('descriptor:'+String(k));return Reflect.getOwnPropertyDescriptor(t,k)},getPrototypeOf(){trace.push('prototype');return Object.prototype}});
const manual=callback(unknown);let sameError=false;try{callback({value:'throw'});}catch(e){sameError=e===error;}
const afterThrow=callback({value:'after-throw'});
const outer=callback({value:'outer'});
const accessor={get value(){trace.push('accessor');fromGetter=object.view({value:'from-getter'});return 'getter';}};
const getterResult=callback(accessor);
globalThis.result={object,callback,result,changedResult,manual,afterThrow,outer,inner,getterResult,fromGetter,trace,sameError};`;
  const p=prepare(text),rows=[];
  for(const observed of [false,true]){
    const context={};runInNewContext(`globalThis.owner={};globalThis.factory=(type,props)=>({type,props,_owner:owner});globalThis.require=()=>({jsx:factory});globalThis.exports={};`,context);
    if(observed){runInNewContext(reactElementCreationHook(p.sites,p.plans,false,p.sources),context);runInNewContext('__DSC_ELEMENT_CREATION.register(factory,factory)',context);}
    runInNewContext((await transform(observed?p.code:text,{loader:'js',format:'cjs'})).code,context);
    const report=runInNewContext(`JSON.stringify((()=>{const r=globalThis.result,read=element=>${observed?'__DSC_ELEMENT_CREATION.readInvocation({memoizedProps:element.props,type:element.type,_debugOwner:owner})':'undefined'};return {trace:r.trace,sameError:r.sameError,sameFunction:r.object.view===r.callback,name:r.callback.name,length:r.callback.length,props:[r.result,r.changedResult,r.manual,r.afterThrow,r.outer,r.inner,r.getterResult,r.fromGetter].map(x=>x.props),observations:[r.result,r.changedResult,r.manual,r.afterThrow,r.outer,r.inner,r.getterResult,r.fromGetter].map(read)};})())`,context);
    rows.push(JSON.parse(report));
  }
  const observed=rows[1].observations;assert.equal(observed[0].status,'observed');assert.equal(observed[0].sourceCall.argument.qualification,'source-object-origin-only');
  assert.equal(observed[0].inputProvenance.status,'refused');assert.equal(observed[0].effectsVerified,false);assert.equal(observed[0].acceptedContract,null);
  for(const index of [1,2,5,6,7]){assert.equal(observed[index].status,'refused');assert.equal(observed[index].reason,'element-source-invocation-unproved');}
  for(const index of [3,4])assert.equal(observed[index].status,'observed');
  delete rows[0].observations;delete rows[1].observations;assert.deepEqual(rows[0],rows[1]);
  assert.equal(rows[1].sameFunction,true);assert.equal(rows[1].sameError,true);assert.equal(rows[1].name,'view');assert.equal(rows[1].length,1);assert(!rows[1].trace.includes('prototype'));
});

test('real React keeps a nested child separate from the callback returned Fragment and records actual provider input',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.source-call-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.mjs'),text=`import React from 'react';import {createRoot} from 'react-dom/client';import {jsx,jsxs,Fragment} from 'react/jsx-runtime';
const Leaf=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));
function Provider(props){const {render}=props;const context={enabled:true,opaque:props.opaque};return render(context);}
function Parent(props){const config={opaque:props.opaque,render:({enabled})=>jsxs(Fragment,{children:[jsx(Leaf,{id:'selected',children:enabled?'Enabled':'Disabled'}),jsx('span',{children:'Sibling'})]})};window.callbackMetadata={name:config.render.name,length:config.render.length};return jsx(Provider,config);}
createRoot(document.getElementById('root')).render(jsx(Parent,{opaque:{}}));`;
  writeFileSync(file,text);const files:Record<string,string>={[file]:sha(text)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:root,files,runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]};
  const observer=createReactElementCreationObserver(reference),browser=await chromium.launch();t.after(()=>browser.close());const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:300,height:150}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#selected').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot(),metadata=await page.evaluate('window.callbackMetadata');rows.push({dom,png,metadata});
      if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected'));assert.deepEqual(ownership.problems,[]);
      const lineage=ownership.nodes[0].creationLineage!;assert.equal(lineage.stop,'source-context-caller-unavailable');
      const parent=lineage.parents[0];assert.equal(parent.invocation?.status,'refused');
      if(parent.invocation?.status==='refused')assert.equal(parent.invocation.reason,'element-source-result-not-returned');
      const returned=parent.enclosingReturn!;assert.equal(returned.site.factory,'jsxs');assert.equal(returned.invocation.status,'observed');
      assert.equal(returned.membership?.status,'matched');
      if(returned.membership?.status==='matched'){
        assert.deepEqual(returned.membership.path.map(p=>p.kind),['children','array-index']);
        const array=returned.membership.path[1];assert(array.kind==='array-index');assert.equal(array.factoryFreeze?.factory,'jsxs');
      }
      if(returned.invocation.status!=='observed')throw Error('missing returned callback');
      assert.equal(returned.invocation.sourceCall?.argument.qualification,'source-object-origin-only');
      assert.equal(returned.invocation.sourceCall?.caller,undefined);assert.equal(returned.invocation.sourceCall?.argument.creator,undefined);
      assert.deepEqual(returned.invocation.input,[['enabled',{kind:'boolean',value:true}],['opaque',{kind:'object'}]]);
      assert.equal(returned.invocation.inputProvenance.status,'refused');assert.equal(returned.invocation.outputProvenance.status,'verified');assert.equal(returned.invocation.effectsVerified,false);
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rows[0],rows[1]);assert.deepEqual(rows[1].metadata,{name:'render',length:1});
});

test('source endpoints retain their nearest function and never attribute class initializers to an outer frame',()=>{
  const text=`function outer(props){const input={value:1};const nested=()=>render(input);class Box {child=render(input);method(){return render(input)}};return render(input)}`;
  const sf=ts.createSourceFile('/fixture.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),sources=readReactElementSourceCalls(sf,'fixture.mjs',sha(text));
  assert.equal(sources.calls.length,4);assert.equal(sources.objects.length,1);
  const spanText=(p:{functionSpan?:{start:number;end:number}})=>p.functionSpan&&text.slice(p.functionSpan.start,p.functionSpan.end);
  assert.equal(spanText(sources.objects[0]),text);
  assert.equal(spanText(sources.calls[0]),'()=>render(input)');
  assert.equal(spanText(sources.calls[1]),undefined);
  assert.equal(spanText(sources.calls[2]),'method(){return render(input)}');
  assert.equal(spanText(sources.calls[3]),text);
});

test('provider joins require the actual creator/caller frame and unique returned children membership',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.source-context-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.mjs'),text=`import React from 'react';import {createRoot} from 'react-dom/client';import {jsx,jsxs,Fragment} from 'react/jsx-runtime';
const Context=React.createContext(null),Leaf=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));
function Selected(props){return props.selected;}
function Provider(props){
 const {render,mode}=props;const context={id:'case-'+mode,enabled:true};
 if(mode==='nested'){const invoke=()=>render(context);return jsx(Context.Provider,{value:context,children:invoke()});}
 if(mode==='class'){class Box{child=render(context)};return jsx(Context.Provider,{value:context,children:new Box().child});}
 if(mode==='foreign'){const Different=ignored=>jsx(Context.Provider,{value:context,children:render(context)});return jsx(Different,{});}
 const child=render(context);
 if(mode==='duplicate')return jsxs(Context.Provider,{value:context,children:[child,child]});
 if(mode==='opaque')return jsx(Selected,{selected:child});
 return jsx(Context.Provider,{value:context,children:child});
}
function Parent(props){return jsx(Provider,{mode:props.mode,render:({id,enabled})=>jsxs(Fragment,{children:[jsx(Leaf,{id,children:enabled?'Enabled':'Disabled'}),jsx('span',{children:'Sibling'})]})});}
createRoot(document.getElementById('root')).render(jsxs(Fragment,{children:[jsx(Parent,{mode:'valid'}),jsx(Parent,{mode:'nested'}),jsx(Parent,{mode:'class'}),jsx(Parent,{mode:'foreign'}),jsx(Parent,{mode:'duplicate'}),jsx(Parent,{mode:'opaque'})]}));`;
  writeFileSync(file,text);const files:Record<string,string>={[file]:sha(text)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const observer=createReactElementCreationObserver({sourceRoot:root,files,runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]}),browser=await chromium.launch();t.after(()=>browser.close());const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:800,height:200}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#case-opaque').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot();rows.push({dom,png});if(!observed)continue;
      const cases:Record<string,string>={valid:'caller-invocation-unavailable',nested:'source-context-caller-unavailable',class:'source-context-caller-unavailable',foreign:'source-context-creator-not-caller',duplicate:'source-context-return-membership-refused',opaque:'source-context-return-membership-refused'};
      for(const [mode,stop] of Object.entries(cases)){
        const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#case-'+mode));assert.deepEqual(ownership.problems,[]);
        const lineage=ownership.nodes[0].creationLineage!;assert.equal(lineage.stop,stop,mode);
        const callback=lineage.parents[0].enclosingReturn!.invocation;assert.equal(callback.status,'observed');if(callback.status!=='observed')throw Error('missing callback');
        const call=callback.sourceCall!;assert(call.argument.creator,mode);assert.equal(call.argument.creator.function.span.start,text.indexOf('function Provider'));
        assert.equal(callback.inputProvenance.status,'refused');assert.equal(callback.effectsVerified,false);
        if(mode==='nested'||mode==='class')assert.equal(call.caller,undefined,mode);
        else {assert(call.caller,mode);assert.equal(call.caller.invocation===call.argument.creator.invocation,mode!=='foreign');}
        const link=lineage.parents.find(p=>p.sourceContext);
        if(mode==='valid'||mode==='duplicate'||mode==='opaque'){
          assert(link?.sourceContext,mode);assert.equal(link.invocation?.status,'observed');
          assert.equal(link.sourceContext.effectsVerified,false);assert.equal(link.sourceContext.acceptedContract,null);
          assert.deepEqual(link.sourceContext.call,call);
          const membership=link.sourceContext.membership;assert.equal(membership.status,mode==='valid'?'matched':'refused');
          if(membership.status==='matched')assert.deepEqual(membership.path.map(p=>p.kind),['children']);
          if(membership.status==='refused')assert.equal(membership.reason,mode==='duplicate'?'element-composition-ambiguous':'element-composition-target-absent');
          if(link.invocation?.status==='observed')assert.equal(link.invocation.inputProvenance.status,'verified');
        }else assert.equal(link,undefined,mode);
        assert.deepEqual(await page.evaluate(reactOwnershipRead('#case-'+mode)),ownership);
      }
      assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rows[0],rows[1]);
});
