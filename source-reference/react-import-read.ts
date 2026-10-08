import ts from 'typescript';
import path from 'node:path';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {prepareReactEffectProgram,type ReactHelperReference} from './react-helper-effects.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import type {HelperSourcePoint} from './react-helper-model.mjs';
/** A source request for a future identity observation, never an export-value proof. */
export function planImportRead(reference:ReactHelperReference,point:HelperSourcePoint){
 try{
 const {root,file,sf,checker,requireCurrent}=prepareReactEffectProgram(reference,point.file,{},{});
 if(reference.files[file]!==point.sha256)throw Error('import-read-source-changed');
 let node:ts.Identifier|undefined;const scan=(n:ts.Node)=>{if(ts.isIdentifier(n)&&n.getStart(sf)===point.start&&n.end===point.end)node=n;ts.forEachChild(n,scan);};scan(sf);if(!node)throw Error('import-read-not-identifier');
 const ds=checker.getSymbolAtLocation(node)?.declarations;if(ds?.length!==1)throw Error('import-read-binding-ambiguous');const d=ds[0];let clause:ts.ImportClause,exportPath:string[];
 if(ts.isImportSpecifier(d)&&!d.isTypeOnly){clause=d.parent.parent;exportPath=[(d.propertyName??d.name).text];}
 else if(ts.isImportClause(d)){clause=d;exportPath=['default'];}
 else throw Error('import-read-binding-unsupported');
 if(clause.isTypeOnly||!ts.isImportDeclaration(clause.parent)||!ts.isStringLiteral(clause.parent.moduleSpecifier))throw Error('import-read-not-executable');
 const specifier=clause.parent.moduleSpecifier.text,edges=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===file&&e.specifier===specifier).map(e=>e.file))];
 if(edges.length!==1)throw Error('import-read-edge-unwitnessed-or-ambiguous');const target=fs.realpathSync(edges[0]);if(target!==edges[0]||!reference.files[target]||createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==reference.files[target])throw Error('import-read-target-changed');
 const resolution=readReactRuntimeExport(reference,path.relative(root,target),exportPath);requireCurrent();
 return {status:'planned' as const,qualification:'source-import-read-plan-only',acceptedContract:null,runtimeVerified:false,read:point,binding:{file:point.file,sha256:point.sha256,start:d.getStart(sf),end:d.end},specifier,target:{file:path.relative(root,target),sha256:reference.files[target]},exportPath,resolution};
 }catch(e){return {status:'refused' as const,reason:e instanceof Error?e.message:String(e),acceptedContract:null,runtimeVerified:false};}
}
