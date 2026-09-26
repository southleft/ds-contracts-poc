import ts from 'typescript';
import path from 'node:path';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {HelperSourcePoint,TargetCallbackProjection,TargetValueShape} from './react-helper-model.mjs';
import type {ReactElementObservedValue} from './react-element-invocation.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer,type ReactTargetInitializer} from './react-target-initializer.js';
import {replanReactTargetCallback,type ReactTargetEffects} from './react-target-effects.js';
import {rebuildReactTargetCallbackPlan,type ReactTargetCallbackPlan} from './react-target-callback-plan.js';
import type {ReactTargetCallbackRuntimeReport} from './react-target-callback-runtime.js';
import {projectionPointKey as key} from './react-target-projection.js';

export interface ReactTargetCallbackValues {
  version:1;qualification:'deferred-callback-value-plan-only';effectsVerified:false;acceptedContract:null;
  boundary:ReactTargetCallbackPlan;rootInput:TargetValueShape;
  input:Array<[string,ReactElementObservedValue]>;projection:TargetCallbackProjection;
  targets:ReactTargetInitializer[];
}
/** Find an actual local export for a source binding, without guessing its name
 * or treating a matching name/shape as initializer identity. */
function initializerAt(reference:ReactHelperReference,point:HelperSourcePoint):ReactTargetInitializer {
  const file=realpathSync(path.resolve(reference.sourceRoot,point.file)),bytes=readFileSync(file),hash=createHash('sha256').update(bytes).digest('hex');
  if(reference.files[file]!==hash||point.sha256!==hash)throw Error('target-callback-component-source-changed');
  const sf=ts.createSourceFile(file,bytes.toString('utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS),names=new Set<string>();
  for(const s of sf.statements){
    if(ts.isExportDeclaration(s)&&!s.isTypeOnly&&s.exportClause&&ts.isNamedExports(s.exportClause)){for(const e of s.exportClause.elements)if(!e.isTypeOnly)names.add(e.name.text);}
    else if(ts.isExportAssignment(s)&&!s.isExportEquals)names.add('default');
    if(ts.canHaveModifiers(s)&&ts.getModifiers(s)?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
      if(ts.getModifiers(s)?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))names.add('default');
      else if(ts.isVariableStatement(s)){for(const d of s.declarationList.declarations)if(ts.isIdentifier(d.name))names.add(d.name.text);}
      else if((ts.isFunctionDeclaration(s)||ts.isClassDeclaration(s))&&s.name)names.add(s.name.text);
    }
  }
  for(const name of [...names].sort()){
    const result=readReactRuntimeExport(reference,point.file,[name]);
    if(result.status==='resolved'&&key({file:result.definition.module,sha256:result.definition.sourceSha256,...result.definition.span})===key(point))return readReactTargetInitializer(reference,result.definition);
  }
  throw Error('target-callback-component-export-unavailable');
}
/** Plans are input assumptions reconstructed from current executable source.
 * The second guarded execution must independently match every actual input,
 * factory trace and returned value. Discovery is never admission authority. */
export function rebuildReactTargetCallbackValues(reference:ReactHelperReference,roots:readonly ReactTargetEffects[],initializers:readonly ReactTargetInitializer[],boundary:ReactTargetCallbackPlan,input:ReadonlyArray<readonly [string,ReactElementObservedValue]>):ReactTargetCallbackValues {
  if(JSON.stringify(rebuildReactTargetCallbackPlan(reference,roots,boundary))!==JSON.stringify(boundary))throw Error('target-callback-value-boundary-changed');
  const candidates=roots.filter(r=>r.status==='modeled'&&key(r.render)===key(boundary.render));
  if(candidates.length!==1||candidates[0].status!=='modeled')throw Error('target-callback-value-owner-ambiguous');
  const root=candidates[0],initializer=initializers.find(i=>key(i.render)===key(root.render));
  if(!initializer)throw Error('target-callback-value-owner-unavailable');
  const result=replanReactTargetCallback(reference,initializer,root,boundary.callback,input);
  if(result.status!=='modeled'||!result.deferred)throw Error(result.status==='refused'?result.reason:'target-callback-value-projection-unavailable');
  const projection=result.deferred;
  if(projection.calls.some(c=>c.site)||projection.writes.length||projection.intrinsics.length||projection.runtimeBindings.bindings.length)throw Error('target-callback-value-helper-effects-unverified');
  const targets=[...new Map(projection.jsxTargets.map(t=>[key(t.binding),t.binding])).values()].map(p=>initializerAt(reference,p));
  return {version:1,qualification:'deferred-callback-value-plan-only',effectsVerified:false,acceptedContract:null,boundary,rootInput:root.input,input:input.map(([k,v])=>[k,{...v}]),projection,targets};
}
export function planReactTargetCallbackValues(reference:ReactHelperReference,roots:readonly ReactTargetEffects[],initializers:readonly ReactTargetInitializer[],boundaries:readonly ReactTargetCallbackPlan[],observed:ReactTargetCallbackRuntimeReport):ReactTargetCallbackValues[]{
  const plans=new Map<string,ReactTargetCallbackValues>();
  for(const event of observed.invocations){
    const boundary=boundaries.find(b=>key(b.call)===key(event.call)&&key(b.input)===key(event.inputSource)&&key(b.callback)===key(event.callback)&&key(b.render)===key(event.render));
    if(!boundary)throw Error('target-callback-value-observation-unplanned');
    const value=rebuildReactTargetCallbackValues(reference,roots,initializers,boundary,event.input);plans.set(JSON.stringify(value),value);
  }
  return [...plans.values()];
}
