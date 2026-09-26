import ts from 'typescript';
import path from 'node:path';
import {reactHelperIntrinsicGuard} from './react-helper-intrinsics.js';

export interface ReactElementSourcePoint {module:string;sourceSha256:string;span:{start:number;end:number};functionSpan?:{start:number;end:number};}
export interface ReactElementSourceInvocation {invocation:number;function:{module:string;sourceSha256:string;span:{start:number;end:number}};}
export interface ReactElementSourceCall {
  id:number;site:ReactElementSourcePoint&{object:number};
  argument:{qualification:'source-object-origin-only';source:ReactElementSourcePoint;creator?:ReactElementSourceInvocation};
  caller?:ReactElementSourceInvocation;
}
export interface ReactElementSourceCalls {
  objects:ReactElementSourcePoint[];
  calls:Array<ReactElementSourcePoint&{object:number}>;
  arrays?:ReactElementSourcePoint[];
}

/** A syntactic object argument is an origin witness, not an effects model.
 * Only bare, non-optional one-argument calls and fresh object expressions (or
 * their const bindings) participate. Fresh array expressions are retained for
 * returned membership; assignment patterns are never wrapped. No initializer
 * or callback executes during this source analysis. */
export function readReactElementSourceCalls(sf:ts.SourceFile,module:string,sourceSha256:string):ReactElementSourceCalls {
  const host:ts.CompilerHost={getSourceFile:f=>f===sf.fileName?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>path.dirname(sf.fileName),getDirectories:()=>[],fileExists:f=>f===sf.fileName,readFile:f=>f===sf.fileName?sf.text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([sf.fileName],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker();
  const objects:ReactElementSourcePoint[]=[],calls:ReactElementSourceCalls['calls']=[],arrays:ReactElementSourcePoint[]=[];
  const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
  const point=(n:ts.Node):ReactElementSourcePoint=>{
    let functionSpan:ReactElementSourcePoint['functionSpan'];
    for(let parent=n.parent;parent;parent=parent.parent){
      if(ts.isFunctionLike(parent)){functionSpan={start:parent.getStart(sf),end:parent.end};break;}
      // Class field initializers can run later without entering a source frame.
      // They must not borrow the lexically enclosing function's active frame.
      if(ts.isClassLike(parent))break;
    }
    return {module,sourceSha256,span:{start:n.getStart(sf),end:n.end},...(functionSpan?{functionSpan}:{})};
  };
  const observable=(node:ts.Node)=>{
    const binding=checker.getSymbolsInScope(node,ts.SymbolFlags.Value).find(s=>s.name==='globalThis');
    return !binding?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
  };
  const assignmentPattern=(node:ts.Node)=>{
    let n=node;
    while(n.parent){
      const p=n.parent;
      if(ts.isBinaryExpression(p)&&p.operatorToken.kind===ts.SyntaxKind.EqualsToken)return p.left===n;
      if(ts.isForOfStatement(p)||ts.isForInStatement(p))return p.initializer===n;
      if(ts.isParenthesizedExpression(p)||ts.isArrayLiteralExpression(p)||ts.isObjectLiteralExpression(p)||ts.isSpreadElement(p)||ts.isPropertyAssignment(p)||ts.isShorthandPropertyAssignment(p))n=p;
      else return false;
    }return false;
  };
  const walk=(node:ts.Node)=>{
    if(ts.isArrayLiteralExpression(node)&&!assignmentPattern(node)&&observable(node)){
      arrays.push(point(node));if(arrays.length>10000)throw Error('element-source-array-site-limit');
    }
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text!=='eval'&&!node.questionDotToken&&node.arguments.length===1){
      let value=unwrap(node.arguments[0]);
      if(ts.isIdentifier(value)){
        const declarations=checker.getSymbolAtLocation(value)?.declarations;
        const decl=declarations?.length===1?declarations[0]:undefined;
        if(decl&&ts.isVariableDeclaration(decl)&&ts.isIdentifier(decl.name)&&decl.initializer&&ts.isVariableDeclarationList(decl.parent)&&
          (decl.parent.flags&ts.NodeFlags.Const)&&decl.getSourceFile()===sf)value=unwrap(decl.initializer);
      }
      if(ts.isObjectLiteralExpression(value)&&observable(node)){
        const source=point(value);let object=objects.findIndex(p=>p.span.start===source.span.start&&p.span.end===source.span.end);
        if(object<0){object=objects.length;objects.push(source);}
        calls.push({...point(node),object});
        if(objects.length>10000||calls.length>10000)throw Error('element-source-call-site-limit');
      }
    }
    ts.forEachChild(node,walk);
  };walk(sf);return {objects,calls,arrays};
}

/** Register a property function after its entire original literal is created,
 * retaining JS inferred names and the original function value. Every property
 * must have a unique static data key, so spreads/computed keys/accessors cannot
 * substitute a different function before registration. */
export function reactElementCallbackProperty(node:ts.Node,sf:ts.SourceFile){
  if(!(ts.isArrowFunction(node)||ts.isFunctionExpression(node)&&!node.name)||!ts.isPropertyAssignment(node.parent)||node.parent.initializer!==node||!ts.isObjectLiteralExpression(node.parent.parent))return;
  const object=node.parent.parent,keys=new Set<string>();let key:string|undefined;
  for(const property of object.properties){
    if(!ts.isPropertyAssignment(property)&&!ts.isShorthandPropertyAssignment(property))return;
    const name=property.name;if(!ts.isIdentifier(name)&&!ts.isStringLiteral(name)&&!ts.isNumericLiteral(name))return;
    const current=name.text;if(current==='__proto__'||keys.has(current))return;keys.add(current);
    if(property===node.parent)key=current;
  }
  return key===undefined?undefined:{key,objectSpan:{start:object.getStart(sf),end:object.end}};
}

export const reactElementSourceCallRuntime=`(plans,sources,data,same,current)=>{
 const N={apply:Reflect.apply,d:Object.getOwnPropertyDescriptor,WeakMap,get:WeakMap.prototype.get,set:WeakMap.prototype.set};
 const functions=new N.WeakMap(),objects=new N.WeakMap(),stack=[];
 const intrinsics=${reactHelperIntrinsicGuard};let serial=0,registered=0,literals=0;
 const get=(map,key)=>N.apply(N.get,map,[key]),set=(map,key,value)=>N.apply(N.set,map,[key,value]);
 const finished=frame=>frame&&frame.finished&&!frame.threw&&frame.returned;
 const endpoint=frame=>finished(frame)?{invocation:frame.id,function:{module:frame.plan.module,sourceSha256:frame.plan.sourceSha256,span:frame.plan.span}}:undefined;
 const valid=call=>{
  if(!call||!call.claimed||!call.finished||call.threw)return false;
  try{intrinsics();return same(call.args[0],call.before);}catch{return false;}
 };
 return {
  object(index,value){
   const source=sources.objects[index];if(!source)throw Error('element-source-object-unplanned');
   if(++literals>100000)throw Error('element-source-object-limit');
   try{intrinsics();const before=data(value);if(before)set(objects,value,{source,before,frame:current(source)});}catch{/* no origin */}
   return value;
  },
  callbacks(indices,value){
   if(++registered>100000)throw Error('element-source-callback-limit');
   try{
    intrinsics();for(const index of indices){
     const plan=plans[index];if(plan?.argumentSource!=='source-call'||!plan.identityProperty)continue;
     const property=N.d(value,plan.identityProperty.key);if(!property||!N.d(property,'value')||typeof property.value!=='function')continue;
     if(get(functions,property.value))continue;set(functions,property.value,{index});
    }
   }catch{/* registration never changes the literal result */}return value;
  },
  call(index,fn,args){
   const site=sources.calls[index];if(!site)throw Error('element-source-call-unplanned');
   const registration=get(functions,fn);if(!registration)return N.apply(fn,undefined,args);
   if(stack.length>=256||++serial>100000)throw Error('element-source-call-limit');
   const origin=get(objects,args[0]);let before=null;
   try{intrinsics();if(origin&&origin.source===sources.objects[site.object]&&same(args[0],origin.before))before=origin.before;}catch{/* unknown input is never reflected upon */}
   const call={id:serial,site,fn,index:registration.index,args,origin,before,caller:current(site),claimed:false,finished:false,threw:false};stack.push(call);
   try{const result=N.apply(fn,undefined,args);call.result=result;return result;}
   catch(error){call.threw=true;throw error;}
   finally{call.finished=true;stack.pop();}
  },
  claim(index){const call=stack[stack.length-1];if(!call||call.index!==index||call.claimed||!call.before)return;call.claimed=true;return call;},
  describe(call){
   if(!valid(call))return;
   const creator=endpoint(call.origin.frame),caller=endpoint(call.caller);
   return {id:call.id,site:call.site,argument:{qualification:'source-object-origin-only',source:call.origin.source,...(creator?{creator}:{})},...(caller?{caller}:{})};
  },
  caller(call){
   if(!valid(call))return {reason:'source-context-call-unproved'};
   if(!finished(call.caller))return {reason:'source-context-caller-unavailable'};
   if(!finished(call.origin.frame))return {reason:'source-context-creator-unavailable'};
   if(call.caller!==call.origin.frame)return {reason:'source-context-creator-not-caller'};
   return {frame:call.caller};
  }
 };
}`;
