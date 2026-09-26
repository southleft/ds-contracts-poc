import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {modelReactJsxComponent,type CompiledModelInput,type JsxValueShape} from './react-helper-model.mjs';
import {prepareReactEffectProgram,type ReactHelperReference} from './react-helper-effects.js';
import {readReactJsxEffects} from './react-jsx-effects.js';
import {readReactJsxInvocationPlans,readReactOriginalJsxSites} from './react-jsx-invocation.js';
import type {ReactElementCreationSite} from './react-element-creation.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
function fixture(files:Record<string,string>,run:(reference:ReactHelperReference)=>void){
  const root=mkdtempSync(path.join(process.cwd(),'source-reference/.jsx-effects-'));
  try{
    files={'tsconfig.json':'{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}',...files};
    const hashes:Record<string,string>={};for(const [name,text] of Object.entries(files)){const file=path.join(root,name);writeFileSync(file,text);hashes[file]=sha(text);}
    run({sourceRoot:root,files:hashes});
  }finally{rmSync(root,{recursive:true,force:true});}
}
function inputEntries(props:Record<string,unknown>):Array<[string,CompiledModelInput]>{
  return Object.entries(props).map(([key,value])=>[key,value!==null&&['object','function','symbol','bigint'].includes(typeof value)?{opaque:typeof value}:value as CompiledModelInput]);
}
function check(shape:JsxValueShape,value:any,props:Record<string,unknown>,ref:unknown):void{
  if(shape.kind==='opaque'){assert.equal(value,props.children);return;}
  if(shape.kind==='input'){assert.equal(value,props[shape.key]);return;}
  if(shape.kind==='parameter'){assert.equal(shape.index,1);assert.equal(value,ref);return;}
  if(shape.kind==='literal'){assert.equal(typeof value,shape.type);assert.equal(value,shape.type==='undefined'?undefined:shape.value);return;}
  if(shape.kind==='array'){assert.equal(value.length,shape.items.length);shape.items.forEach((item,i)=>check(item,value[i],props,ref));return;}
  if(shape.kind==='record'){assert.deepEqual(Object.keys(value),shape.fields.map(([key])=>key));for(const [key,item] of shape.fields)check(item,value[key],props,ref);return;}
  assert.equal(shape.tag.kind==='fragment'?React.Fragment:shape.tag.kind==='host'?shape.tag.name:undefined,value.type);
  assert.equal(shape.key,value.key);check(shape.props,value.props,props,ref);
}

test('whole original JSX functions model actual absent children, nested elements, helpers, fragments and opaque passthrough against React',()=>{
  const callback=()=>{throw Error('callback must not execute');},child=React.createElement('em',null,'caller'),opaque=new Proxy({},{get(){throw Error('opaque read');}});
  const cases=[
    {body:`const copy=normalize(props);return <button {...copy}><span>{copy.label}</span></button>;`,props:{label:'Authored',onClick:callback}},
    {body:`const {label='Default',...rest}=normalize(props);return <section {...rest}><b>{label}</b><i key={0}/></section>;`,props:{}},
    {body:`const {children,...rest}=normalize(props);return <><button {...rest} ref={ref}>{children}</button><span/></>;`,props:{children:child,onClick:callback}},
    {body:`const tag=props.alternate?'a':'button';const Host=tag;return <Host {...props} ref={ref}/>;`,props:{alternate:false,onClick:callback,payload:opaque}},
    {body:`const value={};return <button title={value.toString===Object.prototype.toString?'same':'different'} data-distinct={Object.keys!==Object.assign}/>;`,props:{}},
    {body:`const flags={first:true,second:false,third:true};var label='';for(var key in flags){if(flags[key])label=label+key;}return <button>{label}</button>;`,props:{}},
    {body:`if(props.hidden)return <span/>;return <button><i/></button>;`,props:{hidden:true}},
  ];
  for(const {body,props} of cases){
    const code=`function normalize(input){return {...input};} export function C(props,ref){${body}}`;
    fixture({'fixture.tsx':code},reference=>{
      const {program,sf,source,runtimeFiles}=prepareReactEffectProgram(reference,'fixture.tsx',{},{});
      const component=sf.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='C') as ts.FunctionDeclaration;
      assert(ts.isIdentifier(component.parameters[0].name));
      const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:inputEntries(props),contentKey:'children',source,runtimeFiles});
      assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
      assert.equal(model.input.kind,'record');if(model.input.kind==='record')assert.equal(model.input.fields.some(([key])=>key==='children'),Object.hasOwn(props,'children'));
      const context={exports:{} as Record<string,Function>,React};
      runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,context);
      const ref={current:null};check(model.output,context.exports.C(props,ref),props,ref);
    });
  }
});

test('whole JSX model refuses input mutation, opaque inspection/calls, ref effects and unbound local getter targets',()=>{
  const cases=[
    [`const a=[];return <button title={a.toString===Object.prototype.toString}/>;`,{},'inherited-property-unmodeled:toString'],
    [`const fn=()=>{};return <button title={fn.toString===Object.prototype.toString}/>;`,{},'inherited-property-unmodeled:toString'],
    [`for(var key in {first:true}){}return <button>{key}</button>;`,{},'loop-var-scope-unmodeled'],
    [`var fn;for(var key in {first:true}){fn=()=>key;}return <button>{fn()}</button>;`,{},'loop-var-scope-unmodeled'],
    [`props.label='changed';return <button/>;`,{},'external-data-write'],
    [`const copied={...props};copied.payload.value=1;return <button/>;`,{payload:{}},'opaque-input-inspected:payload'],
    [`props.onClick();return <button/>;`,{onClick:()=>{}},'call-target-unresolved'],
    [`return <button title={props.payload.value}/>;`,{payload:{}},'opaque-input-inspected:payload'],
    [`ref.current=1;return <button/>;`,{},'opaque-parameter-inspected'],
    [`const UI={get Item(){return 'button';}};return <UI.Item/>;`,{},'nondata-object-member'],
    [`const copy={...props};delete copy.children;return <button>{props.children?'x':'y'}</button>;`,{children:{}},'opaque-content-inspected'],
  ] as const;
  for(const [body,props,reason] of cases)fixture({'fixture.tsx':`export function C(props,ref){${body}}`},reference=>{
    const {program,sf,source}=prepareReactEffectProgram(reference,'fixture.tsx',{},{}),component=sf.statements[0] as ts.FunctionDeclaration;
    assert(ts.isIdentifier(component.parameters[0].name));
    const result=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties:inputEntries(props),contentKey:'children',source});
    assert.equal(result.status,'refused',body);if(result.status==='refused')assert.equal(result.reason,reason,body);
  });
});

/** Synthetic source-model inputs deliberately do not authenticate a real render. */
function assumptions(reference:ReactHelperReference){
  const file=path.join(reference.sourceRoot,'fixture.tsx'),text=readFileSync(file,'utf8'),hash=sha(text),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const plan=readReactJsxInvocationPlans(sf,'fixture.tsx',hash)[0],originalJsx=readReactOriginalJsxSites(sf)[0];
  const site:ReactElementCreationSite={module:'fixture.tsx',sourceSha256:hash,span:{start:0,end:1},factory:'jsx',
    originalFunction:{span:plan.span,plan:0,qualification:'original-function-invocation-only'},originalJsx,
    transformed:{kind:'esbuild-jsx',version:'source-test',loader:'tsx',tsconfigSha256:reference.files[path.join(reference.sourceRoot,'tsconfig.json')],generatedSha256:'unverified',spanSpace:'generated-javascript'}};
  const invocation:ReactElementInvocation={version:1,acceptedContract:null,effectsVerified:false,status:'observed',function:plan,invocation:1,input:[['label',{kind:'string',value:'Source'}]],
    childrenIdentity:'both-absent',secondaryKinds:[],closureReads:[],globalReads:[],effects:[],
    inputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:site},outputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:site}};
  return {site,invocation};
}

test('JSX source reader resolves captured namespace and renamed exports, shares pure helpers and retains runtime obligations',()=>{
  fixture({
    'fixture.tsx':`import {Controls as UI} from './barrel';import {copy} from './helper';export function C(props){const next=copy(props);return <UI.Root {...next}><UI.Item/></UI.Root>;}`,
    'helper.ts':'export function copy(props){return {...props};}',
    'barrel.mjs':`export * as Controls from './targets.mjs';`,
    'targets.mjs':`const element=sideEffect();export {element as Root};export function Item(props){return props;}`,
  },reference=>{
    const p=(name:string)=>path.join(reference.sourceRoot,name);
    reference.runtimeImports=[{importer:p('fixture.tsx'),specifier:'./barrel',file:p('barrel.mjs')},{importer:p('barrel.mjs'),specifier:'./targets.mjs',file:p('targets.mjs')},{importer:p('fixture.tsx'),specifier:'./helper',file:p('helper.ts')}];
    const {site,invocation}=assumptions(reference),model=readReactJsxEffects(reference,site,invocation);
    assert.equal(model.status,'modeled',JSON.stringify(model.status==='refused'?{reason:model.reason,at:model.at}:{}));assert.equal(model.acceptedContract,null);assert.equal(model.runtimeVerified,false);
    assert(model.runtimeRequirements.includes('authenticate-every-imported-JSX-target-value-and-lookup-effects'));
    assert.equal(model.targets.length,2);assert(model.targets.every(t=>t.resolution.status==='resolved'&&!t.resolution.runtimeVerified));
    if(model.status==='modeled'){
      assert.equal(model.output.tag.kind,'source-binding');assert.equal(model.jsxTargets.length,2);
      assert(model.calls.some(c=>c.source.file==='helper.ts'));assert(model.runtimeBindings.bindings.some(b=>b.name==='copy'));
      assert.equal(model.input.kind,'record');if(model.input.kind==='record')assert(!model.input.fields.some(([k])=>k==='children'));
    }
    const duplicate=structuredClone(invocation);if(duplicate.status==='observed')duplicate.input.push(duplicate.input[0]);
    assert.equal(readReactJsxEffects(reference,site,duplicate).status,'refused');
    const changed=structuredClone(site);changed.originalJsx!.span.end--;
    assert.equal(readReactJsxEffects(reference,changed,invocation).status,'refused');
    const missing=readReactJsxEffects({...reference,runtimeImports:[]},site,invocation);assert.equal(missing.status,'refused');
    const stale=structuredClone(invocation);stale.function.span.end--;
    assert.equal(readReactJsxEffects(reference,site,stale).status,'refused');
    writeFileSync(p('targets.mjs'),`export const Root='div',Item='span';`);
    assert.equal(readReactJsxEffects(reference,site,invocation).status,'refused');
  });
});

test('an imported ordinary object member is not a namespace export or a proved getter lookup',()=>{
  fixture({'fixture.tsx':`import {UI} from './target.mjs';export function C(props){return <UI.Root/>;}`,
    'target.mjs':`export const UI={get Root(){throw Error('must not execute');}};`},reference=>{
    reference.runtimeImports=[{importer:path.join(reference.sourceRoot,'fixture.tsx'),specifier:'./target.mjs',file:path.join(reference.sourceRoot,'target.mjs')}];
    const {site,invocation}=assumptions(reference),result=readReactJsxEffects(reference,site,invocation);
    assert.equal(result.status,'refused');if(result.status==='refused')assert.equal(result.reason,'jsx-effects-target-runtime-export-member-not-namespace');
    assert.equal(result.runtimeVerified,false);assert.equal(result.acceptedContract,null);
  });
});
