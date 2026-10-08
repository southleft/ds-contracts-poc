import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createReactImplementationStability} from './react-implementation-stability.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactSourceComponent} from './react-source-program.js';

/** Reuse the source reader's binding/use rule with executable runtime edges.
 * Declaration-file substitution cannot hide a mutation through another import.
 * The result establishes only a bounded source identity, not runtime behavior. */
export function createReactRuntimeImplementationProof(reference:ReactHelperReference) {
  const root=realpathSync(reference.sourceRoot);
  const files=Object.keys(reference.files).filter(file=>/\.[cm]?[jt]sx?$/.test(file)&&!/\.d\.[cm]?ts$/.test(file));
  const texts=new Map<string,string>();
  for(const file of files) {
    if(realpathSync(file)!==file||!file.startsWith(root+path.sep))throw Error('runtime-implementation-source-outside-root');
    const text=readFileSync(file,'utf8');
    if(createHash('sha256').update(text).digest('hex')!==reference.files[file])throw Error('runtime-implementation-source-changed');
    texts.set(file,text);
  }
  const options:ts.CompilerOptions={allowJs:true,checkJs:false,noLib:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler};
  const host=ts.createCompilerHost(options);
  host.readFile=file=>texts.get(file);
  host.fileExists=file=>texts.has(file);
  host.resolveModuleNames=(names,importer)=>names.map(specifier=>{
    const targets=[...new Set((reference.runtimeImports??[]).filter(edge=>edge.importer===importer&&edge.specifier===specifier).map(edge=>edge.file))];
    if(targets.length!==1||!texts.has(targets[0]))return undefined;
    const file=targets[0],extension=file.endsWith('.mjs')?ts.Extension.Mjs:file.endsWith('.cjs')?ts.Extension.Cjs:file.endsWith('.mts')?ts.Extension.Mts:file.endsWith('.cts')?ts.Extension.Cts:file.endsWith('.tsx')?ts.Extension.Tsx:file.endsWith('.ts')?ts.Extension.Ts:file.endsWith('.jsx')?ts.Extension.Jsx:ts.Extension.Js;
    return {resolvedFileName:file,extension};
  });
  const program=ts.createProgram(files,options,host),checker=program.getTypeChecker();
  if(program.getSyntacticDiagnostics().length)throw Error('runtime-implementation-source-syntax');
  // Unlike eliminated CJS branches, a missing static value import/export could
  // conceal an alias. Refuse that graph rather than substituting declarations.
  for(const sf of program.getSourceFiles())for(const node of sf.statements) {
    if(!ts.isImportDeclaration(node)&&!ts.isExportDeclaration(node))continue;
    if(ts.isImportDeclaration(node)&&node.importClause?.isTypeOnly||ts.isExportDeclaration(node)&&node.isTypeOnly)continue;
    if(!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
    const target=host.resolveModuleNames!([node.moduleSpecifier.text],sf.fileName,undefined,undefined,options)[0];
    if(!target)throw Error('runtime-implementation-static-edge-unwitnessed');
  }
  const stable=createReactImplementationStability(program,checker);
  return (component:Pick<ReactSourceComponent,'module'|'sourceSha256'|'span'>):boolean=>{
    for(const [file,text] of texts)if(realpathSync(file)!==file||readFileSync(file,'utf8')!==text)
      throw Error('runtime-implementation-source-changed');
    const sf=program.getSourceFile(path.resolve(root,component.module));
    if(!sf||reference.files[sf.fileName]!==component.sourceSha256)return false;
    let declaration:ts.VariableDeclaration|ts.FunctionDeclaration|undefined;
    const find=(node:ts.Node)=>{if((ts.isVariableDeclaration(node)||ts.isFunctionDeclaration(node))&&node.getStart(sf)===component.span.start&&node.end===component.span.end)declaration=node;ts.forEachChild(node,find);};find(sf);
    if(!declaration?.name||!ts.isIdentifier(declaration.name))return false;
    const symbol=checker.getSymbolAtLocation(declaration.name);
    return !!symbol&&stable(symbol,declaration);
  };
}
