import type {ReactTargetEffects} from './react-target-effects.js';
import type {HelperSourcePoint,TargetValueShape} from './react-helper-model.mjs';

export type TargetProjectionModel=Extract<ReactTargetEffects,{status:'modeled'}>;
export const projectionPointKey=(p:HelperSourcePoint)=>JSON.stringify([p.file,p.sha256,p.start,p.end]);

/** Compiler registration inventory only. Keep per-input values in the models;
 * sharing a source point never shares an actual callback across invocations. */
export function targetProjectionParts(models:readonly ReactTargetEffects[]){
  const callbacks=new Map<string,{source:HelperSourcePoint;captures:Array<{name:string;binding:HelperSourcePoint}>}>();
  const bindings=new Map<string,HelperSourcePoint>(),captures=new Map<string,HelperSourcePoint>(),factories=new Map<string,HelperSourcePoint>();
  for(const model of models){
    if(model.status!=='modeled')continue;
    for(const item of model.jsxTargets)bindings.set(projectionPointKey(item.binding),item.binding);
    for(const item of model.targetFactories)factories.set(projectionPointKey(item.source),item.source);
    const seen=new Set<string>();
    const visit=(shape:TargetValueShape)=>{
      if(shape.kind==='callback'){
        const key=projectionPointKey(shape.source);
        if(seen.has(key))throw Error('target-projection-callback-alias-unmodeled');seen.add(key);
        const row={source:shape.source,captures:shape.captures.map(c=>({name:c.name,binding:c.binding}))},old=callbacks.get(key);
        if(old&&JSON.stringify(old)!==JSON.stringify(row))throw Error('target-projection-capture-plan-varies');callbacks.set(key,row);
        for(const capture of shape.captures){captures.set(projectionPointKey(capture.binding),capture.binding);visit(capture.value);}
      }else if(shape.kind==='record')for(const [,value] of shape.fields)visit(value);
      else if(shape.kind==='array')for(const value of shape.items)visit(value);
      else if(shape.kind==='jsx')visit(shape.props);
    };visit(model.output);
  }
  return {callbacks:[...callbacks.values()],bindings:[...bindings.values()],captures:[...captures.values()],factories:[...factories.values()]};
}
