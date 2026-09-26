import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
import type {ReactTargetEffects} from './react-target-effects.js';
import type {ReactTargetCallbackEffects} from './react-target-callbacks.js';
import {targetProjectionParts,projectionPointKey as key} from './react-target-projection.js';
import {readReactElementSourceCalls} from './react-element-source-call.js';

export interface ReactTargetCallbackPlan {
  version:1;render:HelperSourcePoint;callback:HelperSourcePoint;provider:HelperSourcePoint;
  call:HelperSourcePoint;input:HelperSourcePoint;
  factories:Array<{source:HelperSourcePoint;factory:'jsx'|'jsxs'}>;
}
type Request=Omit<ReactTargetCallbackPlan,'version'|'factories'>;
/** Reconstruct exact call/object/factory sites from executable source. The plan
 * does not execute callbacks, prove providers or authorize native conversion. */
export function rebuildReactTargetCallbackPlan(reference:ReactHelperReference,roots:readonly ReactTargetEffects[],request:Request):ReactTargetCallbackPlan {
  const candidates=roots.filter(r=>r.status==='modeled'&&key(r.render)===key(request.render));
  const root=candidates.find(r=>targetProjectionParts([r]).callbacks.some(c=>key(c.source)===key(request.callback)));
  if(!root||root.status!=='modeled'||!root.jsxTargets.some(t=>key(t.binding)===key(request.provider)))throw Error('target-callback-plan-owner-unmodeled');
  const file=realpathSync(path.resolve(reference.sourceRoot,request.render.file)),text=readFileSync(file,'utf8'),hash=createHash('sha256').update(text).digest('hex');
  if(reference.files[file]!==hash||[request.render,request.callback,request.provider,request.call,request.input].some(p=>p.file!==request.render.file||p.sha256!==hash))throw Error('target-callback-plan-source-changed');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  const source=(n:ts.Node):HelperSourcePoint=>({file:request.render.file,sha256:hash,start:n.getStart(sf),end:n.end});
  const nodes=new Map<string,ts.Node>();const scan=(n:ts.Node)=>{nodes.set(key(source(n)),n);ts.forEachChild(n,scan);};scan(sf);
  const provider=nodes.get(key(request.provider)),callback=nodes.get(key(request.callback));
  if(!provider||!ts.isFunctionDeclaration(provider)||!ts.isSourceFile(provider.parent)||!callback||
    !(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))||callback.parameters.length!==1||callback.parameters[0].dotDotDotToken||callback.parameters[0].initializer)throw Error('target-callback-plan-functions-unmodeled');
  // The source-call reader owns a separate checker/AST.
  const inventory=readReactElementSourceCalls(ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS),request.render.file,hash);
  const call=inventory.calls.find(c=>c.span.start===request.call.start&&c.span.end===request.call.end&&c.functionSpan?.start===request.provider.start&&c.functionSpan.end===request.provider.end);
  const input=call&&inventory.objects[call.object];
  if(!input||input.span.start!==request.input.start||input.span.end!==request.input.end||input.functionSpan?.start!==request.provider.start||input.functionSpan.end!==request.provider.end)throw Error('target-callback-plan-call-unmodeled');
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>reference.sourceRoot,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const checker=ts.createProgram([file],{allowJs:true,noResolve:true,noLib:true},host).getTypeChecker();
  const factories:ReactTargetCallbackPlan['factories']=[];
  const visit=(n:ts.Node)=>{
    if(n!==callback&&ts.isFunctionLike(n))return;
    if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)){
      const ds=checker.getSymbolAtLocation(n.expression)?.declarations,d=ds?.length===1?ds[0]:undefined;
      if(d&&ts.isImportSpecifier(d)&&!d.isTypeOnly&&!d.parent.parent.isTypeOnly){
        const imp=d.parent.parent.parent,name=(d.propertyName??d.name).text;
        if(ts.isStringLiteral(imp.moduleSpecifier)&&imp.moduleSpecifier.text==='react/jsx-runtime'&&(name==='jsx'||name==='jsxs'))factories.push({source:source(n),factory:name});
      }
    }
    ts.forEachChild(n,visit);
  };visit(callback);
  if(!factories.length||factories.length>10000)throw Error('target-callback-plan-factories-unmodeled');
  return {version:1,render:{...request.render},callback:{...request.callback},provider:{...request.provider},call:{...request.call},input:{...request.input},factories};
}
export function planReactTargetCallbacks(reference:ReactHelperReference,roots:readonly ReactTargetEffects[],models:readonly ReactTargetCallbackEffects[]):ReactTargetCallbackPlan[]{
  const plans=new Map<string,ReactTargetCallbackPlan>();
  for(const model of models){
    if(model.status!=='modeled')continue;
    const call=model.sourceCall,caller=call.caller!;
    const plan=rebuildReactTargetCallbackPlan(reference,roots,{render:model.render,callback:model.callback,
      provider:{file:caller.function.module,sha256:caller.function.sourceSha256,...caller.function.span},
      call:{file:call.site.module,sha256:call.site.sourceSha256,...call.site.span},
      input:{file:call.argument.source.module,sha256:call.argument.source.sourceSha256,...call.argument.source.span}});
    plans.set(JSON.stringify(plan),plan);
  }
  return [...plans.values()];
}
