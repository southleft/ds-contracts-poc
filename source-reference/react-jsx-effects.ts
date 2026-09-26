import ts from 'typescript';
import path from 'node:path';
import {prepareReactEffectProgram,type ReactHelperReference} from './react-helper-effects.js';
import {modelReactJsxComponent,type CompiledModelInput,type JsxModelResult,type HelperSourcePoint} from './react-helper-model.mjs';
import {readReactJsxInvocationPlans,readReactOriginalJsxSites} from './react-jsx-invocation.js';
import {readReactRuntimeExport,type ReactRuntimeExport} from './react-runtime-export.js';
import type {ReactElementCreationSite} from './react-element-creation.js';
import type {ReactElementInvocation,ReactElementObservedValue} from './react-element-invocation.js';

export type ReactJsxEffects = {
  version:1;acceptedContract:null;runtimeVerified:false;
  qualification:'original-jsx-effects-model-only';
  site:ReactElementCreationSite;
  sourceFiles:Record<string,string>;checkerFiles:Record<string,string>;
  targets:Array<{read:HelperSourcePoint;resolution:ReactRuntimeExport}>;
  runtimeRequirements:readonly string[];
} & JsxModelResult;

/** Model the complete original function using its actual observed input fields.
 * Serialized observations and resolved exports are assumptions, never authority
 * for runtime effects, imported component identity, or native conversion. */
export function readReactJsxEffects(reference:ReactHelperReference,site:ReactElementCreationSite,invocation:ReactElementInvocation):ReactJsxEffects {
  const sourceFiles:Record<string,string>={},checkerFiles:Record<string,string>={},targets:ReactJsxEffects['targets']=[];
  const common={version:1 as const,acceptedContract:null,runtimeVerified:false as const,
    qualification:'original-jsx-effects-model-only' as const,site,sourceFiles,checkerFiles,targets,
    runtimeRequirements:[
      'original-and-instrumented-render-equivalence',
      'authenticate-original-input-and-return-in-the-same-invocation',
      'guard-complete-input-descriptors-and-secondary-parameter-identities',
      'registered-original-transitive-functions-metadata-and-unchanged-module-state',
      'unchanged-native-global-bindings-intrinsic-graph-and-iterators',
      'authenticate-every-imported-JSX-target-value-and-lookup-effects',
      'compare-complete-returned-JSX-props-key-children-and-opaque-identities',
      'prove-enclosing-provider-state-and-caller-boundaries',
    ],
  };
  try {
    if(!site.transformed||site.referenceEntry||!site.originalFunction||!site.originalJsx)throw Error('jsx-effects-original-source-unavailable');
    if(invocation.status!=='observed')throw Error('jsx-effects-invocation-unavailable');
    const {root,file,program,checker,sf,source,runtimeFiles,requireCurrent}=prepareReactEffectProgram(reference,site.module,sourceFiles,checkerFiles);
    if(reference.files[file]!==site.sourceSha256)throw Error('jsx-effects-source-changed');
    // Invocation planning uses its own no-resolve checker. Give it a separate
    // AST so it cannot replace symbols on the pinned executable program.
    const planningSource=ts.createSourceFile(file,sf.text,ts.ScriptTarget.Latest,true);
    const plan=readReactJsxInvocationPlans(planningSource,site.module,site.sourceSha256).find(p=>p.span.start===site.originalFunction!.span.start&&p.span.end===site.originalFunction!.span.end);
    if(!plan||JSON.stringify(plan)!==JSON.stringify(invocation.function))throw Error('jsx-effects-invocation-plan-changed');
    if(!readReactOriginalJsxSites(planningSource).some(s=>JSON.stringify(s)===JSON.stringify(site.originalJsx)))throw Error('jsx-effects-original-site-changed');
    if(invocation.inputProvenance.status!=='verified'||invocation.outputProvenance.status!=='verified'||
      JSON.stringify(invocation.outputProvenance.source)!==JSON.stringify(site))throw Error('jsx-effects-input-or-return-origin-unproved');
    if(invocation.input.length>10000)throw Error('jsx-effects-input-limit');
    let component:ts.FunctionDeclaration|ts.FunctionExpression|ts.ArrowFunction|undefined;
    const find=(node:ts.Node)=>{
      if((ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node))&&node.getStart(sf)===plan.span.start&&node.end===plan.span.end)component=node;
      ts.forEachChild(node,find);
    };find(sf);
    if(!component||!component.parameters.length||!ts.isIdentifier(component.parameters[0].name))throw Error('jsx-effects-function-unavailable');
    const decode=(value:ReactElementObservedValue):CompiledModelInput=>{
      if(value.kind==='null'&&value.value===null&&!value.representation)return null;
      if(value.kind==='undefined'&&!('value' in value)&&!value.representation)return undefined;
      if(value.kind==='number'&&typeof value.value==='number'&&Number.isFinite(value.value)&&!Object.is(value.value,-0)&&!value.representation)return value.value;
      if((value.kind==='string'||value.kind==='boolean')&&typeof value.value===value.kind&&!value.representation)return value.value;
      if(['object','function','symbol','bigint'].includes(value.kind)&&!('value' in value)&&!value.representation)return {opaque:value.kind};
      throw Error('jsx-effects-value-unmodeled');
    };
    const keys=new Set<string>();
    const properties=invocation.input.map(([key,value])=>{
      if(typeof key!=='string'||keys.has(key)||key==='__proto__')throw Error('jsx-effects-input-key-unmodeled');
      keys.add(key);return [key,decode(value)] as const;
    });
    const jsxTarget=(name:ts.JsxTagNameExpression):HelperSourcePoint|undefined=>{
      const members:string[]=[];let base:ts.Expression|ts.JsxNamespacedName=name;
      while(ts.isPropertyAccessExpression(base)){members.unshift(base.name.text);base=base.expression;}
      if(!ts.isIdentifier(base))return undefined;
      const declaration=checker.getSymbolAtLocation(base)?.declarations?.[0];
      let clause:ts.ImportClause|undefined,exportPath:string[];
      if(declaration&&ts.isImportSpecifier(declaration)){
        if(declaration.isTypeOnly)return undefined;
        clause=declaration.parent.parent;exportPath=[(declaration.propertyName??declaration.name).text,...members];
      }else if(declaration&&ts.isNamespaceImport(declaration)){
        clause=declaration.parent;exportPath=members;
      }else if(declaration&&ts.isImportClause(declaration)){
        clause=declaration;exportPath=['default',...members];
      }else return undefined;
      if(clause.isTypeOnly||!exportPath.length||!ts.isImportDeclaration(clause.parent)||!ts.isStringLiteral(clause.parent.moduleSpecifier))return undefined;
      const specifier=clause.parent.moduleSpecifier.text,importer=path.resolve(root,source(name).file);
      const edges=[...new Set((reference.runtimeImports??[]).filter(e=>e.importer===importer&&e.specifier===specifier).map(e=>e.file))];
      if(edges.length!==1)throw Error('jsx-effects-target-edge-unwitnessed-or-ambiguous');
      const resolution=readReactRuntimeExport(reference,path.relative(root,edges[0]),exportPath);
      targets.push({read:source(name),resolution});
      Object.assign(sourceFiles,resolution.files);
      if(resolution.status!=='resolved')throw Error('jsx-effects-target-'+resolution.reason);
      const definition=resolution.definition;
      return {file:definition.module,sha256:definition.sourceSha256,...definition.span};
    };
    const model=modelReactJsxComponent({program,component,parameter:component.parameters[0].name,properties,contentKey:'children',source,runtimeFiles,resolution:reference.runtimeImports,jsxTarget});
    if(model.status==='modeled'&&(model.output.source.file!==site.module||model.output.source.sha256!==site.sourceSha256||model.output.source.start!==site.originalJsx.span.start||model.output.source.end!==site.originalJsx.span.end))throw Error('jsx-effects-returned-site-mismatch');
    requireCurrent();
    return {...common,...model};
  }catch(error){return {...common,status:'refused',reason:error instanceof Error?error.message:'jsx-effects-model-unavailable',steps:0};}
}
