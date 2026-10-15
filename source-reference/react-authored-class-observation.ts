import {readFileSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import type {Browser} from 'playwright-core';
import type {ReactReference} from './react-reference.js';
import {reactReferenceHtml} from './react-reference.js';
import type {ReactSourceProgram} from './react-source-program.js';
import {readReactAuthoredClasses} from './react-authored-classes.js';
import {createReactHelperObserver} from './react-helper-transform.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import {reactHelperRuntimeHook,reactHelperRuntimeRead,type ReactHelperRuntimeReport} from './react-helper-runtime.js';
import {buildReactOwnershipReference,reactOwnershipHook,reactOwnershipRead,reactOwnershipStructure,type ReactOwnership} from './react-ownership.js';
import {captureValidatedTree} from './capture.js';
import {watchSourceFailures} from './observe.js';
import {evidenceSha} from './react-validation-evidence.js';
import {verifyReactContextConsumers} from './react-context-verification.js';
import {verifyReactRenderGraph} from './react-render-graph.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
import {reactJsxHelperObservationUnchanged,type ReactJsxHelperObservation} from './react-jsx-helper-observation.js';

/** Same sealed authored-render observation as the JSX producer, with class
 * construction/render identities in place of an invented function-body model.
 * Private helper effects, behavior and other inputs remain unqualified. */
export async function observeReactAuthoredClasses(options:{browser:Browser;reference:ReactReference;program:ReactSourceProgram;ownership:ReactOwnership;
 caseId:string;treeSha256:string;pngSha256:string;dir:string;engine:Readonly<Record<string,string>>;assertCurrent():void;
}):Promise<ReactJsxHelperObservation>{
 const {browser,reference,program,ownership,dir,assertCurrent}=options;
 const row:ReactJsxHelperObservation={version:1,acceptedContract:null,effectsVerified:false,qualification:'original-call-wrapper-state-only',status:'refused'};
 mkdirSync(dir,{recursive:true});
 const save=(name:string,value:unknown)=>{const text=JSON.stringify(value,null,2)+'\n';writeFileSync(path.join(dir,name),text,{flag:'wx'});return evidenceSha(text);};
 try{
  assertCurrent();
  const classes=readReactAuthoredClasses(reference,ownership.components.map(c=>c.source));
  if(!classes.length)throw Error('authored-class-plans-unavailable');
  const plan:ReactJsxHelperInstrumentationPlan={kind:'jsx-component',boundaryOnly:true,models:[],targets:[],authoredClasses:classes};
  // This branch retains a source boundary plan, never a fabricated body model.
  const modelSha256=save('model.json',plan);
  const planSha256=save('plan.json',plan),targetModelsSha256=save('target-models.json',[]),callbackModelsSha256=save('callback-models.json',[]);
  row.targetEffects=[];row.targetCallbacks=[];
  const require=createRequire(import.meta.url),moduleRoot=path.dirname(fileURLToPath(import.meta.url));
  const cdp=await browser.newBrowserCDPSession();let executable:string;
  try{const command=await cdp.send('Browser.getBrowserCommandLine');if(typeof command.arguments?.[0]!=='string'||!path.isAbsolute(command.arguments[0]))throw Error('authored-class-browser-identity-unavailable');executable=realpathSync(command.arguments[0]);}finally{await cdp.detach();}
  const playwrightRoot=path.dirname(require.resolve('playwright-core/package.json'));
  const tooling=[require.resolve('esbuild'),require.resolve('typescript'),executable,
   ...['package.json','lib/coreBundle.js','lib/utilsBundle.js','lib/serverRegistry.js'].map(f=>path.join(playwrightRoot,f)),
   path.resolve(path.dirname(require.resolve('esbuild/package.json')),'..','@esbuild',process.platform+'-'+process.arch,'bin','esbuild')];
  row.inputs={...reference.files,...Object.fromEntries(Object.entries(options.engine).map(([name,hash])=>[realpathSync(path.join(moduleRoot,name)),hash])),
   ...Object.fromEntries(tooling.map(file=>[realpathSync(file),evidenceSha(readFileSync(file))]))};
  const observer=createReactHelperObserver(reference,plan),guarded=await buildReactOwnershipReference(reference.sourceRoot,reference,program,observer);
  observer.complete();writeFileSync(path.join(dir,'guarded.js'),guarded.javascript,{flag:'wx'});
  const prepared=prepareReactJsxLookupBundle(guarded.javascript,plan);row.lookup=prepared.proof;guarded.javascript=prepared.javascript;
  writeFileSync(path.join(dir,'lookup-guarded.js'),guarded.javascript,{flag:'wx'});save('lookup.json',row.lookup);
  assertCurrent();if(guarded.css!==reference.css)throw Error('authored-class-css-changed');
  const buildSha256=save('build.json',{version:1,referenceId:reference.id,guardedReferenceId:guarded.id,
   originalJavascript:evidenceSha(reference.javascript),guardedJavascript:evidenceSha(guarded.javascript),css:evidenceSha(guarded.css),inputs:row.inputs,transforms:observer.changes,
   toolchain:{node:process.version,typescript:program.typescriptVersion,chromium:browser.version(),executable}});
  const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
  try{
   await context.addInitScript(reactOwnershipHook+'\n'+reactHelperRuntimeHook([],[],true,[],[],[],[],[],[],[],[],[],undefined,undefined,undefined,[],[],undefined,undefined,[],true,[],classes));
   const url='http://localhost/react-authored-class-observation?case='+encodeURIComponent(options.caseId);
   await context.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},body:reactReferenceHtml(guarded)}):route.abort());
   const page=await context.newPage(),failures=watchSourceFailures(page),profile=reference.cohort.profile(options.caseId);
   try{
    await page.goto(url);await page.locator(profile.path[0]).waitFor({timeout:15000});
    const tree=await captureValidatedTree(page,profile,failures,'#root','--');save('tree.json',tree);
    if(tree.status!=='captured')throw Error('authored-class-capture-refused');
    const png=await page.screenshot({fullPage:true,caret:'initial'});writeFileSync(path.join(dir,'observed.png'),png,{flag:'wx'});
    if(evidenceSha(png)!==tree.sourcePngSha256||tree.treeSha256!==options.treeSha256||tree.sourcePngSha256!==options.pngSha256)throw Error('authored-class-render-differs');
    const actual=await page.evaluate<ReactOwnership>(reactOwnershipRead(profile.path[0],true));
    const ownershipSha256=save('ownership.json',actual),pairedOwnershipSha256=save('paired-ownership.json',ownership);
    if(JSON.stringify(reactOwnershipStructure(actual))!==JSON.stringify(reactOwnershipStructure(ownership)))throw Error('authored-class-ownership-differs');
    const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead);row.runtime=runtime;
    const runtimeSha256=save('runtime.json',runtime);if(runtime.status!=='observed')throw Error(runtime.reason);
    if(!runtime.authoredClasses?.calls.length)throw Error('authored-class-render-unobserved');
    if(JSON.stringify(await page.evaluate(reactHelperRuntimeRead))!==JSON.stringify(runtime)||evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))!==tree.sourcePngSha256)throw Error('authored-class-observation-unstable');
    row.contextConsumers=verifyReactContextConsumers(reference,plan,runtime,row.lookup);
    const contextConsumersSha256=save('context-consumers.json',row.contextConsumers);
    row.renderGraph=verifyReactRenderGraph(actual,runtime,row.contextConsumers);
    const renderGraphSha256=save('render-graph.json',row.renderGraph);
    if(row.renderGraph.rows.some(r=>r.status!=='linked'))throw Error('authored-class-return-graph-refused');
    row.evidence={renderGraphSha256,contextConsumersSha256,callbackModelsSha256,targetModelsSha256,modelSha256,planSha256,buildSha256,runtimeSha256,treeSha256:tree.treeSha256,pngSha256:tree.sourcePngSha256,ownershipSha256,pairedOwnershipSha256};row.status='observed';
   }catch(error){const runtime=await page.evaluate<ReactHelperRuntimeReport>(reactHelperRuntimeRead).catch(()=>({status:'refused' as const,reason:'authored-class-runtime-unreadable'}));row.runtime=runtime;
    save('failure.json',{runtime,resourceFailures:failures.failedResources,runtimeErrors:failures.runtimeErrors});throw error;
   }finally{failures.dispose();}
  }finally{await context.close();}
  assertCurrent();if(!reactJsxHelperObservationUnchanged(row))throw Error('authored-class-inputs-changed');
 }catch(error){row.status='refused';delete row.evidence;delete row.lookup;row.reason=error instanceof Error?error.message:'authored-class-observation-unavailable';}
 save('report.json',row);return row;
}
