import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReactRuntimeExport,type ReactRuntimeExportDefinition} from './react-runtime-export.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';

export interface ReactAuthoredFunctionPlan {
 source:HelperSourcePoint;render:HelperSourcePoint;binding:string;
 /** Only real exported roots have a target. Local functions retain source identity only. */
 target?:ReactRuntimeExportDefinition;
 qualification:'original-function-render-boundary-only';effectsVerified:false;acceptedContract:null;
}
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const scriptKind=(file:string)=>/\.[jt]sx$/.test(file)?ts.ScriptKind.TSX:/\.ts$/.test(file)?ts.ScriptKind.TS:ts.ScriptKind.JS;
function sourceFile(file:string,text:string){const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,scriptKind(file));if((sf as ts.SourceFile & {parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length)throw Error('authored-function-source-syntax');return sf;}
export const authoredFunctionKey=(plan:ReactAuthoredFunctionPlan)=>JSON.stringify([plan.source.file,plan.source.sha256,plan.source.start,plan.source.end]);

/** Plan direct module-scope function literals. This never evaluates initializers,
 * reads imported values, models a body, or invents an export for a local helper. */
export function readReactAuthoredFunctions(reference:ReactHelperReference,targets:readonly {module:string;exportName:string}[],modules:readonly string[]=[]):ReactAuthoredFunctionPlan[]{
 const roots=targets.map(request=>{
  const result=readReactRuntimeExport(reference,request.module,[request.exportName]);
  if(result.status!=='resolved')throw Error('authored-function-export-unresolved:'+result.reason);
  return result.definition;
 });
 const result:ReactAuthoredFunctionPlan[]=[];
 if(targets.length>1000||modules.length>1000)throw Error('authored-function-plan-limit');
 for(const module of [...new Set([...modules,...roots.map(r=>r.module)])].sort()){
  const file=realpathSync(path.resolve(reference.sourceRoot,module));
  if(!file.startsWith(realpathSync(reference.sourceRoot)+path.sep))throw Error('authored-function-outside-source');
  const text=readFileSync(file,'utf8'),hash=sha(text);if(reference.files[file]!==hash)throw Error('authored-function-source-changed');
  const sf=sourceFile(file,text);
  const point=(node:ts.Node):HelperSourcePoint=>({file:module,sha256:hash,start:node.getStart(sf),end:node.end});
  const add=(declaration:ts.FunctionDeclaration|ts.VariableDeclaration,fn:ts.FunctionDeclaration|ts.FunctionExpression|ts.ArrowFunction,binding:string)=>{
   if(!fn.body||'asteriskToken' in fn&&fn.asteriskToken||fn.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)||binding.startsWith('__DSC_')||['globalThis','eval','arguments'].includes(binding))return;
   const source=point(declaration),matches=roots.filter(r=>r.module===module&&r.sourceSha256===hash&&same(r.span,{start:source.start,end:source.end}));
   if(matches.length>1&&!matches.every(r=>same(r,matches[0])))throw Error('authored-function-export-ambiguous');
   if(result.length>=10000)throw Error('authored-function-plan-limit');
   result.push({source,render:point(fn),binding,...(matches[0]?{target:matches[0]}:{}),qualification:'original-function-render-boundary-only',effectsVerified:false,acceptedContract:null});
  };
  for(const statement of sf.statements){
   if(ts.isFunctionDeclaration(statement)&&statement.name)add(statement,statement,statement.name.text);
   if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
    const fn=declaration.initializer;
    if(ts.isIdentifier(declaration.name)&&fn&&(ts.isArrowFunction(fn)||ts.isFunctionExpression(fn)))add(declaration,fn,declaration.name.text);
   }
  }
 }
 for(const root of roots)if(!result.some(p=>p.target&&same(p.target,root)))throw Error('authored-function-direct-definition-unavailable');
 if(new Set(result.map(authoredFunctionKey)).size!==result.length)throw Error('authored-function-source-ambiguous');
 return result;
}

/** Register the original value and a lexical binding reader after its statement.
 * Neither function bodies nor the values passed to the React renderer change. */
export function instrumentReactAuthoredFunctions(text:string,module:string,plans:readonly ReactAuthoredFunctionPlan[]):string{
 const local=plans.filter(p=>p.source.file===module);if(!local.length)return text;
 if(text.includes('__DSC_'))throw Error('authored-function-reserved-binding');
 const hash=sha(text),sf=sourceFile(module,text);
 const host:ts.CompilerHost={getSourceFile:f=>f===module?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:f=>f===module,readFile:f=>f===module?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
 const checker=ts.createProgram([module],{allowJs:true,noLib:true,noResolve:true},host).getTypeChecker(),edits=new Map<number,string[]>();
 for(const plan of local){
  if(plan.source.sha256!==hash||plan.render.sha256!==hash)throw Error('authored-function-source-changed');
  let declaration:ts.FunctionDeclaration|ts.VariableDeclaration|undefined,statement:ts.Statement|undefined;
  for(const s of sf.statements){
   const declarations=ts.isFunctionDeclaration(s)?[s]:ts.isVariableStatement(s)?[...s.declarationList.declarations]:[];
   const found=declarations.find(d=>d.getStart(sf)===plan.source.start&&d.end===plan.source.end);
   if(found){declaration=found;statement=s;break;}
  }
  const fn=declaration&&ts.isVariableDeclaration(declaration)?declaration.initializer:declaration;
  if(!declaration||!statement||!declaration.name||!ts.isIdentifier(declaration.name)||declaration.name.text!==plan.binding||!fn||!(ts.isFunctionDeclaration(fn)||ts.isFunctionExpression(fn)||ts.isArrowFunction(fn))||fn.getStart(sf)!==plan.render.start||fn.end!==plan.render.end)throw Error('authored-function-definition-changed');
  const symbols=checker.getSymbolsInScope(declaration,ts.SymbolFlags.Value);
  if(symbols.some(s=>s.name==='globalThis'&&s.declarations?.length))throw Error('authored-function-global-shadowed');
  const symbol=checker.getSymbolAtLocation(declaration.name);if(symbol?.declarations?.length!==1||symbol.declarations[0]!==declaration)throw Error('authored-function-binding-ambiguous');
  const code='\nglobalThis.__DSC_RUNTIME_PROOF.authoredFunctionRegister('+JSON.stringify(authoredFunctionKey(plan))+','+plan.binding+',()=>'+plan.binding+');\n';
  edits.set(statement.end,[...(edits.get(statement.end)??[]),code]);
 }
 for(const [at,code] of [...edits].sort(([a],[b])=>b-a))text=text.slice(0,at)+code.join('')+text.slice(at);
 return text;
}
