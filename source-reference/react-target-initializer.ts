import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReactRuntimeExport,type ReactRuntimeExportDefinition} from './react-runtime-export.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';

export interface ReactTargetInitializer {
  version:1;acceptedContract:null;effectsVerified:false;
  qualification:'forward-ref-initializer-plan-only';
  target:ReactRuntimeExportDefinition;
  call:HelperSourcePoint;render:HelperSourcePoint;
  naming?:{call:HelperSourcePoint;helper:HelperSourcePoint;nativeAlias:HelperSourcePoint;nativeName:string;helperName:string;name:string};
}

/** Locate an executable initializer without running it. The runtime must still
 * authenticate the function literal, optional naming helper, pinned forwardRef
 * call, resulting object and unchanged export identity. Render effects and
 * behavior are not inferred from an initializer or component name. */
export function readReactTargetInitializer(reference:ReactHelperReference,target:ReactRuntimeExportDefinition):ReactTargetInitializer {
  const fail=(why:string):never=>{throw Error('target-initializer-'+why);};
  const current=readReactRuntimeExport(reference,target.module,[target.exportName]);
  if(current.status!=='resolved'||JSON.stringify(current.definition)!==JSON.stringify(target))fail('export-changed');
  const file=realpathSync(path.resolve(reference.sourceRoot,target.module)),text=readFileSync(file,'utf8'),hash=createHash('sha256').update(text).digest('hex');
  if(hash!==target.sourceSha256||reference.files[file]!==hash)fail('source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>path.dirname(file),getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker();
  const point=(node:ts.Node):HelperSourcePoint=>({file:target.module,sha256:hash,start:node.getStart(sf),end:node.end});
  const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isSatisfiesExpression(n)||ts.isNonNullExpression(n)?unwrap(n.expression):n;
  const declaration=(node:ts.Node)=>{const ds=checker.getSymbolAtLocation(node)?.declarations;if(ds?.length!==1)return fail('binding-ambiguous');return ds[0];};
  let found:ts.Node|undefined;const walk=(n:ts.Node)=>{if(n.getStart(sf)===target.span.start&&n.end===target.span.end)found=n;ts.forEachChild(n,walk);};walk(sf);
  if(!found||!ts.isVariableDeclaration(found)||!found.initializer)return fail('declaration-unmodeled');
  const call=unwrap(found.initializer);if(!ts.isCallExpression(call)||call.questionDotToken||call.arguments.length!==1)return fail('call-unmodeled');
  const factory=unwrap(call.expression);let imported:ts.Node|undefined,exportName:string|undefined;
  if(ts.isIdentifier(factory)){imported=declaration(factory);if(ts.isImportSpecifier(imported))exportName=(imported.propertyName??imported.name).text;}
  else if(ts.isPropertyAccessExpression(factory)&&!factory.questionDotToken&&ts.isIdentifier(factory.expression)){imported=declaration(factory.expression);exportName=factory.name.text;}
  let clause:ts.ImportClause|undefined;
  if(imported&&ts.isImportSpecifier(imported)&&!imported.isTypeOnly){clause=imported.parent.parent;if(ts.isPropertyAccessExpression(factory)&&(imported.propertyName??imported.name).text!=='default')fail('factory-import-unmodeled');}
  else if(imported&&ts.isNamespaceImport(imported))clause=imported.parent;
  else if(imported&&ts.isImportClause(imported))clause=imported;
  if(exportName!=='forwardRef'||!clause||clause.isTypeOnly||!ts.isImportDeclaration(clause.parent)||!ts.isStringLiteral(clause.parent.moduleSpecifier)||clause.parent.moduleSpecifier.text!=='react')fail('factory-import-unmodeled');
  let render=unwrap(call.arguments[0]);let naming:ReactTargetInitializer['naming'];
  if(ts.isCallExpression(render)){
    const result=readReactFunctionNaming(sf,checker,render,point,fail);naming=result.naming;render=result.value;
  }
  if(!(ts.isFunctionExpression(render)||ts.isArrowFunction(render))||render.modifiers?.length||ts.isFunctionExpression(render)&&render.asteriskToken||render.parameters.length!==2||render.parameters.some(p=>p.initializer||p.dotDotDotToken))return fail('render-unmodeled');
  return {version:1,acceptedContract:null,effectsVerified:false,qualification:'forward-ref-initializer-plan-only',target,call:point(call),render:point(render),...(naming?{naming}:{})};
}

/** Reusable source proof for the compiler's native function-name helper. The
 * runtime must still authenticate the helper, native alias and exact write. */
export function readReactFunctionNaming(sf:ts.SourceFile,checker:ts.TypeChecker,nameCall:ts.CallExpression,point:(node:ts.Node)=>HelperSourcePoint,fail:(why:string)=>never=(why)=>{throw Error('function-'+why);}){
 const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isSatisfiesExpression(n)||ts.isNonNullExpression(n)?unwrap(n.expression):n;
 const declaration=(node:ts.Node)=>{const ds=checker.getSymbolAtLocation(node)?.declarations;if(ds?.length!==1)return fail('binding-ambiguous');return ds[0];};
    const callee=unwrap(nameCall.expression);
    if(nameCall.questionDotToken||!ts.isIdentifier(callee)||nameCall.arguments.length!==2||!ts.isStringLiteral(nameCall.arguments[1]))return fail('naming-call-unmodeled');
    const decl=declaration(callee);if(!ts.isVariableDeclaration(decl)||!ts.isIdentifier(decl.name)||!decl.initializer)return fail('naming-helper-unmodeled');
    const helper=unwrap(decl.initializer);
    if(!ts.isArrowFunction(helper)||helper.modifiers?.length||helper.parameters.length!==2||helper.parameters.some(p=>!ts.isIdentifier(p.name)||p.initializer||p.dotDotDotToken)||ts.isBlock(helper.body))return fail('naming-helper-unmodeled');
    const body=unwrap(helper.body);if(!ts.isCallExpression(body)||body.questionDotToken||body.arguments.length!==3||!ts.isIdentifier(body.expression))return fail('naming-body-unmodeled');
    if(checker.getSymbolAtLocation(body.arguments[0])!==checker.getSymbolAtLocation(helper.parameters[0].name)||!ts.isStringLiteral(body.arguments[1])||body.arguments[1].text!=='name')fail('naming-target-unmodeled');
    const descriptor=body.arguments[2];if(!ts.isObjectLiteralExpression(descriptor)||descriptor.properties.length!==2)return fail('naming-descriptor-unmodeled');
    const [value,config]=descriptor.properties;
    const valueExpr=ts.isShorthandPropertyAssignment(value)?value.name:ts.isPropertyAssignment(value)?value.initializer:undefined;
    const valueSymbol=valueExpr&&ts.isShorthandPropertyAssignment(value)?checker.getShorthandAssignmentValueSymbol(value):valueExpr&&checker.getSymbolAtLocation(valueExpr);
    if(!value.name||value.name.getText(sf)!=='value'||valueSymbol!==checker.getSymbolAtLocation(helper.parameters[1].name)||!ts.isPropertyAssignment(config)||config.name.getText(sf)!=='configurable'||config.initializer.kind!==ts.SyntaxKind.TrueKeyword)fail('naming-descriptor-unmodeled');
    const alias=declaration(body.expression);if(!ts.isVariableDeclaration(alias)||!ts.isIdentifier(alias.name)||!alias.initializer)return fail('naming-native-unmodeled');
    const native=unwrap(alias.initializer);
    if(!ts.isPropertyAccessExpression(native)||native.questionDotToken||native.name.text!=='defineProperty'||!ts.isIdentifier(native.expression)||native.expression.text!=='Object'||checker.getSymbolAtLocation(native.expression)?.declarations?.length)fail('naming-native-unmodeled');
    const naming={call:point(nameCall),helper:point(helper),nativeAlias:point(alias),nativeName:alias.name.text,helperName:decl.name.text,name:nameCall.arguments[1].text};return {naming,value:unwrap(nameCall.arguments[0])};
}
