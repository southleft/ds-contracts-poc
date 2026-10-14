import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReactRuntimeExport,type ReactRuntimeExportDefinition} from './react-runtime-export.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';

export interface ReactAuthoredClassPlan {
  target:ReactRuntimeExportDefinition;
  render:HelperSourcePoint;
  name:string;
  constructorSource?:HelperSourcePoint;
  qualification:'original-class-render-boundary-only';
  effectsVerified:false;
  acceptedContract:null;
}

function transparentConstructor(owner:ts.ClassDeclaration):ts.ConstructorDeclaration|undefined|false {
  const constructors=owner.members.filter(ts.isConstructorDeclaration);if(!constructors.length)return undefined;
  if(constructors.length!==1)return false;
  const ctor=constructors[0];if(!ctor.body||ctor.modifiers?.length)return false;
  const statements=ctor.body.statements;
  const superProps=(statement:ts.Statement,name:string)=>ts.isExpressionStatement(statement)&&ts.isCallExpression(statement.expression)&&statement.expression.expression.kind===ts.SyntaxKind.SuperKeyword&&statement.expression.arguments.length===1&&ts.isIdentifier(statement.expression.arguments[0])&&statement.expression.arguments[0].text===name;
  if(ctor.parameters.length===1){const p=ctor.parameters[0];return ts.isIdentifier(p.name)&&!['globalThis','__DSC_CLASS_CONSTRUCTION',owner.name?.text].includes(p.name.text)&&!p.initializer&&!p.dotDotDotToken&&!p.modifiers?.length&&statements.length===1&&superProps(statements[0],p.name.text)?ctor:false;}
  if(ctor.parameters.length||statements.length!==2||!ts.isVariableStatement(statements[0])||statements[0].declarationList.declarations.length!==1)return false;
  const decl=statements[0].declarationList.declarations[0],value=decl.initializer;
  if(!ts.isIdentifier(decl.name)||['arguments','globalThis','__DSC_CLASS_CONSTRUCTION',owner.name?.text].includes(decl.name.text)||!value||!ts.isConditionalExpression(value)||!superProps(statements[1],decl.name.text))return false;
  const arg0=(n:ts.Node)=>ts.isElementAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='arguments'&&!!n.argumentExpression&&ts.isNumericLiteral(n.argumentExpression)&&n.argumentExpression.text==='0';
  const test=value.condition;
  return ts.isBinaryExpression(test)&&test.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&
    ts.isBinaryExpression(test.left)&&test.left.operatorToken.kind===ts.SyntaxKind.GreaterThanToken&&ts.isPropertyAccessExpression(test.left.left)&&ts.isIdentifier(test.left.left.expression)&&test.left.left.expression.text==='arguments'&&test.left.left.name.text==='length'&&ts.isNumericLiteral(test.left.right)&&test.left.right.text==='0'&&
    ts.isBinaryExpression(test.right)&&test.right.operatorToken.kind===ts.SyntaxKind.ExclamationEqualsEqualsToken&&arg0(test.right.left)&&ts.isIdentifier(test.right.right)&&test.right.right.text==='undefined'&&arg0(value.whenTrue)&&ts.isObjectLiteralExpression(value.whenFalse)&&value.whenFalse.properties.length===0?ctor:false;
}


/** Identify original class/render identities using the existing bounded class
 * source checks. This is a render-boundary plan, never a body/effects model. */
export function readReactAuthoredClasses(reference:ReactHelperReference,targets:readonly {module:string;exportName:string}[]):ReactAuthoredClassPlan[]{
  const result:ReactAuthoredClassPlan[]=[];
  for(const request of targets){
    const resolved=readReactRuntimeExport(reference,request.module,[request.exportName]);
    if(resolved.status!=='resolved')throw Error('authored-class-export-unresolved:'+resolved.reason);
    const target=resolved.definition,file=realpathSync(path.resolve(reference.sourceRoot,target.module));
    const text=readFileSync(file,'utf8'),hash=createHash('sha256').update(text).digest('hex');
    if(reference.files[file]!==hash||target.sourceSha256!==hash)throw Error('authored-class-source-changed');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    let owner:ts.ClassDeclaration|undefined;
    const walk=(node:ts.Node)=>{if(ts.isClassDeclaration(node)&&node.getStart(sf)===target.span.start&&node.end===target.span.end)owner=node;ts.forEachChild(node,walk);};walk(sf);
    if(!owner?.name)throw Error('authored-class-definition-unavailable');
    const renders=owner.members.filter((node):node is ts.MethodDeclaration=>ts.isMethodDeclaration(node)&&node.name.getText(sf)==='render');
    if(renders.length!==1||!renders[0].body)throw Error('authored-class-render-unavailable');
    const render=renders[0],span={start:render.getStart(sf),end:render.end};
    const heritage=owner.heritageClauses?.find(h=>h.token===ts.SyntaxKind.ExtendsKeyword)?.types,base=heritage?.length===1?heritage[0].expression:undefined;
    let reactBase=false;
    if(base&&ts.isPropertyAccessExpression(base)&&['Component','PureComponent'].includes(base.name.text))reactBase=sf.statements.some(st=>ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)&&st.moduleSpecifier.text==='react'&&(st.importClause?.name?.text===base.expression.getText(sf)||st.importClause?.namedBindings&&ts.isNamespaceImport(st.importClause.namedBindings)&&st.importClause.namedBindings.name.text===base.expression.getText(sf)));
    if(base&&ts.isIdentifier(base))reactBase=sf.statements.some(st=>ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)&&st.moduleSpecifier.text==='react'&&st.importClause?.namedBindings&&ts.isNamedImports(st.importClause.namedBindings)&&st.importClause.namedBindings.elements.some(e=>e.name.text===base.text&&['Component','PureComponent'].includes((e.propertyName??e.name).text)));
    const constructor=transparentConstructor(owner);
    if(!reactBase||constructor===false||render.parameters.length||render.asteriskToken||render.modifiers?.length||owner.modifiers?.some(m=>m.kind===ts.SyntaxKind.Decorator)||!owner.members.every(m=>m===constructor||ts.isMethodDeclaration(m)&&ts.isIdentifier(m.name)&&!m.modifiers?.length))throw Error('authored-class-construction-or-render-unmodeled');
    const key=JSON.stringify([target.module,target.sourceSha256,target.span]);
    if(result.some(p=>JSON.stringify([p.target.module,p.target.sourceSha256,p.target.span])===key))continue;
    result.push({target,render:{file:target.module,sha256:hash,...span},name:owner.name.text,
      ...(constructor?{constructorSource:{file:target.module,sha256:hash,start:constructor.getStart(sf),end:constructor.end}}:{}),
      qualification:'original-class-render-boundary-only',effectsVerified:false,acceptedContract:null});
  }
  return result;
}

/** Register the original class value outside its body. Runtime construction,
 * renderer dispatch, props and returned membership are separate checks. */
export function instrumentReactAuthoredClasses(text:string,module:string,plans:readonly ReactAuthoredClassPlan[]):string{
  const local=plans.filter(p=>p.target.module===module);if(!local.length)return text;
  if(text.includes('__DSC_'))throw Error('authored-class-reserved-binding');
  const hash=createHash('sha256').update(text).digest('hex');
  const sf=ts.createSourceFile(module,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const host:ts.CompilerHost={getSourceFile:f=>f===module?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===module,readFile:f=>f===module?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([module],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),edits:Array<{at:number;text:string}>=[];
  for(const plan of local){
    if(plan.target.sourceSha256!==hash)throw Error('authored-class-source-changed');
    const node=sf.statements.find((n):n is ts.ClassDeclaration=>ts.isClassDeclaration(n)&&n.getStart(sf)===plan.target.span.start&&n.end===plan.target.span.end);
    if(!node?.name||node.name.text!==plan.name)throw Error('authored-class-declaration-changed');
    if(checker.getSymbolsInScope(node,ts.SymbolFlags.Value).some(s=>s.name==='globalThis'&&s.declarations?.length))throw Error('authored-class-global-shadowed');
    const key=JSON.stringify([plan.target.module,plan.target.sourceSha256,plan.target.span.start,plan.target.span.end]);
    edits.push({at:node.end,text:'\nglobalThis.__DSC_RUNTIME_PROOF.authoredClassRegister('+JSON.stringify(key)+','+node.name.text+');\n'});
  }
  for(const edit of edits.sort((a,b)=>b.at-a.at))text=text.slice(0,edit.at)+edit.text+text.slice(edit.at);
  return text;
}
