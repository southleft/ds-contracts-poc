import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import type {ReactJsxLookupProof} from './react-jsx-lookup.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
import {planReactCallbackSources} from './react-callback-sources.js';

export interface ReactCallbackCreationVerification {
 qualification:'observed-callback-helper-creation-only';effectsVerified:false;acceptedContract:null;
 rows:Array<{hook:number;sourceInvocation:number;status:'verified'|'refused';reason?:string;creationBodyVerified:boolean;
  callback:number|null;selectedCallback:number|null;nativeSelection:number|null;remainingRequirements:readonly string[]}>;
}
const remaining=['callback-body-and-ref-attachment-cleanup','module-initialization','enclosing-provider-state-event-semantics','unobserved-inputs-and-recovery'];
const key=(p:HelperSourcePoint)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function requireProof(value:unknown,reason:string):asserts value {if(!value)throw Error('callback-creation-'+reason);}

/** Prove only the observed creation path: one original rest helper returns a
 * native useCallback selection of a local rest factory's returned literal.
 * The callback body is not executed by this path and stays a deferred obligation.
 * Unsupported source statements and unjoined runtime values refuse. */
export function verifyReactCallbackCreations(reference:ReactHelperReference,plan:ReactJsxHelperInstrumentationPlan,runtime:ReactHelperRuntimeReport,lookup:ReactJsxLookupProof):ReactCallbackCreationVerification {
 const result:ReactCallbackCreationVerification={qualification:'observed-callback-helper-creation-only',effectsVerified:false,acceptedContract:null,rows:[]};
 if(runtime.status!=='observed'||!runtime.callbackSources||!runtime.callbackMemo||!plan.callbackSources)return result;
 const source=runtime.callbackSources,memo=runtime.callbackMemo,plans=plan.callbackSources;
 const cache=new Map<string,ReturnType<typeof parse>>();
 function parse(name:string){
  const file=path.resolve(reference.sourceRoot,name),hash=reference.files[file];requireProof(realpathSync(file)===file&&hash,'source-file-unavailable');
  const text=readFileSync(file,'utf8');requireProof(createHash('sha256').update(text).digest('hex')===hash,'source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:/\.[cm]?js$/.test(name)?ts.ScriptKind.JS:ts.ScriptKind.TS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),nodes=new Map<string,ts.Node>();
  const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
  const scan=(n:ts.Node)=>{nodes.set(key(point(n)),n);ts.forEachChild(n,scan);};scan(sf);return {sf,checker,nodes,point};
 }
 function module(point:HelperSourcePoint){let m=cache.get(point.file);if(!m){m=parse(point.file);cache.set(point.file,m);}requireProof(m.point(m.sf).sha256===point.sha256,'source-hash');return m;}
 const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
 function returns(fn:ts.Node|undefined){
  requireProof(fn&&ts.isFunctionDeclaration(fn)&&fn.body&&fn.parameters.length===1,'function-form');
  const parameter=fn.parameters[0];requireProof(ts.isIdentifier(parameter.name)&&parameter.dotDotDotToken&&!parameter.initializer,'rest-parameter');
  const statements=fn.body.statements;requireProof(statements.length===1&&ts.isReturnStatement(statements[0])&&statements[0].expression,'body-statements');
  return {fn,parameter,statement:statements[0],expression:unwrap(statements[0].expression)};
 }
 for(const hook of source.hooks){
  const row:ReactCallbackCreationVerification['rows'][number]={hook:hook.id,sourceInvocation:hook.invocation,status:'refused',creationBodyVerified:false,callback:null,selectedCallback:null,nativeSelection:hook.nativeSelection,remainingRequirements:remaining};result.rows.push(row);
  try{
   requireProof(equal(planReactCallbackSources(reference,plan.contextConsumerCalls??[],plan.contextHelpers??[]),plans),'plan-changed');
   const hp=plans.hooks.find(h=>key(h.call)===hook.site),root=source.invocations[hook.invocation];requireProof(hp&&root&&root.source===key(hp.owner)&&root.id===hook.invocation&&root.callVerified&&root.parent===null&&root.completion==='returned','root-invocation');
   requireProof(root.consumerCall!==null&&root.render===hook.render&&root.consumerCall===hook.consumerCall&&runtime.contexts,'consumer-scope');
   const consumer=runtime.contexts.consumerCalls.invocations[root.consumerCall];requireProof(consumer&&consumer.id===root.consumerCall&&consumer.render===root.render&&consumer.completion==='returned'&&plans.consumers.some(c=>key(c.call)===key(consumer.site)&&key(c.source)===root.source)&&lookup.contextConsumerCallees?.includes(key(consumer.site)),'consumer-callee');
   const m=module(hp.owner),body=returns(m.nodes.get(key(hp.owner))),expr=body.expression;
   requireProof(ts.isCallExpression(expr)&&key(m.point(expr))===hook.site&&expr.arguments.length===2,'root-return');
   const parameter=(n:ts.Expression,p:ts.ParameterDeclaration,mod:ReturnType<typeof parse>)=>{n=unwrap(n);return ts.isIdentifier(n)&&mod.checker.getSymbolAtLocation(n)?.valueDeclaration===p;};
   requireProof(parameter(expr.arguments[1],body.parameter,m),'dependency-binding');
   const candidate=unwrap(expr.arguments[0]);requireProof(ts.isCallExpression(candidate)&&candidate.arguments.length===1&&ts.isSpreadElement(candidate.arguments[0])&&parameter(candidate.arguments[0].expression,body.parameter,m),'factory-arguments');
   const callPlan=plans.calls.find(c=>key(c.call)===key(m.point(candidate))&&key(c.caller)===root.source);requireProof(callPlan,'factory-call-plan');
   const cm=module(callPlan.source),factory=returns(cm.nodes.get(key(callPlan.source))),literal=factory.expression;
   requireProof(ts.isArrowFunction(literal)||ts.isFunctionExpression(literal),'factory-return');
   const callbackPlan=plans.callbacks.find(c=>key(c.source)===key(cm.point(literal))&&key(c.owner)===key(callPlan.source));requireProof(callbackPlan&&callbackPlan.captures.length===1&&key(callbackPlan.captures[0].binding)===key(cm.point(factory.parameter)),'callback-capture-plan');
   const children=source.invocations.filter(i=>i.parent===root.id);requireProof(children.length===1,'factory-call-coverage');const creation=children[0];
   requireProof(creation.callVerified&&creation.call===key(callPlan.call)&&creation.source===key(callPlan.source)&&creation.completion==='returned'&&creation.consumerCall===root.consumerCall&&creation.render===root.render&&equal(creation.arguments,root.arguments),'factory-invocation');
   const candidates=source.callbacks.filter(c=>c.invocation===creation.id);requireProof(candidates.length===1,'callback-creation-coverage');const callback=candidates[0];row.callback=callback.id;
   requireProof(callback.originVerified&&callback.source===key(callbackPlan.source)&&callback.captures.length===1&&callback.captures[0].binding===key(callbackPlan.captures[0].binding)&&equal(callback.value,creation.value),'callback-origin');
   const rootRests=source.rests.filter(r=>r.invocation===root.id),createdRests=source.rests.filter(r=>r.invocation===creation.id);requireProof(rootRests.length===1&&createdRests.length===1,'rest-coverage');
   const deps=rootRests[0],capture=createdRests[0];requireProof(deps.binding===key(m.point(body.parameter))&&capture.binding===key(cm.point(factory.parameter))&&callback.captures[0].rest===capture.id&&deps.id!==capture.id&&equal(deps.elements,root.arguments)&&equal(capture.elements,root.arguments),'rest-values');
   requireProof(source.hooks.filter(h=>h.invocation===root.id).length===1&&hook.propertyEffectsVerified&&hook.completion==='returned'&&lookup.callbackHookReads?.includes(hook.site)&&equal(hook.arguments,[callback.value,deps.value]),'hook-lookup-and-arguments');
   const selections=memo.invocations.filter(i=>i.sourceHook===hook.id);requireProof(selections.length===1,'native-call-coverage');const selected=selections[0];row.selectedCallback=selected.selectedSource;
   requireProof(selected.id===hook.nativeSelection&&selected.selectionVerified&&selected.consumerReturnMatched&&selected.completion==='returned'&&selected.consumerCall===root.consumerCall&&selected.render===root.render&&selected.candidateSource===callback.id&&selected.dependencyRest===deps.id&&equal(selected.candidate,callback.value)&&equal(selected.dependencies,deps.value)&&equal(selected.selected,hook.value)&&equal(selected.selected,root.value),'native-selection');
   const origin=selected.selectedSource===null?undefined:source.callbacks[selected.selectedSource];requireProof(origin?.originVerified&&equal(origin.value,selected.selected),'selected-origin');
   row.status='verified';row.creationBodyVerified=true;
  }catch(error){row.reason=error instanceof Error?error.message:'callback-creation-unavailable';}
 }
 return result;
}
