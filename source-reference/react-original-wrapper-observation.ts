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

import {reactJsxHelperObservationUnchanged,type ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
import {readReactOriginalWrappers,type ReactOriginalWrapperCandidate} from './react-original-wrappers.js';
import {planContextImportFunctions} from './react-context-import-functions.js';
import {planContextExportReads} from './react-context-export-reads.js';
import {readReactContextConsumerEffects} from './react-target-effects.js';

export async function observeReactOriginalWrapper(options:{browser:Browser;reference:ReactReference;program:ReactSourceProgram;ownership:ReactOwnership;candidate:ReactOriginalWrapperCandidate;caseId:string;treeSha256:string;pngSha256:string;dir:string;engine:Readonly<Record<string,string>>;assertCurrent():void;}):Promise<ReactJsxHelperObservation>{
 const {browser,reference,program,ownership,dir,assertCurrent}=options;
 const row:ReactJsxHelperObservation={version:1,acceptedContract:null,effectsVerified:false,qualification:'original-call-wrapper-state-only',status:'refused'};
 mkdirSync(dir,{recursive:true});
 const save=(name:string,value:unknown)=>{const text=JSON.stringify(value,null,2)+'\n';writeFileSync(path.join(dir,name),text,{flag:'wx'});return evidenceSha(text);};
 try{
  assertCurrent();const candidate=options.candidate;
  if(candidate.status!=='planned')throw Error(candidate.reason);
  const current=readReactOriginalWrappers(reference,ownership).find(c=>JSON.stringify(c.site)===JSON.stringify(candidate.site)&&c.invocation.invocation===candidate.invocation.invocation);
  if(JSON.stringify(current)!==JSON.stringify(candidate))throw Error('original-wrapper-plan-changed');
  const initializer=candidate.initializer,model=readReactContextConsumerEffects(reference,initializer,candidate.invocation,[]);
  const modelSha256=save('model.json',model);if(model.status!=='modeled')throw Error(model.reason);
  const initializers=[initializer],contextFactories=planReactContextFactoryCalls(reference,initializers),contextConsumerCalls=planReactContextConsumerCalls(reference,initializers),contextBindings=planReactContextBindings(reference,initializers),contextTargets=planReactContextTargets(reference,contextFactories),consumerLiterals=planReactConsumerLiterals(reference,initializers);
  const contextImportFunctions=[{initializer,invocation:candidate.invocation}],importBindings=planContextImportFunctions(reference,contextImportFunctions);
  contextBindings.reads.push(...importBindings.reads);contextBindings.functions.push(...importBindings.functions);
  const plan:ReactJsxHelperInstrumentationPlan={kind:'jsx-component',boundaryOnly:true,models:[],bodyModels:[model],targets:[initializer.target],initializers,contextFactories,contextConsumerCalls,contextBindings,contextTargets,consumerLiterals,contextImportFunctions,contextExportReads:planContextExportReads(reference,contextFactories)};
  row.targetEffects=[];row.targetCallbacks=[];const targetModelsSha256=save('target-models.json',[]),callbackModelsSha256=save('callback-models.json',[]);
    const planSha256=save('plan.json',plan),moduleRoot=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
    const cdp=await browser.newBrowserCDPSession();let executable:string;
    try{const command=await cdp.send('Browser.getBrowserCommandLine');if(typeof command.arguments?.[0]!=='string'||!path.isAbsolute(command.arguments[0]))throw Error('jsx-helper-browser-identity-unavailable');executable=realpathSync(command.arguments[0]);}finally{await cdp.detach();}
    const playwrightRoot=path.dirname(require.resolve('playwright-core/package.json'));
    const tooling=[require.resolve('esbuild'),require.resolve('typescript'),executable,
      ...['package.json','lib/coreBundle.js','lib/utilsBundle.js','lib/serverRegistry.js'].map(f=>path.join(playwrightRoot,f)),
      path.resolve(path.dirname(require.resolve('esbuild/package.json')),'..','@esbuild',process.platform+'-'+process.arch,'bin','esbuild')];
    row.inputs={...reference.files,...model.sourceFiles,

      ...Object.fromEntries(Object.entries(options.engine).map(([name,hash])=>[realpathSync(path.join(moduleRoot,name)),hash])),
      ...Object.fromEntries(tooling.map(file=>[realpathSync(file),evidenceSha(readFileSync(file))]))};
    const observer=createReactHelperObserver(reference,plan),guarded=await buildReactOwnershipReference(reference.sourceRoot,reference,program,observer);
    observer.complete();writeFileSync(path.join(dir,'guarded.js'),guarded.javascript,{flag:'wx'});const prepared=prepareReactJsxLookupBundle(guarded.javascript,plan);row.lookup=prepared.proof;guarded.javascript=prepared.javascript;writeFileSync(path.join(dir,'lookup-guarded.js'),guarded.javascript,{flag:'wx'});save('lookup.json',row.lookup);assertCurrent();if(guarded.css!==reference.css)throw Error('jsx-helper-css-changed');
    const buildSha256=save('build.json',{version:1,referenceId:reference.id,guardedReferenceId:guarded.id,
      originalJavascript:evidenceSha(reference.javascript),guardedJavascript:evidenceSha(guarded.javascript),css:evidenceSha(guarded.css),inputs:row.inputs,transforms:observer.changes,
      toolchain:{node:process.version,typescript:program.typescriptVersion,chromium:browser.version(),executable}});
    const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
    try{
      await context.addInitScript(reactOwnershipHook+'\n'+reactHelperRuntimeHook([],[],true,plan.initializers,[],[],[],[],[],[],plan.contextConsumerCalls,plan.contextFactories,plan.contextBindings,plan.contextTargets,undefined,[],[],undefined,undefined,plan.consumerLiterals,true,[model]));
      const url='http://localhost/react-jsx-helper-observation?case='+encodeURIComponent(options.caseId);
      await context.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},body:reactReferenceHtml(guarded)}):route.abort());
      const page=await context.newPage(),failures=watchSourceFailures(page),profile=reference.cohort.profile(options.caseId);
      try{
        await page.goto(url);await page.locator(profile.path[0]).waitFor({timeout:15000});
        const tree=await captureValidatedTree(page,profile,failures,'#root','--');save('tree.json',tree);
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
        if(JSON.stringify(await page.evaluate(reactHelperRuntimeRead))!==JSON.stringify(runtime)||evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))!==tree.sourcePngSha256)throw Error('jsx-helper-observation-unstable');
        row.callbackCreations=verifyReactCallbackCreations(reference,plan,runtime,row.lookup);
        const callbackCreationsSha256=save('callback-creations.json',row.callbackCreations);
        row.contextConsumers=verifyReactContextConsumers(reference,plan,runtime,row.lookup);
        if(!row.contextConsumers.rows.length||row.contextConsumers.rows.some(r=>r.status!=='verified'||!r.consumerBodyVerified))throw Error('original-wrapper-body-refused:'+row.contextConsumers.rows.map(r=>r.reason).join(';')); 
        const contextConsumersSha256=save('context-consumers.json',row.contextConsumers);
        row.renderGraph=verifyReactRenderGraph(actual,runtime,row.contextConsumers);
        const renderGraphSha256=save('render-graph.json',row.renderGraph);
        row.evidence={renderGraphSha256,callbackCreationsSha256,contextConsumersSha256,callbackModelsSha256,targetModelsSha256,modelSha256,planSha256,buildSha256,runtimeSha256,treeSha256:tree.treeSha256,pngSha256:tree.sourcePngSha256,ownershipSha256,pairedOwnershipSha256};row.status='observed';
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
