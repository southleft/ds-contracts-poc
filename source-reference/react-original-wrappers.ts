import type {ReactElementCreationSite} from './react-element-creation.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
import ts from 'typescript';
import {prepareReactEffectProgram,type ReactHelperReference} from './react-helper-effects.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {planOriginalWrapper} from './react-original-wrapper-plan.js';
import type {ReactOwnership} from './react-ownership.js';
export type ReactOriginalWrapperCandidate={path:string;relation:'creation'|'ancestor';site:ReactElementCreationSite;invocation:Extract<ReactElementInvocation,{status:'observed'}>} & ({status:'planned';initializer:ReactTargetInitializer;request:Extract<ReturnType<typeof planOriginalWrapper>,{status:'planned'}>}|{status:'refused';reason:string});
/** Discover original factory wrappers from observed ownership, without
 * manufacturing JSX metadata or using library/component-name dispatch. */
export function readReactOriginalWrappers(reference:ReactHelperReference,ownership:ReactOwnership){
 const seen=new Set<string>();
 return ownership.nodes.flatMap(node=>{
  const subjects=[...(node.creationSite&&node.creationInvocation?[{site:node.creationSite,invocation:node.creationInvocation}]:[]),...(node.creationLineage?.parents??[]).map(p=>p.enclosingReturn??p)];
  return subjects.flatMap<ReactOriginalWrapperCandidate>(subject=>{
   const {site,invocation}=subject;if(site.factory!=='createElement'||site.transformed||site.originalJsx||site.referenceEntry||invocation?.status!=='observed')return [];
   const id=JSON.stringify([site,invocation.invocation]);if(seen.has(id))return [];seen.add(id);
   const base={path:node.path,relation:(site===node.creationSite?'creation':'ancestor') as 'creation'|'ancestor',site,invocation};
   try{
    const {sf,requireCurrent}=prepareReactEffectProgram(reference,site.module,{},{}),names=new Set<string>();
    for(const statement of sf.statements){
     if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause)&&!statement.isTypeOnly)for(const e of statement.exportClause.elements)if(!e.isTypeOnly)names.add(e.name.text);
     const modifiers=ts.canHaveModifiers(statement)?ts.getModifiers(statement):undefined;
     if(modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
      if(modifiers.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))names.add('default');
      else if(ts.isVariableStatement(statement)){for(const d of statement.declarationList.declarations)if(ts.isIdentifier(d.name))names.add(d.name.text);}
      else if(ts.isFunctionDeclaration(statement)&&statement.name)names.add(statement.name.text);
     }
    }
    const initializers:ReactTargetInitializer[]=[];
    for(const name of [...names].sort()){
     const target=readReactRuntimeExport(reference,site.module,[name]);if(target.status!=='resolved')continue;
     try{const i=readReactTargetInitializer(reference,target.definition);if(i.render.file===site.module&&i.render.sha256===site.sourceSha256&&i.render.start===invocation.function.span.start&&i.render.end===invocation.function.span.end&&!initializers.some(old=>JSON.stringify(old.call)===JSON.stringify(i.call)))initializers.push(i);}catch{/* Another export is not this observed forwardRef initializer. */}
    }
    if(initializers.length!==1)throw Error('original-wrapper-export-initializer-unavailable-or-ambiguous');
    const initializer=initializers[0],request=planOriginalWrapper(reference,site,invocation,initializer);requireCurrent();
    if(request.status!=='planned')throw Error(request.reason);
    return [{...base,status:'planned' as const,initializer,request}];
   }catch(error){return [{...base,status:'refused' as const,reason:error instanceof Error?error.message:'original-wrapper-discovery-unavailable'}];}
  });
 });
}
