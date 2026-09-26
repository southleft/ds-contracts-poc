import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {build,transformSync} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactJsxInvocationPlans,bindReactJsxInvocations} from './react-jsx-invocation.js';
import {transformReactElementSource} from './react-element-invocation.js';
import {createReactElementCreationObserver} from './react-element-creation.js';
import {reactRuntimeAdapters} from './react-helper-transform.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');

test('original JSX function entries survive type erasure with exact source spans; missing, duplicate and wrong entries refuse',()=>{
  const source=`const before='💡';\r\nconst C=<T,>(props:{label:T})=><section><span>{String(props.label)}</span></section>;\r\nconst D=(props:any)=>{const child=(nested:any)=><b>{nested.label}</b>;return <C label={child(props)}/>};
const unsupported=({label=read()})=><button>{label}</button>;function withThis(this:any,props:any){return <b/>}
function enclosing(props:any){class Box{child=<b/>}return new Box()}`;
  const sf=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const plans=readReactJsxInvocationPlans(sf,'fixture.tsx',sha(source)).map((p,index)=>({...p,index}));assert.equal(plans.length,3);
  assert(plans.every(p=>p.observation==='original-function-invocation-only'&&p.operations?.length===0));
  assert.deepEqual(plans.flatMap(p=>p.bindingReads?.map(r=>r.name)),['String']);
  const instrumented=transformReactElementSource(sf,[],plans),code=transformSync(instrumented,{loader:'tsx',jsx:'automatic',target:'esnext'}).code;
  const parse=(text:string)=>ts.createSourceFile('fixture.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const bindings=bindReactJsxInvocations(parse(code),plans);assert.equal(bindings.size,3);
  for(const [generated,original] of bindings){const span=JSON.parse(generated);assert(code.slice(span.start,span.end).includes('__DSC_INVOCATION'));assert(source.slice(original.span.start,original.span.end).includes('=>'));assert.deepEqual(original.span,plans[original.plan].span);}
  assert.throws(()=>bindReactJsxInvocations(parse(code.replace('.enter(0,','.enter(99,')),plans),/entry-unmatched/);
  assert.throws(()=>bindReactJsxInvocations(parse(code.replace('.enter(0,','.enterReact(0,')),plans),/entry-kind-changed/);
  assert.throws(()=>bindReactJsxInvocations(parse(code.replace('.enter(0,','.unknown(0,')),plans),/entry-missing/);
  assert.throws(()=>bindReactJsxInvocations(parse(code+'\nfunction other(){const frame=globalThis.__DSC_ELEMENT_CREATION.enter(0,[])}'),plans),/entry-unmatched/);
});

test('actual TSX invocations join compiled children without changing names, refs, attribute evaluation, DOM or pixels',async t=>{
  const root=process.cwd(),dir=mkdtempSync(path.join(root,'source-reference/.jsx-invocation-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fixture.tsx'),leaf=path.join(dir,'leaf.mjs'),configFile=path.join(dir,'tsconfig.json');
  const source=`import React from 'react';import {createRoot} from 'react-dom/client';import {Leaf} from './leaf.mjs';
type Props={id:string,label:string};const trace:string[]=[],ref=React.createRef<HTMLButtonElement>();
const read=(key:string,value:any)=>(trace.push(key),value);const spread={get ['data-first'](){trace.push('spread');return 'a';}};
const Root=React.forwardRef<HTMLButtonElement,Props>((props,forwardedRef)=>{const {label,...rest}=props;return <Leaf {...rest} ref={forwardedRef}><span>{label}</span></Leaf>});
function Named({label,...rest}:Props,unused?:any){return <Leaf {...rest}>{label}</Leaf>}
const Unsupported=({label='Default',...rest}:Props)=><Leaf {...rest}>{label}</Leaf>;
function App(props:Record<string,never>){const proxy=new Proxy({id:'proxy',label:'Proxy'},{get(t,k,r){trace.push('proxy:get:'+String(k));return Reflect.get(t,k,r)},getPrototypeOf(t){trace.push('proxy:prototype');return Reflect.getPrototypeOf(t)},ownKeys(t){trace.push('proxy:keys');return Reflect.ownKeys(t)},getOwnPropertyDescriptor(t,k){trace.push('proxy:descriptor:'+String(k));return Reflect.getOwnPropertyDescriptor(t,k)}});const manualRoot=Root.render(proxy,null);return <section><Root {...spread} id={read('id','selected')} label={read('label','Original')} ref={ref}/><Named id="named" label="Named"/><Unsupported id="unsupported" label="Default"/>{Named({id:'manual',label:'Manual'})}{manualRoot}<div>Original &amp;
    preserved {' '} whitespace 💡</div></section>}
window.fixtureTrace=trace;window.fixtureFunctions={rootName:Root.render.name,rootLength:Root.render.length,name:Named.name,length:Named.length};window.fixtureRef=ref;
createRoot(document.getElementById('root')!).render(<App/>);`;
  const leafSource="import React from 'react';import {jsx} from 'react/jsx-runtime';export const Leaf=React.forwardRef((props,ref)=>jsx('button',{...props,ref}));";
  const config='{"compilerOptions":{"target":"ES2022","jsx":"react-jsx"}}';writeFileSync(file,source);writeFileSync(leaf,leafSource);writeFileSync(configFile,config);
  const files:Record<string,string>={[file]:sha(source),[leaf]:sha(leafSource),[configFile]:sha(config)};
  for(const adapter of reactRuntimeAdapters){const f=root+adapter.suffix;files[f]=sha(readFileSync(f,'utf8'));}
  const reference={sourceRoot:dir,files,runtimeImports:[file,leaf].map(importer=>({importer,specifier:'react/jsx-runtime',file:path.join(root,'node_modules/react/jsx-runtime.js')}))};
  const observer=createReactElementCreationObserver(reference),browser=await chromium.launch();t.after(()=>browser.close());const rows=[];
  for(const observed of [false,true]){
    const built=await build({entryPoints:[file],tsconfig:configFile,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:observed?[{name:'observe',setup(b){b.onLoad({filter:/./},async args=>args.path in files?observer.transform(readFileSync(args.path,'utf8'),args.path,args.path===file?'tsx':'js'):undefined);}}]:[]});
    const page=await browser.newPage({viewport:{width:500,height:150}});try{
      await page.setContent('<div id="root"></div>');if(observed){await page.evaluate(reactOwnershipHook);await page.evaluate(observer.hook);await page.evaluate('window.__DSC_REACT_EXPORTS=[]');}
      await page.addScriptTag({content:built.outputFiles[0].text});await page.locator('#manual').waitFor();
      const dom=await page.locator('#root').evaluate(n=>n.innerHTML),png=await page.screenshot(),metadata=await page.evaluate<{trace:string[];functions:unknown;ref:boolean}>('({trace:window.fixtureTrace,functions:window.fixtureFunctions,ref:window.fixtureRef.current===document.getElementById("selected")})');rows.push({dom,png,metadata});if(!observed)continue;
      for(const id of ['selected','named']){
        const ownership=await page.evaluate<ReactOwnership>(reactOwnershipRead('#'+id));assert.deepEqual(ownership.problems,[]);
        const parent=ownership.nodes[0].creationLineage!.parents[0],invocation=parent.invocation!;assert.equal(invocation.status,'observed',id);if(invocation.status!=='observed')throw Error('missing invocation');
        assert.equal(parent.site.transformed?.spanSpace,'generated-javascript');assert(parent.site.transformed?.instrumentedSourceSha256);
        assert.equal(parent.site.originalFunction?.qualification,'original-function-invocation-only');assert.deepEqual(parent.site.originalFunction?.span,invocation.function.span);
        assert.equal(invocation.function.observation,'original-function-invocation-only');assert.equal(invocation.function.sourceSha256,sha(source));assert.equal(invocation.effectsVerified,false);assert.equal(invocation.acceptedContract,null);
        assert.deepEqual(invocation.closureReads,[]);assert.equal(invocation.outputProvenance.status,'verified');
        if(id==='selected')assert.equal(invocation.inputProvenance.status,'verified');
        // The existing props-origin adapter proves the second argument only
        // for forwardRef copies. Recording Named's optional parameter does not
        // silently broaden that separate authority.
        else assert.deepEqual(invocation.inputProvenance,{status:'refused',reason:'react-secondary-origin-unproved'});
        assert(source.slice(invocation.function.span.start,invocation.function.span.end).includes(id==='selected'?'(props,forwardedRef)':'function Named'));
        assert.deepEqual(await page.evaluate(reactOwnershipRead('#'+id)),ownership);
      }
      const manual=await page.evaluate<ReactOwnership>(reactOwnershipRead('#manual')),manualParent=manual.nodes[0].creationLineage!.parents[0];assert.equal(manualParent.invocation?.status,'refused');if(manualParent.invocation?.status==='refused')assert.equal(manualParent.invocation.reason,'element-react-invocation-unproved');
      const unsupported=await page.evaluate<ReactOwnership>(reactOwnershipRead('#unsupported')),unsupportedParent=unsupported.nodes[0].creationLineage!.parents[0];assert.equal(unsupportedParent.site.originalFunction,undefined);assert.equal(unsupportedParent.invocation,undefined);
      const proxy=await page.evaluate<ReactOwnership>(reactOwnershipRead('#proxy')),proxyParent=proxy.nodes[0].creationLineage!.parents[0];assert.equal(proxyParent.invocation?.status,'refused');if(proxyParent.invocation?.status==='refused')assert.equal(proxyParent.invocation.reason,'element-invocation-input-not-data');
      assert.deepEqual(await page.screenshot(),png);
    }finally{await page.close();}
  }
  observer.complete();assert.deepEqual(rows[0],rows[1]);assert.deepEqual(rows[1].metadata.trace.filter(s=>!s.startsWith('proxy:')),['spread','id','label']);assert(!rows[1].metadata.trace.includes('proxy:prototype'));assert.equal(rows[1].metadata.ref,true);
});
