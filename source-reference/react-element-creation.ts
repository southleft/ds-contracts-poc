import {reactJsxValuesRuntime} from './react-jsx-values.js';
import {readReactRuntimeExport,type ReactRuntimeExportDefinition} from './react-runtime-export.js';
import ts from 'typescript';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {transformSync,version as esbuildVersion,type Loader} from 'esbuild';
import type {ReactReference} from './react-reference.js';
import {readReactElementInvocationPlans,transformReactElementSource,reactElementInvocationRuntime,type ReactElementInvocationPlan,type ReactElementInvocation} from './react-element-invocation.js';
import {reactRuntimeAdapters,reactForwardCopyNeedle} from './react-helper-transform.js';
import {reactElementProvenanceRuntime} from './react-element-provenance.js';
import {reactCompiledValuesRuntime} from './react-compiled-values.js';
import {readReactElementSourceCalls,type ReactElementSourceCall,type ReactElementSourceCalls} from './react-element-source-call.js';
import {reactElementCompositionRuntime,type ReactElementMembership} from './react-element-composition.js';
import {readReactJsxInvocationPlans,bindReactJsxInvocations,readReactOriginalJsxSites,bindReactOriginalJsxSites,type ReactOriginalJsxSite,type ReactJsxMarker} from './react-jsx-invocation.js';

export interface ReactElementCreationSite {
  module:string;
  sourceSha256:string;
  span:{start:number;end:number};
  functionSpan?:{start:number;end:number};
  originalFunction?:{span:{start:number;end:number};plan:number;qualification:'original-function-invocation-only'};
  originalJsx?:ReactOriginalJsxSite;
  factory:'jsx'|'jsxs'|'createElement';
  referenceEntry?:{qualification:'reference-entry-origin-only';referenceId:string;cohortEntrySha256:string;entrySha256:string};
  /** Factory spans address retained generated JavaScript. originalFunction is a
   * separate original-source invocation link, never a compiled content model. */
  transformed?:{
    kind:'esbuild-jsx';version:string;loader:'jsx'|'tsx'|'ts';
    tsconfigSha256:string;generatedSha256:string;spanSpace:'generated-javascript';
    instrumentedSourceSha256?:string;
  };
}
interface Site extends ReactElementCreationSite {receiver?:string;}
export interface ReactElementLineage {
  version:1;acceptedContract:null;qualification:'react-factory-and-source-call-links-only';
  parents:Array<{site:ReactElementCreationSite;invocation?:ReactElementInvocation;enclosingReturn?:{site:ReactElementCreationSite;invocation:ReactElementInvocation;membership?:ReactElementMembership};
    sourceContext?:{qualification:'source-context-caller-only';acceptedContract:null;effectsVerified:false;call:ReactElementSourceCall;membership:ReactElementMembership}}>;
  stop:string;
}
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const runtimeSuffix='/node_modules/react/cjs/react-jsx-runtime.development.js';
// Both supported React development versions have these identical factory bytes.
const runtimeSha='dd50fd0db2fba44e0eee66243a45c81cfa3774cf41e4e6c0c080a601815c694d';
const G='globalThis.__DSC_ELEMENT_CREATION';
const reactCallNeedle='            return Component(props, secondArg);';

/** The binder distinguishes a JSX-runtime import from a same-named local.
 * This is an invocation location, not an interpretation of its containing body,
 * hooks, closures, wrapper factories, children or possible future inputs. */
export function readReactElementCreationSites(text:string,file:string,module:string,includeCreateElement=false):Site[]{
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if((sf as ts.SourceFile&{parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length)
    throw Error('element-creation-source-syntax');
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>path.dirname(file),getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host),checker=program.getTypeChecker();
  const imports=new Map<ts.Symbol,{factory?:ReactElementCreationSite['factory'];namespace?:'jsx'|'react'}>();
  for(const statement of sf.statements){
    if(!ts.isImportDeclaration(statement)||!ts.isStringLiteral(statement.moduleSpecifier))continue;
    const name=statement.moduleSpecifier.text,isReact=includeCreateElement&&name==='react';
    if(name!=='react/jsx-runtime'&&!isReact)continue;
    const clause=statement.importClause;if(!clause||clause.isTypeOnly)continue;
    if(isReact&&clause.name){const symbol=checker.getSymbolAtLocation(clause.name);if(symbol)imports.set(symbol,{namespace:'react'});}
    const binding=clause.namedBindings;if(!binding)continue;
    if(ts.isNamespaceImport(binding)){
      const symbol=checker.getSymbolAtLocation(binding.name);if(symbol)imports.set(symbol,{namespace:isReact?'react':'jsx'});
    }else for(const item of binding.elements){
      const name=(item.propertyName??item.name).text,symbol=checker.getSymbolAtLocation(item.name);
      if(!item.isTypeOnly&&symbol){
        if(!isReact&&(name==='jsx'||name==='jsxs')||isReact&&name==='createElement')imports.set(symbol,{factory:name as ReactElementCreationSite['factory']});
        if(isReact&&name==='default')imports.set(symbol,{namespace:'react'});
      }
    }
  }
  const sites:Site[]=[],sourceSha256=sha(text);
  const walk=(node:ts.Node,fn?:ts.Node)=>{
    const containing=ts.isFunctionLike(node)?node:fn;
    if(ts.isCallExpression(node)&&!node.questionDotToken&&node.arguments.length>=2&&node.arguments.length<=(includeCreateElement?10002:3)&&!node.arguments.some(ts.isSpreadElement)){
      const callee=node.expression;let factory:ReactElementCreationSite['factory']|undefined,receiver:string|undefined;
      if(ts.isIdentifier(callee)){
        const symbol=checker.getSymbolAtLocation(callee);if(symbol)factory=imports.get(symbol)?.factory;
      }else if(ts.isPropertyAccessExpression(callee)&&!callee.questionDotToken&&ts.isIdentifier(callee.expression)){
        const symbol=checker.getSymbolAtLocation(callee.expression),name=callee.name.text;
        const namespace=symbol&&imports.get(symbol)?.namespace;
        if(namespace==='jsx'&&(name==='jsx'||name==='jsxs')||namespace==='react'&&name==='createElement'){factory=name as ReactElementCreationSite['factory'];receiver=callee.expression.text;}
      }
      if(factory!=='createElement'&&node.arguments.length>3)factory=undefined;
      if(factory){
        const globalBinding=checker.getSymbolsInScope(node,ts.SymbolFlags.Value).find(s=>s.name==='globalThis');
        // JS expando analysis can attach a declaration to the globalThis
        // identifier in globalThis.property = value. That is a property write,
        // not a lexical replacement of the observer's global binding.
        if(globalBinding?.declarations?.some(d=>!(ts.isIdentifier(d)&&
          (ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d)))
          throw Error('element-creation-reserved-binding');
        sites.push({module,sourceSha256,span:{start:node.getStart(sf),end:node.end},...(containing?{functionSpan:{start:containing.getStart(sf),end:containing.end}}:{}),factory,...(receiver?{receiver}:{})});
      }
    }
    ts.forEachChild(node,child=>walk(child,containing));
  };
  walk(sf);return sites;
}

/** The runtime stores exact factory-return props identities. A committed host
 * gets a location only when type, props and creation-owner identities agree.
 * Returned elements and installed functions are never wrapped or mutated. */
export function reactElementCreationHook(sites:readonly ReactElementCreationSite[],plans:readonly ReactElementInvocationPlan[]=[],provenanceEnabled=false,sources:ReactElementSourceCalls={objects:[],calls:[]},targets:readonly ReactRuntimeExportDefinition[]=[]):string{
  return `((sites,plans,provenanceEnabled,sources,targets)=>{
 const N={apply:Reflect.apply,descriptor:Object.getOwnPropertyDescriptor,define:Object.defineProperty,freeze:Object.freeze,parse:JSON.parse,WeakMap,weakGet:WeakMap.prototype.get,Map,Error};
 const factories=new N.Map(),records=new N.WeakMap(),elements=new N.WeakMap(),invocations=new N.Map();let count=0;
 const fail=reason=>{throw new N.Error(reason);};
 const own=(value,key)=>{const d=N.descriptor(value,key);return d&&Object.prototype.hasOwnProperty.call(d,'value')?d.value:undefined;};
 const provenance=(${reactElementProvenanceRuntime})(provenanceEnabled);
 const invocation=(${reactElementInvocationRuntime})(plans,provenance,sources);
 const compare=(${reactCompiledValuesRuntime})(provenance,invocation.read);
 const composition=(${reactElementCompositionRuntime})(sources.arrays??[],provenance,value=>N.apply(N.weakGet,elements,[value]));
 const compareJsx=(${reactJsxValuesRuntime})(provenance,invocation.read,value=>N.apply(N.weakGet,elements,[value]),composition.isCurrentArray,targets);
 const observed=record=>{const result=invocation.read(record);if(result?.status==='observed')invocations.set(result.invocation,record);return result;};
 const matched=fiber=>{
  const record=fiber.memoizedProps&&records.get(fiber.memoizedProps);if(!record)return;
  if(own(record.element,'props')!==record.props||own(record.element,'type')!==record.type||own(record.element,'_owner')!==record.owner)fail('element-creation-result-changed');
  const owner=fiber._debugOwner;
  if(record.type!==fiber.type||typeof record.type!=='string'||!record.owner||
   !(record.owner===owner||record.owner.alternate===owner&&owner?.alternate===record.owner))return;
  return record;
 };
 const api=N.freeze({
  enter:invocation.enter,binding:invocation.binding,returned:invocation.returned,thrown:invocation.thrown,leave:invocation.leave,
  enterReact:invocation.enterReact,reactCall:invocation.reactCall,
  enterSource:invocation.enterSource,sourceCall:invocation.sourceCall,sourceObject:invocation.sourceObject,callbackObject:invocation.callbackObject,
  sourceArray:composition.array,
  registerTarget:compareJsx.register,registerFragment:compareJsx.fragment,
  globalRead:invocation.globalRead,member:invocation.member,write:invocation.write,
  literal:provenance.literal,forward:provenance.forward,
  register(jsx,jsxs){if(factories.has('jsx')||factories.has('jsxs')||typeof jsx!=='function'||typeof jsxs!=='function')fail('element-creation-factory-registration');factories.set('jsx',jsx);factories.set('jsxs',jsxs);},
  registerCreateElement(fn){if(!provenanceEnabled||factories.has('createElement')||typeof fn!=='function')fail('element-creation-factory-registration');factories.set('createElement',fn);},
  call(index,callee,receiver,args){
   const site=sites[index];if(!site||factories.get(site.factory)!==callee)fail('element-creation-factory-unproved');
   if(++count>100000)fail('element-creation-call-limit');
   const frame=invocation.current(site),origin=provenance.before(args[1],site),array=composition.before(origin,args[1],site),element=N.apply(callee,receiver,args);
   provenance.after(origin,element);
   composition.after(array,element);
   if(!element||typeof element!=='object')fail('element-creation-result-unmodeled');
   const props=own(element,'props'),type=own(element,'type'),owner=own(element,'_owner');
   if(!props||typeof props!=='object'||type!==args[0])fail('element-creation-result-unmodeled');
   if(records.has(props))fail('element-creation-props-reused');
   const record={element,props,type,owner,site,frame};records.set(props,record);elements.set(element,record);return element;
  },
  read(fiber){
   return matched(fiber)?.site;
  },
  readInvocation(fiber){
   const record=matched(fiber);return record&&observed(record);
  },
  readLineage(fiber){
   let record=matched(fiber);if(!record)return;
   const parents=[],seen=new Set(),done=stop=>({version:1,acceptedContract:null,qualification:'react-factory-and-source-call-links-only',parents,stop});
   for(let depth=0;depth<32;depth++){
    const frame=record.frame;if(!frame)return done('caller-invocation-unavailable');
    if(provenance.readInput(frame.origin).status!=='verified'){
     if(!frame.sourceCall)return done('caller-input-origin-unproved');
     const callback=observed(record);if(callback?.status!=='observed')return done('source-context-callback-unproved');
     const caller=invocation.sourceCaller(frame);if(!caller.frame)return done(caller.reason);
     const parent=elements.get(caller.frame.result);
     if(!parent||parent.frame!==caller.frame)return done('source-context-return-factory-unavailable');
     if(seen.has(parent))return done('caller-factory-cycle');seen.add(parent);
     const parentObservation=observed(parent),membership=composition.read(parent.element,record.element);
     parents.push({site:parent.site,...(parentObservation?{invocation:parentObservation}:{}),sourceContext:{qualification:'source-context-caller-only',acceptedContract:null,effectsVerified:false,call:callback.sourceCall,membership}});
     if(parentObservation?.status!=='observed')return done('source-context-caller-refused');
     if(membership.status!=='matched')return done('source-context-return-membership-refused');
     record=parent;continue;
    }
    const input=provenance.factoryProps(frame.input),parent=input&&records.get(input);
    if(!parent)return done('caller-factory-unavailable');
    if(seen.has(parent))return done('caller-factory-cycle');seen.add(parent);
    const parentObservation=observed(parent),returned=parent.frame&&elements.get(parent.frame.result);
    // A nested factory is not the returned element. Cross that boundary only
    // through a separately observed return and unique private membership path.
    const enclosing=returned&&returned!==parent&&returned.frame===parent.frame?observed(returned):undefined;
    const membership=enclosing?.status==='observed'?composition.read(returned.element,parent.element):undefined;
    parents.push({site:parent.site,...(parentObservation?{invocation:parentObservation}:{}),...(enclosing?{enclosingReturn:{site:returned.site,invocation:enclosing,...(membership?{membership}:{})}}:{})});
    if(!parentObservation)return done(parent.site.referenceEntry?'reference-entry-boundary':'caller-invocation-unavailable');
    if(parentObservation.status!=='observed'){
     if(membership?.status==='matched'){record=returned;continue;}
     return done('caller-invocation-refused');
    }
    record=parent;
   }return done('caller-depth-limit');
  },
  compareJsxValues(json){
   if(typeof json!=='string'||json.length>5000000)fail('jsx-values-request-limit');
   const requests=N.parse(json);if(!Array.isArray(requests)||requests.length>10000)fail('jsx-values-request-limit');
   return requests.map(target=>compareJsx.compare(invocations.get(target.observation?.invocation),target));
  },
  compareValues(json){
   if(typeof json!=='string'||json.length>5000000)fail('compiled-values-request-limit');
   const requests=N.parse(json);if(!Array.isArray(requests)||requests.length>10000)fail('compiled-values-request-limit');
   return requests.map(target=>compare(invocations.get(target.observation?.invocation),target));
  }
 });
 if(Object.prototype.hasOwnProperty.call(globalThis,'__DSC_ELEMENT_CREATION'))fail('element-creation-existing-hook');
 for(const site of sites){N.freeze(site.span);if(site.functionSpan)N.freeze(site.functionSpan);if(site.originalFunction){N.freeze(site.originalFunction.span);N.freeze(site.originalFunction);}if(site.originalJsx){N.freeze(site.originalJsx.span);if(site.originalJsx.tagSpan)N.freeze(site.originalJsx.tagSpan);N.freeze(site.originalJsx);}if(site.transformed)N.freeze(site.transformed);if(site.referenceEntry)N.freeze(site.referenceEntry);N.freeze(site);}N.freeze(sites);
 for(const plan of plans){
  if(plan.identityProperty){N.freeze(plan.identityProperty.objectSpan);N.freeze(plan.identityProperty);}
  N.freeze(plan.span);for(const parameter of plan.parameters)N.freeze(parameter);N.freeze(plan.parameters);
  for(const read of plan.bindingReads??[]){N.freeze(read.span);if(read.declaration){N.freeze(read.declaration.span);N.freeze(read.declaration);}N.freeze(read);}N.freeze(plan.bindingReads);
  for(const effect of plan.effectSites??[]){N.freeze(effect.span);N.freeze(effect);}N.freeze(plan.effectSites);
  for(const op of plan.operations??[]){N.freeze(op.span);N.freeze(op);}N.freeze(plan.operations);N.freeze(plan);
 }N.freeze(plans);
 for(const points of [sources.objects,sources.calls,sources.arrays??[]]){for(const point of points){N.freeze(point.span);if(point.functionSpan)N.freeze(point.functionSpan);N.freeze(point);}N.freeze(points);}N.freeze(sources);
 for(const target of targets){N.freeze(target.span);N.freeze(target);}N.freeze(targets);
 N.define(globalThis,'__DSC_ELEMENT_CREATION',{value:api});
})(${JSON.stringify(sites)},${JSON.stringify(plans)},${provenanceEnabled},${JSON.stringify(sources)},${JSON.stringify(targets)});`;
}

/** Only witnessed modules importing the JSX runtime participate. JSX/TS inputs
 * retain generated factory identity and separately bound original invocations.
 * The host still must compare the original and observed trees and pixels.
 * No serialization from this observer grants native or content authority. */
export function createReactElementCreationObserver(reference:Pick<ReactReference,'sourceRoot'|'files'|'runtimeImports'>&{id?:string;cohort?:Pick<ReactReference['cohort'],'entry'>},referenceEntry?:string,targetRequests:readonly {module:string;exportName:string}[]=[]){
  if(targetRequests.length>10000||targetRequests.length&&!referenceEntry)throw Error('jsx-values-target-entry-unavailable-or-limit');
  const targetResolutions=targetRequests.map(request=>readReactRuntimeExport(reference,request.module,[request.exportName]));
  const targets=[...new Map(targetResolutions.flatMap(result=>result.status==='resolved'
    ?[[JSON.stringify([result.definition.module,result.definition.sourceSha256,result.definition.span]),result.definition] as const]:[])).values()];
  const runtime=Object.keys(reference.files).filter(f=>f.endsWith(runtimeSuffix));
  if(runtime.length!==1||reference.files[runtime[0]]!==runtimeSha)throw Error('element-creation-react-runtime-unsupported');
  const version=[0,1].find(index=>reactRuntimeAdapters.every(adapter=>{
    const matches=Object.entries(reference.files).filter(([file])=>file.endsWith(adapter.suffix));
    return matches.length===1&&matches[0][1]===adapter.hashes[index];
  }));
  const forwardRuntime=version===undefined?undefined:Object.keys(reference.files).find(file=>file.endsWith(reactRuntimeAdapters[2].suffix));
  const coreRuntime=version===undefined?undefined:Object.keys(reference.files).find(file=>file.endsWith(reactRuntimeAdapters[0].suffix));
  const modules=[...new Set((reference.runtimeImports??[]).filter(e=>e.specifier==='react/jsx-runtime'&&/\.(?:[cm]?js|jsx|tsx|ts)$/.test(e.importer)).map(e=>e.importer))];
  const files=new Map<string,{text:string;code:string;sites:Array<Site&{index:number}>;plans:Array<ReactElementInvocationPlan&{index:number}>;sources:NonNullable<Parameters<typeof transformReactElementSource>[3]>;transformed?:ReactElementCreationSite['transformed'];jsxMarkers?:ReactJsxMarker[]}>(),sites:ReactElementCreationSite[]=[],plans:ReactElementInvocationPlan[]=[];
  const sourceCalls:ReactElementSourceCalls={objects:[],calls:[],arrays:[]};
  const transformedSources:Array<{file:string;sourceSha256:string;transform:NonNullable<ReactElementCreationSite['transformed']>;code:string;instrumentedSource?:string;originalJsx?:Array<{source:ReactOriginalJsxSite;marker:ReactJsxMarker;factoryObserved:boolean}>}>=[];
  const transformRefusals:Array<{file:string;sourceSha256:string;reason:string}>=[];
  let originalJsxCount=0;
  for(const file of modules){
    if(!file.startsWith(reference.sourceRoot+path.sep))throw Error('element-creation-outside-source');
    const text=readFileSync(file,'utf8');if(reference.files[file]!==sha(text))throw Error('element-creation-source-changed');
    if(text.length>5_000_000)throw Error('element-creation-source-limit');
    const module=path.relative(reference.sourceRoot,file).split(path.sep).join('/');
    const indexSources=(localSources:ReactElementSourceCalls)=>{
      const offset=sourceCalls.objects.length;
      const objects=localSources.objects.map(point=>{const index=sourceCalls.objects.length;sourceCalls.objects.push(point);return {...point,index};});
      const calls=localSources.calls.map(point=>{const adjusted={...point,object:point.object+offset},index=sourceCalls.calls.length;sourceCalls.calls.push(adjusted);return {...adjusted,index};});
      const arrays=(localSources.arrays??[]).map(point=>{const index=sourceCalls.arrays!.length;sourceCalls.arrays!.push(point);return {...point,index};});
      if(sourceCalls.objects.length>10000||sourceCalls.calls.length>10000)throw Error('element-source-call-site-limit');
      if(sourceCalls.arrays!.length>10000)throw Error('element-source-array-site-limit');
      return {objects,calls,arrays};
    };
    let code=text,transformed:ReactElementCreationSite['transformed'],instrumentedSource:string|undefined;
    let originalFunctions:ReturnType<typeof bindReactJsxInvocations>|undefined;
    let originalJsx:ReactOriginalJsxSite[]|undefined,jsxBindings:ReturnType<typeof bindReactOriginalJsxSites>|undefined;
    if(/\.(?:jsx|tsx|ts)$/.test(file)){
      // buildReactReference forces this same root config and automatic JSX.
      // Never silently flatten extends: those extra config inputs would need
      // their own capture and deterministic resolution before observation.
      const configFile=path.join(reference.sourceRoot,'tsconfig.json');
      if(!reference.files[configFile])throw Error('element-creation-tsconfig-unrecorded');
      const config=readFileSync(configFile,'utf8'),tsconfigSha256=sha(config);
      if(tsconfigSha256!==reference.files[configFile])throw Error('element-creation-tsconfig-changed');
      if(config.length>5_000_000)throw Error('element-creation-source-limit');
      const parsed=ts.parseConfigFileTextToJson(configFile,config);
      if(parsed.error||!parsed.config||typeof parsed.config!=='object'||Array.isArray(parsed.config))
        throw Error('element-creation-tsconfig-unmodeled');
      if(Object.hasOwn(parsed.config,'extends')){
        // Keep the original loader and existing compiled-module observation.
        // This input receives no generated sites or private props provenance.
        transformRefusals.push({file,sourceSha256:sha(text),reason:'element-creation-tsconfig-inheritance-unmodeled'});
        continue;
      }
      const loader=path.extname(file).slice(1) as 'jsx'|'tsx'|'ts';
      const original=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,loader==='tsx'?ts.ScriptKind.TSX:loader==='jsx'?ts.ScriptKind.JSX:ts.ScriptKind.TS);
      const originalPlans=readReactJsxInvocationPlans(original,module,sha(text)).map(plan=>{const index=plans.length;plans.push(plan);return {...plan,index};});
      if(plans.length>10000)throw Error('element-invocation-plan-limit');
      originalJsx=readReactOriginalJsxSites(original);originalJsxCount+=originalJsx.length;
      if(originalJsxCount>10000)throw Error('jsx-original-site-limit');
      if(originalPlans.length||originalJsx.length){
        if(text.includes('__DSC_'))throw Error('element-creation-reserved-binding');
        instrumentedSource=transformReactElementSource(original,[],originalPlans,indexSources(readReactElementSourceCalls(original,module,sha(text))),{sites:originalJsx});
        if(instrumentedSource.length>5_000_000)throw Error('element-creation-source-limit');
      }
      code=transformSync(instrumentedSource??text,{loader,jsx:'automatic',target:'esnext',tsconfigRaw:config,sourcefile:file}).code;
      if(code.length>5_000_000)throw Error('element-creation-source-limit');
      transformed={kind:'esbuild-jsx',version:esbuildVersion,loader,tsconfigSha256,generatedSha256:sha(code),spanSpace:'generated-javascript',...(instrumentedSource?{instrumentedSourceSha256:sha(instrumentedSource)}:{})};
      const generated=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
      originalFunctions=bindReactJsxInvocations(generated,originalPlans);
      jsxBindings=bindReactOriginalJsxSites(generated,originalJsx);
    }
    const local=readReactElementCreationSites(code,file,module)
      .map(site=>{
        const originalFunction=originalFunctions?.get(JSON.stringify(site.functionSpan));
        const originalJsx=jsxBindings?.bindings.get(JSON.stringify(site.span));
        return transformed?{...site,sourceSha256:sha(text),transformed,...(originalFunction?{originalFunction}:{}),...(originalJsx?{originalJsx}:{})}:site;
      });
    if(local.length||jsxBindings?.markers.length){
      if(text.includes('__DSC_'))throw Error('element-creation-reserved-binding');
      const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
      const localPlans=(transformed?[]:readReactElementInvocationPlans(source,local)).map(plan=>{const index=plans.length;plans.push(plan);return {...plan,index};});
      const {objects,calls,arrays}=transformed?{objects:[],calls:[],arrays:[]}:indexSources(readReactElementSourceCalls(source,local[0].module,local[0].sourceSha256));
      files.set(file,{text,code,transformed,sites:local.map(site=>{const {receiver:_receiver,...identity}=site;const index=sites.length;sites.push(identity);return {...site,index};}),plans:localPlans,sources:{objects,calls,arrays},jsxMarkers:jsxBindings?.markers});
      if(transformed)transformedSources.push({file,sourceSha256:sha(text),transform:transformed,code,...(instrumentedSource?{instrumentedSource}:{}),...(jsxBindings?{originalJsx:jsxBindings.markers.map(marker=>({source:originalJsx![marker.index],marker,factoryObserved:local.some(site=>site.span.start===marker.factorySpan.start&&site.span.end===marker.factorySpan.end)}))}:{})});
    }
    if(sites.length>10000)throw Error('element-creation-site-limit');
  }
  let entry:{text:string;code:string;sites:Array<Site&{index:number}>;configSha256:string;identity:NonNullable<ReactElementCreationSite['referenceEntry']>}|undefined;
  if(referenceEntry!==undefined){
    if(version===undefined)throw Error('reference-entry-react-runtime-unsupported');
    const original=reference.cohort?.entry;
    if(!reference.id||!/^[a-f0-9]{64}$/.test(reference.id)||!original||!referenceEntry.startsWith(original)||
      referenceEntry.length>original.length&&referenceEntry[original.length]!=='\n')throw Error('reference-entry-source-unbound');
    if(referenceEntry.length>5_000_000)throw Error('element-creation-source-limit');
    const configFile=path.join(reference.sourceRoot,'tsconfig.json'),config=readFileSync(configFile,'utf8'),configSha256=sha(config);
    if(configSha256!==reference.files[configFile])throw Error('reference-entry-tsconfig-unrecorded-or-changed');
    const parsed=ts.parseConfigFileTextToJson(configFile,config);
    if(parsed.error||!parsed.config||typeof parsed.config!=='object'||Array.isArray(parsed.config)||Object.hasOwn(parsed.config,'extends'))throw Error('reference-entry-tsconfig-unmodeled');
    const code=transformSync(referenceEntry,{loader:'tsx',jsx:'automatic',target:'esnext',tsconfigRaw:config,sourcefile:'react-reference.tsx'}).code;
    if(code.length>5_000_000)throw Error('element-creation-source-limit');
    const sourceSha256=sha(referenceEntry),identity={qualification:'reference-entry-origin-only' as const,referenceId:reference.id,cohortEntrySha256:sha(original),entrySha256:sourceSha256};
    const transformed={kind:'esbuild-jsx' as const,version:esbuildVersion,loader:'tsx' as const,tsconfigSha256:configSha256,generatedSha256:sha(code),spanSpace:'generated-javascript' as const};
    const entrySites=readReactElementCreationSites(code,'react-reference.tsx','react-reference.tsx',true).map(site=>{
      const full={...site,sourceSha256,transformed,referenceEntry:identity},index=sites.length,{receiver:_receiver,...point}=full;sites.push(point);return {...full,index};
    });
    if(sites.length>10000)throw Error('element-creation-site-limit');
    entry={text:referenceEntry,code,sites:entrySites,configSha256,identity};
    transformedSources.push({file:'react-reference.tsx',sourceSha256,transform:transformed,code});
  }
  const changes:Array<{file:string;inputSha256:string;outputSha256:string;sites:number}>=[],seen=new Set<string>();
  return {
    sites,plans,changes,sourceCalls,transformedSources,transformRefusals,targets,targetResolutions,hook:reactElementCreationHook(sites,plans,version!==undefined,sourceCalls,targets),
    referenceEntry:entry?{source:entry.text,identity:entry.identity}:undefined,
    complete(){if(!seen.has(runtime[0])||forwardRuntime&&!seen.has(forwardRuntime)||coreRuntime&&!seen.has(coreRuntime)||entry&&!seen.has('react-reference.tsx')||[...files.keys()].some(f=>!seen.has(f)))throw Error('element-creation-transform-incomplete');},
    async transform(text:string,file:string,loader:Loader){
      if(file==='react-reference.tsx'){
        if(!entry)return {contents:text,loader};
        if(text!==entry.text||loader!=='tsx')throw Error('reference-entry-source-or-loader-changed');
        if(sha(readFileSync(path.join(reference.sourceRoot,'tsconfig.json'),'utf8'))!==entry.configSha256)throw Error('reference-entry-tsconfig-changed');
        const sf=ts.createSourceFile(file,entry.code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
        if(text.includes('__DSC_JSX_TARGET_'))throw Error('jsx-values-target-reserved-binding');
        const registrations=targets.map((target,index)=>
          `import {${JSON.stringify(target.exportName)} as __DSC_JSX_TARGET_${index}} from ${JSON.stringify('./'+target.module)};\n${G}.registerTarget(${index},__DSC_JSX_TARGET_${index});`).join('\n');
        const contents=transformReactElementSource(sf,entry.sites,[])+(registrations?'\n'+registrations:'');seen.add(file);changes.push({file,inputSha256:sha(text),outputSha256:sha(contents),sites:entry.sites.length});return {contents,loader:'js' as const};
      }
      if(reference.files[file]!==sha(text)||text.includes('__DSC_'))throw Error('element-creation-source-changed-or-reserved');
      let contents=text;
      if(file===runtime[0])contents+=`\n${G}.register(exports.jsx,exports.jsxs);\n`;
      else if(file===forwardRuntime){
        if(text.split(reactForwardCopyNeedle).length!==2)throw Error('element-forward-copy-site-unmatched');
        contents=text.replace(reactForwardCopyNeedle,`      ${G}.forward(nextProps,propsWithoutRef,ref);\n`+reactForwardCopyNeedle);
        if(text.split(reactCallNeedle).length!==2)throw Error('element-react-call-site-unmatched');
        contents=contents.replace(reactCallNeedle,`            return ${G}.reactCall(Component,props,secondArg);`);
      }
      else if(file===coreRuntime){contents+=`\n${G}.registerFragment(exports.Fragment);\n`;if(entry)contents+=`\n${G}.registerCreateElement(exports.createElement);\n`;}
      else {
        const entry=files.get(file);if(!entry)return {contents,loader};
        if(text!==entry.text)throw Error('element-creation-source-changed');
        if(entry.transformed){
          if(loader!==entry.transformed.loader)throw Error('element-creation-loader-changed');
          if(sha(readFileSync(path.join(reference.sourceRoot,'tsconfig.json'),'utf8'))!==entry.transformed.tsconfigSha256)
            throw Error('element-creation-tsconfig-changed');
          loader='js';
        }
        const sf=ts.createSourceFile(file,entry.code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
        contents=transformReactElementSource(sf,entry.sites,entry.plans,entry.sources,{markers:entry.jsxMarkers});
      }
      seen.add(file);changes.push({file,inputSha256:sha(text),outputSha256:sha(contents),sites:files.get(file)?.sites.length??0});return {contents,loader};
    },
  };
}
