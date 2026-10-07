import ts from 'typescript';
import {readReactElementCreationSites} from './react-element-creation.js';
import type {ReactRootFact} from './react-source-program.js';

/** Possible host branches from an original, import-bound factory return.
 * No branch is selected here. Effects, actual factory identity and the returned
 * host must still match the authenticated containing-function observation. */
export function readReactRuntimeRoot(fn:ts.FunctionExpression|ts.ArrowFunction,checker:ts.TypeChecker,module:string):ReactRootFact {
  const sf=fn.getSourceFile(),unknown=(reason:string):ReactRootFact=>({kind:'unresolved',reason});
  const unwrap=(n:ts.Expression):ts.Expression=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
  const returns:ts.Expression[]=[],locals=new Map<ts.Symbol,ts.Expression>();
  if(ts.isBlock(fn.body)) {
    for(const statement of fn.body.statements) {
      if(ts.isReturnStatement(statement)&&statement.expression)returns.push(statement.expression);
      else if(!ts.isVariableStatement(statement)&&!ts.isExpressionStatement(statement)&&!ts.isEmptyStatement(statement))
        return unknown('compiled-root-control-flow-unresolved');
      if(ts.isVariableStatement(statement)&&(statement.declarationList.flags&ts.NodeFlags.Const))for(const declaration of statement.declarationList.declarations) {
        if(!ts.isIdentifier(declaration.name)||!declaration.initializer)continue;
        const symbol=checker.getSymbolAtLocation(declaration.name);if(symbol)locals.set(symbol,declaration.initializer);
      }
    }
  }else returns.push(fn.body);
  if(returns.length!==1)return unknown('compiled-root-single-return-required');
  const call=unwrap(returns[0]);
  if(!ts.isCallExpression(call)||!readReactElementCreationSites(sf.text,sf.fileName,module,true).some(site=>
      site.factory==='createElement'&&site.span.start===call.getStart(sf)&&site.span.end===call.end))
    return unknown('compiled-root-factory-unresolved');
  const resolve=(node:ts.Expression,seen=new Set<ts.Symbol>()):ReactRootFact=>{
    node=unwrap(node);
    if(ts.isStringLiteral(node)&&node.text)return {kind:'host',name:node.text};
    if(ts.isConditionalExpression(node))return {kind:'conditional',condition:node.condition.getText(sf),whenTrue:resolve(node.whenTrue,seen),whenFalse:resolve(node.whenFalse,seen)};
    const symbol=ts.isIdentifier(node)&&checker.getSymbolAtLocation(node);
    if(symbol&&locals.has(symbol)&&!seen.has(symbol))return resolve(locals.get(symbol)!,new Set([...seen,symbol]));
    // Retain symbolic imported roots. Executable resolution and observed
    // delegation remain separate proofs; no dependency is accepted here.
    let base:ts.Expression=node;const members:string[]=[];
    while(ts.isPropertyAccessExpression(base)){members.unshift(base.name.text);base=base.expression;}
    if(ts.isIdentifier(base)){
      const binding=checker.getSymbolAtLocation(base),declarations=binding?.declarations;
      if(declarations?.length===1){
        const declaration=declarations[0];let statement:ts.Node|undefined=declaration;
        while(statement&&!ts.isImportDeclaration(statement))statement=statement.parent;
        if(statement&&ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier)&&!statement.importClause?.isTypeOnly){
          let exported:string[]|undefined;
          if(ts.isImportSpecifier(declaration)&&!declaration.isTypeOnly)exported=[(declaration.propertyName??declaration.name).text,...members];
          else if(ts.isNamespaceImport(declaration)&&members.length)exported=members;
          else if(ts.isImportClause(declaration)&&declaration.name)exported=['default',...members];
          if(exported)return {kind:'component',name:node.getText(sf),module:statement.moduleSpecifier.text,export:exported.join('.'),dependencyProblem:'implementation-unavailable'};
        }
      }
    }
    return unknown('compiled-root-target-unresolved');
  };
  return call.arguments.length?resolve(call.arguments[0]):unknown('compiled-root-target-missing');
}
