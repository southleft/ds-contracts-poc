import ts from 'typescript';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
import {readReactTargetEffects,replanReactTargetCallback,type ReactTargetEffects} from './react-target-effects.js';
import type {HelperSourcePoint,TargetCallbackProjection,TargetValueShape} from './react-helper-model.mjs';
import type {ReactElementInvocation} from './react-element-invocation.js';
import {readReactElementSourceCalls,type ReactElementSourceCall} from './react-element-source-call.js';
import type {ReactOwnership} from './react-ownership.js';

export type ReactTargetCallbackEffects={
  version:1;acceptedContract:null;effectsVerified:false;runtimeVerified:false;
  qualification:'target-callback-projection-model-only';render:HelperSourcePoint;callback:HelperSourcePoint;
  runtimeRequirements:readonly string[];
} & ({status:'modeled';renderInvocation:number;callbackInvocation:number;sourceCall:ReactElementSourceCall;
      projection:TargetCallbackProjection;sourceFiles:Record<string,string>}
    |{status:'refused';reason:string});
const pointKey=(p:HelperSourcePoint)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
const matches=(i:ReactElementInvocation|undefined,p:HelperSourcePoint):i is Extract<ReactElementInvocation,{status:'observed'}>=>
  i?.status==='observed'&&i.function.module===p.file&&i.function.sourceSha256===p.sha256&&i.function.span.start===p.start&&i.function.span.end===p.end;
function callbacks(shape:TargetValueShape,out:HelperSourcePoint[]=[]):HelperSourcePoint[]{
  if(shape.kind==='callback'){out.push(shape.source);for(const c of shape.captures)callbacks(c.value,out);}
  else if(shape.kind==='record')for(const [,v] of shape.fields)callbacks(v,out);
  else if(shape.kind==='array')for(const v of shape.items)callbacks(v,out);
  else if(shape.kind==='jsx')callbacks(shape.props,out);
  return out;
}
function currentCall(reference:ReactHelperReference,call:ReactElementSourceCall){
  const site=call.site,argument=call.argument;
  if(argument.qualification!=='source-object-origin-only'||!call.caller||!argument.creator||
    JSON.stringify(call.caller)!==JSON.stringify(argument.creator))return false;
  const file=path.resolve(reference.sourceRoot,site.module),text=readFileSync(file,'utf8'),hash=createHash('sha256').update(text).digest('hex');
  if(hash!==reference.files[file]||hash!==site.sourceSha256)return false;
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  const inventory=readReactElementSourceCalls(sf,site.module,hash);
  // The observation numbers objects across the whole bundle; this inventory
  // numbers only this file. Compare source identity, then follow its local index.
  const {object:_bundleObject,...claimedSite}=site;
  const actual=inventory.calls.find(c=>{const {object:_localObject,...localSite}=c;return JSON.stringify(localSite)===JSON.stringify(claimedSite);});
  return !!actual&&JSON.stringify(inventory.objects[actual.object])===JSON.stringify(argument.source)&&
    call.caller.function.module===site.module&&call.caller.function.sourceSha256===hash&&
    JSON.stringify(call.caller.function.span)===JSON.stringify(site.functionSpan);
}

/** Follow an observed enclosing-return path to its modeled render, then model
 * the original deferred closure under that source call's recorded arguments.
 * The input remains source-object provenance, never relabeled React props.
 * A matching model is not proof of the provider/hook/callback runtime effects. */
export function readReactTargetCallbacks(reference:ReactHelperReference,initializers:readonly ReactTargetInitializer[],models:readonly ReactTargetEffects[],ownership:ReactOwnership):ReactTargetCallbackEffects[]{
  const rows:ReactTargetCallbackEffects[]=[];
  for(const model of models){
    if(model.status!=='modeled')continue;
    const initializer=initializers.find(i=>pointKey(i.render)===pointKey(model.render));
    for(const callback of callbacks(model.output)){
      const common={version:1 as const,acceptedContract:null,effectsVerified:false as const,runtimeVerified:false as const,
        qualification:'target-callback-projection-model-only' as const,render:model.render,callback,
        runtimeRequirements:['actual-callback-invocation-and-captured-environment','original-source-call-input-and-return-values',
          'registered-factories-and-target-initializers','provider-context-state-hooks-ref-and-event-semantics']};
      const seen=new Set<string>();let found=false;
      for(const node of ownership.nodes){
        const parents=node.creationLineage?.parents??[];
        for(let index=0;index<parents.length;index++){
          const parent=parents[index],invocation=[parent.invocation,parent.enclosingReturn?.invocation].find(i=>matches(i,callback));
          if(!matches(invocation,callback))continue;
          for(let ownerIndex=index+1;ownerIndex<parents.length;ownerIndex++){
            const owner=parents[ownerIndex];
            const outer=[owner.invocation,owner.enclosingReturn?.invocation].find(i=>matches(i,model.render));
            if(!matches(outer,model.render))continue;
            const key=JSON.stringify([outer.invocation,invocation.invocation]);if(seen.has(key))continue;seen.add(key);found=true;
            try{
              if(!initializer||JSON.stringify(readReactTargetEffects(reference,initializer,outer))!==JSON.stringify(model))throw Error('target-callback-render-context-mismatch');
              if(!invocation.sourceCall||!currentCall(reference,invocation.sourceCall))throw Error('target-callback-source-call-unproved');
              const call=invocation.sourceCall,caller=call.caller!;
              const provider=parents.slice(index+1,ownerIndex).find(p=>p.sourceContext?.membership.status==='matched'&&
                JSON.stringify(p.sourceContext.call)===JSON.stringify(call)&&p.invocation?.status==='observed'&&
                p.invocation.invocation===caller.invocation&&p.invocation.function.module===caller.function.module&&
                p.invocation.function.sourceSha256===caller.function.sourceSha256&&JSON.stringify(p.invocation.function.span)===JSON.stringify(caller.function.span));
              const callerPoint={file:caller.function.module,sha256:caller.function.sourceSha256,...caller.function.span};
              if(!provider||!model.jsxTargets.some(t=>pointKey(t.binding)===pointKey(callerPoint)))throw Error('target-callback-provider-return-unproved');
              const result=replanReactTargetCallback(reference,initializer,model,callback,invocation.input);
              if(result.status!=='modeled')throw Error(result.reason);
              if(!result.deferred)throw Error('target-callback-projection-missing');
              rows.push({...common,status:'modeled',renderInvocation:outer.invocation,callbackInvocation:invocation.invocation,
                sourceCall:invocation.sourceCall,projection:result.deferred,sourceFiles:result.sourceFiles});
            }catch(error){rows.push({...common,status:'refused',reason:error instanceof Error?error.message:'target-callback-projection-unavailable'});}
          }
        }
      }
      if(!found)rows.push({...common,status:'refused',reason:'target-callback-enclosing-render-unavailable'});
    }
  }
  return rows;
}
