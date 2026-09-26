import {verifyReactRenderGraph,type ReactRenderGraphVerification} from './react-render-graph.js';
import {planReactConsumerLiterals} from './react-consumer-literals.js';
import {planReactHookHelpers} from './react-hook-helpers.js';
import {planReactCallbackFactories} from './react-callback-factories.js';
import {planReactEffectHooks} from './react-effect-hooks.js';
import {planReactRefHooks} from './react-ref-hooks.js';
import {verifyReactCallbackCreations,type ReactCallbackCreationVerification} from './react-callback-creation.js';
import {planReactCallbackSources} from './react-callback-sources.js';
import {readReactTargetEffects,type ReactTargetEffects} from './react-target-effects.js';
import {planReactContextCalls,planReactContextRests,planReactContextHelpers,planReactContextConsumerCalls,planReactContextFactoryCalls,planReactContextBindings,planReactContextTargets} from './react-context-calls.js';
import {readReactTargetCallbacks,type ReactTargetCallbackEffects} from './react-target-callbacks.js';
import {planReactTargetCallbacks} from './react-target-callback-plan.js';
import {planReactTargetCallbackValues} from './react-target-callback-values.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import {prepareReactJsxLookupBundle,type ReactJsxLookupProof} from './react-jsx-lookup.js';
import {readFileSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import type {Browser} from 'playwright-core';
import type {ReactReference} from './react-reference.js';
import {reactReferenceHtml} from './react-reference.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactJsxEffects} from './react-jsx-effects.js';
import {createReactHelperObserver} from './react-helper-transform.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {buildReactOwnershipReference,reactOwnershipHook,reactOwnershipRead,reactOwnershipStructure,type ReactOwnership} from './react-ownership.js';
import {captureValidatedTree} from './capture.js';
import {captureMatchedInitialTree} from './react-initial-capture.js';
import {watchSourceFailures} from './observe.js';
import {evidenceSha} from './react-validation-evidence.js';
import {verifyReactContextConsumers,type ReactContextConsumerVerification} from './react-context-verification.js';

export interface ReactJsxHelperObservation {
  version:1;acceptedContract:null;effectsVerified:false;
  qualification:'original-jsx-helper-state-only';
  status:'observed'|'refused';reason?:string;
  inputs?:Record<string,string>;runtime?:ReactHelperRuntimeReport;lookup?:ReactJsxLookupProof;
  /** Source assumptions. Runtime projection checks are reported separately. */
  targetEffects?:ReactTargetEffects[];
  targetCallbacks?:ReactTargetCallbackEffects[];
  callbackCreations?:ReactCallbackCreationVerification;
  contextConsumers?:ReactContextConsumerVerification;
  renderGraph?:ReactRenderGraphVerification;
  evidence?:{renderGraphSha256?:string;callbackCreationsSha256?:string;contextConsumersSha256?:string;callbackDiscoverySha256?:string;callbackModelsSha256?:string;targetModelsSha256?:string;modelSha256:string;planSha256:string;buildSha256:string;runtimeSha256:string;treeSha256:string;pngSha256:string;ownershipSha256:string;pairedOwnershipSha256:string};
}
export function reactJsxHelperObservationUnchanged(row:ReactJsxHelperObservation):boolean{
  try{
    if(row.status==='observed'&&(!row.inputs||!row.evidence||row.runtime?.status!=='observed'||row.lookup?.status!=='verified'))return false;
    if(row.targetEffects&&row.evidence&&evidenceSha(JSON.stringify(row.targetEffects,null,2)+'\n')!==row.evidence.targetModelsSha256)return false;
    if(row.targetCallbacks&&row.evidence&&evidenceSha(JSON.stringify(row.targetCallbacks,null,2)+'\n')!==row.evidence.callbackModelsSha256)return false;
    if(row.callbackCreations&&(!row.evidence||evidenceSha(JSON.stringify(row.callbackCreations,null,2)+'\n')!==row.evidence.callbackCreationsSha256))return false;
    if(row.evidence?.callbackCreationsSha256&&!row.callbackCreations)return false;
    if(row.contextConsumers&&(!row.evidence||evidenceSha(JSON.stringify(row.contextConsumers,null,2)+'\n')!==row.evidence.contextConsumersSha256))return false;
    if(row.evidence?.contextConsumersSha256&&!row.contextConsumers)return false;
    if(row.renderGraph&&(!row.evidence||evidenceSha(JSON.stringify(row.renderGraph,null,2)+'\n')!==row.evidence.renderGraphSha256))return false;
    if(row.evidence?.renderGraphSha256&&!row.renderGraph)return false;
    return !row.inputs||Object.entries(row.inputs).every(([file,hash])=>realpathSync(file)===file&&evidenceSha(readFileSync(file))===hash);
  }catch{return false;}
}

/** Separate guarded render of the same finite input context. Runtime function,
 * metadata, target lookup, initializer and render boundary checks do not establish
 * enclosing providers, hooks or state semantics. Never native authority. */
export async function observeReactJsxHelpers(options:{browser:Browser;reference:ReactReference;program:ReactSourceProgram;ownership:ReactOwnership;
  model:ReactJsxEffects;caseId:string;treeSha256:string;pngSha256:string;dir:string;engine:Readonly<Record<string,string>>;assertCurrent():void;
  callbackCaptureOnly?:boolean;
  /** Host-paired initial mount from an isolated, derived caller entry. */
  initialState?:{treeSha256:string;image:string};
}):Promise<ReactJsxHelperObservation>{
  const {browser,reference,program,ownership,model,dir,assertCurrent}=options;
  const row:ReactJsxHelperObservation={version:1,acceptedContract:null,effectsVerified:false,qualification:'original-jsx-helper-state-only',status:'refused'};
  mkdirSync(dir,{recursive:true});
  const save=(name:string,value:unknown)=>{const text=JSON.stringify(value,null,2)+'\n';writeFileSync(path.join(dir,name),text,{flag:'wx'});return evidenceSha(text);};
  try{
    assertCurrent();const modelSha256=save('model.json',model);
    if(model.status!=='modeled')throw Error(model.reason);
    const targets=[...new Map(model.targets.flatMap(t=>t.resolution.status==='resolved'?[[JSON.stringify(t.resolution.definition),t.resolution.definition] as const]:[])).values()];
    const plan:ReactJsxHelperInstrumentationPlan={kind:'jsx-component',models:[model],component:model.component,targets,initializers:targets.map(target=>readReactTargetInitializer(reference,target))};
    const invocations=ownership.nodes.flatMap(node=>(node.creationLineage?.parents??[]).flatMap(parent=>[parent.invocation,parent.enclosingReturn?.invocation]));
    row.targetEffects=plan.initializers!.flatMap(initializer=>{
      const candidates=invocations.filter(i=>i?.status==='observed'&&i.function.module===initializer.render.file&&i.function.sourceSha256===initializer.render.sha256&&i.function.span.start===initializer.render.start&&i.function.span.end===initializer.render.end);
      const contexts=[...new Map(candidates.map(i=>[JSON.stringify(i?.status==='observed'?i.input:[]),i])).values()];
      return (contexts.length?contexts:[undefined]).map(invocation=>readReactTargetEffects(reference,initializer,invocation));
    });
    const targetModelsSha256=save('target-models.json',row.targetEffects);plan.targetEffects=row.targetEffects;
    row.targetCallbacks=readReactTargetCallbacks(reference,plan.initializers!,row.targetEffects,ownership);
    const callbackModelsSha256=save('callback-models.json',row.targetCallbacks);
    plan.callbackPlans=planReactTargetCallbacks(reference,row.targetEffects,row.targetCallbacks);
    let callbackDiscoverySha256:string|undefined;
    if(plan.callbackPlans.length&&!options.callbackCaptureOnly){
      const discovery=await observeReactJsxHelpers({...options,dir:path.join(dir,'callback-discovery'),callbackCaptureOnly:true});
      callbackDiscoverySha256=save('callback-discovery.json',discovery);
      if(discovery.status!=='observed'||discovery.runtime?.status!=='observed'||!discovery.runtime.targetCallbacks)throw Error('target-callback-discovery-refused:'+discovery.reason);
      plan.callbackValues=planReactTargetCallbackValues(reference,row.targetEffects,plan.initializers!,plan.callbackPlans,discovery.runtime.targetCallbacks);
      if(!plan.callbackValues.length)throw Error('target-callback-values-unmodeled');
      const extra=plan.callbackValues.flatMap(p=>p.targets);
      for(const item of extra)if(!plan.initializers!.some(p=>p.target.module===item.target.module&&p.target.sourceSha256===item.target.sourceSha256&&p.target.span.start===item.target.span.start&&p.target.span.end===item.target.span.end)){
        plan.initializers=[...plan.initializers!,item];
      }
    }
    plan.contextCalls=planReactContextCalls(reference);
    plan.contextRests=planReactContextRests(reference,plan.contextCalls);
    plan.contextHelpers=planReactContextHelpers(reference,plan.contextCalls);
    plan.contextConsumerCalls=planReactContextConsumerCalls(reference,plan.initializers??[]);
    plan.contextFactories=planReactContextFactoryCalls(reference,plan.initializers??[]);
    plan.contextTargets=planReactContextTargets(reference,plan.contextFactories);
    plan.contextBindings=planReactContextBindings(reference,plan.initializers??[]);
    plan.consumerLiterals=planReactConsumerLiterals(reference,plan.initializers??[]);
    plan.hookHelpers=planReactHookHelpers(reference,plan.contextConsumerCalls??[]);
    plan.callbackFactories=planReactCallbackFactories(reference,plan.contextConsumerCalls??[]);
    plan.effectHooks=planReactEffectHooks(reference,plan.initializers??[]);
    plan.refHooks=planReactRefHooks(reference,plan.initializers??[]);
    plan.callbackSources=planReactCallbackSources(reference,plan.contextConsumerCalls,plan.contextHelpers);
    const planSha256=save('plan.json',plan),moduleRoot=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
    const cdp=await browser.newBrowserCDPSession();let executable:string;
    try{const command=await cdp.send('Browser.getBrowserCommandLine');if(typeof command.arguments?.[0]!=='string'||!path.isAbsolute(command.arguments[0]))throw Error('jsx-helper-browser-identity-unavailable');executable=realpathSync(command.arguments[0]);}finally{await cdp.detach();}
    const playwrightRoot=path.dirname(require.resolve('playwright-core/package.json'));
    const tooling=[require.resolve('esbuild'),require.resolve('typescript'),executable,
      ...['package.json','lib/coreBundle.js','lib/utilsBundle.js','lib/serverRegistry.js'].map(f=>path.join(playwrightRoot,f)),
      path.resolve(path.dirname(require.resolve('esbuild/package.json')),'..','@esbuild',process.platform+'-'+process.arch,'bin','esbuild')];
    row.inputs={...reference.files,...model.sourceFiles,...model.checkerFiles,
      ...(options.initialState?Object.fromEntries(['react-authored-initial.ts','react-initial-capture.ts','react-cohort.ts','../extract/computed/capture.ts','react-validation-evidence.ts'].map(name=>{
        const file=realpathSync(path.join(moduleRoot,name));return [file,evidenceSha(readFileSync(file))];
      })):{}),
      ...Object.fromEntries(Object.entries(options.engine).map(([name,hash])=>[realpathSync(path.join(moduleRoot,name)),hash])),
      ...Object.fromEntries(tooling.map(file=>[realpathSync(file),evidenceSha(readFileSync(file))]))};
    const observer=createReactHelperObserver(reference,plan),guarded=await buildReactOwnershipReference(reference.sourceRoot,reference,program,observer);
    observer.complete();writeFileSync(path.join(dir,'guarded.js'),guarded.javascript,{flag:'wx'});const prepared=prepareReactJsxLookupBundle(guarded.javascript,plan);row.lookup=prepared.proof;guarded.javascript=prepared.javascript;writeFileSync(path.join(dir,'lookup-guarded.js'),guarded.javascript,{flag:'wx'});save('lookup.json',row.lookup);assertCurrent();if(guarded.css!==reference.css)throw Error('jsx-helper-css-changed');
    const buildSha256=save('build.json',{version:1,referenceId:reference.id,guardedReferenceId:guarded.id,
      originalJavascript:evidenceSha(reference.javascript),guardedJavascript:evidenceSha(guarded.javascript),css:evidenceSha(guarded.css),inputs:row.inputs,transforms:observer.changes,
      toolchain:{node:process.version,typescript:program.typescriptVersion,chromium:browser.version(),executable}});
    const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
    try{
      await context.addInitScript(reactOwnershipHook+'\n'+reactHelperRuntimeHook([],[model],true,plan.initializers,plan.targetEffects,plan.callbackPlans,plan.callbackValues,plan.contextCalls,plan.contextRests,plan.contextHelpers,plan.contextConsumerCalls,plan.contextFactories,plan.contextBindings,plan.contextTargets,plan.callbackSources,plan.refHooks,plan.effectHooks,plan.callbackFactories,plan.hookHelpers,plan.consumerLiterals));
      const url='http://localhost/react-jsx-helper-observation?case='+encodeURIComponent(options.caseId);
      await context.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},body:reactReferenceHtml(guarded)}):route.abort());
      const page=await context.newPage(),failures=watchSourceFailures(page),profile=reference.cohort.profile(options.caseId);
      try{
        await page.goto(url);await page.locator(profile.path[0]).waitFor({timeout:15000});
        const tree=options.initialState?await captureMatchedInitialTree(page,profile.path,options.initialState,failures)
          :await captureValidatedTree(page,profile,failures,'#root','--');save('tree.json',tree);
        if(tree.status!=='captured')throw Error('jsx-helper-capture-refused');
        const png=await page.screenshot({fullPage:true,caret:'initial'});writeFileSync(path.join(dir,'observed.png'),png,{flag:'wx'});
        if(evidenceSha(png)!==tree.sourcePngSha256||tree.treeSha256!==options.treeSha256||tree.sourcePngSha256!==options.pngSha256)throw Error('jsx-helper-render-differs');
        const actual=await page.evaluate<ReactOwnership>(reactOwnershipRead(profile.path[0],true));
        const ownershipSha256=save('ownership.json',actual),pairedOwnershipSha256=save('paired-ownership.json',ownership);
        if(JSON.stringify(reactOwnershipStructure(actual))!==JSON.stringify(reactOwnershipStructure(ownership)))throw Error('jsx-helper-ownership-differs');
        const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);row.runtime=runtime;
        const runtimeSha256=save('runtime.json',runtime);
        if(runtime.status!=='observed')throw Error(runtime.reason);
        if(runtime.targetInitializers?.targets.length!==plan.initializers!.length||runtime.targetInitializers.targets.some(t=>!t.dispatches||!t.invocations.length))throw Error('target-initializer-render-unobserved');
        if(runtime.targetProjections?.models!==row.targetEffects.filter(m=>m.status==='modeled').length)throw Error('target-projection-model-unobserved');
        if(!runtime.targetCallbacks||plan.callbackPlans.length&&!runtime.targetCallbacks.invocations.length)throw Error('target-callback-invocation-unobserved');
        if(plan.callbackValues?.length&&runtime.targetCallbacks.values?.contexts!==plan.callbackValues.length)throw Error('target-callback-values-unobserved');
        const expectedCalls=model.calls.filter(c=>c.site&&c.phase!=='module-initialization').length;
        if(!runtime.components?.length||runtime.components.some(c=>c.context!==0||c.checkedCalls!==expectedCalls||c.targetReads!==model.jsxTargets.length))throw Error('jsx-helper-call-trace-unobserved');
        if(JSON.stringify(await page.evaluate(reactHelperRuntimeRead))!==JSON.stringify(runtime)||evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))!==tree.sourcePngSha256)throw Error('jsx-helper-observation-unstable');
        row.callbackCreations=verifyReactCallbackCreations(reference,plan,runtime,row.lookup);
        const callbackCreationsSha256=save('callback-creations.json',row.callbackCreations);
        row.contextConsumers=verifyReactContextConsumers(reference,plan,runtime,row.lookup);
        const contextConsumersSha256=save('context-consumers.json',row.contextConsumers);
        row.renderGraph=verifyReactRenderGraph(actual,runtime,row.contextConsumers);
        const renderGraphSha256=save('render-graph.json',row.renderGraph);
        row.evidence={renderGraphSha256,callbackCreationsSha256,contextConsumersSha256,...(callbackDiscoverySha256?{callbackDiscoverySha256}:{}),callbackModelsSha256,targetModelsSha256,modelSha256,planSha256,buildSha256,runtimeSha256,treeSha256:tree.treeSha256,pngSha256:tree.sourcePngSha256,ownershipSha256,pairedOwnershipSha256};row.status='observed';
      }catch(error){
        const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead).catch(()=>({status:'refused' as const,reason:'jsx-helper-runtime-unreadable'}));row.runtime=runtime;
        save('failure.json',{runtime,resourceFailures:failures.failedResources,runtimeErrors:failures.runtimeErrors});
        if(runtime.status==='refused'&&runtime.reason!=='component-runtime-call-unobserved')throw Error(runtime.reason);throw error;
      }finally{failures.dispose();}
    }finally{await context.close();}
    assertCurrent();if(!reactJsxHelperObservationUnchanged(row))throw Error('jsx-helper-inputs-changed');
  }catch(error){row.status='refused';delete row.evidence;delete row.lookup;row.reason=error instanceof Error?error.message:'jsx-helper-observation-unavailable';}
  save('report.json',row);return row;
}
