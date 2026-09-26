import ts from 'typescript';
import {readReactRuntimeExport,type ReactRuntimeExportDefinition} from './react-runtime-export.js';
import {readReactElementClosures} from './react-element-closure.js';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';

export interface ReactContextCall {
  call:HelperSourcePoint;
  argument:HelperSourcePoint;
  binding:HelperSourcePoint;
  enclosingFunction:HelperSourcePoint|null;
  receiver:'bare'|'default'|'namespace';
}
export interface ReactContextRest {
  binding:HelperSourcePoint;declaration:HelperSourcePoint;input:HelperSourcePoint;
  name:string;excluded:string[];
}
export interface ReactContextHelper {
  source:HelperSourcePoint;name:string;calls:HelperSourcePoint[];returns:HelperSourcePoint[];
  closureReads?:Array<{read:HelperSourcePoint;name:string;kind:'value'|'typeof';binding?:HelperSourcePoint}>;
}
export interface ReactContextConsumerCall {
  call:HelperSourcePoint;callee:HelperSourcePoint;consumer:HelperSourcePoint;arguments:HelperSourcePoint[];
}
export interface ReactContextFactoryCall extends ReactContextConsumerCall {factory:'jsx'|'jsxs'}

export interface ReactContextBindings {
  reads:Array<{read:HelperSourcePoint;binding:HelperSourcePoint;consumer:HelperSourcePoint;name:string;kind:'value'|'typeof'}>;
  functions:Array<{source:HelperSourcePoint;name:string}>;
}
/** Observe a module lexical binding only at an original read. This plan does
 * not assume its initializer remains current, nor reflect the resulting value. */
export function planReactContextBindings(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[]):ReactContextBindings{
  const result:ReactContextBindings={reads:[],functions:[]};
  for(const name of [...new Set(initializers.map(i=>i.render.file))].sort()){
    const file=path.resolve(reference.sourceRoot,name),real=realpathSync(file),hash=reference.files[real];
    if(file!==real||!hash)throw Error('context-binding-source-unavailable');
    const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('context-binding-source-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
    const closures=readReactElementClosures(sf),nodes=new Map<string,ts.Node>();
    const spanKey=(start:number,end:number)=>JSON.stringify([start,end]);
    const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
    const scan=(n:ts.Node)=>{nodes.set(spanKey(n.getStart(sf),n.end),n);ts.forEachChild(n,scan);};scan(sf);
    for(const initializer of initializers.filter(i=>i.render.file===name)){
      const fn=nodes.get(spanKey(initializer.render.start,initializer.render.end));
      if(initializer.render.sha256!==hash||!fn||!(ts.isArrowFunction(fn)||ts.isFunctionExpression(fn)))throw Error('context-binding-render-changed');
      let reads:ReturnType<typeof closures>['reads'];
      try{reads=closures(fn).reads;}catch(error){if(error instanceof Error&&error.message==='element-closure-reserved-binding')continue;throw error;}
      for(const read of reads){
        if(!read.declaration)continue;
        const d=nodes.get(spanKey(read.declaration.span.start,read.declaration.span.end));
        const variable=d&&ts.isVariableDeclaration(d)&&ts.isIdentifier(d.name)&&ts.isVariableDeclarationList(d.parent)&&ts.isVariableStatement(d.parent.parent)&&ts.isSourceFile(d.parent.parent.parent);
        const declaration=d&&ts.isFunctionDeclaration(d)&&d.name&&ts.isSourceFile(d.parent);
        if(!d||!variable&&!declaration)continue;
        result.reads.push({read:{file:name,sha256:hash,...read.span},binding:point(d),consumer:initializer.render,name:read.name,kind:read.kind});
        if(declaration&&!result.functions.some(f=>f.source.file===name&&f.source.start===d.getStart(sf)&&f.source.end===d.end))result.functions.push({source:point(d),name:d.name!.text});
      }
    }
  }
  return result;
}

/** Candidate bare calls in an authenticated original render. These sites do
 * not name or prove a context helper. Runtime function identity decides which,
 * if any, invokes a registered helper; all other calls remain unqualified. */
export function planReactContextConsumerCalls(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[]):ReactContextConsumerCall[]{
  return planRenderCalls(reference,initializers,false);
}
/** Original named JSX-runtime calls inside registered render bodies. Neither a
 * plan nor a target expression's spelling establishes its actual runtime value. */
export function planReactContextFactoryCalls(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[]):ReactContextFactoryCall[]{
  return planRenderCalls(reference,initializers,true).map(p=>{if(!p.factory)throw Error('context-factory-plan-unavailable');return {...p,factory:p.factory};});
}
function planRenderCalls(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[],factories:boolean):Array<ReactContextConsumerCall & {factory?:'jsx'|'jsxs'}>{
  const result:Array<ReactContextConsumerCall & {factory?:'jsx'|'jsxs'}>=[];
  for(const name of [...new Set(initializers.map(i=>i.render.file))].sort()){
    const file=path.resolve(reference.sourceRoot,name),real=realpathSync(file),hash=reference.files[real];
    if(file!==real||!hash)throw Error('context-consumer-source-unavailable');
    const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('context-consumer-source-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const checker=ts.createProgram([file],{allowJs:true,noResolve:true,noLib:true},host).getTypeChecker();
    const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
    const globalAvailable=(n:ts.Node)=>!checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
    const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
    const excludedImport=(n:ts.Identifier)=>{
      const ds=checker.getSymbolAtLocation(n)?.declarations,d=ds?.length===1?ds[0]:undefined;
      if(!d||!ts.isImportSpecifier(d))return false;
      const imp=d.parent.parent.parent;
      return ts.isImportDeclaration(imp)&&ts.isStringLiteral(imp.moduleSpecifier)&&['react','react/jsx-runtime','react/jsx-dev-runtime'].includes(imp.moduleSpecifier.text);
    };
    const factoryImport=(n:ts.Identifier):'jsx'|'jsxs'|undefined=>{
      const ds=checker.getSymbolAtLocation(n)?.declarations,d=ds?.length===1?ds[0]:undefined;
      if(!d||!ts.isImportSpecifier(d)||d.isTypeOnly||d.parent.parent.isTypeOnly)return;
      const imp=d.parent.parent.parent,name=(d.propertyName??d.name).text;
      if(ts.isImportDeclaration(imp)&&ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react/jsx-runtime'&&(name==='jsx'||name==='jsxs'))return name;
    };
    const visit=(n:ts.Node)=>{
      const initializer=initializers.find(i=>i.render.file===name&&i.render.sha256===hash&&i.render.start===n.getStart(sf)&&i.render.end===n.end);
      if(initializer){
        if(!(ts.isFunctionExpression(n)||ts.isArrowFunction(n))||!n.body)throw Error('context-consumer-render-changed');
        const inspect=(a:ts.Node)=>{
          if(ts.isFunctionLike(a))return;
          if(ts.isCallExpression(a)&&!a.questionDotToken&&a.arguments.length<=10000&&!a.arguments.some(ts.isSpreadElement)){
            const callee=unwrap(a.expression);
            const factory=ts.isIdentifier(callee)?factoryImport(callee):undefined;
            if(ts.isIdentifier(callee)&&callee.text!=='eval'&&(factories?factory&&a.arguments.length>=2&&a.arguments.length<=3:!excludedImport(callee))&&globalAvailable(a)){
              let unsafe=false;
              const scan=(v:ts.Node)=>{
                if(ts.isAwaitExpression(v)||ts.isYieldExpression(v))unsafe=true;
                if(ts.isCallExpression(v)){const fn=unwrap(v.expression);if(ts.isIdentifier(fn)&&fn.text==='eval')unsafe=true;}
                ts.forEachChild(v,scan);
              };a.arguments.forEach(scan);
              if(!unsafe)result.push({call:point(a),callee:point(callee),consumer:initializer.render,arguments:a.arguments.map(point),...(factories?{factory}:{})});
            }
          }
          ts.forEachChild(a,inspect);
        };inspect(n.body);return;
      }
      ts.forEachChild(n,visit);
    };visit(sf);
  }
  return result;
}

/** Synchronous declaration boundaries only. This authenticates an executing
 * function instance, not its closure values, caller or effects. Keep eval,
 * nested declarations and finally overrides outside this bounded transform. */
export function planReactContextHelpers(reference:ReactHelperReference,calls:readonly ReactContextCall[]):ReactContextHelper[]{
  const result:ReactContextHelper[]=[];
  for(const name of [...new Set(calls.map(c=>c.call.file))].sort()){
    const file=path.resolve(reference.sourceRoot,name),real=realpathSync(file),hash=reference.files[real];
    if(file!==real||!hash)throw Error('context-helper-source-unavailable');
    const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('context-helper-source-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:name.endsWith('.jsx')?ts.ScriptKind.JSX:/\.[cm]?js$/.test(name)?ts.ScriptKind.JS:ts.ScriptKind.TS);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const checker=ts.createProgram([file],{allowJs:true,noResolve:true,noLib:true},host).getTypeChecker();
    // Keep the lexical inventory's checker separate from the planner AST.
    const planning=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:name.endsWith('.jsx')?ts.ScriptKind.JSX:/\.[cm]?js$/.test(name)?ts.ScriptKind.JS:ts.ScriptKind.TS),closures=readReactElementClosures(planning),closureFunctions=new Map<string,ts.FunctionDeclaration>();
    const scanClosures=(n:ts.Node)=>{if(ts.isFunctionDeclaration(n))closureFunctions.set(JSON.stringify([n.getStart(planning),n.end]),n);ts.forEachChild(n,scanClosures);};scanClosures(planning);
    const globalAvailable=(node:ts.Node)=>!checker.getSymbolsInScope(node,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
    const point=(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end});
    const visit=(n:ts.Node)=>{
      if(ts.isFunctionDeclaration(n)&&n.name&&n.body&&!n.asteriskToken&&!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)&&(ts.isBlock(n.parent)||ts.isSourceFile(n.parent))){
        const source=point(n),sites=calls.filter(c=>JSON.stringify(c.enclosingFunction)===JSON.stringify(source));
        if(sites.length&&sites.every(c=>c.call.start>=n.body!.getStart(sf)&&c.call.end<=n.body!.end)){
          let unsafe=!globalAvailable(n.parent)||!globalAvailable(n.body);const returns:HelperSourcePoint[]=[];
          const inspect=(a:ts.Node)=>{
            if(ts.isFunctionDeclaration(a)||ts.isClassDeclaration(a)||ts.isTryStatement(a)||ts.isWithStatement(a))unsafe=true;
            if(ts.isCallExpression(a)){
              let expression:ts.Expression=a.expression;while(ts.isParenthesizedExpression(expression))expression=expression.expression;
              if(ts.isIdentifier(expression)&&expression.text==='eval')unsafe=true;
            }
            // A declaration-name read at entry must not resolve to a parameter
            // or a function-scoped var with the same spelling.
            if((ts.isVariableDeclaration(a)||ts.isParameter(a)||ts.isBindingElement(a))&&ts.isIdentifier(a.name)&&a.name.text===n.name!.text)unsafe=true;
            if(ts.isReturnStatement(a)){returns.push(point(a));if(!globalAvailable(a))unsafe=true;}
            if(ts.isFunctionLike(a))return;
            ts.forEachChild(a,inspect);
          };
          n.parameters.forEach(inspect);inspect(n.body);
          if(!unsafe){
            const original=closureFunctions.get(JSON.stringify([source.start,source.end]));if(!original)throw Error('context-helper-closure-source-missing');
            let inventory:ReturnType<typeof closures>;
            try{inventory=closures(original);}catch(error){if(error instanceof Error&&error.message==='element-closure-reserved-binding')return;throw error;}
            const closureReads=inventory.reads.map(r=>({read:{file:name,sha256:hash,...r.span},name:r.name,kind:r.kind,...(r.declaration?{binding:{file:name,sha256:hash,...r.declaration.span}}:{})}));
            result.push({source,name:n.name.text,calls:sites.map(c=>c.call),returns,closureReads});
          }
        }
      }
      ts.forEachChild(n,visit);
    };visit(sf);
  }
  return result;
}

/** The result of native object-rest syntax is a fresh data object. Recording
 * that allocation does not establish the input's origin or field computation. */
export function readReactContextRests(text:string,file:string,sha256:string):ReactContextRest[]{
  if(createHash('sha256').update(text).digest('hex')!==sha256)throw Error('context-rest-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.jsx')?ts.ScriptKind.JSX:/\.[cm]?js$/.test(file)?ts.ScriptKind.JS:ts.ScriptKind.TS);
  const point=(n:ts.Node):HelperSourcePoint=>({file,sha256,start:n.getStart(sf),end:n.end}),result:ReactContextRest[]=[];
  const visit=(n:ts.Node)=>{
    if(ts.isVariableDeclaration(n)&&ts.isObjectBindingPattern(n.name)&&n.initializer&&ts.isIdentifier(n.initializer)&&ts.isVariableDeclarationList(n.parent)&&
       (n.parent.flags&ts.NodeFlags.Const)&&n.parent.declarations.length===1&&ts.isVariableStatement(n.parent.parent)&&
       (ts.isBlock(n.parent.parent.parent)||ts.isSourceFile(n.parent.parent.parent))){
      const elements=n.name.elements,rest=elements[elements.length-1];
      if(rest?.dotDotDotToken&&ts.isIdentifier(rest.name)&&!rest.initializer&&!rest.propertyName&&elements.slice(0,-1).every(e=>!e.dotDotDotToken&&ts.isIdentifier(e.name)&&(!e.propertyName||ts.isIdentifier(e.propertyName)||ts.isStringLiteral(e.propertyName))))
        result.push({binding:point(rest),declaration:point(n),input:point(n.initializer),name:rest.name.text,excluded:elements.slice(0,-1).map(e=>(e.propertyName??e.name as ts.Identifier) as ts.Identifier|ts.StringLiteral).map(n=>n.text)});
    }
    ts.forEachChild(n,visit);
  };visit(sf);return result;
}

export function planReactContextRests(reference:ReactHelperReference,calls:readonly ReactContextCall[]):ReactContextRest[]{
  const results:ReactContextRest[]=[];
  for(const name of [...new Set(calls.map(c=>c.call.file))].sort()){
    const file=path.resolve(reference.sourceRoot,name),real=realpathSync(file),hash=reference.files[real];
    if(file!==real||!hash)throw Error('context-rest-source-unavailable');
    results.push(...readReactContextRests(readFileSync(file,'utf8'),name,hash));
  }
  return results;
}

/** Direct source imports only. A spelling, alias assigned elsewhere, optional
 * call or framework-internal read does not establish a source hook call. */
export function readReactContextCalls(text:string,file:string,sha256:string):ReactContextCall[]{
  if(createHash('sha256').update(text).digest('hex')!==sha256)throw Error('context-call-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.jsx')?ts.ScriptKind.JSX:/\.[cm]?js$/.test(file)?ts.ScriptKind.JS:ts.ScriptKind.TS);
  if(!sf.statements.some(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='react'))return [];
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noResolve:true,noLib:true},host).getTypeChecker();
  const point=(n:ts.Node):HelperSourcePoint=>({file,sha256,start:n.getStart(sf),end:n.end}),result:ReactContextCall[]=[];
  const visit=(n:ts.Node)=>{
    if(ts.isCallExpression(n)&&!n.questionDotToken&&n.arguments.length===1&&!ts.isSpreadElement(n.arguments[0])){
      let callee:ts.Expression=n.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
      const member=ts.isPropertyAccessExpression(callee)&&!callee.questionDotToken&&callee.name.text==='useContext'?callee:undefined;
      const id=ts.isIdentifier(callee)?callee:member&&ts.isIdentifier(member.expression)?member.expression:undefined;
      const declarations=id&&checker.getSymbolAtLocation(id)?.declarations,d=declarations?.length===1?declarations[0]:undefined;
      let imp:ts.ImportDeclaration|undefined,receiver:ReactContextCall['receiver']|undefined;
      if(d&&ts.isImportSpecifier(d)&&!member&&!d.isTypeOnly&&!d.parent.parent.isTypeOnly&&(d.propertyName??d.name).text==='useContext'&&ts.isImportDeclaration(d.parent.parent.parent)){imp=d.parent.parent.parent;receiver='bare';}
      if(d&&ts.isNamespaceImport(d)&&member&&!d.parent.isTypeOnly&&ts.isImportDeclaration(d.parent.parent)){imp=d.parent.parent;receiver='namespace';}
      if(d&&ts.isImportClause(d)&&member&&!d.isTypeOnly&&ts.isImportDeclaration(d.parent)){imp=d.parent;receiver='default';}
      let suspends=false;
      // Moving a direct eval into the receiver-capture arrow changes its var
      // scope; suspension syntax also cannot cross that function boundary.
      const suspension=(a:ts.Node)=>{
        if(ts.isAwaitExpression(a)||ts.isYieldExpression(a))suspends=true;
        if(ts.isCallExpression(a)){
          let fn:ts.Expression=a.expression;while(ts.isParenthesizedExpression(fn))fn=fn.expression;
          if(ts.isIdentifier(fn)&&fn.text==='eval')suspends=true;
        }
        ts.forEachChild(a,suspension);
      };suspension(n.arguments[0]);
      if(imp&&receiver&&d&&ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react'&&!suspends){
        let enclosing:ts.Node|undefined=n.parent;while(enclosing&&!ts.isFunctionLike(enclosing))enclosing=enclosing.parent;
        result.push({call:point(n),argument:point(n.arguments[0]),binding:point(d),enclosingFunction:enclosing?point(enclosing):null,receiver});
      }
    }
    ts.forEachChild(n,visit);
  };visit(sf);return result;
}

export function planReactContextCalls(reference:ReactHelperReference):ReactContextCall[]{
  const calls:ReactContextCall[]=[];
  for(const [file,hash] of Object.entries(reference.files).sort(([a],[b])=>a.localeCompare(b))){
    if(!/\.[cm]?[jt]sx?$/.test(file)||/\.d\.[cm]?ts$/.test(file))continue;
    if(realpathSync(file)!==file)throw Error('context-call-source-path-changed');
    const text=readFileSync(file,'utf8');
    if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('context-call-source-changed');
    // This is only a parsing optimization. The checker establishes identity.
    if(!text.includes('useContext')||!text.includes('react'))continue;
    calls.push(...readReactContextCalls(text,path.relative(reference.sourceRoot,file),hash));
  }
  return calls;
}


export interface ReactContextTargets {
  reads:Array<{read:HelperSourcePoint;object:HelperSourcePoint;consumer:HelperSourcePoint;property:string;origin:ReactRuntimeExportDefinition}>;
  objects:HelperSourcePoint[];
}
/** Imported component-table reads and fresh literal allocations in their
 * resolved source modules. Allocation origin is not initialization purity. */
export function planReactContextTargets(reference:ReactHelperReference,factories:readonly ReactContextFactoryCall[]):ReactContextTargets {
  const reads:ReactContextTargets['reads']=[],objects:HelperSourcePoint[]=[];
  const cache=new Map<string,{sf:ts.SourceFile;checker:ts.TypeChecker;point:(n:ts.Node)=>HelperSourcePoint}>();
  const module=(name:string)=>{
    const prior=cache.get(name);if(prior)return prior;
    const file=path.resolve(reference.sourceRoot,name),hash=reference.files[file];
    if(realpathSync(file)!==file||!hash)throw Error('context-target-source-unavailable');
    const text=readFileSync(file,'utf8');if(createHash('sha256').update(text).digest('hex')!==hash)throw Error('context-target-source-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:name.endsWith('.jsx')?ts.ScriptKind.JSX:/\.[cm]?js$/.test(name)?ts.ScriptKind.JS:ts.ScriptKind.TS);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker();
    const value={sf,checker,point:(n:ts.Node):HelperSourcePoint=>({file:name,sha256:hash,start:n.getStart(sf),end:n.end})};cache.set(name,value);return value;
  };
  for(const factory of factories){
    const {sf,checker,point}=module(factory.call.file);let target:ts.Node|undefined;
    const locate=(n:ts.Node)=>{if(n.getStart(sf)===factory.arguments[0].start&&n.end===factory.arguments[0].end)target=n;ts.forEachChild(n,locate);};locate(sf);
    if(!target)throw Error('context-target-expression-missing');
    const node=target as ts.Node;
    const base=ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)?node.expression:undefined;
    const property=ts.isPropertyAccessExpression(node)?node.name.text:ts.isElementAccessExpression(node)&&ts.isStringLiteral(node.argumentExpression)?node.argumentExpression.text:undefined;
    if(!base||!ts.isIdentifier(base)||property===undefined||('questionDotToken' in node&&node.questionDotToken))continue;
    const declarations=checker.getSymbolAtLocation(base)?.declarations,d=declarations?.length===1?declarations[0]:undefined;
    if(!d||!(ts.isImportSpecifier(d)&&!d.isTypeOnly&&!d.parent.parent.isTypeOnly||ts.isImportClause(d)&&d.name&&!d.isTypeOnly))continue;
    let parent:ts.Node=d;while(parent.parent&&!ts.isImportDeclaration(parent))parent=parent.parent;
    if(!ts.isImportDeclaration(parent)||!ts.isStringLiteral(parent.moduleSpecifier))continue;
    const specifier=parent.moduleSpecifier.text;
    const edge=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===sf.fileName&&e.specifier===specifier).map(e=>e.file))];if(edge.length!==1)continue;
    const resolved=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,edge[0]).split(path.sep).join('/'),[ts.isImportSpecifier(d)?(d.propertyName??d.name).text:'default']);
    if(resolved.status!=='resolved')continue;
    reads.push({read:point(node),object:point(base),consumer:factory.consumer,property,origin:resolved.definition});
  }
  for(const name of [...new Set(reads.map(r=>r.origin.module))].sort()){
    const {sf,checker,point}=module(name);
    const safe=(n:ts.Node)=>{
      if(checker.getSymbolsInScope(n,ts.SymbolFlags.Value).find(s=>s.name==='globalThis')?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d)))return false;
      for(let a=n.parent;a;a=a.parent){
        if(ts.isWithStatement(a))return false;
        if(ts.isBinaryExpression(a)&&a.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&a.operatorToken.kind<=ts.SyntaxKind.LastAssignment&&n.pos>=a.left.pos&&n.end<=a.left.end)return false;
        if((ts.isForInStatement(a)||ts.isForOfStatement(a))&&n.pos>=a.initializer.pos&&n.end<=a.initializer.end)return false;
      }
      return true;
    };
    const visit=(n:ts.Node)=>{if(ts.isObjectLiteralExpression(n)&&safe(n))objects.push(point(n));ts.forEachChild(n,visit);};visit(sf);
  }
  if(reads.length>10000||objects.length>10000)throw Error('context-target-plan-limit');
  return {reads,objects};
}
