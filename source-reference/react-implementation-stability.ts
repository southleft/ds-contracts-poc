import {readReactElementCreationSites} from './react-element-creation.js';
import ts from 'typescript';

/** Shared bounded binding/use proof. This establishes source identity only,
 * never effects, runtime behavior, caller content or native authority. */
export function createReactImplementationStability(program:ts.Program,checker:ts.TypeChecker) {
    const unalias = (symbol: ts.Symbol) => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const valueExport = (symbol: ts.Symbol) => !!(unalias(symbol).flags & ts.SymbolFlags.Value) &&
      !symbol.declarations?.every(d => ts.isExportSpecifier(d) &&
        (d.isTypeOnly || (ts.isExportDeclaration(d.parent.parent) && d.parent.parent.isTypeOnly)));
    // Factory call locations alone do not prove the imported value was retained.
    // Reject mutable or escaped React namespaces anywhere in this source graph.
    let factoryInputsStable=true;
    const factorySites=new Map<ts.SourceFile,ReturnType<typeof readReactElementCreationSites>>();
    for(const source of program.getSourceFiles()){
      if(source.isDeclarationFile)continue;
      const bindings=new Map<ts.Symbol,'namespace'|'factory'>();
      for(const statement of source.statements){
        if(!ts.isImportDeclaration(statement)||!ts.isStringLiteral(statement.moduleSpecifier)||statement.moduleSpecifier.text!=='react')continue;
        const clause=statement.importClause;if(!clause||clause.isTypeOnly)continue;
        const add=(node:ts.Identifier,kind:'namespace'|'factory')=>{const symbol=checker.getSymbolAtLocation(node);if(symbol)bindings.set(symbol,kind);};
        if(clause.name)add(clause.name,'namespace');
        const named=clause.namedBindings;
        if(named&&ts.isNamespaceImport(named))add(named.name,'namespace');
        else if(named)for(const item of named.elements){if(item.isTypeOnly)continue;const name=(item.propertyName??item.name).text;if(name==='createElement')add(item.name,'factory');else if(name==='default')add(item.name,'namespace');}
      }
      const inspectFactory=(node:ts.Node)=>{
        if(ts.isTypeNode(node))return;
        if(ts.isIdentifier(node)){
          const symbol=checker.getSymbolAtLocation(node),kind=symbol&&bindings.get(symbol),parent=node.parent;
          if(kind&&!ts.isImportClause(parent)&&!ts.isImportSpecifier(parent)&&!ts.isNamespaceImport(parent)){
            if(kind==='factory'){
              if(!ts.isCallExpression(parent)||parent.expression!==node||parent.questionDotToken)factoryInputsStable=false;
            }else{
              if(!(ts.isPropertyAccessExpression(parent)||ts.isElementAccessExpression(parent))||parent.expression!==node)factoryInputsStable=false;
              else{
                let member:ts.Node=parent;while((ts.isPropertyAccessExpression(member.parent)||ts.isElementAccessExpression(member.parent))&&member.parent.expression===member)member=member.parent;
                const use=member.parent;
                if((ts.isBinaryExpression(use)&&use.left===member&&use.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&use.operatorToken.kind<=ts.SyntaxKind.LastAssignment)||
                   ts.isDeleteExpression(use)||ts.isPostfixUnaryExpression(use)||ts.isPrefixUnaryExpression(use))factoryInputsStable=false;
                if(ts.isPropertyAccessExpression(parent)&&parent.name.text==='createElement'&&(!ts.isCallExpression(parent.parent)||parent.parent.expression!==parent))factoryInputsStable=false;
              }
            }
          }
        }
        ts.forEachChild(node,inspectFactory);
      };
      inspectFactory(source);
    }
    const stableDependencies = new Map<ts.Symbol, boolean>();
    const dependencyImplementationStable = (symbol: ts.Symbol, declaration: ts.Declaration): boolean => {
      const saved = stableDependencies.get(symbol);
      if (saved !== undefined) return saved;
      let stable = ts.isFunctionDeclaration(declaration) || (ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const));
      const namespaceContains = (candidate: ts.Symbol | undefined, seen = new Set<ts.Symbol>()): boolean => {
        if (!candidate) return false;
        candidate = unalias(candidate);
        if (seen.has(candidate) || !(candidate.flags & (ts.SymbolFlags.ValueModule | ts.SymbolFlags.NamespaceModule))) return false;
        seen.add(candidate);
        return checker.getExportsOfModule(candidate).some(e => valueExport(e) &&
          (unalias(e) === symbol || namespaceContains(e, seen)));
      };
      // An export object's current value is not proof of its original body.
      // Inspect its uses across the installed source graph, including callers
      // importing it under another name. JSX and import/export/type references
      // preserve identity; passing/storing/mutating the value does not.
      for (const source of program.getSourceFiles()) {
        if (!stable || source.isDeclarationFile) continue;
        let referenced = false, hasEval = false;
        let factories=factorySites.get(source);if(!factories){factories=readReactElementCreationSites(source.text,source.fileName,source.fileName,true);factorySites.set(source,factories);}
        const inspect = (node: ts.Node) => {
          if (ts.isTypeNode(node)) return;
          if (ts.isIdentifier(node) && node.text === 'eval') hasEval = true;
          if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
            const candidate = checker.getSymbolAtLocation(node);
            if (candidate && unalias(candidate) === symbol) {
              referenced = true;
              let use: ts.Node = node;
              if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) use = node.parent;
              const parent = use.parent;
              const tag = (ts.isJsxOpeningElement(parent) || ts.isJsxClosingElement(parent) || ts.isJsxSelfClosingElement(parent)) && parent.tagName === use;
              const compiledTag = factoryInputsStable && ts.isCallExpression(parent) && parent.arguments[0]===use && factories.some(site=>site.factory==='createElement'&&site.span.start===parent.getStart(source)&&site.span.end===parent.end);
              const label = ts.isPropertyAccessExpression(parent) && parent.expression === use && parent.name.text === 'displayName' &&
                ts.isBinaryExpression(parent.parent) && parent.parent.left === parent &&
                parent.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                (ts.isStringLiteral(parent.parent.right) || ts.isNoSubstitutionTemplateLiteral(parent.parent.right));
              if (!(node === (declaration as ts.NamedDeclaration).name || tag || compiledTag || label ||
                ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isExportSpecifier(parent) ||
                (ts.isExportAssignment(parent) && !parent.isExportEquals && parent.expression === use))) stable = false;
            } else if (namespaceContains(candidate) || namespaceContains(checker.getTypeAtLocation(node).getSymbol())) {
              // An escaping namespace can expose this export to untyped code
              // without another symbol-level reference to the component.
              referenced = true;
              const parent = node.parent;
              if (!(ts.isNamespaceImport(parent) || ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) ||
                ts.isNamespaceExport(parent) || (ts.isPropertyAccessExpression(parent) && parent.expression === node))) stable = false;
            }
          }
          ts.forEachChild(node, inspect);
        };
        inspect(source);
        if (hasEval && referenced) stable = false;
      }
      stableDependencies.set(symbol, stable);
      return stable;
    };
  return dependencyImplementationStable;
}
