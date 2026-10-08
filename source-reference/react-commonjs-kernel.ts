import ts from 'typescript';
/** Authenticate the pinned bundler's module allocation path. This is source
 * evidence only; it does not authorize application writes or module effects. */
export function readReactCommonJsKernel(javascript:string){
 const fail=(why:string):never=>{throw Error('commonjs-kernel-'+why);};
 const file='/commonjs-bundle.js',sf=ts.createSourceFile(file,javascript,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=> '/',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?javascript:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
 const checker=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker();
 const variables:ts.VariableDeclaration[]=[];const walk=(n:ts.Node,fn:(n:ts.Node)=>void)=>{fn(n);ts.forEachChild(n,c=>walk(c,fn));};walk(sf,n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))variables.push(n);});
 const candidates=variables.filter(n=>ts.isIdentifier(n.name)&&n.name.text==='__commonJS');if(candidates.length!==1)fail('missing-or-ambiguous');const kernel=candidates[0],scope=kernel.parent.parent.parent;
 const names=variables.filter(n=>ts.isIdentifier(n.name)&&n.name.text==='__getOwnPropNames'&&n.parent.parent.parent===scope);if(names.length!==1)fail('names-binding');const dependency=names[0];
 const print=ts.createPrinter({removeComments:true});const normalized=(n:ts.Node,s=sf)=>print.printNode(ts.EmitHint.Unspecified,n,s).replace(/\s+/g,'');
 const expr=(s:string)=>{const f=ts.createSourceFile('/expected.js','const value='+s+';',ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);return normalized((f.statements[0] as ts.VariableStatement).declarationList.declarations[0].initializer!,f);};
 const expected=`(cb,mod)=>function __require(){try{return mod||(0,cb[__getOwnPropNames(cb)[0]])((mod={exports:{}}).exports,mod),mod.exports;}catch(e){throw mod=0,e;}}`;
 if(!kernel.initializer)return fail('body-changed');
 const catches:ts.CatchClause[]=[];walk(kernel.initializer,n=>{if(ts.isCatchClause(n))catches.push(n);});
 if(catches.length!==1||!catches[0].variableDeclaration||!ts.isIdentifier(catches[0].variableDeclaration.name))return fail('catch-binding');
 const caught=checker.getSymbolAtLocation(catches[0].variableDeclaration.name);
 const transformed=ts.transform(kernel.initializer,[context=>root=>{const visit:ts.Visitor=n=>ts.isIdentifier(n)&&checker.getSymbolAtLocation(n)===caught?ts.factory.createIdentifier('e'):ts.visitEachChild(n,visit,context);return ts.visitNode(root,visit) as ts.Expression;}]);
 const body=normalized(transformed.transformed[0]);transformed.dispose();
 if(body!==expr(expected))fail('body-changed');
 if(!dependency.initializer||normalized(dependency.initializer)!==expr('Object.getOwnPropertyNames'))fail('intrinsic-changed');
 const kernelSymbol=checker.getSymbolAtLocation(kernel.name),nameSymbol=checker.getSymbolAtLocation(dependency.name);
 const inside=(n:ts.Node,owner:ts.Node)=>n.pos>=owner.pos&&n.end<=owner.end;
 const wrappers:Array<{name:string;start:number;end:number;parameters:string[]}>=[];
 walk(sf,n=>{
  if(ts.isIdentifier(n)&&n.text==='Object'&&inside(n,dependency)&&checker.getSymbolAtLocation(n)?.declarations?.length)fail('intrinsic-shadowed');
  if(ts.isIdentifier(n)&&n.text==='__getOwnPropNames'&&inside(n,kernel)&&checker.getSymbolAtLocation(n)!==nameSymbol)fail('dependency-shadowed');
  if(ts.isIdentifier(n)&&checker.getSymbolAtLocation(n)===nameSymbol&&n!==dependency.name){if(!(ts.isCallExpression(n.parent)&&n.parent.expression===n))fail('dependency-used-indirectly');}
  if(!ts.isIdentifier(n)||checker.getSymbolAtLocation(n)!==kernelSymbol||n===kernel.name)return;
  const call=n.parent;if(!ts.isCallExpression(call)||call.expression!==n||call.questionDotToken||call.arguments.length!==1)return fail('loader-used-indirectly');
  const table=call.arguments[0];if(!ts.isObjectLiteralExpression(table)||table.properties.length!==1)return fail('callback-table');
  const method=table.properties[0];if(!ts.isMethodDeclaration(method)||method.asteriskToken||method.modifiers?.length||!method.body||!ts.isStringLiteral(method.name)||method.parameters.length>2||method.parameters.some(p=>!ts.isIdentifier(p.name)||p.initializer||p.dotDotDotToken))return fail('callback-shape');
  wrappers.push({name:method.name.text,start:method.getStart(sf),end:method.end,parameters:method.parameters.map(p=>p.name.getText(sf))});
 });
 return {qualification:'bundled-commonjs-allocation-source-only' as const,effectsVerified:false as const,acceptedContract:null,kernel:{start:kernel.getStart(sf),end:kernel.end},wrappers};
}
