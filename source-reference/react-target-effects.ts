import {planReactHookHelpers} from './react-hook-helpers.js';
import {planReactCallbackFactories} from './react-callback-factories.js';
import {planReactEffectHooks} from './react-effect-hooks.js';
import {planReactRefHooks} from './react-ref-hooks.js';
import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import {readReactTargetInitializer,type ReactTargetInitializer} from './react-target-initializer.js';
import type {ReactElementInvocation,ReactElementObservedValue} from './react-element-invocation.js';
import {readReactElementClosures} from './react-element-closure.js';
import {planReactContextConsumerCalls,planReactContextHelpers,readReactContextCalls,type ReactContextHelper} from './react-context-calls.js';
import {modelReactTargetRender,modelReactContextConsumer,modelReactContextHelper,type ContextHelperModelResult,type ContextHelperModelInput,type ContextHelperNativeCall,type ContextConsumerCallAssumption,type ContextConsumerCallbackAssumption,type ContextConsumerRefAssumption,type ContextConsumerEffectAssumption,type ContextConsumerFactoryAssumption,type ContextConsumerHookAssumption,type ContextConsumerModelResult,type CompiledModelInput,type HelperSourcePoint,type TargetModelResult,type TargetValueShape} from './react-helper-model.mjs';

export type ReactTargetEffects = {
  version:1;acceptedContract:null;effectsVerified:false;runtimeVerified:false;
  qualification:'target-render-projection-model-only';
  render:HelperSourcePoint;sourceFiles:Record<string,string>;
  runtimeRequirements:readonly string[];
} & TargetModelResult;
export type ReactContextConsumerEffects = {
  version:1;acceptedContract:null;effectsVerified:false;runtimeVerified:false;
  qualification:'context-consumer-projection-model-only';
  render:HelperSourcePoint;sourceFiles:Record<string,string>;runtimeRequirements:readonly string[];
} & ContextConsumerModelResult;

/** Conditional original-source projection. Inputs and the selected context call
 * sequence are assumptions, even when copied from guarded receipts. This API
 * does not establish that they belonged to the same render invocation. */
export function readReactContextConsumerEffects(reference:ReactHelperReference,initializer:ReactTargetInitializer,invocation:ReactElementInvocation,contextCalls:ContextConsumerCallAssumption[],callbackCalls:ContextConsumerCallbackAssumption[]=[],refCalls:ContextConsumerRefAssumption[]=[],effectCalls:ContextConsumerEffectAssumption[]=[],factoryCalls:ContextConsumerFactoryAssumption[]=[],hookCalls:ContextConsumerHookAssumption[]=[]):ReactContextConsumerEffects {
  return readProjection(reference,initializer,{invocation,contextCalls,callbackCalls,refCalls,effectCalls,factoryCalls,hookCalls});
}
/** Rebuild a source-only consumer model from a separately guarded input record.
 * The caller must retain the render/context/return linkage; never manufacture
 * a final-tree ReactElementInvocation for a transient render. */
export function modelReactContextConsumerInput(reference:ReactHelperReference,initializer:ReactTargetInitializer,input:ReadonlyArray<readonly [string,ReactElementObservedValue]>,contextCalls:ContextConsumerCallAssumption[],callbackCalls:ContextConsumerCallbackAssumption[]=[],refCalls:ContextConsumerRefAssumption[]=[],effectCalls:ContextConsumerEffectAssumption[]=[],factoryCalls:ContextConsumerFactoryAssumption[]=[],hookCalls:ContextConsumerHookAssumption[]=[]):ReactContextConsumerEffects {
  return readProjection(reference,initializer,{observedInput:input,contextCalls,callbackCalls,refCalls,effectCalls,factoryCalls,hookCalls});
}

/** Derive a dependency's returned projection from its current executable AST.
 * Recorded props are assumptions. In particular, a callback's source and local
 * captures do not establish its runtime identity, body effects or dependencies. */
export function readReactTargetEffects(reference:ReactHelperReference,initializer:ReactTargetInitializer,invocation?:ReactElementInvocation):ReactTargetEffects {
  return readProjection(reference,initializer,{invocation});
}
/** Rebuild a source model from its input assumptions without fabricating an
 * observed invocation. Runtime guards must independently match these inputs. */
export function replanReactTargetEffects(reference:ReactHelperReference,initializer:ReactTargetInitializer,input:TargetValueShape):ReactTargetEffects {
  return readProjection(reference,initializer,{input});
}
/** Source-only deferred projection. The root model is rebuilt independently;
 * recorded callback arguments are assumptions, never hook/context evidence. */
export function replanReactTargetCallback(reference:ReactHelperReference,initializer:ReactTargetInitializer,root:ReactTargetEffects,callback:HelperSourcePoint,input:ReadonlyArray<readonly [string,ReactElementObservedValue]>):ReactTargetEffects {
  if(root.status!=='modeled'||JSON.stringify(replanReactTargetEffects(reference,initializer,root.input))!==JSON.stringify(root))
    return {version:1,acceptedContract:null,effectsVerified:false,runtimeVerified:false,qualification:'target-render-projection-model-only',render:initializer.render,sourceFiles:{},runtimeRequirements:[],status:'refused',reason:'target-callback-root-model-changed',steps:0};
  return readProjection(reference,initializer,{input:root.input,deferred:{source:callback,input}});
}
type ProjectionContext={invocation?:ReactElementInvocation;input?:TargetValueShape;observedInput?:ReadonlyArray<readonly [string,ReactElementObservedValue]>;deferred?:{source:HelperSourcePoint;input:ReadonlyArray<readonly [string,ReactElementObservedValue]>}};
function readProjection(reference:ReactHelperReference,initializer:ReactTargetInitializer,context:ProjectionContext & {contextCalls:ContextConsumerCallAssumption[];callbackCalls?:ContextConsumerCallbackAssumption[];refCalls?:ContextConsumerRefAssumption[];effectCalls?:ContextConsumerEffectAssumption[];factoryCalls?:ContextConsumerFactoryAssumption[];hookCalls?:ContextConsumerHookAssumption[]}):ReactContextConsumerEffects;
function readProjection(reference:ReactHelperReference,initializer:ReactTargetInitializer,context:ProjectionContext):ReactTargetEffects;
function readProjection(reference:ReactHelperReference,initializer:ReactTargetInitializer,context:ProjectionContext & {contextCalls?:ContextConsumerCallAssumption[];callbackCalls?:ContextConsumerCallbackAssumption[];refCalls?:ContextConsumerRefAssumption[];effectCalls?:ContextConsumerEffectAssumption[];factoryCalls?:ContextConsumerFactoryAssumption[];hookCalls?:ContextConsumerHookAssumption[]}):ReactTargetEffects|ReactContextConsumerEffects {
  const {invocation}=context;
  const sourceFiles:Record<string,string>={},common={version:1 as const,acceptedContract:null,effectsVerified:false as const,runtimeVerified:false as const,
    qualification:context.contextCalls?'context-consumer-projection-model-only' as const:'target-render-projection-model-only' as const,render:initializer.render,sourceFiles,
    runtimeRequirements:[
      'same-guarded-invocation-input-and-return-values',
      'registered-pinned-factory-and-exact-returned-component-binding',
      'actual-callback-creation-identity-and-captured-local-values',
      'deferred-callback-body-and-module-dependency-effects',
      'enclosing-provider-context-state-ref-and-event-semantics',
      ...(context.contextCalls?[
        'same-render-input-context-call-order-and-return-values',
        'original-context-helper-callee-closure-and-argument-effects',
        'callback-helper-creation-callee-argument-and-selected-origin-linkage',
        'context-object-field-origin-and-continuity',
        'mutable-module-binding-same-value-at-every-read',
        'imported-target-read-identity-and-lookup-effects',
      ]:[]),
    ]};
  try{
    if(JSON.stringify(readReactTargetInitializer(reference,initializer.target))!==JSON.stringify(initializer))throw Error('target-effects-initializer-changed');
    if(!context.input&&!context.observedInput&&(invocation?.status!=='observed'||invocation.function.module!==initializer.render.file||invocation.function.sourceSha256!==initializer.render.sha256||
      invocation.function.span.start!==initializer.render.start||invocation.function.span.end!==initializer.render.end||
      invocation.inputProvenance.status!=='verified'||invocation.outputProvenance.status!=='verified'))throw Error('target-effects-invocation-unavailable');
    const file=realpathSync(path.resolve(reference.sourceRoot,initializer.render.file)),text=readFileSync(file,'utf8');
    const hash=createHash('sha256').update(text).digest('hex');sourceFiles[file]=hash;
    if(hash!==initializer.render.sha256||reference.files[file]!==hash)throw Error('target-effects-source-changed');
    const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS;
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,kind);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host),checker=program.getTypeChecker();
    const point=(node:ts.Node):HelperSourcePoint=>({file:initializer.render.file,sha256:hash,start:node.getStart(sf),end:node.end});
    const key=(node:ts.Node)=>JSON.stringify([node.getStart(sf),node.end]),nodes=new Map<string,ts.Node>();
    const scan=(node:ts.Node)=>{nodes.set(key(node),node);ts.forEachChild(node,scan);};scan(sf);
    const component=nodes.get(JSON.stringify([initializer.render.start,initializer.render.end]));
    if(!component||!(ts.isFunctionExpression(component)||ts.isArrowFunction(component))||!component.parameters[0]||!(ts.isIdentifier(component.parameters[0].name)||ts.isObjectBindingPattern(component.parameters[0].name)))throw Error('target-effects-render-unmodeled');
    // The lexical inventory owns a separate checker/AST. Never rebind symbols
    // on the AST used by the abstract evaluator.
    const planning=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,kind),closures=readReactElementClosures(planning),planned=new Map<string,ts.FunctionExpression|ts.ArrowFunction>();
    const find=(node:ts.Node)=>{if(ts.isArrowFunction(node)||ts.isFunctionExpression(node))planned.set(key(node),node);ts.forEachChild(node,find);};find(planning);
    const decode=(v:ReactElementObservedValue):CompiledModelInput=>{
      if(v.representation)throw Error('target-effects-value-unmodeled');
      if(v.kind==='undefined'&&!('value' in v))return undefined;
      if(v.kind==='null'&&v.value===null)return null;
      if(v.kind==='number'&&typeof v.value==='number'&&Number.isFinite(v.value)&&!Object.is(v.value,-0))return v.value;
      if((v.kind==='boolean'||v.kind==='string')&&typeof v.value===v.kind)return v.value as string|boolean;
      if(['object','function','symbol','bigint'].includes(v.kind)&&!('value' in v))return {opaque:v.kind};
      throw Error('target-effects-value-unmodeled');
    };
    const names=new Set<string>();let properties:Array<readonly [string,CompiledModelInput]>;
    const unique=(name:string)=>{if(typeof name!=='string'||name==='__proto__'||names.has(name))throw Error('target-effects-input-ambiguous');names.add(name);};
    if(context.input){
      if(context.input.kind!=='record'||context.input.fields.length>10000)throw Error('target-effects-input-unmodeled');
      properties=context.input.fields.map(([name,value])=>{
        unique(name);
        if(value.kind==='opaque'&&name==='children'||value.kind==='input'&&value.key===name)return [name,{opaque:'object'}] as const;
        if(value.kind!=='literal')throw Error('target-effects-input-unmodeled');
        const actual=value.type==='undefined'?undefined:value.value;
        if(typeof actual!==value.type||actual!==null&&!['string','number','boolean','undefined'].includes(typeof actual)||typeof actual==='number'&&(!Number.isFinite(actual)||Object.is(actual,-0)))throw Error('target-effects-input-unmodeled');
        return [name,actual] as const;
      });
    }else{
      const fields=context.observedInput??(invocation?.status==='observed'?invocation.input:undefined);
      if(!fields||fields.length>10000)throw Error('target-effects-input-limit');
      properties=fields.map(([name,v])=>{unique(name);return [name,decode(v)] as const;});
    }
    const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isNonNullExpression(n)?unwrap(n.expression):n;
    const imported=(node:ts.Expression)=>{
      node=unwrap(node);if(!ts.isIdentifier(node))return;
      const declarations=checker.getSymbolAtLocation(node)?.declarations;
      if(declarations?.length!==1||!ts.isImportSpecifier(declarations[0])||declarations[0].isTypeOnly)return;
      const d=declarations[0],clause=d.parent.parent,imp=clause.parent;
      if(clause.isTypeOnly||!ts.isStringLiteral(imp.moduleSpecifier)||imp.moduleSpecifier.text!=='react/jsx-runtime')return;
      return (d.propertyName??d.name).text;
    };
    let deferred:Parameters<typeof modelReactTargetRender>[0]['deferred'];
    if(context.deferred){
      if(context.deferred.input.length>10000)throw Error('target-callback-input-limit');
      names.clear();deferred={source:context.deferred.source,properties:context.deferred.input.map(([name,value])=>{unique(name);return [name,decode(value)] as const;})};
    }
    if(context.contextCalls){
      if(context.contextCalls.length>10000)throw Error('context-model-call-limit');
      const plans=planReactContextConsumerCalls(reference,[initializer]);
      const same=(a:HelperSourcePoint,b:HelperSourcePoint)=>a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;
      const primitive=(v:unknown)=>v===null||['string','boolean','undefined'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0);
      if((context.callbackCalls?.length??0)>10000)throw Error('callback-model-call-limit');
      const callbackIds=new Set<number>();
      for(const call of context.callbackCalls??[]){
        if(!plans.some(p=>same(p.call,call.site))||context.contextCalls.some(c=>same(c.site,call.site))||
          ![call.call,call.origin,call.contextCallsBefore].every(v=>Number.isSafeInteger(v)&&v>=0)||callbackIds.has(call.call)||
          call.contextCallsBefore>context.contextCalls.length)throw Error('callback-model-call-assumption-unmodeled');
        callbackIds.add(call.call);
        const sourceFile=path.resolve(reference.sourceRoot,call.source.file),expected=reference.files[sourceFile];
        if(!expected||expected!==call.source.sha256||realpathSync(sourceFile)!==sourceFile)throw Error('callback-model-source-unavailable');
        const sourceText=readFileSync(sourceFile,'utf8');sourceFiles[sourceFile]=createHash('sha256').update(sourceText).digest('hex');
        if(sourceFiles[sourceFile]!==expected)throw Error('callback-model-source-changed');
        const callbackTree=ts.createSourceFile(sourceFile,sourceText,ts.ScriptTarget.Latest,true,sourceFile.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
        let found=false;const scanCallback=(n:ts.Node)=>{if((ts.isArrowFunction(n)||ts.isFunctionExpression(n))&&n.getStart(callbackTree)===call.source.start&&n.end===call.source.end)found=true;ts.forEachChild(n,scanCallback);};scanCallback(callbackTree);
        if(!found)throw Error('callback-model-source-unmodeled');
      }
      const hookPlans=planReactHookHelpers(reference,plans),hookIds=new Set<number>();
      if((context.hookCalls?.length??0)>10000)throw Error('hook-model-call-limit');
      for(const call of context.hookCalls??[]){
        const planned=hookPlans.consumers.find(p=>same(p.call,call.site)),fn=planned&&hookPlans.functions.find(p=>same(p.source,planned.source));
        if(!fn||!same(fn.source,call.source)||![call.call,call.invocation,call.consumerCallsBefore].every(v=>Number.isSafeInteger(v)&&v>=0)||hookIds.has(call.call)||!(primitive(call.value)||call.value&&typeof call.value==='object'&&'opaque' in call.value&&call.value.opaque===true))throw Error('hook-model-call-assumption-unmodeled');
        hookIds.add(call.call);sourceFiles[path.resolve(reference.sourceRoot,fn.source.file)]=fn.source.sha256;
      }
      const factoryPlans=planReactCallbackFactories(reference,plans),factoryIds=new Set<number>();
      if((context.factoryCalls?.length??0)>10000)throw Error('factory-model-call-limit');
      for(const call of context.factoryCalls??[]){
        const planned=factoryPlans.consumers.find(p=>same(p.call,call.site)),fn=planned&&factoryPlans.functions.find(p=>same(p.source,planned.source));
        if(!fn||!same(fn.callback,call.source)||![call.call,call.origin,call.consumerCallsBefore].every(v=>Number.isSafeInteger(v)&&v>=0)||factoryIds.has(call.call))throw Error('factory-model-call-assumption-unmodeled');factoryIds.add(call.call);
        sourceFiles[path.resolve(reference.sourceRoot,fn.source.file)]=fn.source.sha256;
      }
      const effectPlans=planReactEffectHooks(reference,[initializer]),effectIds=new Set<number>();
      if((context.effectCalls?.length??0)>10000)throw Error('effect-model-call-limit');
      for(const call of context.effectCalls??[]){
        if(!effectPlans.some(p=>same(p.call,call.site)&&same(p.callback,call.callback))||![call.call,call.effect,call.consumerCallsBefore,call.refCallsBefore].every(v=>Number.isSafeInteger(v)&&v>=0)||effectIds.has(call.call))throw Error('effect-model-call-assumption-unmodeled');effectIds.add(call.call);
      }
      const refPlans=planReactRefHooks(reference,[initializer]),refIds=new Set<number>();
      if((context.refCalls?.length??0)>10000)throw Error('ref-model-call-limit');
      for(const call of context.refCalls??[]){
        if(!refPlans.some(p=>same(p.call,call.site))||![call.call,call.state,call.consumerCallsBefore].every(v=>Number.isSafeInteger(v)&&v>=0)||refIds.has(call.call))throw Error('ref-model-call-assumption-unmodeled');
        refIds.add(call.call);
      }
      for(const call of context.contextCalls){
        const plan=plans.find(p=>same(p.call,call.site));
        if(!plan||call.arguments.length!==plan.arguments.length||!call.arguments.every(primitive))throw Error('context-model-call-assumption-unmodeled');
        if(!Number.isSafeInteger(call.value.id)||call.value.id<0||call.value.fields.length>10000)throw Error('context-model-value-assumption-unmodeled');
        const keys=new Set<string>();
        for(const [key,value] of call.value.fields){
          if(typeof key!=='string'||keys.has(key))throw Error('context-model-field-ambiguous');keys.add(key);
          if(!primitive(value)&&!(value&&typeof value==='object'&&['object','function','symbol','bigint'].includes(value.opaque)))throw Error('context-model-field-unmodeled');
        }
      }
    }
    const options:Parameters<typeof modelReactTargetRender>[0]={program,component,parameter:component.parameters[0].name,properties,contentKey:'children',source:point,...(deferred?{deferred}:{}),
      factory(node){const name=imported(node.expression);return name==='jsx'||name==='jsxs'?name:undefined;},
      target(node){
        node=unwrap(node);if(imported(node)==='Fragment')return {kind:'fragment'};
        if(!ts.isIdentifier(node))return;
        const ds=checker.getSymbolAtLocation(node)?.declarations;
        if(ds?.length===1&&ts.isFunctionDeclaration(ds[0])&&ts.isSourceFile(ds[0].parent))return {kind:'source-binding',source:point(ds[0])};
        if(deferred&&ds?.length===1&&ts.isVariableDeclaration(ds[0])&&ts.isIdentifier(ds[0].name)&&
          ts.isVariableDeclarationList(ds[0].parent)&&ts.isVariableStatement(ds[0].parent.parent)&&ts.isSourceFile(ds[0].parent.parent.parent))
          return {kind:'source-binding',source:point(ds[0])};
      },
      callback(node){
        let unmodeled=false;
        const inspect=(child:ts.Node)=>{
          if(child.kind===ts.SyntaxKind.ThisKeyword||child.kind===ts.SyntaxKind.SuperKeyword||ts.isMetaProperty(child)||
            ts.isIdentifier(child)&&['eval','arguments'].includes(child.text)||
            (ts.isParameter(child)||ts.isBindingElement(child))&&(child.initializer||child.dotDotDotToken))unmodeled=true;
          ts.forEachChild(child,inspect);
        };inspect(node);
        if(unmodeled)throw Error('target-callback-context-unmodeled');
        const original=planned.get(key(node));if(!original)throw Error('target-effects-callback-unavailable');
        const inventory=closures(original);
        return {effects:inventory.effects,reads:inventory.reads.map(read=>{
          const actual=nodes.get(JSON.stringify([read.span.start,read.span.end]));if(!actual)throw Error('target-effects-callback-read-unavailable');
          return {name:read.name,node:actual,...(read.declaration?{declaration:{file:initializer.render.file,sha256:hash,...read.declaration.span}}:{})};
        })};
      },
    };
    const result=context.contextCalls?{...common,qualification:'context-consumer-projection-model-only' as const,...modelReactContextConsumer({...options,contextCalls:context.contextCalls,callbackCalls:context.callbackCalls,refCalls:context.refCalls,effectCalls:context.effectCalls,factoryCalls:context.factoryCalls,hookCalls:context.hookCalls,target(node){
      const existing=options.target(node);if(existing)return existing;
      // A static imported target expression is retained as a read obligation,
      // not resolved by spelling or treated as a registered runtime component.
      node=unwrap(node);let root=node;
      while(ts.isPropertyAccessExpression(root)&&!root.questionDotToken)root=unwrap(root.expression);
      if(!ts.isIdentifier(root))return;
      const ds=checker.getSymbolAtLocation(root)?.declarations,d=ds?.length===1?ds[0]:undefined;
      if(d&&(ts.isImportSpecifier(d)&&!d.isTypeOnly&&!d.parent.parent.isTypeOnly||ts.isNamespaceImport(d)&&!d.parent.isTypeOnly||ts.isImportClause(d)&&!d.isTypeOnly))return {kind:'source-read',source:point(node)};
    }})}:{...common,qualification:'target-render-projection-model-only' as const,...modelReactTargetRender(options)};
    if(createHash('sha256').update(readFileSync(file)).digest('hex')!==hash)throw Error('target-effects-source-changed');
    return result;
  }catch(error){return {...common,status:'refused',reason:error instanceof Error?error.message:'target-effects-unavailable',steps:0};}
}

export type ReactContextHelperEffects={version:1;acceptedContract:null;effectsVerified:false;runtimeVerified:false;qualification:'context-helper-source-path-model-only';helper:HelperSourcePoint;sourceFiles:Record<string,string>;runtimeRequirements:string[]} & ContextHelperModelResult;
/** Interpret the original helper with separately observed read/hook assumptions.
 * This source-only result does not grant those observations runtime authority. */
export function modelReactContextHelperInput(reference:ReactHelperReference,helper:ReactContextHelper,
  arguments_:ReadonlyArray<ReactElementObservedValue>,
  closureReads:ReadonlyArray<{site:HelperSourcePoint;value:ReactElementObservedValue;context:number|null}>,
  nativeCalls:ReadonlyArray<{site:HelperSourcePoint;context:number;value:ReactElementObservedValue;origin?:{id:number;fields:ReadonlyArray<readonly [string,ReactElementObservedValue]>}}>,
):ReactContextHelperEffects{
  const sourceFiles:Record<string,string>={},common={version:1 as const,acceptedContract:null,effectsVerified:false as const,runtimeVerified:false as const,qualification:'context-helper-source-path-model-only' as const,helper:helper.source,sourceFiles,
    runtimeRequirements:['actual-original-helper-arguments-and-closure-read-values','native-context-hook-identity-and-value-transport','native-hook-import-property-read-effects','enclosing-provider-context-state-ref-and-event-semantics']};
  try{
    const file=path.resolve(reference.sourceRoot,helper.source.file);
    if(realpathSync(file)!==file||reference.files[file]!==helper.source.sha256)throw Error('context-helper-model-source-unavailable');
    const text=readFileSync(file,'utf8'),hash=createHash('sha256').update(text).digest('hex');sourceFiles[file]=hash;
    if(hash!==helper.source.sha256)throw Error('context-helper-model-source-changed');
    const native=readReactContextCalls(text,helper.source.file,hash),current=planReactContextHelpers(reference,native).find(p=>JSON.stringify(p.source)===JSON.stringify(helper.source));
    if(!current||JSON.stringify(current)!==JSON.stringify(helper))throw Error('context-helper-model-plan-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const program=ts.createProgram([file],{allowJs:true,noResolve:true,noLib:true},host);
    let component:ts.FunctionDeclaration|undefined;const find=(n:ts.Node)=>{if(ts.isFunctionDeclaration(n)&&n.getStart(sf)===helper.source.start&&n.end===helper.source.end)component=n;ts.forEachChild(n,find);};find(sf);
    if(!component)throw Error('context-helper-model-function-missing');
    const same=(a:HelperSourcePoint,b:HelperSourcePoint)=>a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;
    const point=(n:ts.Node):HelperSourcePoint=>({file:helper.source.file,sha256:hash,start:n.getStart(sf),end:n.end});
    const decode=(v:ReactElementObservedValue):CompiledModelInput=>{
      if(v.representation)throw Error('context-helper-model-value-unmodeled');
      if(v.kind==='undefined'&&!('value' in v))return undefined;
      if(v.kind==='null'&&v.value===null)return null;
      if(v.kind==='number'&&typeof v.value==='number'&&Number.isFinite(v.value)&&!Object.is(v.value,-0))return v.value;
      if((v.kind==='boolean'||v.kind==='string')&&typeof v.value===v.kind)return v.value as string|boolean;
      if(['object','function','symbol','bigint'].includes(v.kind)&&!('value' in v))return {opaque:v.kind};
      throw Error('context-helper-model-value-unmodeled');
    };
    const id=(v:number)=>{if(!Number.isSafeInteger(v)||v<0)throw Error('context-helper-model-identity-invalid');return v;};
    if(arguments_.length>10000||closureReads.length>100000||nativeCalls.length>100000)throw Error('context-helper-model-input-limit');
    const sites=helper.closureReads??[];
    const reads=closureReads.map(r=>{
      const index=sites.findIndex(s=>same(s.read,r.site));if(index<0)throw Error('context-helper-model-read-unplanned');
      let value:ContextHelperModelInput=decode(r.value);
      if(r.context!==null){if(r.value.kind!=='object')throw Error('context-helper-model-context-kind');value={nativeContext:id(r.context)};}
      return {read:index,value};
    });
    const hooks:ContextHelperNativeCall[]=nativeCalls.map(call=>{
      const plan=native.find(n=>same(n.call,call.site)&&n.enclosingFunction&&same(n.enclosingFunction,helper.source));if(!plan)throw Error('context-helper-model-hook-unplanned');
      let value:ContextHelperNativeCall['value'];
      if(call.origin){
        if(call.value.kind!=='object'||call.origin.fields.length>10000)throw Error('context-helper-model-origin-invalid');
        const keys=new Set<string>(),fields=call.origin.fields.map(([key,v])=>{if(typeof key!=='string'||keys.has(key))throw Error('context-helper-model-field-ambiguous');keys.add(key);return [key,decode(v)] as const;});
        value={contextValue:id(call.origin.id),fields};
      }else{
        const decoded=decode(call.value);if(decoded!==null&&typeof decoded==='object')throw Error('context-helper-model-native-value-unproved');value=decoded;
      }
      return {site:call.site,receiver:plan.receiver,context:id(call.context),value};
    });
    return {...common,...modelReactContextHelper({program,component,source:point,arguments:arguments_.map(decode),closureSites:sites.map(r=>({name:r.name,kind:r.kind,span:{start:r.read.start,end:r.read.end}})),closureReads:reads,nativeCalls:hooks})};
  }catch(error){return {...common,status:'refused',reason:error instanceof Error?error.message:'context-helper-model-failed',steps:0};}
}
