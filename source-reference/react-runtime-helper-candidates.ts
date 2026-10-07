import ts from 'typescript';
import {createReactRuntimeImplementationProof} from './react-runtime-implementation.js';
import {readReactRuntimeRoot} from './react-runtime-root.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {prepareReactEffectProgram,reactHelperCandidates,type ReactHelperReference} from './react-helper-effects.js';
import type {ReactSourceProgram} from './react-source-program.js';

/** Nominate helper sites inside an exact exported forwardRef render body.
 * Bounded binding/use checks may establish source identity and possible roots.
 * Props and caller-content ownership remain unresolved.
 * The ordinary paired observation must prove the containing function at runtime. */
export function observeReactRuntimeHelperCandidates(reference:ReactHelperReference,source:ReactSourceProgram) {
  const program=structuredClone(source);
  let implementationProof:ReturnType<typeof createReactRuntimeImplementationProof>|null|undefined;
  for(const component of program.components) {
    if(component.helperCandidates?.length || !component.problems.includes('runtime-export-binding-only'))continue;
    try {
      const target=readReactRuntimeExport(reference,component.module,[component.exportName]);
      if(target.status!=='resolved'||target.definition.sourceSha256!==component.sourceSha256||
          target.definition.span.start!==component.span.start||target.definition.span.end!==component.span.end)continue;
      const initializer=readReactTargetInitializer(reference,target.definition);
      const {sf,checker,requireCurrent}=prepareReactEffectProgram(reference,component.module,{},{});
      let render:ts.FunctionExpression|ts.ArrowFunction|undefined;
      const visit=(node:ts.Node)=>{
        if((ts.isFunctionExpression(node)||ts.isArrowFunction(node))&&node.getStart(sf)===initializer.render.start&&node.end===initializer.render.end)render=node;
        ts.forEachChild(node,visit);
      };visit(sf);
      if(!render)continue;
      const candidates=reactHelperCandidates(render,checker);
      requireCurrent();

      component.helperCandidates=candidates;component.wrappers=['forwardRef'];
      // Failure to prove source identity must retain discovery without promotion.
      if(implementationProof===undefined) {
        try{implementationProof=createReactRuntimeImplementationProof(reference);}catch{implementationProof=null;}
      }
      if(!implementationProof?.(component))continue;
      const root=readReactRuntimeRoot(render,checker,component.module);
      const witnesses=Object.entries(reference.files).filter(([file])=>/\.[cm]?[jt]sx?$/.test(file)&&!/\.d\.[cm]?ts$/.test(file));
      if(witnesses.some(([file,hash])=>program.files[file]&&program.files[file]!==hash))continue;
      requireCurrent();
      Object.assign(program.files,Object.fromEntries(witnesses));
      component.implementation='source-checked';component.root=root;
      component.problems=component.problems.filter(problem=>problem!=='runtime-export-binding-only');
    }catch{
      // An unavailable initializer remains the existing unresolved source fact.
    }
  }
  return program;
}
