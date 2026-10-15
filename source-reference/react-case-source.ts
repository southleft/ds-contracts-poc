/** Join a declared public mount to its witnessed executable binding. Public
 * labels remain public labels; they are never substituted for source identity. */
import path from 'node:path';
import {builtinReactCohort,readReactDeclaredCaseMount,reactInitialCaseEntry,type ReactCaseElement} from './react-cohort.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import type {ReactReference} from './react-reference.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';

type Source=ReactOwnership['components'][number]['source'];
type Mount=Extract<ReactCaseElement,{module:string}>;
const fail=(reason:string):never=>{throw Error('react-case-source-'+reason);};
const same=(a:Source,b:Source)=>a.module===b.module&&a.exportName===b.exportName&&
  a.sourceSha256===b.sourceSha256&&a.span.start===b.span.start&&a.span.end===b.span.end;
const key=(mount:Mount)=>JSON.stringify([mount.module,mount.export]);

function mounts(reference:ReactReference,caseId:string):Mount[]{
  const found:Mount[]=[];
  const visit=(node:ReactCaseElement)=>{
    if('module' in node)found.push(node);
    for(const child of node.children??[])if(typeof child!=='string')visit(child);
  };
  visit(readReactDeclaredCaseMount(reference.cohort,caseId));
  return found;
}

function resolve(reference:ReactReference,mount:Mount):Source{
  const entries=[...new Set((reference.runtimeEntryImports??[])
    .filter(edge=>edge.specifier===mount.module).map(edge=>edge.file))];
  if(entries.length!==1)fail(entries.length?'entry-edge-ambiguous':'entry-edge-unwitnessed');
  const result=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,entries[0]),mount.export.split('.'));
  if(result.status!=='resolved')return fail(result.reason);
  const {module,exportName,sourceSha256,span}=result.definition;
  return {module,exportName,sourceSha256,span:{...span}};
}

/** Select one observed root instance by its full source tuple. Legacy built-in
 * cases retain their existing export selection; declared cases use their own
 * authenticated mount, never another case's identically named export. */
export function reactCaseRootOwner(reference:ReactReference,program:ReactSourceProgram,caseId:string,ownership:ReactOwnership){
  const cases=reference.cohort.cases.filter(c=>c.id===caseId);
  if(cases.length!==1)fail('case-unavailable');
  const subject=cases[0].subject;
  let definitions:Source[];
  let legacy=false;
  if(reference.cohort.declared&&reference.cohort.declaration){
    const selected=[...new Map(mounts(reference,caseId).filter(m=>m.export===subject).map(m=>[key(m),m])).values()];
    if(selected.length!==1)fail(selected.length?'subject-mount-ambiguous':'subject-mount-missing');
    definitions=[resolve(reference,selected[0])];
  }else{
    // Historical host-authored cohorts also exist without a declaration.
    // Their workspace exports retain the old path; package mounts cannot use
    // that path to avoid a missing public-route witness.
    legacy=true;
    if(reference.cohort.mountedModules?.some(module=>!module.startsWith('./'))||
      reference.cohort.mountedExports?.some(mount=>!mount.module.startsWith('./')))fail('declaration-required');
    definitions=program.components.filter(c=>c.exportName===subject&&!c.module.startsWith('node_modules/'));
  }
  const owners=ownership.components.filter(c=>c.roots.includes('')&&definitions.some(d=>same(c.source,d)));
  if(owners.length!==1)fail(owners.length?'subject-root-ambiguous':'subject-root-unmatched');
  if(program.components.filter(c=>same(c,owners[0].source)).length!==1)fail('program-identity-unmatched-or-ambiguous');
  if(legacy){
    const source=owners[0].source;
    let direct:Source;
    if(reference.runtimeEntryImports){
      const entries=[...new Map(reference.runtimeEntryImports
        .filter(edge=>path.relative(reference.sourceRoot,edge.file).split(path.sep).join('/')===source.module)
        .map(edge=>[JSON.stringify(edge),edge])).values()];
      if(entries.length!==1)fail(entries.length?'entry-edge-ambiguous':'entry-edge-unwitnessed');
      if(!entries[0].specifier.startsWith('./'))fail('declaration-required');
      direct=resolve(reference,{module:entries[0].specifier,export:subject});
    }else{
      // The original built-in reference predates entry-edge receipts. Only its
      // unchanged host-owned entry/cases may retain that compatibility path.
      if(reference.cohort.declared||reference.cohort.entry!==builtinReactCohort.entry||
        JSON.stringify(reference.cohort.cases)!==JSON.stringify(builtinReactCohort.cases))fail('entry-edge-unwitnessed');
      const result=readReactRuntimeExport(reference,source.module,[subject]);
      if(result.status!=='resolved')return fail(result.reason);
      direct=result.definition;
    }
    if(!same(source,direct))fail('source-identity-changed');
  }
  return owners[0];
}

/** Derive the original public caller for an already observed implementation.
 * The existing derivation still checks declaration/entry bytes, allowed edits
 * and a unique occurrence. Its receipt keeps the complete implementation tuple. */
export function reactResolvedInitialCaseEntry(reference:ReactReference,caseId:string,target:Source,
  changes:Parameters<typeof reactInitialCaseEntry>[3]){
  const byMount=new Map<string,Source>();
  const selected=mounts(reference,caseId).filter(mount=>{
    const name=key(mount);
    if(!byMount.has(name))byMount.set(name,resolve(reference,mount));
    return same(byMount.get(name)!,target);
  });
  if(selected.length!==1)fail(selected.length?'initial-mount-ambiguous':'initial-mount-unmatched');
  const mount=selected[0];
  const derived=reactInitialCaseEntry(reference.cohort,caseId,{...target,exportName:mount.export},changes,
    new Map([[mount.module,target.module]]));
  return {...derived,receipt:{...derived.receipt,target:{...target,span:{...target.span}}}};
}
