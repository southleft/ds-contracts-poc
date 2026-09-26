import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {createReactElementCreationObserver} from './react-element-creation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {readReactCompiledEffects} from './react-compiled-effects.js';
import type {ReactCompiledValueRequest,ReactCompiledValues} from './react-compiled-values.js';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');

test('complete keyed React output matches private children, callback and ref identities in the original invocation',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.compiled-values-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.mjs'),source=`import React from 'react';import {createRoot} from 'react-dom/client';import {jsx} from 'react/jsx-runtime';
const outside=()=>{throw Error('closure called');};
const Control=React.forwardRef((props,ref)=>{
 const {otherHandler,otherChild,...rest}=props;
 globalThis[Symbol.for('generic-values-test')]=true;
 return jsx('button',{...rest,ref,onFocus:outside},'output-key');
});
const callback=()=>{throw Error('callback inspected or called');},otherHandler=()=>{},ref=()=>{};
function App(){const child=jsx('span',{children:'Kept'}),otherChild=jsx('span',{children:'Kept'});
 return jsx(Control,{id:'selected',children:child,onClick:callback,otherHandler,otherChild,ref},'input-key');}
createRoot(document.getElementById('root')).render(jsx(App,{}));`;
  writeFileSync(file,source);
  const files:Record<string,string>={[file]:sha(source)};for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:root,files,runtimeImports:[{importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}]};
  const observer=createReactElementCreationObserver(reference),browser=await chromium.launch();t.after(()=>browser.close());
  const rows:Array<{dom:string;png:Buffer}>=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:300,height:150}});try{
      await page.setContent('<div id="root"></div>');
      if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#selected').waitFor();
      const dom=await page.locator('#selected').evaluate(n=>n.outerHTML),png=await page.screenshot();rows.push({dom,png});
      if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected')),node=ownership.nodes.find(n=>n.path==='')!;
      assert(node.creationSite&&node.creationInvocation);
      const model=readReactCompiledEffects(reference,node.creationSite,node.creationInvocation);
      assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
      const request:ReactCompiledValueRequest={site:node.creationSite,observation:node.creationInvocation,model};
      const compare=async(r:ReactCompiledValueRequest)=>(await page.evaluate((json)=>
        (globalThis as unknown as {__DSC_ELEMENT_CREATION:{compareValues(json:string):ReactCompiledValues[]}}).__DSC_ELEMENT_CREATION.compareValues(json),JSON.stringify([r])))[0];
      const result=await compare(request);assert.equal(result.status,'matched',JSON.stringify(result));
      assert.equal(result.effectsVerified,false);assert.equal(result.acceptedContract,null);assert.equal(result.qualification,'compiled-invocation-values-only');
      assert.deepEqual(await compare(request),result);
      for(const mutate of [
        (r:typeof model)=>{r.output.tag.name='span';},
        (r:typeof model)=>{r.output.key='wrong-key';},
        (r:typeof model)=>{r.content='not-directly-forwarded';},
        (r:typeof model)=>{r.output.props.fields.reverse();},
        (r:typeof model)=>{r.output.props.fields.push(['extra',{kind:'literal',type:'boolean',value:true}]);},
        (r:typeof model)=>{r.output.props.fields.find(([key])=>key==='onClick')![1]={kind:'input',key:'otherHandler'};},
        (r:typeof model)=>{r.output.props.fields.find(([key])=>key==='children')![1]={kind:'input',key:'otherChild'};},
        (r:typeof model)=>{r.output.props.fields.find(([key])=>key==='ref')![1]={kind:'parameter',index:2};},
        (r:typeof model)=>{r.output.props.fields.find(([key])=>key==='onFocus')![1]={kind:'closure',name:'wrong-name',read:0};},
        (r:typeof model)=>{r.output.props.fields.find(([key])=>key==='onClick')![1]={kind:'record',fields:[]};},
        (r:typeof model)=>{r.nativeEffects[0].key='wrong-marker';},
        (r:typeof model)=>{r.nativeEffects.pop();},
      ]){
        const changed:ReactCompiledValueRequest=structuredClone(request);mutate(changed.model as typeof model);
        assert.equal((await compare(changed)).status,'refused');
      }
      const forged=structuredClone(request);(forged.observation as unknown as {effectsVerified:boolean}).effectsVerified=true;
      assert.equal((await compare(forged)).status,'refused');
      const foreign=structuredClone(request);if(foreign.observation.status==='observed')foreign.observation.invocation+=10000;
      assert.equal((await compare(foreign)).status,'refused');
      assert.deepEqual(await compare(request),result);assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.equal(rows[0].dom,rows[1].dom);assert.deepEqual(rows[0].png,rows[1].png);
});
