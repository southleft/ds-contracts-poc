import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReactCompiledContent} from './react-compiled-content.js';
import {readReactElementInvocationPlans,type ReactElementInvocation,type ReactElementObservedValue} from './react-element-invocation.js';
import type {ReactElementCreationSite} from './react-element-creation.js';
import type {ReactReference} from './react-reference.js';
import {modelReactCompiledCall,type CompiledModelInput,type CompiledModelResult,type CompiledEffectAssumption} from './react-helper-model.mjs';

export type ReactCompiledEffects = {
  version:1;
  acceptedContract:null;
  runtimeVerified:false;
  qualification:'compiled-effects-model-only';
  site:ReactElementCreationSite;
  runtimeRequirements:readonly string[];
} & CompiledModelResult;

/** Rebind the exact source/function/import before modeling recorded inputs. A
 * modeled result is still conditional on runtime guards. Neither a caller's
 * serialized observation nor a source model grants content or native authority. */
export function readReactCompiledEffects(
  reference:Pick<ReactReference,'sourceRoot'|'files'>,
  site:ReactElementCreationSite,
  invocation:ReactElementInvocation,
):ReactCompiledEffects {
  const common={version:1 as const,acceptedContract:null,runtimeVerified:false as const,
    qualification:'compiled-effects-model-only' as const,site,
    runtimeRequirements:[
      'authenticate-original-react-input-and-same-returned-element',
      'guard-complete-input-descriptors-and-opaque-value-identities',
      'guard-selected-closure-values-and-read-order-in-the-same-invocation',
      'authenticate-global-read-and-native-operation-journal-in-the-same-invocation',
      'authenticate-jsx-factory-and-compare-complete-modeled-output',
      'prove-enclosing-provider-state-and-caller-boundaries',
    ],
  };
  try{
    const content=readReactCompiledContent(reference,site);
    if(content.status!=='read')throw Error(content.reason);
    if(invocation.status!=='observed')throw Error('compiled-effects-invocation-unavailable');
    const file=realpathSync(path.resolve(reference.sourceRoot,site.module));
    const text=readFileSync(file,'utf8'),sha=createHash('sha256').update(text).digest('hex');
    if(sha!==site.sourceSha256||sha!==reference.files[file])throw Error('compiled-effects-source-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const plan=readReactElementInvocationPlans(sf,[site])[0];
    if(!plan||JSON.stringify(plan)!==JSON.stringify(invocation.function))throw Error('compiled-effects-invocation-plan-changed');
    if(invocation.input.length>10000||invocation.closureReads.length>10000||invocation.effects.length>10000||invocation.globalReads.length>10000)throw Error('compiled-effects-input-limit');
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host);
    let call:ts.CallExpression|undefined,component:ts.FunctionDeclaration|ts.FunctionExpression|ts.ArrowFunction|undefined;
    const find=(node:ts.Node)=>{
      if(ts.isCallExpression(node)&&node.getStart(sf)===site.span.start&&node.end===site.span.end)call=node;
      if((ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node))&&node.getStart(sf)===plan.span.start&&node.end===plan.span.end)component=node;
      ts.forEachChild(node,find);
    };find(sf);
    if(!call||!component||!ts.isIdentifier(component.parameters[0].name))throw Error('compiled-effects-function-unavailable');
    const decode=(value:ReactElementObservedValue):CompiledModelInput=>{
      if(value.kind==='null'&&value.value===null)return null;
      if(value.kind==='undefined'&&!('value' in value))return undefined;
      if(value.kind==='number'&&typeof value.value==='number'&&Number.isFinite(value.value)&&!Object.is(value.value,-0)&&!value.representation)return value.value;
      if((value.kind==='string'||value.kind==='boolean')&&typeof value.value===value.kind&&!value.representation)return value.value;
      if(['object','function','symbol','bigint'].includes(value.kind)&&!('value' in value)&&!value.representation)return {opaque:value.kind};
      throw Error('compiled-effects-value-unmodeled');
    };
    const keys=new Set<string>();
    const properties=invocation.input.map(([key,value])=>{
      if(keys.has(key)||key==='__proto__')throw Error('compiled-effects-input-key-unmodeled');keys.add(key);
      return [key,decode(value)] as const;
    });
    const closureReads=invocation.closureReads.map(read=>{
      if(!Number.isSafeInteger(read.read)||read.read<0||!plan.bindingReads?.[read.read])throw Error('compiled-effects-closure-index-unmodeled');
      return {read:read.read,value:decode(read.value)};
    });
    const globals=invocation.closureReads.filter(read=>{const site=plan.bindingReads![read.read];return !site.declaration&&['window','globalThis','Symbol'].includes(site.name);});
    if(globals.length!==invocation.globalReads.length)throw Error('compiled-global-read-coverage-mismatch');
    for(let i=0;i<globals.length;i++){
      const read=invocation.globalReads[i];if(read.read!==globals[i].read)throw Error('compiled-global-read-order-mismatch');
      if(read.status!=='verified')throw Error('compiled-global-read-unproved:'+read.reason);
    }
    const effects:CompiledEffectAssumption[]=invocation.effects.map(effect=>{
      if(!Number.isSafeInteger(effect.operation)||effect.operation<0||!plan.operations?.[effect.operation])throw Error('compiled-effect-operation-unplanned');
      if(effect.status==='refused')return {operation:effect.operation,status:'refused',reason:effect.reason};
      if(effect.status!=='verified'||typeof effect.key!=='string')throw Error('compiled-effect-unmodeled');
      if(effect.kind==='symbol-for')return {operation:effect.operation,status:'verified',kind:'symbol-for',key:effect.key};
      if(effect.kind!=='global-symbol-data-write')throw Error('compiled-effect-unmodeled');
      const value=decode(effect.value);if(value!==null&&typeof value==='object')throw Error('compiled-effect-value-not-primitive');
      return {operation:effect.operation,status:'verified',kind:'global-symbol-data-write',key:effect.key,value};
    });
    const model=modelReactCompiledCall({program,call,component,parameter:component.parameters[0].name,properties,contentKey:'children',
      closureSites:plan.bindingReads??[],closureReads,operations:plan.operations??[],effects,
      source(node){if(node.getSourceFile()!==sf)throw Error('compiled-effects-outside-source');return {file:site.module,sha256:sha,start:node.getStart(sf),end:node.end};},
    });
    if(createHash('sha256').update(readFileSync(file)).digest('hex')!==sha)throw Error('compiled-effects-source-changed');
    return {...common,...model};
  }catch(error){return {...common,status:'refused',reason:error instanceof Error?error.message:'compiled-effects-unavailable',steps:0};}
}
