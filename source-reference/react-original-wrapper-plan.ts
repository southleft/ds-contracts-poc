import ts from 'typescript';
import {prepareReactEffectProgram,type ReactHelperReference} from './react-helper-effects.js';
import {readReactElementCreationSites,type ReactElementCreationSite} from './react-element-creation.js';
import {readReactElementInvocationPlans,type ReactElementInvocation} from './react-element-invocation.js';
import {readReactTargetInitializer,type ReactTargetInitializer} from './react-target-initializer.js';
import {planReactContextFactoryCalls} from './react-context-calls.js';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Authentic original-call observation request only. Recorded input and return
 * witnesses remain assumptions until a fresh paired runtime verifies them. */
export function planOriginalWrapper(reference:ReactHelperReference,site:ReactElementCreationSite,invocation:ReactElementInvocation,initializer:ReactTargetInitializer){
 const base={version:1 as const,acceptedContract:null,runtimeVerified:false as const,effectsVerified:false as const,qualification:'original-call-wrapper-observation-plan-only' as const};
 try{
  if(site.factory!=='createElement'||site.transformed||site.originalJsx||site.referenceEntry)throw Error('wrapper-original-call-required');
  if(invocation.status!=='observed')throw Error('wrapper-invocation-unavailable');
  const sourceFiles:Record<string,string>={},checkerFiles:Record<string,string>={};
  const {file,sf,requireCurrent}=prepareReactEffectProgram(reference,site.module,sourceFiles,checkerFiles);
  if(reference.files[file]!==site.sourceSha256)throw Error('wrapper-source-changed');
  const sites=readReactElementCreationSites(sf.text,file,site.module,true);
  const original=sites.find(s=>s.factory==='createElement'&&same(s.span,site.span)&&same(s.functionSpan,site.functionSpan));
  if(!original)throw Error('wrapper-factory-site-changed');
  const planning=ts.createSourceFile(file,sf.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const plan=readReactElementInvocationPlans(planning,sites).find(p=>same(p.span,site.functionSpan));
  if(!plan||!same(plan,invocation.function))throw Error('wrapper-invocation-plan-changed');
  if(!same(readReactTargetInitializer(reference,initializer.target),initializer)||initializer.render.file!==site.module||initializer.render.sha256!==site.sourceSha256||!same({start:initializer.render.start,end:initializer.render.end},plan.span))throw Error('wrapper-initializer-changed');
  if(invocation.inputProvenance.status!=='verified'||invocation.outputProvenance.status!=='verified'||invocation.outputProvenance.kind!=='create-element'||!same(invocation.outputProvenance.source,site))throw Error('wrapper-input-return-origin-unproved');
  const factories=planReactContextFactoryCalls(reference,[initializer]);
  if(!factories.some(f=>f.factory==='createElement'&&f.call.start===site.span.start&&f.call.end===site.span.end))throw Error('wrapper-factory-observation-unavailable');
  requireCurrent();
  return {...base,status:'planned' as const,site,initializer,invocation:plan,factories,sourceFiles,checkerFiles};
 }catch(error){return {...base,status:'refused' as const,reason:error instanceof Error?error.message:'wrapper-plan-unavailable'};}
}
