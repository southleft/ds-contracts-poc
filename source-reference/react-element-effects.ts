import ts from 'typescript';
import {reactHelperIntrinsicGuard} from './react-helper-intrinsics.js';
import type {ReactElementObservedValue} from './react-element-invocation.js';
import type {ReactElementBindingRead} from './react-element-closure.js';

export interface ReactElementOperation {
  span:{start:number;end:number};
  kind:'member-call'|'write';
}
export type ReactElementEffect = {operation:number} & (
  {status:'refused';reason:string} |
  {status:'verified';kind:'symbol-for';key:string} |
  {status:'verified';kind:'global-symbol-data-write';key:string;value:ReactElementObservedValue}
);
export type ReactElementGlobalRead = {read:number;status:'verified'|'refused';reason?:string};

/** Candidate syntax only. Runtime identity, descriptors and arguments decide
 * whether an operation is known. No package, component or marker names. */
export function readReactElementOperations(fn:ts.FunctionDeclaration|ts.FunctionExpression|ts.ArrowFunction,sf:ts.SourceFile,reads:readonly ReactElementBindingRead[]):ReactElementOperation[]{
  const operations:ReactElementOperation[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isFunctionLike(node)||ts.isClassLike(node))return;
    if(ts.isCallExpression(node)&&!node.questionDotToken&&!node.arguments.some(ts.isSpreadElement)){
      const member=node.expression;
      if((ts.isPropertyAccessExpression(member)||ts.isElementAccessExpression(member))&&!member.questionDotToken&&member.expression.kind!==ts.SyntaxKind.SuperKeyword&&
        (ts.isPropertyAccessExpression(member)&&member.name.text==='for'||ts.isElementAccessExpression(member)&&ts.isStringLiteral(member.argumentExpression)&&member.argumentExpression.text==='for'))
        operations.push({span:{start:node.getStart(sf),end:node.end},kind:'member-call'});
    }
    if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken){
      const member=node.left;
      let receiver:ts.Expression|undefined=(ts.isPropertyAccessExpression(member)||ts.isElementAccessExpression(member))?member.expression:undefined;
      while(receiver&&ts.isParenthesizedExpression(receiver))receiver=receiver.expression;
      const external=receiver&&ts.isIdentifier(receiver)&&reads.some(r=>r.kind==='value'&&r.span.start===receiver!.getStart(sf)&&r.span.end===receiver!.end);
      if((ts.isPropertyAccessExpression(member)||ts.isElementAccessExpression(member))&&!member.questionDotToken&&member.expression.kind!==ts.SyntaxKind.SuperKeyword&&
        external&&!(ts.isPropertyAccessExpression(member)&&ts.isPrivateIdentifier(member.name)))
        operations.push({span:{start:node.getStart(sf),end:node.end},kind:'write'});
    }
    ts.forEachChild(node,visit);
  };if(fn.body)visit(fn.body);
  if(operations.length>10000)throw Error('element-operation-site-limit');
  return operations;
}

/** Loaded before source modules in an isolated realm. These are individual
 * operation witnesses, not a full invocation/content proof. Unknown operations
 * retain original execution and report refusal; no getter is invoked to inspect
 * an unknown receiver. The containing observer still requires equal captures. */
export const reactElementEffectRuntime=`(top,shape)=>{
 'use strict';
 const realm=globalThis,N={descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,keys:Reflect.ownKeys,apply:Reflect.apply,is:Object.is,extensible:Object.isExtensible,Map, get:Map.prototype.get,set:Map.prototype.set};
 const intrinsics=${reactHelperIntrinsicGuard};
 const SymbolCtor=Symbol,symbolFor=Symbol.for,symbolKeyFor=Symbol.keyFor;
 const chain=[];for(let p=realm;p!==null;p=N.prototype(p)){if(chain.length>=32)throw Error('element-global-prototype-limit');const bindings={};for(const name of ['globalThis','window','Symbol'])bindings[name]=N.descriptor(p,name);chain[chain.length]={target:p,next:N.prototype(p),bindings};}
 let count=0;
 const reason=()=>{try{intrinsics();}catch(error){return error.message;}return undefined;};
 const sameDescriptor=(a,b)=>{
  if(!a||!b)return a===b;
  for(const key of ['value','get','set','writable','enumerable','configurable']){
   const left=N.descriptor(a,key),right=N.descriptor(b,key);
   if(!!left!==!!right||left&&!N.is(left.value,right.value))return false;
  }return true;
 };
 const globalStable=name=>{
  // A missing own property does not prove an unresolved identifier. A changed
  // global prototype could introduce an inherited getter under that name.
  for(const link of chain){
   if(!sameDescriptor(link.bindings[name],N.descriptor(link.target,name)))return false;
   if(link.bindings[name])return true;
   if(N.prototype(link.target)!==link.next)return false;
  }return true;
 };
 const reserve=(frame,index,kind)=>{
  top(frame);if(frame.plan.operations?.[index]?.kind!==kind)throw Error('element-operation-unplanned');
  if(frame.effects.length>=10000||++count>100000)throw Error('element-operation-limit');
  const event={operation:index,status:'refused',reason:'element-operation-unfinished'};frame.effects[frame.effects.length]=event;return event;
 };
 const verified=(event,fields)=>{delete event.reason;event.status='verified';for(const key of N.keys(fields))event[key]=fields[key];};
 const fail=(event,why)=>{event.status='refused';event.reason=why;};
 const safeTarget=(receiver,key)=>{
  if(receiver!==realm||typeof key!=='symbol')return 'element-global-write-receiver-unproved';
  for(let i=0;i<chain.length;i++){
   const link=chain[i];
   // Each target was captured before source code. Refuse a changed chain before
   // asking an unfamiliar object (possibly a Proxy) about descriptors.
   if(N.prototype(link.target)!==link.next)return 'element-global-prototype-changed';
   const d=N.descriptor(link.target,key);
   if(d){if(!N.descriptor(d,'value')||!d.writable)return 'element-global-write-not-writable-data';return i===0||N.extensible(realm)?undefined:'element-global-not-extensible';}
  }
  return N.extensible(realm)?undefined:'element-global-not-extensible';
 };
 return {
  globalRead(frame,index,name,lookup,record){
   top(frame);
   const read=frame.plan.bindingReads?.[index];
   if(!read||read.name!==name||read.declaration||!['globalThis','window','Symbol'].includes(name))throw Error('element-global-read-unplanned');
   const failure=reason()||(!globalStable(name)?'element-global-binding-changed:'+name:undefined);
   const event={read:index,status:failure?'refused':'verified',...(failure?{reason:failure}:{})};frame.globalReads[frame.globalReads.length]=event;
   // This executes the original identifier/typeof exactly once, after the guard.
   return record(frame,index,N.apply(lookup,undefined,[]));
  },
  member(frame,index,receiver,key){
   const event=reserve(frame,index,'member-call');
   let failure=reason();
   if(!failure&&(receiver!==SymbolCtor||key!=='for'))failure='element-native-member-receiver-unproved';
   if(!failure){const d=N.descriptor(receiver,key);if(!d||!N.descriptor(d,'value')||d.value!==symbolFor)failure='element-native-member-unproved';}
   // Unknown accessors execute as in the original, but cannot produce a verified
   // event even if they happen to return the original native function.
   let fn;try{fn=receiver[key];}catch(error){fail(event,failure||'element-member-threw');throw error;}
   return (...args)=>{
    top(frame);failure=failure||reason();
    if(!failure&&(fn!==symbolFor||args.length!==1||typeof args[0]!=='string'))failure='element-native-call-arguments-unproved';
    let result;try{result=N.apply(fn,receiver,args);}catch(error){fail(event,failure||'element-call-threw');throw error;}
    if(!failure&&(typeof result!=='symbol'||N.apply(symbolKeyFor,SymbolCtor,[result])!==args[0]))failure='element-native-call-result-unproved';
    if(failure)fail(event,failure);else{
     if(!frame.registeredSymbols)frame.registeredSymbols=new N.Map();N.apply(N.set,frame.registeredSymbols,[result,args[0]]);
     verified(event,{kind:'symbol-for',key:args[0]});
    }return result;
   };
  },
  write(frame,index,receiver,key){
   const event=reserve(frame,index,'write');
   // Retain the raw key reference. Do not coerce it or inspect an object before
   // RHS evaluation; the actual assignment below performs its original coercion.
   const registered=typeof key==='symbol'&&frame.registeredSymbols&&N.apply(N.get,frame.registeredSymbols,[key]);
   let failure=reason()||(typeof registered!=='string'?'element-write-key-unproved':safeTarget(receiver,key));
   return value=>{
    top(frame);failure=failure||reason()||safeTarget(receiver,key);
    if(!failure&&value!==null&& !['string','number','boolean','undefined'].includes(typeof value))failure='element-write-value-not-primitive';
    try{receiver[key]=value;}catch(error){fail(event,failure||'element-write-threw');throw error;}
    if(!failure){const d=N.descriptor(receiver,key);if(!d||!N.descriptor(d,'value')||!N.is(d.value,value))failure='element-global-write-result-unproved';}
    if(failure)fail(event,failure);else verified(event,{kind:'global-symbol-data-write',key:registered,value:shape(value)});
    return value;
   };
  }
 };
}`;
