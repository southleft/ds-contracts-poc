import path from 'node:path';
import {readReactRuntimeExport} from './react-runtime-export.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactRootFact,ReactSourceProgram} from './react-source-program.js';
// Retain executable identities only when both source implementations have
// independently passed the binding/use proof. Runtime delegation and content
// ownership are still adjudicated by the paired observation, not this linker.
export function linkRootDependencies(reference:ReactHelperReference,source:ReactSourceProgram){
 const program=structuredClone(source),observations:Array<{owner:string;target:string;status:string}>=[];
 const identity=(d:{module:string;sourceSha256:string;span:{start:number;end:number}})=>JSON.stringify([d.module,d.sourceSha256,d.span]);
 const definitions=new Map(program.components.filter(c=>c.implementation==='source-checked').map(c=>[identity(c),c]));
 for(const component of program.components){
  if(component.implementation!=='source-checked')continue;
  const visit=(target:ReactRootFact)=>{
   if(target.kind==='conditional'){if(target.whenTrue)visit(target.whenTrue);if(target.whenFalse)visit(target.whenFalse);return;}
   if(target.kind!=='component'||!target.module||!target.export||target.definition)return;
   const edges=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===path.resolve(reference.sourceRoot,component.module)&&e.specifier===target.module).map(e=>e.file))];
   if(edges.length!==1){observations.push({owner:component.exportName,target:target.export,status:'edge-unqualified'});return;}
   const result=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,edges[0]),target.export.split('.'));
   if(result.status!=='resolved'){observations.push({owner:component.exportName,target:target.export,status:result.reason});return;}
   const d=result.definition,existing=definitions.get(identity(d));
   if(!existing||existing.exportName!==d.exportName){observations.push({owner:component.exportName,target:target.export,status:'implementation-unqualified'});return;}
   for(const [file,hash] of Object.entries(result.files))if(program.files[file]&&program.files[file]!==hash)throw Error('compiled-root-dependency-source-changed');
   Object.assign(program.files,result.files);
   target.definition={module:d.module,exportName:d.exportName,sourceSha256:d.sourceSha256,span:d.span};delete target.dependencyProblem;
   observations.push({owner:component.exportName,target:target.export,status:'executable-source-linked'});
  };
  visit(component.root);for(const ref of component.componentReferences)visit(ref.target);
 }
 return {program,observations};
}
