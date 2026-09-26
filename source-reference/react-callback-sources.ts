import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactContextConsumerCall,ReactContextHelper} from './react-context-calls.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactElementClosures} from './react-element-closure.js';

export interface ReactCallbackSources {
  hooks:Array<{call:HelperSourcePoint;callee:HelperSourcePoint;owner:HelperSourcePoint;receiver:'bare'|'namespace'|'default'}>;
  consumers:Array<{call:HelperSourcePoint;source:HelperSourcePoint}>;
  functions:Array<{source:HelperSourcePoint;name:string;parameters:Array<{binding:HelperSourcePoint;name:string;rest:boolean}>;returns:HelperSourcePoint[]}>;
  calls:Array<{call:HelperSourcePoint;callee:HelperSourcePoint;caller:HelperSourcePoint;source:HelperSourcePoint}>;
  callbacks:Array<{source:HelperSourcePoint;owner:HelperSourcePoint;captures:Array<{binding:HelperSourcePoint;name:string}>;
    dependencies:Array<{read:HelperSourcePoint;name:string;binding?:HelperSourcePoint}>}>;
}
const same=(a:HelperSourcePoint,b:HelperSourcePoint)=>a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;

/** Resolve original imported hook helpers through captured executable edges.
 * Register their actual calls and directly returned callback literals with
 * enclosing rest-parameter captures. This is provenance, not a body/effects
 * model; other captures and callback forms remain outside this rule. */
export function planReactCallbackSources(reference:ReactHelperReference,consumers:readonly ReactContextConsumerCall[],excluded:readonly ReactContextHelper[]=[]):ReactCallbackSources {
  const result:ReactCallbackSources={hooks:[],consumers:[],functions:[],calls:[],callbacks:[]};
  const cache=new Map<string,ReturnType<typeof parse>>();
  function parse(name:string){
    const file=path.resolve(reference.sourceRoot,name),real=realpathSync(file),hash=reference.files[file];
    if(file!==real||!hash)throw Error('callback-source-file-unavailable');
    const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('callback-source-file-changed');
    const kind=name.endsWith('.tsx')?ts.ScriptKind.TSX:/\.[cm]?js$/.test(name)?ts.ScriptKind.JS:ts.ScriptKind.TS,sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,kind);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),nodes=new Map<string,ts.Node>();
    const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
    const span=(n:ts.Node)=>JSON.stringify([n.getStart(sf),n.end]);
    const scan=(n:ts.Node)=>{nodes.set(span(n),n);ts.forEachChild(n,scan);};scan(sf);
    const other=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,kind),closures=readReactElementClosures(other),callbacks=new Map<string,ts.ArrowFunction|ts.FunctionExpression>();
    const scanOther=(n:ts.Node)=>{if(ts.isArrowFunction(n)||ts.isFunctionExpression(n))callbacks.set(JSON.stringify([n.getStart(other),n.end]),n);ts.forEachChild(n,scanOther);};scanOther(other);
    const declaration=(n:ts.Identifier)=>{const symbol=ts.isShorthandPropertyAssignment(n.parent)?checker.getShorthandAssignmentValueSymbol(n.parent):checker.getSymbolAtLocation(n);const ds=symbol?.declarations;return ds?.length===1?ds[0]:undefined;};
    const globalAvailable=(n:ts.Node)=>!checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
    return {sf,checker,nodes,point,span,closures,callbacks,declaration,globalAvailable};
  }
  function module(name:string){let m=cache.get(name);if(!m){m=parse(name);cache.set(name,m);}return m;}
  const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
  function imported(m:ReturnType<typeof parse>,n:ts.Identifier){
    const d=m.declaration(n);if(!d||!(ts.isImportSpecifier(d)||ts.isImportClause(d)))return;
    if(d.isTypeOnly||ts.isImportSpecifier(d)&&d.parent.parent.isTypeOnly)return;
    const imp=ts.isImportSpecifier(d)?d.parent.parent.parent:d.parent;
    if(!ts.isImportDeclaration(imp)||!ts.isStringLiteral(imp.moduleSpecifier))return;
    return {specifier:imp.moduleSpecifier.text,name:ts.isImportSpecifier(d)?(d.propertyName??d.name).text:'default'};
  }
  function nativeCallback(m:ReturnType<typeof parse>,n:ts.CallExpression):'bare'|'namespace'|'default'|undefined{
    if(n.questionDotToken||n.arguments.length!==2||n.arguments.some(ts.isSpreadElement))return;
    const callee=unwrap(n.expression);
    if(ts.isIdentifier(callee)){const imp=imported(m,callee);if(imp?.specifier==='react'&&imp.name==='useCallback')return 'bare';}
    else if(ts.isPropertyAccessExpression(callee)&&!callee.questionDotToken&&callee.name.text==='useCallback'&&ts.isIdentifier(callee.expression)){
      const d=m.declaration(callee.expression),imp=d&&(ts.isNamespaceImport(d)?d.parent.parent:ts.isImportClause(d)?d.parent:undefined);
      if(imp&&ts.isImportDeclaration(imp)&&ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react')return d&&ts.isNamespaceImport(d)?'namespace':'default';
    }
  }
  function hasNativeCallback(m:ReturnType<typeof parse>,fn:ts.FunctionDeclaration){
    let found=false;const scan=(n:ts.Node)=>{if(ts.isFunctionLike(n)&&n!==fn)return;if(ts.isCallExpression(n)&&nativeCallback(m,n))found=true;ts.forEachChild(n,scan);};scan(fn);return found;
  }
  function safe(m:ReturnType<typeof parse>,fn:ts.FunctionDeclaration){
    if(!fn.name||!fn.body||!ts.isSourceFile(fn.parent)||fn.asteriskToken||fn.modifiers?.some(x=>x.kind===ts.SyntaxKind.AsyncKeyword)||!m.globalAvailable(fn)||!m.globalAvailable(fn.body)||fn.parameters.some(p=>!ts.isIdentifier(p.name)||p.initializer)||excluded.some(p=>same(p.source,m.point(fn))))return false;
    let ok=true;const scan=(n:ts.Node)=>{
      if((ts.isReturnStatement(n)||ts.isCallExpression(n))&&!m.globalAvailable(n))ok=false;
      if(ts.isTryStatement(n)||ts.isWithStatement(n)||ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n))ok=false;
      if(ts.isCallExpression(n)&&ts.isIdentifier(unwrap(n.expression))&&(unwrap(n.expression) as ts.Identifier).text==='eval')ok=false;
      if((ts.isVariableDeclaration(n)||ts.isBindingElement(n)||ts.isParameter(n))&&ts.isIdentifier(n.name)&&n.name.text===fn.name!.text)ok=false;
      if(ts.isFunctionLike(n))return;ts.forEachChild(n,scan);
    };fn.parameters.forEach(scan);scan(fn.body);return ok;
  }
  const visited=new Set<string>();
  function add(m:ReturnType<typeof parse>,fn:ts.FunctionDeclaration):boolean {
    const source=m.point(fn),id=JSON.stringify(source);if(visited.has(id))return true;if(!safe(m,fn))return false;
    if(visited.size>=256)throw Error('callback-source-function-limit');visited.add(id);
    const parameters=fn.parameters.map(p=>({binding:m.point(p),name:(p.name as ts.Identifier).text,rest:!!p.dotDotDotToken}));
    const entry={source,name:fn.name!.text,parameters,returns:[] as HelperSourcePoint[]};result.functions.push(entry);
    const scan=(n:ts.Node)=>{
      if(ts.isFunctionLike(n))return;
      if(ts.isReturnStatement(n)){
        entry.returns.push(m.point(n));
        const expression=n.expression&&unwrap(n.expression);
        if(expression&&(ts.isArrowFunction(expression)||ts.isFunctionExpression(expression))&&!(ts.isFunctionExpression(expression)&&expression.asteriskToken)&&!expression.modifiers?.some(x=>x.kind===ts.SyntaxKind.AsyncKeyword)){
          const original=m.callbacks.get(m.span(expression));if(!original)throw Error('callback-source-literal-missing');
          try{
            let supported=true;const reads:ReturnType<typeof m.closures>['reads']=[];
            const collect=(n:ts.Node)=>{if(ts.isFunctionLike(n)&&n.parameters.some(p=>!ts.isIdentifier(p.name)||p.initializer))supported=false;if(ts.isClassLike(n)||ts.isWithStatement(n)||ts.isMetaProperty(n)||n.kind===ts.SyntaxKind.ThisKeyword||n.kind===ts.SyntaxKind.SuperKeyword||ts.isIdentifier(n)&&n.text==='arguments'||ts.isFunctionLike(n)&&!(ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isFunctionDeclaration(n)))supported=false;if(ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isFunctionDeclaration(n))reads.push(...m.closures(n).reads);ts.forEachChild(n,collect);};collect(original);
            const captures:ReactCallbackSources['callbacks'][number]['captures']=[],dependencies:ReactCallbackSources['callbacks'][number]['dependencies']=[];
            for(const read of reads){
              const binding=read.declaration?{file:source.file,sha256:source.sha256,...read.declaration.span}:undefined;
              if(binding&&binding.start>=expression.getStart(m.sf)&&binding.end<=expression.end)continue;
              const parameter=parameters.find(p=>binding&&same(p.binding,binding));
              if(parameter){if(!parameter.rest)supported=false;else if(!captures.some(c=>same(c.binding,parameter.binding)))captures.push({binding:parameter.binding,name:parameter.name});}
              else if(binding&&binding.start>=source.start&&binding.end<=source.end)supported=false;
              else dependencies.push({read:{file:source.file,sha256:source.sha256,...read.span},name:read.name,...(binding?{binding}:{})});
            }
            // Captures denote a stable rest binding, not a mutable lexical cell.
            const captured=new Set(captures.map(c=>c.name));
            const containsCapture=(n:ts.Node):boolean=>{if(ts.isPropertyAccessExpression(n)||ts.isElementAccessExpression(n))return false;if(ts.isIdentifier(n)&&captured.has(n.text)){const d=m.declaration(n);if(d&&parameters.some(p=>p.rest&&same(p.binding,m.point(d))))return true;}return ts.forEachChild(n,containsCapture)??false;};
            const writes=(n:ts.Node)=>{
              if(ts.isCallExpression(n)&&ts.isIdentifier(unwrap(n.expression))&&(unwrap(n.expression) as ts.Identifier).text==='eval')supported=false;
              if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment&&containsCapture(n.left))supported=false;
              if((ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))&&(n.operator===ts.SyntaxKind.PlusPlusToken||n.operator===ts.SyntaxKind.MinusMinusToken)&&containsCapture(n.operand))supported=false;
              if((ts.isForInStatement(n)||ts.isForOfStatement(n))&&containsCapture(n.initializer))supported=false;
              ts.forEachChild(n,writes);
            };writes(fn.body!);
            if(supported&&captures.length)result.callbacks.push({source:m.point(expression),owner:source,captures,dependencies});
          }catch(error){if(!(error instanceof Error)||error.message!=='element-closure-reserved-binding')throw error;}
        }
      }
      if(ts.isCallExpression(n)&&!n.questionDotToken){
        const receiver=nativeCallback(m,n);if(receiver)result.hooks.push({call:m.point(n),callee:m.point(unwrap(n.expression)),owner:source,receiver});
        const callee=unwrap(n.expression),d=ts.isIdentifier(callee)?m.declaration(callee):undefined;
        if(d&&ts.isFunctionDeclaration(d)&&add(m,d))result.calls.push({call:m.point(n),callee:m.point(callee),caller:source,source:m.point(d)});
      }
      ts.forEachChild(n,scan);
    };scan(fn.body!);return true;
  }
  for(const consumer of consumers){
    const m=module(consumer.callee.file),callee=m.nodes.get(JSON.stringify([consumer.callee.start,consumer.callee.end]));
    if(!callee||!ts.isIdentifier(callee)||m.point(callee).sha256!==consumer.callee.sha256)continue;
    const imp=imported(m,callee);if(!imp||imp.specifier==='react')continue;
    const edges=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===m.sf.fileName&&e.specifier===imp.specifier).map(e=>e.file))];if(edges.length!==1)continue;
    const resolved=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,edges[0]).split(path.sep).join('/'),[imp.name]);if(resolved.status!=='resolved')continue;
    const target=module(resolved.definition.module),fn=target.nodes.get(JSON.stringify([resolved.definition.span.start,resolved.definition.span.end]));
    if(!fn||!ts.isFunctionDeclaration(fn)||!hasNativeCallback(target,fn)||!add(target,fn))continue;
    result.consumers.push({call:consumer.call,source:target.point(fn)});
  }
  if(result.calls.length>10000||result.callbacks.length>10000)throw Error('callback-source-plan-limit');
  return result;
}
