import ts from 'typescript';

export interface ReactElementBindingRead {
  name: string;
  span: {start:number;end:number};
  kind: 'value'|'typeof';
  declaration?: {span:{start:number;end:number};kind:string};
}
export interface ReactElementEffectSite {
  span:{start:number;end:number};
  kind:'call'|'construct'|'write'|'delete'|'nested-function'|'class'|'suspend';
}

/** A lexical inventory, not an effects proof. The observer reads a free value
 * only where the original program reads it. In particular, it never evaluates
 * both sides of a conditional, reads an unused closure at entry, unwraps an
 * opaque value, or changes a write reference into a value expression. */
export function readReactElementClosures(sf:ts.SourceFile) {
  const file=sf.fileName;
  const host:ts.CompilerHost={
    getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},
    getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===file,
    readFile:f=>f===file?sf.text:undefined,getCanonicalFileName:f=>f,
    useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',
  };
  const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host);
  const checker=program.getTypeChecker();
  const namesGlobal=(name:ts.BindingName):boolean=>ts.isIdentifier(name)?name.text==='globalThis':
    name.elements.some(element=>!ts.isOmittedExpression(element)&&namesGlobal(element.name));
  // TypeScript's intrinsic globalThis symbol can hide an illegal-but-bundleable
  // script-level declaration from getSymbolsInScope. Such a runtime binding
  // cannot safely host our injected global references either.
  const scriptGlobal=!ts.isExternalModule(sf)&&sf.statements.some(statement=>
    ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(d=>namesGlobal(d.name))||
    (ts.isFunctionDeclaration(statement)||ts.isClassDeclaration(statement)||ts.isEnumDeclaration(statement))&&statement.name?.text==='globalThis');
  const requireObserverGlobal=(node:ts.Node)=>{
    const binding=checker.getSymbolsInScope(node,ts.SymbolFlags.Value).find(s=>s.name==='globalThis');
    if(scriptGlobal||binding?.declarations?.some(d=>!(ts.isIdentifier(d)&&
      (ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d)))
      throw Error('element-closure-reserved-binding');
  };
  const span=(n:ts.Node)=>({start:n.getStart(sf),end:n.end});
  const assignment=(node:ts.BinaryExpression)=>
    node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment;
  const transparent=(node:ts.Node)=>ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||
    ts.isSatisfiesExpression(node)||ts.isNonNullExpression(node)||ts.isTypeAssertionExpression(node);
  function writeReference(node:ts.Node):boolean {
    let current=node;
    // Parentheses preserve a Reference. A property receiver/key, conversely,
    // is read even when the surrounding member is an assignment target.
    while(transparent(current.parent))current=current.parent;
    const p=current.parent;
    if(ts.isBinaryExpression(p)&&p.left===current&&assignment(p))return true;
    if((ts.isPrefixUnaryExpression(p)||ts.isPostfixUnaryExpression(p))&&
      [ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(p.operator))return true;
    if(ts.isDeleteExpression(p))return true;
    if((ts.isForInStatement(p)||ts.isForOfStatement(p))&&p.initializer===current)return true;
    // Destructuring targets are not object/array value expressions. Conservatively
    // skip their contents, including computed reads, rather than corrupt syntax.
    for(let n:ts.Node=current;n.parent&&!ts.isStatement(n.parent)&&!ts.isFunctionLike(n.parent);n=n.parent){
      const parent=n.parent;
      if(ts.isBinaryExpression(parent)&&parent.left===n&&assignment(parent)&&
        (ts.isObjectLiteralExpression(n)||ts.isArrayLiteralExpression(n)))return true;
      if((ts.isForOfStatement(parent)||ts.isForInStatement(parent))&&parent.initializer===n)return true;
    }
    return false;
  }
  function isReference(n:ts.Identifier):boolean {
    const p=n.parent;
    if(ts.isPropertyAccessExpression(p)&&p.name===n)return false;
    if((ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isPropertyDeclaration(p)||
      ts.isGetAccessorDeclaration(p)||ts.isSetAccessorDeclaration(p)||ts.isBindingElement(p))&&p.name===n)return false;
    if(ts.isBindingElement(p)&&p.propertyName===n)return false;
    if((ts.isVariableDeclaration(p)||ts.isParameter(p)||ts.isFunctionDeclaration(p)||
      ts.isFunctionExpression(p)||ts.isClassDeclaration(p)||ts.isClassExpression(p))&&p.name===n)return false;
    if(ts.isLabeledStatement(p)&&p.label===n||ts.isBreakOrContinueStatement(p))return false;
    if(ts.isImportSpecifier(p)||ts.isImportClause(p)||ts.isNamespaceImport(p)||ts.isExportSpecifier(p))return false;
    if(ts.isMetaProperty(p))return false;
    return !writeReference(n);
  }
  return (fn:ts.FunctionDeclaration|ts.FunctionExpression|ts.ArrowFunction)=>{
    const reads:ReactElementBindingRead[]=[],effects:ReactElementEffectSite[]=[];
    const fnSpan=span(fn);
    // Entry/return brackets also use the observer global. A function can have
    // no free expression reads, or return early inside a shadowing block.
    requireObserverGlobal(fn.body??fn);
    const visit=(n:ts.Node)=>{
      // TypeScript type syntax is erased. JSX names are grammar slots rather
      // than ordinary expression positions; wrapping one corrupts the tag or
      // attribute. Their executable target lookup needs a separate binding.
      if(ts.isTypeNode(n)||ts.isJsxClosingElement(n))return;
      const parent=n.parent;
      if((ts.isJsxOpeningElement(parent)||ts.isJsxSelfClosingElement(parent))&&parent.tagName===n||
        ts.isJsxAttribute(parent)&&parent.name===n)return;
      if(ts.isFunctionLike(n)){effects.push({span:span(n),kind:'nested-function'});return;}
      if(ts.isClassLike(n)){effects.push({span:span(n),kind:'class'});return;}
      if(ts.isReturnStatement(n))requireObserverGlobal(n);
      if(ts.isCallExpression(n))effects.push({span:span(n),kind:'call'});
      if(ts.isNewExpression(n))effects.push({span:span(n),kind:'construct'});
      if(ts.isBinaryExpression(n)&&assignment(n)||
        (ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))&&
        [ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(n.operator))
        effects.push({span:span(n),kind:'write'});
      if(ts.isDeleteExpression(n))effects.push({span:span(n),kind:'delete'});
      if(ts.isAwaitExpression(n)||ts.isYieldExpression(n))effects.push({span:span(n),kind:'suspend'});
      if(ts.isIdentifier(n)&&isReference(n)){
        const symbol=ts.isShorthandPropertyAssignment(n.parent)?checker.getShorthandAssignmentValueSymbol(n.parent):checker.getSymbolAtLocation(n);
        // JS expando declarations are receiver reads, not lexical bindings.
        const declarations=symbol?.declarations?.filter(d=>!(ts.isIdentifier(d)&&
          (ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d));
        if(!declarations?.some(d=>d.getSourceFile()===sf&&d.getStart(sf)>=fnSpan.start&&d.end<=fnSpan.end)){
          requireObserverGlobal(n);
          const decl=declarations?.length===1?declarations[0]:undefined;
          let expression:ts.Node=n;
          while(transparent(expression.parent))expression=expression.parent;
          const typeOf=ts.isTypeOfExpression(expression.parent)?expression.parent:undefined;
          reads.push({name:n.text,span:span(typeOf??n),kind:typeOf?'typeof':'value',
            ...(decl&&decl.getSourceFile()===sf?{declaration:{span:span(decl),kind:ts.SyntaxKind[decl.kind]}}:{})});
        }
      }
      ts.forEachChild(n,visit);
    };
    if(fn.body)visit(fn.body);
    return {reads,effects};
  };
}
