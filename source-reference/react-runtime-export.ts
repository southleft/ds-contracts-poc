import ts from 'typescript';
import path from 'node:path';
import {readFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {ReactSourceProgram,ReactSourceComponent} from './react-source-program.js';

interface RuntimeReference {
  sourceRoot: string;
  files: Readonly<Record<string,string>>;
  runtimeImports?: readonly {importer:string;specifier:string;file:string}[];
}
export interface ReactRuntimeExportDefinition {
  module: string;
  /** Export through which the final source binding can be observed at runtime. */
  exportName: string;
  sourceSha256: string;
  span: {start:number;end:number};
  bindingName: string | null;
  declarationKind: string;
}
export type ReactRuntimeExport = {
  version: 1;
  acceptedContract: null;
  runtimeVerified: false;
  files: Record<string,string>;
  route: Array<{module:string;exportPath:string[]}>;
} & ({status:'resolved';definition:ReactRuntimeExportDefinition} | {status:'refused';reason:string});

type ExportTarget = {kind:'local';name:string} | {kind:'remote';specifier:string;name:string} |
  {kind:'namespace';specifier:string} | {kind:'declaration';node:ts.Node;name:string|null};
type Local = {kind:'declaration';node:ts.Node;name:string|null} |
  {kind:'remote';specifier:string;name:string} | {kind:'namespace';specifier:string};
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
class Refused extends Error {}
function fail(reason:string):never {throw new Refused(reason);}

/** Resolve a value export through the exact ESM edges captured by the original
 * bundler. Declaration files, package metadata and source maps cannot substitute
 * for executable bytes. This identifies a source binding; it neither executes
 * its initializer nor proves a stable runtime value, component or content flow. */
export function readReactRuntimeExport(reference:RuntimeReference,module:string,exportPath:readonly string[]):ReactRuntimeExport {
  const files:Record<string,string>={},route:ReactRuntimeExport['route']=[];
  const common={version:1 as const,acceptedContract:null,runtimeVerified:false as const,files,route};
  try {
    const root=realpathSync(reference.sourceRoot);
    const moduleName=(file:string)=>path.relative(root,file).split(path.sep).join('/');
    const current=(file:string)=>{
      const absolute=realpathSync(file);
      if(absolute!==file || !absolute.startsWith(root+path.sep))fail('runtime-export-outside-source-root');
      if(/\.d\.[cm]?ts$/.test(file) || !/\.[cm]?[jt]sx?$/.test(file))fail('runtime-export-nonexecutable-source');
      const bytes=readFileSync(file),hash=sha(bytes);
      if(bytes.length>5_000_000)fail('runtime-export-source-limit');
      if(reference.files[file]!==hash || (files[file] && files[file]!==hash))fail('runtime-export-source-not-witnessed-or-changed');
      files[file]=hash;
      return bytes.toString('utf8');
    };
    const edge=(file:string,specifier:string)=>{
      const targets=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===file&&e.specifier===specifier).map(e=>e.file))];
      if(targets.length!==1)fail(targets.length?'runtime-export-edge-ambiguous':'runtime-export-edge-unwitnessed');
      current(targets[0]);
      return targets[0];
    };
    const cache=new Map<string,{sf:ts.SourceFile;locals:Map<string,Local>;exports:Map<string,ExportTarget>;stars:string[]}>();
    const read=(file:string)=>{
      const source=current(file),old=cache.get(file);if(old)return old;
      const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
      const diagnostics=(sf as ts.SourceFile & {parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics;
      if(diagnostics.length)fail('runtime-export-source-syntax');
      const locals=new Map<string,Local>(),exports=new Map<string,ExportTarget>(),stars:string[]=[];
      const add=<T>(map:Map<string,T>,name:string,value:T)=>{if(map.has(name))fail('runtime-export-duplicate-binding');map.set(name,value);};
      const exported=(node:ts.Node)=>ts.canHaveModifiers(node)&&!!ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword);
      const isDefault=(node:ts.Node)=>ts.canHaveModifiers(node)&&!!ts.getModifiers(node)?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword);
      for(const statement of sf.statements){
        if(ts.isImportDeclaration(statement)){
          const clause=statement.importClause;if(!clause||clause.isTypeOnly)continue;
          if(!ts.isStringLiteral(statement.moduleSpecifier))fail('runtime-export-import-unmodeled');
          const specifier=statement.moduleSpecifier.text;
          if(clause.name)add(locals,clause.name.text,{kind:'remote',specifier,name:'default'});
          const binding=clause.namedBindings;
          if(binding&&ts.isNamespaceImport(binding))add(locals,binding.name.text,{kind:'namespace',specifier});
          else if(binding)for(const item of binding.elements)if(!item.isTypeOnly)add(locals,item.name.text,{kind:'remote',specifier,name:(item.propertyName??item.name).text});
        } else if(ts.isExportDeclaration(statement)){
          if(statement.isTypeOnly)continue;
          const specifier=statement.moduleSpecifier;
          if(specifier&&!ts.isStringLiteral(specifier))fail('runtime-export-import-unmodeled');
          const spec=specifier?.text;
          if(!statement.exportClause){if(!spec)fail('runtime-export-import-unmodeled');stars.push(spec);}
          else if(ts.isNamespaceExport(statement.exportClause)){
            if(!spec)fail('runtime-export-import-unmodeled');add(exports,statement.exportClause.name.text,{kind:'namespace',specifier:spec});
          }else for(const item of statement.exportClause.elements)if(!item.isTypeOnly){
            const name=(item.propertyName??item.name).text;
            add(exports,item.name.text,spec?{kind:'remote',specifier:spec,name}:{kind:'local',name});
          }
        } else if(ts.isVariableStatement(statement)){
          for(const declaration of statement.declarationList.declarations){
            if(!ts.isIdentifier(declaration.name)){if(exported(statement))fail('runtime-export-destructured-export');continue;}
            const name=declaration.name.text;add(locals,name,{kind:'declaration',node:declaration,name});
            if(exported(statement))add(exports,name,{kind:'local',name});
          }
        } else if(ts.isFunctionDeclaration(statement)||ts.isClassDeclaration(statement)){
          const name=statement.name?.text??null,target:Local={kind:'declaration',node:statement,name};
          if(name)add(locals,name,target);
          if(isDefault(statement))add(exports,'default',target);
          else if(exported(statement)&&name)add(exports,name,{kind:'local',name});
        } else if(ts.isExportAssignment(statement)){
          if(statement.isExportEquals||!ts.isIdentifier(statement.expression))fail('runtime-export-expression-unmodeled');
          add(exports,'default',{kind:'local',name:statement.expression.text});
        }
      }
      const out={sf,locals,exports,stars};cache.set(file,out);return out;
    };
    const resolve=(file:string,names:readonly string[],seen:Set<string>):ReactRuntimeExportDefinition=>{
      if(!names.length||names.some(n=>!n))fail('runtime-export-path-invalid');
      if(names.length>64 || route.length>=256)fail('runtime-export-traversal-limit');
      const key=JSON.stringify([file,names]);if(seen.has(key))fail('runtime-export-cycle');
      const next=new Set([...seen,key]),record=read(file),[name,...tail]=names;
      route.push({module:moduleName(file),exportPath:[...names]});
      const follow=(target:ExportTarget|Local):ReactRuntimeExportDefinition=>{
        if(target.kind==='remote')return resolve(edge(file,target.specifier),[target.name,...tail],next);
        if(target.kind==='namespace'){if(!tail.length)fail('runtime-export-namespace-not-value');return resolve(edge(file,target.specifier),tail,next);}
        if(target.kind==='local'){
          const local=record.locals.get(target.name);if(!local)fail('runtime-export-local-unresolved');return follow(local);
        }
        if(tail.length)fail('runtime-export-member-not-namespace');
        return {module:moduleName(file),exportName:name,sourceSha256:files[file],span:{start:target.node.getStart(record.sf),end:target.node.end},bindingName:target.name,declarationKind:ts.SyntaxKind[target.node.kind]};
      };
      const explicit=record.exports.get(name);if(explicit)return follow(explicit);
      const found:ReactRuntimeExportDefinition[]=[];
      if(name!=='default')for(const specifier of record.stars){
        try{found.push(resolve(edge(file,specifier),names,next));}
        catch(error){if(!(error instanceof Refused)||error.message!=='runtime-export-missing')throw error;}
      }
      if(!found.length)fail('runtime-export-missing');
      const binding=(d:ReactRuntimeExportDefinition)=>JSON.stringify([d.module,d.sourceSha256,d.span,d.bindingName,d.declarationKind]);
      if(found.some(d=>binding(d)!==binding(found[0])))fail('runtime-export-star-ambiguous');
      return found[0];
    };
    const file=realpathSync(path.resolve(root,module));
    const definition=resolve(file,exportPath,new Set());
    for(const file of Object.keys(files))current(file);
    return {...common,status:'resolved',definition};
  }catch(error){return {...common,status:'refused',reason:error instanceof Refused?error.message:'runtime-export-input-unavailable'};}
}

/** Add only runtime observation identities for JSX dependencies that the
 * declaration checker could not locate in executable source. Their implementation,
 * root, props API and children semantics remain unresolved. These registrations
 * cannot authorize native generation; the paired browser render must still match. */
export function observeReactRuntimeDependencies(reference:RuntimeReference,source:ReactSourceProgram){
  const program=structuredClone(source);
  const observations:Array<{component:{module:string;exportName:string};target:{module:string;exportPath:string[]};result:ReactRuntimeExport}>=[];
  const key=(c:Pick<ReactSourceComponent,'module'|'sourceSha256'|'span'>)=>JSON.stringify([c.module,c.sourceSha256,c.span]);
  const existing=new Set(source.components.map(key));
  const root=realpathSync(reference.sourceRoot);
  for(const component of source.components){
    for(const {target} of component.componentReferences){
      if(target.dependencyProblem!=='implementation-unavailable'||!target.module||!target.export)continue;
      const targets=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===path.resolve(root,component.module)&&e.specifier===target.module).map(e=>e.file))];
      const exportPath=target.export.split('.');
      const result:ReactRuntimeExport=targets.length===1?readReactRuntimeExport(reference,path.relative(root,targets[0]),exportPath):{
        version:1,acceptedContract:null,runtimeVerified:false,files:{},route:[],status:'refused',reason:targets.length?'runtime-export-edge-ambiguous':'runtime-export-edge-unwitnessed',
      };
      observations.push({component:{module:component.module,exportName:component.exportName},target:{module:target.module,exportPath},result});
      if(result.status!=='resolved')continue;
      const d=result.definition;if(existing.has(key(d)))continue;
      for(const [file,hash] of Object.entries(result.files)){
        if(program.files[file]&&program.files[file]!==hash)throw Error('react-runtime-dependency-source-changed');
        program.files[file]=hash;
      }
      existing.add(key(d));
      program.components.push({name:d.bindingName??d.exportName,exportName:d.exportName,module:d.module,
        sourceSha256:d.sourceSha256,span:d.span,implementation:'unresolved',props:[],
        root:{kind:'unresolved',reason:'runtime-export-body-unmodeled'},markers:[],defaults:{},forwardedProps:[],
        children:{kind:'unresolved',reason:'runtime-export-body-unmodeled'},componentReferences:[],
        problems:['runtime-export-binding-only','runtime-export-body-unmodeled'],
      });
    }
  }
  return {program,observations};
}
