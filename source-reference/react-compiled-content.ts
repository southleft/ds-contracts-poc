import ts from 'typescript';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {readReactChildren,type ReactChildrenFact} from './react-children.js';
import {readReactElementCreationSites,type ReactElementCreationSite} from './react-element-creation.js';
import type {ReactReference} from './react-reference.js';

export type ReactCompiledContent = {
  version:1;
  acceptedContract:null;
  runtimeVerified:false;
  qualification:'compiled-source-flow-only';
  site:ReactElementCreationSite;
} & ({status:'read';children:ReactChildrenFact;input:{start:number;end:number}}|{status:'refused';reason:string});

/** Exact source flow at an already observed creation site. Rebinds the import
 * itself; a caller-supplied span/factory/name cannot turn an ordinary call into
 * JSX. No native authority: function-input provenance, escaping/global effects,
 * current runtime result and every enclosing component boundary remain separate
 * requirements, even when this local syntax forwards children. */
export function readReactCompiledContent(reference:Pick<ReactReference,'sourceRoot'|'files'>,site:ReactElementCreationSite):ReactCompiledContent{
  const common={version:1 as const,acceptedContract:null,runtimeVerified:false as const,qualification:'compiled-source-flow-only' as const,site};
  try{
    if(site.referenceEntry)throw Error('compiled-content-reference-entry-unmodeled');
    if(site.transformed)throw Error('compiled-content-transformed-source-unmodeled');
    const root=realpathSync(reference.sourceRoot),file=realpathSync(path.resolve(root,site.module));
    if(!file.startsWith(root+path.sep)||!/\.[cm]?js$/.test(file))throw Error('compiled-content-source-unavailable');
    const text=readFileSync(file,'utf8'),sha=createHash('sha256').update(text).digest('hex');
    if(text.length>5_000_000)throw Error('compiled-content-source-limit');
    if(sha!==reference.files[file]||sha!==site.sourceSha256)throw Error('compiled-content-source-changed');
    const sites=readReactElementCreationSites(text,file,path.relative(root,file).split(path.sep).join('/'));
    const match=sites.find(s=>s.span.start===site.span.start&&s.span.end===site.span.end);
    if(!match||match.factory!==site.factory||JSON.stringify(match.functionSpan)!==JSON.stringify(site.functionSpan)||match.module!==site.module)
      throw Error('compiled-content-site-unproved');
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>root,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
    const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host);
    let call:ts.CallExpression|undefined,fn:ts.FunctionLikeDeclaration|undefined;
    const find=(node:ts.Node)=>{
      if(ts.isCallExpression(node)&&node.getStart(sf)===site.span.start&&node.end===site.span.end)call=node;
      if((ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node)||ts.isMethodDeclaration(node))&&node.getStart(sf)===site.functionSpan?.start&&node.end===site.functionSpan?.end)fn=node;
      ts.forEachChild(node,find);
    };find(sf);
    if(!call||!fn?.body||fn.asteriskToken||fn.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)||!fn.parameters.length||fn.parameters.some(p=>p.initializer||p.dotDotDotToken))
      throw Error('compiled-content-function-unmodeled');
    let ancestor:ts.Node=call.parent;while(ancestor!==fn&&ancestor.parent&&!ts.isFunctionLike(ancestor))ancestor=ancestor.parent;
    if(ancestor!==fn)throw Error('compiled-content-function-unproved');
    // A modeled root must itself be returned by this function. Calls used only
    // in an assignment, argument or nested callback do not define its output.
    let returned:ts.Node=call;while(ts.isParenthesizedExpression(returned.parent))returned=returned.parent;
    if(!(fn.body===returned||(ts.isReturnStatement(returned.parent)&&returned.parent.expression===returned)))
      throw Error('compiled-content-call-not-returned');
    const children=readReactChildren(fn,call,program.getTypeChecker(),true,true);
    if(createHash('sha256').update(readFileSync(file)).digest('hex')!==sha)throw Error('compiled-content-source-changed');
    return {...common,status:'read',children,input:{start:fn.parameters[0].getStart(sf),end:fn.parameters[0].end}};
  }catch(error){return {...common,status:'refused',reason:error instanceof Error?error.message:'compiled-content-source-unavailable'};}
}
