import {planReactRefHooks} from './react-ref-hooks.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {planReactContextConsumerCalls} from './react-context-calls.js';
import {readReactContextConsumerEffects,modelReactContextConsumerInput,readReactTargetEffects} from './react-target-effects.js';
import type {ReactElementInvocation,ReactElementObservedValue} from './react-element-invocation.js';
import type {ContextConsumerCallAssumption,ContextConsumerValueShape} from './react-helper-model.mjs';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const observe=(v:unknown):ReactElementObservedValue=>v===undefined?{kind:'undefined'}:v===null?{kind:'null',value:null}:
  ['string','number','boolean'].includes(typeof v)?{kind:typeof v,value:v as string|number|boolean}:{kind:typeof v};
function fixture(body:string,run:(f:ReturnType<typeof prepare>)=>void,name='Consumer',moduleBody='var NAME="consumer";',factorySource?:string){
  const root=mkdtempSync(path.join(process.cwd(),'source-reference/.context-consumer-model-'));
  const text=`import * as React from 'react';import {jsx as make} from 'react/jsx-runtime';import {Thing} from 'independent-ui';
${moduleBody}
function readContext(name,scope){globalThis.__calls.push([name,scope]);return globalThis.__context;}
function state(v){return v?'on':'off';}
export const ${name}=React.forwardRef(function Render({scope,...props},ref){${body}});`;
  if(factorySource)writeFileSync(path.join(root,'factories.mjs'),factorySource);
  try{run(prepare(root,text,name));}finally{rmSync(root,{recursive:true,force:true});}
}
function prepare(root:string,text:string,name:string){
  const file=path.join(root,'consumer.mjs');writeFileSync(file,text);
  const factory=path.join(root,'factories.mjs'),reference={sourceRoot:root,files:{[file]:sha(text),...(existsSync(factory)?{[factory]:sha(readFileSync(factory,'utf8'))}:{})},runtimeImports:existsSync(factory)?[{importer:file,specifier:'./factories.mjs',file:factory}]:[]};
  const target=readReactRuntimeExport(reference,'consumer.mjs',[name]);assert.equal(target.status,'resolved');
  const initializer=readReactTargetInitializer(reference,target.definition),plans=planReactContextConsumerCalls(reference,[initializer]);
  const calls=plans.filter(p=>text.slice(p.callee.start,p.callee.end)==='readContext');
  const invocation=(props:Record<string,unknown>):ReactElementInvocation=>({version:1,acceptedContract:null,effectsVerified:false,status:'observed',invocation:1,
    function:{module:'consumer.mjs',sourceSha256:sha(text),span:{start:initializer.render.start,end:initializer.render.end},parameters:[]},
    input:Object.entries(props).map(([key,v])=>[key,observe(v)]),childrenIdentity:'both-absent',secondaryKinds:['object'],closureReads:[],globalReads:[],effects:[],
    inputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:{module:'consumer.mjs',sourceSha256:sha(text),span:{start:0,end:1},factory:'jsx'}},
    outputProvenance:{status:'verified',qualification:'react-props-origin-only',kind:'jsx',source:{module:'consumer.mjs',sourceSha256:sha(text),span:{start:0,end:1},factory:'jsx'}}});
  const assumptions=(values:Record<string,unknown>,args=['consumer',undefined] as unknown[]):ContextConsumerCallAssumption[]=>calls.map(p=>({site:p.call,arguments:args as ContextConsumerCallAssumption['arguments'],value:{id:7,fields:Object.entries(values).map(([key,v])=>[key,v!==null&&['object','function','symbol','bigint'].includes(typeof v)?{opaque:typeof v}:v as string|number|boolean|null|undefined])}}));
  return {root,file,text,name,reference,initializer,calls,invocation,assumptions};
}
function compare(shape:ContextConsumerValueShape,value:any,input:Record<string,unknown>,context:Record<string,unknown>,ref:unknown,target:unknown):void{
  if(shape.kind==='literal'){assert.equal(typeof value,shape.type);assert.equal(value,shape.type==='undefined'?undefined:shape.value);return;}
  if(shape.kind==='context-value'){assert.equal(shape.value,7);assert.equal(value,context);return;}
  if(shape.kind==='context-field'){assert.equal(shape.value,7);assert.equal(value,context[shape.key]);return;}
  if(shape.kind==='opaque'){assert.equal(value,input.children);return;}
  if(shape.kind==='input'){assert.equal(value,input[shape.key]);return;}
  if(shape.kind==='parameter'){assert.equal(shape.index,1);assert.equal(value,ref);return;}
  if(shape.kind==='ref-reference'){assert.equal(typeof value,'object');return;}
  if(shape.kind==='callback-reference'){assert.equal(typeof value,'function');return;}
  if(shape.kind==='callback'){assert.equal(typeof value,'function');return;}
  if(shape.kind==='record'){assert.deepEqual(Object.keys(value),shape.fields.map(([key])=>key));for(const [key,item] of shape.fields)compare(item,value[key],input,context,ref,target);return;}
  if(shape.kind==='array'){assert.equal(value.length,shape.items.length);shape.items.forEach((s,i)=>compare(s,value[i],input,context,ref,target));return;}
  assert.equal(shape.kind,'jsx');if(shape.kind!=='jsx')throw Error('fixture expected JSX');
  assert.equal(value.type,shape.tag.kind==='host'?shape.tag.name:target);assert.equal(value.key,shape.key);compare(shape.props,value.props,input,context,ref,target);
}

test('conditional context consumers match original outputs with explicit opaque identities and imported target obligations',()=>{
  for(const name of ['Consumer','IndependentIndicator'])for(const checked of [false,true])fixture(`const value=readContext(NAME,scope);
    return make(Thing.span,{'data-state':state(value.checked),'data-disabled':value.disabled?'':undefined,change:value.change,payload:value.payload,whole:value,...props,ref});`,f=>{
    let opaqueReads=0,targetReads=0;
    const context={checked,disabled:checked,change:()=>{},payload:new Proxy({}, {get(){opaqueReads++;throw Error('opaque inspected');}})},input={id:'a',scope:undefined},ref={current:null};
    const assumptions=f.assumptions(context),invocation=f.invocation(input),before=JSON.stringify(assumptions);
    const model=readReactContextConsumerEffects(f.reference,f.initializer,invocation,assumptions);
    assert(invocation.status==='observed');assert.deepEqual(modelReactContextConsumerInput(f.reference,f.initializer,invocation.input,assumptions),model);
    assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
    assert.equal(model.qualification,'context-consumer-projection-model-only');assert.equal(model.runtimeVerified,false);assert.equal(model.effectsVerified,false);assert.equal(model.acceptedContract,null);
    assert.equal(model.contextCalls.length,1);assert.equal(model.targetReads.length,1);assert.equal(model.mutableBindings.length,1);
    assert.equal(model.contextFunctionCalls.length,1);const sourceCall=model.contextFunctionCalls[0];
    assert.equal(f.text.slice(sourceCall.site.start,sourceCall.site.end),'state(value.checked)');
    assert.equal(f.text.slice(sourceCall.source.start,sourceCall.source.end),"function state(v){return v?'on':'off';}");
    assert.deepEqual(sourceCall.arguments,[{kind:'literal',type:'boolean',value:checked}]);
    assert.deepEqual(sourceCall.output,{kind:'literal',type:'string',value:checked?'on':'off'});
    assert.equal(model.contextValues.length,1);assert.equal(model.contextValues[0].id,7);
    assert.deepEqual(new Map(model.contextValues[0].fields).get('payload'),{kind:'context-field',value:7,key:'payload'});
    assert.equal(f.text.slice(model.mutableBindings[0].binding.start,model.mutableBindings[0].binding.end),'NAME="consumer"');
    assert.equal(model.runtimeBindings.bindings.find(b=>b.name==='NAME')?.reads.length,1);
    assert.equal(model.output.tag.kind,'source-read');assert.equal(opaqueReads,0);assert.equal(targetReads,0);
    const actualTarget=()=>{},calls:unknown[]=[];
    const Thing={get span(){targetReads++;return actualTarget;}};
    const require=createRequire(import.meta.url),env={exports:{} as Record<string,any>,require:(id:string)=>id==='independent-ui'?{Thing}:require(id),__context:context,__calls:calls};
    runInNewContext(ts.transpileModule(f.text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,env);
    const result=env.exports[name].render(input,ref);compare(model.output,result,input,context,ref,actualTarget);
    assert.equal(calls.length,1);assert.equal(targetReads,1);assert.equal(opaqueReads,0);assert.equal(JSON.stringify(assumptions),before);
    // The established runtime projection path has not been silently expanded.
    assert.equal(readReactTargetEffects(f.reference,f.initializer,invocation).status,'refused');
  },name);
});

test('context arguments are modeled in order and never replaced by recorded values',()=>{
  fixture(`let n=0;const c=readContext(n++,scope);return make('span',{n,checked:c.checked});`,f=>{
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({checked:true},[0,undefined]));
    assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status==='modeled')assert.deepEqual(new Map(model.output.props.fields).get('n'),{kind:'literal',type:'number',value:1});
    const wrong=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({checked:true},[1,undefined]));
    assert.equal(wrong.status,'refused');if(wrong.status==='refused')assert.equal(wrong.reason,'context-model-arguments-mismatch');
  });
  fixture(`const c=readContext(unknownEffect(),scope);return make('span',{checked:c.checked});`,f=>{
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({checked:true}));assert.equal(model.status,'refused');if(model.status==='refused')assert.match(model.reason,/unknownEffect/);
  });
});

test('opaque context fields refuse inspection, calls, coercion and mutation',()=>{
  for(const expr of ['c.payload.x','!!c.payload','typeof c.payload','c.change()','c.payload===null','`${c.payload}`','(c.checked=false)','(delete c.checked)'])fixture(`const c=readContext(NAME,scope);return make('span',{value:${expr}});`,f=>{
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({checked:true,payload:{},change:()=>{}}));
    assert.equal(model.status,'refused',expr);if(model.status==='refused')assert.match(model.reason,/opaque-context-field-inspected|call-target-unresolved|external-data-write/);
  });
});

test('context call sequences, source pins and value continuity are explicit preconditions',()=>{
  fixture(`const a=readContext(NAME,scope);const b=readContext(NAME,scope);return make('span',{a:a.checked,b:b.checked});`,f=>{
    const input=f.invocation({}),calls=f.assumptions({checked:true});
    assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,input,calls).status,'modeled');
    for(const changed of [[...calls].reverse(),calls.slice(0,1),[...calls,calls[0]],calls.map((c,i)=>i?{...c,value:{id:7,fields:[['checked',false]] as Array<readonly [string,boolean]>}}:c)]){
      assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,input,changed).status,'refused');
    }
    const distinct=calls.map((c,i)=>i?{...c,value:{id:8,fields:[['checked',false]] as Array<readonly [string,boolean]>}}:c);
    assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,input,distinct).status,'modeled');
    writeFileSync(f.file,f.text+'\n// source changed');assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,input,calls).status,'refused');
  });
  fixture(`const c=readContext(readContext(NAME,scope).checked,scope);return make('span',{checked:c.checked});`,f=>{
    const calls=f.assumptions({checked:true});calls[0].arguments=[true,undefined];
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),calls);
    assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status==='modeled')assert.deepEqual(model.contextCalls.map(c=>c.site),calls.map(c=>c.site));
  });
});

test('void evaluates its operand and discards only the resulting value',()=>{
  fixture(`let n=0;const c=readContext(NAME,scope);const discarded=void n++;return make('span',{n,discarded,opaque:void c.payload});`,f=>{
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({payload:{}}));
    assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
    const props=new Map(model.output.props.fields);assert.deepEqual(props.get('n'),{kind:'literal',type:'number',value:1});
    assert.deepEqual(props.get('discarded'),{kind:'literal',type:'undefined'});assert.deepEqual(props.get('opaque'),{kind:'literal',type:'undefined'});
  });
  fixture(`const c=readContext(NAME,scope);return make('span',{value:void unknownEffect(c)});`,f=>{
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({checked:true}));
    assert.equal(model.status,'refused');if(model.status==='refused')assert.match(model.reason,/unknownEffect/);
  });
});

test('unmodeled context assumptions and computed imported lookups stay refused',()=>{
  fixture(`const c=readContext(NAME,scope);return make('span',{checked:c.checked});`,f=>{
    const input=f.invocation({}),calls=f.assumptions({checked:true});
    const malformed=[{...calls[0],site:{...calls[0].site,start:calls[0].site.start+1}},
      {...calls[0],arguments:[{opaque:'object'},undefined]},
      {...calls[0],value:{id:7,fields:[['checked',NaN]]}},
      {...calls[0],value:{id:7,fields:[['checked',true],['checked',false]]}}];
    for(const item of malformed)assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,input,[item as ContextConsumerCallAssumption]).status,'refused');
  });
  fixture(`const c=readContext(NAME,scope);return make(Thing[unknownEffect()],{checked:c.checked});`,f=>{
    assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({checked:true})).status,'refused');
  });
});

test('callback summaries evaluate original arguments, retain selected origins and refuse deferred inspection',()=>{
  const moduleBody='var NAME="consumer";function remember(...refs){return node=>refs;}';
  const body=`const c=readContext(NAME,scope);const joined=remember(ref,c.change,props.payload);return make('button',{ref:joined});`;
  fixture(body,f=>{
    const plans=planReactContextConsumerCalls(f.reference,[f.initializer]),site=plans.find(p=>f.text.slice(p.callee.start,p.callee.end)==='remember')!.call;
    const tree=ts.createSourceFile(f.file,f.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let callback:ts.ArrowFunction|undefined;
    const scan=(n:ts.Node)=>{if(ts.isArrowFunction(n))callback=n;ts.forEachChild(n,scan);};scan(tree);assert(callback);
    const source={file:'consumer.mjs',sha256:sha(f.text),start:callback.getStart(tree),end:callback.end};
    const assumption={site,call:9,contextCallsBefore:1,origin:2,source};
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({payload:{}}),f.assumptions({change:()=>{}}),[assumption]);
    assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
    assert.deepEqual(model.callbackCalls,[{...assumption,arguments:[{kind:'parameter',index:1},{kind:'context-field',value:7,key:'change'},{kind:'input',key:'payload'}]}]);
    assert.deepEqual(model.output.props.fields,[['ref',{kind:'callback-reference',origin:2,source,qualification:'callback-body-unverified'}]]);
    assert.equal(model.effectsVerified,false);assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
    for(const bad of [[{...assumption,contextCallsBefore:0}],[assumption,{...assumption,call:10}],[{...assumption,source:{...source,start:0}}]]){
      const refused=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({payload:{}}),f.assumptions({change:()=>{}}),bad);assert.equal(refused.status,'refused');
    }
  },'Consumer',moduleBody);
  for(const expression of ['joined.current','joined()','!!joined','typeof joined','joined===null','`${joined}`','(joined.current=null)','(delete joined.current)'])fixture(`const c=readContext(NAME,scope);const joined=remember(ref,c.change);return make('button',{value:${expression}});`,f=>{
    const site=planReactContextConsumerCalls(f.reference,[f.initializer]).find(p=>f.text.slice(p.callee.start,p.callee.end)==='remember')!.call;
    const start=f.text.indexOf('node=>refs'),source={file:'consumer.mjs',sha256:sha(f.text),start,end:start+'node=>refs'.length};
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({change:()=>{}}),[{site,call:9,contextCallsBefore:1,origin:2,source}]);
    assert.equal(model.status,'refused',expression);assert.equal(model.callbackCalls?.length,1,expression);
  },'Consumer',moduleBody);
  for(const arg of ['unknownEffect()','c.change()','c.change.current','state(true)'])fixture(`const c=readContext(NAME,scope);const joined=remember(ref,${arg});return make('button',{ref:joined});`,f=>{
    const site=planReactContextConsumerCalls(f.reference,[f.initializer]).find(p=>f.text.slice(p.callee.start,p.callee.end)==='remember')!.call;
    const start=f.text.indexOf('node=>refs'),source={file:'consumer.mjs',sha256:sha(f.text),start,end:start+'node=>refs'.length};
    const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({change:()=>{}}),[{site,call:9,contextCallsBefore:1,origin:2,source}]);
    assert.equal(model.status,'refused',arg);assert.equal(model.callbackCalls?.length??0,0,arg);
  },'Consumer',moduleBody);
});

test('native ref assumptions preserve opaque identity and original arguments, leaving ref reads and writes deferred',()=>{
 const body=`const c=readContext(NAME,scope);const held=React.useRef(c.payload);return make('span',{held});`;
 fixture(body,f=>{
  const plans=planReactRefHooks(f.reference,[f.initializer]);assert.equal(plans.length,1);
  const assumption={site:plans[0].call,call:2,state:4,consumerCallsBefore:1};
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({payload:{}}),[],[assumption]);
  assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
  assert.deepEqual(model.refCalls,[{...assumption,argument:{kind:'context-field',value:7,key:'payload'}}]);
  assert.deepEqual(model.output.props.fields,[['held',{kind:'ref-reference',state:4,call:2}]]);assert.equal(model.runtimeVerified,false);assert.equal(model.effectsVerified,false);
  for(const calls of [[{...assumption,consumerCallsBefore:0}],[assumption,{...assumption,call:3}],[{...assumption,site:{...assumption.site,start:0}}]])assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({payload:{}}),[],calls).status,'refused');
 });
 for(const expr of ['held.current','held.current=1','delete held.current','held()','!!held','typeof held','held===null'])fixture(`const c=readContext(NAME,scope);const held=React.useRef(c.payload);return make('span',{value:(${expr})});`,f=>{
  const plan=planReactRefHooks(f.reference,[f.initializer])[0];
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({payload:{}}),[],[{site:plan.call,call:2,state:4,consumerCallsBefore:1}]);
  assert.equal(model.status,'refused',expr);assert.equal(model.refCalls?.length,1,expr);
 });
 for(const arg of ['eval("1")','unknownEffect()','state(true)','React.useRef(1)'])fixture(`const c=readContext(NAME,scope);const held=React.useRef(${arg});return make('span',{held});`,f=>{
  const plans=planReactRefHooks(f.reference,[f.initializer]);if(arg.startsWith('eval')){assert.equal(plans.length,0);return;}
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({}),[],plans.map((p,i)=>({site:p.call,call:i,state:i,consumerCallsBefore:1})));
  assert.equal(model.status,'refused',arg);
 });
});

test('effect assumptions retain original dependency provenance while callback bodies and binding cells stay deferred',async()=>{
 const {planReactEffectHooks}=await import('./react-effect-hooks.js');
 fixture(`const c=readContext(NAME,scope);let captured=c.checked;React.useEffect(()=>unknownEffect(captured),[c.checked,props.payload,ref]);captured=!captured;return make('span',{checked:captured});`,f=>{
  const plans=planReactEffectHooks(f.reference,[f.initializer]);assert.equal(plans.length,1);
  const assumption={site:plans[0].call,callback:plans[0].callback,call:4,effect:8,consumerCallsBefore:1,refCallsBefore:0};
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({payload:{}}),f.assumptions({checked:true}),[],[],[assumption]);
  assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
  assert.deepEqual(model.effectCalls,[{...assumption,dependencies:[{kind:'literal',type:'boolean',value:true},{kind:'input',key:'payload'},{kind:'parameter',index:1}]}]);
  assert.equal(model.effectsVerified,false);assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
  for(const altered of [{...assumption,consumerCallsBefore:0},{...assumption,refCallsBefore:1},{...assumption,callback:{...assumption.callback,start:0}}])assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({payload:{}}),f.assumptions({checked:true}),[],[],[altered]).status,'refused');
 });
 for(const arg of ['unknownEffect()','c.payload.current','state(true)','React.useEffect(()=>{},[])'])fixture(`const c=readContext(NAME,scope);React.useEffect(()=>{},[${arg}]);return make('span',{});`,f=>{
  const plans=planReactEffectHooks(f.reference,[f.initializer]);assert(plans.length>0);
  const assumptions=plans.map((p,i)=>({site:p.call,callback:p.callback,call:i,effect:i,consumerCallsBefore:1,refCallsBefore:0}));
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({}),f.assumptions({payload:{}}),[],[],assumptions);assert.equal(model.status,'refused',arg);assert.equal(model.effectCalls?.length??0,0,arg);
 });
 for(const call of ['React.useEffect(callback,[])','React.useEffect(()=>{},deps)','React.useEffect(()=>{},[...deps])','React.useEffect(()=>{},[,])','React.useEffect(()=>eval("1"),[])'])fixture(`const c=readContext(NAME,scope);${call};return make('span',{});`,f=>{assert.equal(planReactEffectHooks(f.reference,[f.initializer]).length,0,call);});
});

test('ordinary callback factories model arguments without freezing callback binding cells or permitting deferred inspection',async()=>{
 const {planReactCallbackFactories}=await import('./react-callback-factories.js');
 const factory=`export function compose(first,second,{guard=true}={}){return function run(event){first?.(event);if(!guard||!event.defaultPrevented)return second?.(event);};}`;
 const moduleBody=`import {compose} from './factories.mjs';var NAME='consumer';`;
 fixture(`const c=readContext(NAME,scope);let late=c.checked;const handler=compose(props.handler,()=>{late=!late;}, {guard:false});late=!late;return make('button',{onClick:handler,checked:late});`,f=>{
  const plans=planReactCallbackFactories(f.reference,planReactContextConsumerCalls(f.reference,[f.initializer]));assert.equal(plans.functions.length,1);assert.equal(plans.literals.length,2);
  const assumption={site:plans.consumers[0].call,call:5,origin:3,source:plans.functions[0].callback,consumerCallsBefore:1};
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({handler:()=>{}}),f.assumptions({checked:true}),[],[],[],[assumption]);assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
  const options=model.factoryCalls[0].arguments[2];assert(options.kind==='record'&&options.allocation);assert.deepEqual(options.allocation.source,plans.literals[1].source);
  assert.deepEqual(model.factoryCalls[0].arguments.map(v=>v.kind==='record'?{kind:v.kind,fields:v.fields}:v),[{kind:'input',key:'handler'},{kind:'deferred-literal',source:plans.literals[0].source,qualification:'body-and-captures-unverified'},{kind:'record',fields:[['guard',{kind:'literal',type:'boolean',value:false}]]}]);
  assert.deepEqual(model.output.props.fields,[['onClick',{kind:'factory-reference',origin:3,source:assumption.source,qualification:'body-and-captures-unverified'}],['checked',{kind:'literal',type:'boolean',value:false}]]);assert.equal(model.effectsVerified,false);assert.equal(model.runtimeVerified,false);
  for(const wrong of [{...assumption,consumerCallsBefore:0},{...assumption,source:{...assumption.source,start:0}}])assert.equal(readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({handler:()=>{}}),f.assumptions({checked:true}),[],[],[],[wrong]).status,'refused');
 },'Consumer',moduleBody,factory);
 for(const value of ['handler()','handler.name','typeof handler','!!handler','handler===null','handler.current=1'])fixture(`const c=readContext(NAME,scope);const handler=compose(props.handler,()=>{});return make('span',{value:(${value})});`,f=>{
  const plans=planReactCallbackFactories(f.reference,planReactContextConsumerCalls(f.reference,[f.initializer])),assumption={site:plans.consumers[0].call,call:1,origin:0,source:plans.functions[0].callback,consumerCallsBefore:1};
  const model=readReactContextConsumerEffects(f.reference,f.initializer,f.invocation({handler:()=>{}}),f.assumptions({}),[],[],[],[assumption]);assert.equal(model.status,'refused',value);assert.equal(model.factoryCalls?.length,1,value);
 },'Consumer',moduleBody,factory);
 for(const body of [
  `export function compose(a,b,options=sideEffect()){return ()=>{};}`,
  `export function compose(a,b,{guard=sideEffect()}={}){return ()=>{};}`,
  `export function compose(a,b,{[sideEffect()]:guard}={}){return ()=>{};}`,
  `export function compose(a,b){sideEffect();return ()=>{};}`,
  `export function compose(a,b){return ()=>eval('1');}`,
  `export function compose(a,b){return unknownName(()=>{},'callback');}`,
 ])fixture(`const c=readContext(NAME,scope);const handler=compose(props.handler,()=>{});return make('span',{handler});`,f=>{assert.equal(planReactCallbackFactories(f.reference,planReactContextConsumerCalls(f.reference,[f.initializer])).functions.length,0,body);},'Consumer',moduleBody,body);
});

test('object literal spreads skip nullish sources while opaque spreads and own-key intrinsics retain refusals',()=>{
 for(const optional of [null,undefined])fixture('const value=readContext(NAME,scope);const style={before:1,...props.style,...value.optional,after:2};return make("span",{style});',f=>{
  const model=modelReactContextConsumerInput(f.reference,f.initializer,[['style',observe(optional)]],f.assumptions({optional}));assert.equal(model.status,'modeled',JSON.stringify(model));if(model.status!=='modeled')return;
  const style=model.output.props.fields.find(([k])=>k==='style')![1];assert.equal(style.kind,'record');if(style.kind!=='record')return;
  assert(style.allocation);assert.deepEqual(style.fields,[['before',{kind:'literal',type:'number',value:1}],['after',{kind:'literal',type:'number',value:2}]]);
  assert.deepEqual({...optional as any},{ });
 });
 for(const expression of ['({...value.optional})','Object.keys(value.optional)'])fixture(`const value=readContext(NAME,scope);const result=${expression};return make("span",{result});`,f=>{
  const model=modelReactContextConsumerInput(f.reference,f.initializer,[],f.assumptions({optional:{}}));assert.equal(model.status,'refused');
 });
 fixture('const value=readContext(NAME,scope);const result=Object.keys(value.optional);return make("span",{result});',f=>{
  for(const optional of [undefined,null]){const model=modelReactContextConsumerInput(f.reference,f.initializer,[],f.assumptions({optional}));assert.equal(model.status,'refused');}
 });
});
