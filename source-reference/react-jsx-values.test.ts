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
import {readReactJsxEffects} from './react-jsx-effects.js';
import type {ReactJsxValueRequest,ReactJsxValues} from './react-jsx-values.js';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');

test('complete original JSX return matches private imported types, fragments, children arrays, callbacks and refs; mutations refuse without proxy inspection',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.jsx-values-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const configFile=path.join(dir,'tsconfig.json'),config='{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}';
  const source=`import React from 'react';import {Root,Thumb} from './targets.mjs';
export const Control=React.forwardRef((props,ref)=><Root id={props.id} onClick={props.onClick} payload={props.payload} ref={ref} key="outer"><><Thumb label={props.label}/><i>Tail</i></></Root>);`;
  const targets=`import React from 'react';import {jsx} from 'react/jsx-runtime';
export const Root=React.forwardRef((props,ref)=>jsx('button',{id:props.id,onClick:props.onClick,ref,children:props.children}));
export function Thumb(props){return jsx('b',{children:props.label});}
export function Other(props){return jsx('b',{children:props.label});}`;
  const file=path.join(dir,'fixture.tsx'),targetFile=path.join(dir,'targets.mjs');
  writeFileSync(configFile,config);writeFileSync(file,source);writeFileSync(targetFile,targets);
  const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './fixture.tsx';
window.trace=[];window.traps=0;const onClick=()=>window.trace.push('click'),otherHandler=()=>{},ref=React.createRef();window.testRef=ref;
const payload=new Proxy({},{get(){window.traps++;throw Error('get trap');},ownKeys(){window.traps++;throw Error('keys trap');},getPrototypeOf(){window.traps++;throw Error('proto trap');}});
createRoot(document.getElementById('root')).render(React.createElement(Control,{id:'selected',label:'Original',onClick,otherHandler,payload,ref}));`;
  const files:Record<string,string>={[file]:sha(source),[targetFile]:sha(targets),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const file=root+adapter.suffix;files[file]=sha(readFileSync(file,'utf8'));}
  const reference={id:sha('fixture-reference'),sourceRoot:dir,files,cohort:{entry},runtimeImports:[
    {importer:file,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')},
    {importer:targetFile,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')},
    {importer:file,specifier:'./targets.mjs',file:targetFile},
  ]};
  const observer=createReactElementCreationObserver(reference,entry,['Root','Thumb','Other'].map(exportName=>({module:'targets.mjs',exportName})));
  assert.equal(observer.targets.length,3);assert(observer.targetResolutions.every(r=>r.status==='resolved'&&!r.runtimeVerified));
  const browser=await chromium.launch();t.after(()=>browser.close());const rendered=[];
  for(const observed of [false,true]){
    const input=observed?await observer.transform(entry,'react-reference.tsx','tsx'):{contents:entry,loader:'tsx' as const};
    const bundle=await build({stdin:{contents:input.contents,loader:input.loader,resolveDir:dir,sourcefile:'react-reference.tsx'},tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path===file?'tsx':'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:300,height:150}});try{
      await page.setContent('<div id="root"></div>');
      if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:bundle.outputFiles[0].text});await page.locator('#selected').waitFor();
      const dom=await page.locator('#selected').evaluate(n=>n.outerHTML);await page.locator('#selected').click();const png=await page.screenshot();
      const data=await page.evaluate('({ref:window.testRef.current===document.getElementById("selected"),trace:window.trace,traps:window.traps})');rendered.push({dom,png,data});
      if(!observed)continue;
      const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#selected'));
      const parent=ownership.nodes[0].creationLineage!.parents.find(p=>p.site.originalJsx)!;assert(parent?.invocation);
      const model=readReactJsxEffects(reference,parent.site,parent.invocation);
      assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
      const request:ReactJsxValueRequest={site:parent.site,observation:parent.invocation,model};
      const compare=async(r:ReactJsxValueRequest)=>(await page.evaluate((json)=>(globalThis as unknown as {__DSC_ELEMENT_CREATION:{compareJsxValues(json:string):ReactJsxValues[]}}).__DSC_ELEMENT_CREATION.compareJsxValues(json),JSON.stringify([r])))[0];
      const result=await compare(request);assert.equal(result.status,'matched',JSON.stringify(result));
      assert.equal(result.effectsVerified,false);assert.equal(result.acceptedContract,null);assert.equal(result.qualification,'original-jsx-invocation-values-only');
      if(result.status==='matched')assert.equal(result.targets,2);
      const other=observer.targets.find(target=>target.exportName==='Other')!;
      const otherPoint={file:other.module,sha256:other.sourceSha256,...other.span};
      for(const mutate of [
        (m:typeof model)=>{
          const fragment=m.output.props.fields.find(([key])=>key==='children')![1];assert.equal(fragment.kind,'jsx');if(fragment.kind!=='jsx')return;
          const children=fragment.props.fields.find(([key])=>key==='children')![1];assert.equal(children.kind,'array');if(children.kind!=='array')return;
          const thumb=children.items[0];assert.equal(thumb.kind,'jsx');if(thumb.kind!=='jsx')return;
          thumb.tag={kind:'source-binding',source:otherPoint};m.jsxTargets[1].binding=otherPoint;
        },
        (m:typeof model)=>{m.output.key='wrong';},
        (m:typeof model)=>{m.output.props.fields.reverse();},
        (m:typeof model)=>{m.input={kind:'record',fields:[]};},
        (m:typeof model)=>{m.output.props.fields.find(([key])=>key==='onClick')![1]={kind:'input',key:'otherHandler'};},
        (m:typeof model)=>{m.output.props.fields.find(([key])=>key==='ref')![1]={kind:'parameter',index:2};},
        (m:typeof model)=>{m.output.props.fields.find(([key])=>key==='payload')![1]={kind:'record',fields:[]};},
        (m:typeof model)=>{m.output.props.fields.find(([key])=>key==='payload')![1]={kind:'array',items:[]};},
        (m:typeof model)=>{m.output.props.fields.find(([key])=>key==='children')![1]={kind:'array',items:[]};},
        (m:typeof model)=>{m.jsxTargets[0].read.start++;},
        (m:typeof model)=>{m.jsxTargets.pop();},
        (m:typeof model)=>{if(m.output.tag.kind==='source-binding')m.output.tag.source.start++;},
        (m:typeof model)=>{m.content='forwarded';},
      ]){const changed=structuredClone(request);mutate(changed.model as typeof model);assert.equal((await compare(changed)).status,'refused');}
      const foreign=structuredClone(request);if(foreign.observation.status==='observed')foreign.observation.invocation+=10000;assert.equal((await compare(foreign)).status,'refused');
      const forged=structuredClone(request);Object.assign(forged.observation,{effectsVerified:true});assert.equal((await compare(forged)).status,'refused');
      assert.deepEqual(await compare(request),result);assert.equal(await page.evaluate('window.traps'),0);
      assert.deepEqual(await page.evaluate(reactOwnershipRead('#selected')),ownership);assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rendered[0],rendered[1]);assert.deepEqual(rendered[0].data,{ref:true,trace:['click'],traps:0});
});
