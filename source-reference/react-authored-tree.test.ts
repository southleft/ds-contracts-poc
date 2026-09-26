import {restoreReactOwnership} from './react-ownership-restore.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import {beginReactOwnershipSelection,sealReactOwnershipSelection,restoreSelectedReactOwnership} from './react-ownership-selection.js';
import {selectReactAuthoredNativeRequest,readReactAuthoredNativeEvidence} from './react-authored-native-evidence.js';
import {isReactAuthoredNativeRequest,isReactAuthoredOperationRequest,reactAuthoredOwnershipAnchor,
  reactAuthoredNativeReservation,type ReactAuthoredInitialNativeRequest} from './react-authored-native-request.js';
import {prepareReactAuthoredNativePlan,buildReactAuthoredNativeWrite} from './react-authored-native-plan.js';
import {inventoryEvidence} from './react-validation-evidence.js';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY,type NativeOperationJobsOptions} from './native-operation-jobs.js';
import {nativeFixtureHost} from './native-operation-test-fixture.js';
import type {ReactOwnershipReport} from './react-ownership-run.js';
import type {ReactReference} from './react-reference.js';
import {builtinReactCohort} from './react-cohort.js';
import test from 'node:test';
import {projectReactAuthoredSweep} from './react-authored-sweep.js';
import {reactAuthoredNamespace} from './react-authored-namespace.js';
import {flattenTokens} from '../core/tokens.js';
import {enumerate} from '../extract/computed/lib.js';
import type {PropSpace} from '../extract/computed/capture.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {chromium} from 'playwright-core';
import {reactEmitter,reactInlineEmitter} from '../core/emitter.js';
import {mountGenerated,generatedTypeErrors} from '../core/react-test-runtime.js';
import {emitTokensCss} from '../packages/core/src/emit-tokens-css.js';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {walkAnatomy} from '../scripts/contract-schema.js';
import {readReactSourceProgram} from './react-source-program.js';
import {evidenceSha} from './react-validation-evidence.js';
import {verifyReactRenderGraph} from './react-render-graph.js';
import {readReactAuthoredContent,verifiedReactAuthoredContent} from './react-authored-content.js';
import {projectReactAuthoredTree} from './react-authored-tree.js';
import {readReactInspectionOriginal,reactInspectionRequest} from './react-initial-inspection.js';
import {isReactInitialNativeRequest} from './react-initial-native-request.js';
import type {ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
import type {ReactOwnership} from './react-ownership.js';
import {reactOwnershipStructure} from './react-ownership.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {TextFontEvidence} from './text-fonts.js';
import type {ReactStyleOrigin} from './react-style-origin.js';

/** Host archive/reader fixture. Actual renderer provenance is exercised in
 * react-render-graph.test.ts and the installed ownership runner. */
function fixture(t:test.TestContext,absolute=false,qualified=false,referenceId='reference',indexed=false,stateful=false,intrinsic=false){
 const dir=mkdtempSync(path.join(tmpdir(),'authored-tree-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'surface.tsx');writeFileSync(path.join(dir,'tsconfig.json'),'{"compilerOptions":{"jsx":"preserve","target":"ES2022","skipLibCheck":true}}');
 writeFileSync(file,`declare global {namespace JSX {interface Element {} interface IntrinsicElements {section:any;span:any}}} export function Marker(){return <span/>} export function Panel(${stateful?'props:{active?:boolean}':''}){return <section><Marker/></section>}`);
 const program=readReactSourceProgram(dir,['surface.tsx']);assert.deepEqual(program.problems,[]);
 const source=(name:string)=>{const c=program.components.find(c=>c.exportName===name)!;return {module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};};
 const child:CapturedNode={tag:'span',classes:[],pseudo:{},nodes:[],style:{display:'flex','flex-direction':'row',position:absolute?'absolute':'static',width:'20px',height:'10px','background-color':'rgb(0, 0, 0)','box-sizing':'border-box',opacity:'1'}};
 const tree:CapturedNode={tag:'section',classes:[],pseudo:{},nodes:[{t:'el',el:child}],style:{display:'flex','flex-direction':'row',position:'static',width:'100px',height:'30px','background-color':'rgb(255, 255, 255)','box-sizing':'border-box',opacity:'1'}};
 if(intrinsic){tree.style.width='20px';tree.style.height='10px';}
 if(qualified){
  const defaults={'writing-mode':'horizontal-tb',direction:'ltr',translate:'none',rotate:'none',scale:'none',perspective:'none',transform:'none'};
  Object.assign(tree.style,defaults,{position:'relative'});
  Object.assign(child.style,defaults,{left:'1px',top:'1px',right:'79px',bottom:'19px',transform:'matrix(1, 0, 0, 1, 15, 0)','z-index':'auto',order:'0'});
  for(const side of ['top','right','bottom','left'])child.style['margin-'+side]='0px';
 }
 const object=(identity:number)=>({kind:'object',identity}),fn=(identity:number)=>({kind:'function',identity}),str=(value:string)=>({kind:'string',value}),undef={kind:'undefined'};
 const factories=[
  {id:0,element:object(101),props:object(100),type:fn(10),createdIn:null,current:true,children:{status:'verified',value:undef}},
  {id:1,element:object(202),props:object(201),type:str('section'),createdIn:0,current:true,children:{status:'verified',value:object(302)}},
  {id:2,element:object(302),props:object(301),type:fn(20),createdIn:0,current:true,children:{status:'verified',value:undef}},
  {id:3,element:object(402),props:object(401),type:str('span'),createdIn:1,current:true,children:{status:'verified',value:undef}}];
 const graph={qualification:'original-element-and-render-identity-only',effectsVerified:false,acceptedContract:null,factories,arrays:[],renders:[
  {id:0,parent:null,callee:fn(10),input:object(100),factoryProps:object(100),factory:0,completion:'returned',output:object(202),returnedFactory:1,sourceRender:null,componentModels:[0],membership:{status:'verified',factories:[1,2],arrays:[]}},
  {id:1,parent:null,callee:fn(20),input:object(301),factoryProps:object(301),factory:2,completion:'returned',output:object(402),returnedFactory:3,sourceRender:null,componentModels:[],membership:{status:'verified',factories:[3],arrays:[]}}]};
 const host=(id:number)=>({status:'matched' as const,factory:id,element:factories[id].element,props:factories[id].props,type:factories[id].type});
 const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],problems:[],components:[{id:'panel',source:source('Panel'),props:{},roots:['']},{id:'marker',source:source('Marker'),parent:'panel',props:{},roots:['0']}],nodes:[{path:'',tag:'section',createdBy:'panel',nearestComponent:'panel'},{path:'0',tag:'span',createdBy:'marker',nearestComponent:'marker'}]};
 if(indexed){
  const ids:Record<string,string>={panel:'instance-0',marker:'instance-1'};
  for(const c of ownership.components){c.id=ids[c.id];if(c.parent)c.parent=ids[c.parent];}
  for(const n of ownership.nodes){if(n.createdBy)n.createdBy=ids[n.createdBy];if(n.nearestComponent)n.nearestComponent=ids[n.nearestComponent];}
  ownership.nodes[0].creationSite={module:'surface.tsx',sourceSha256:source('Panel').sourceSha256,span:source('Panel').span,factory:'jsx'};
 }
 const recorded=structuredClone(ownership);recorded.nodes[0].renderGraph=host(1) as any;recorded.nodes[1].renderGraph=host(3) as any;
 const model={status:'modeled',acceptedContract:null,runtimeVerified:false,component:{file:'surface.tsx',sha256:source('Panel').sourceSha256,...source('Panel').span},calls:[],jsxTargets:[]};
 const runtime={status:'observed',components:[{context:0,checkedCalls:0,targetReads:0}],renderGraph:graph},consumers={rows:[]};
 const proof=verifyReactRenderGraph(recorded,runtime as any,consumers as any);assert(proof.rows.every(r=>r.status==='linked'));
 const inputs={...program.files},files=new Map<string,Buffer>(),put=(name:string,value:unknown)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');files.set(name,b);return evidenceSha(b);};
 const original=Buffer.from('original instrumented bundle'),guarded=Buffer.from('lookup guarded bundle'),png=Buffer.from('original image bytes');
 files.set('guarded.js',original);files.set('lookup-guarded.js',guarded);files.set('observed.png',png);
 const lookup={status:'verified',sourceJavascriptSha256:evidenceSha(original),javascriptSha256:evidenceSha(guarded)};put('lookup.json',lookup);
 const evidence={modelSha256:put('model.json',model),planSha256:put('plan.json',{kind:'jsx-component',models:[model],component:model.component}),
  runtimeSha256:put('runtime.json',runtime),ownershipSha256:put('ownership.json',recorded),pairedOwnershipSha256:put('paired-ownership.json',ownership),
  buildSha256:put('build.json',{referenceId,guardedReferenceId:'guarded',inputs,guardedJavascript:evidenceSha(guarded)}),
  contextConsumersSha256:put('context-consumers.json',consumers),renderGraphSha256:put('render-graph.json',proof),treeSha256:evidenceSha(JSON.stringify(tree)),pngSha256:evidenceSha(png)};
 put('tree.json',{status:'captured',problems:[],tree,treeSha256:evidence.treeSha256,sourcePngSha256:evidence.pngSha256});
 const helper={version:1,status:'observed',qualification:'original-jsx-helper-state-only',acceptedContract:null,effectsVerified:false,inputs,evidence,runtime,lookup,contextConsumers:consumers,renderGraph:proof} as unknown as ReactJsxHelperObservation;put('report.json',helper);
 const options={referenceId,sourceRoot:dir,program,ownership,tree,helper,read:(name:string)=>{const value=files.get(name);assert(value,name);return value;}};
 const content=readReactAuthoredContent(options),fonts:TextFontEvidence={version:1,status:'observed',treeRevision:revisionOf(tree),problems:[],rows:[]};
 const origin:ReactStyleOrigin={version:1,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width',status:'fixed',value:'100px',selectors:['section']},{channel:'height',status:'fixed',value:'30px',selectors:['section']}]},{path:'0',tag:'span',channels:[],sizes:[{channel:'width',status:'fixed',value:'20px',selectors:['span']},{channel:'height',status:'fixed',value:'10px',selectors:['span']}]}]};
 if(intrinsic)origin.roots[0].sizes=origin.roots[0].sizes!.map(s=>({...s,status:'auto',value:'auto'}));
 return {options,content,program,ownership,tree,fonts,origin,files,file,put,recorded};
}

test('sealed authored tree compiles parent and dependency mains without turning authored children into slots',t=>{
 const f=fixture(t),before=structuredClone({program:f.program,ownership:f.ownership,tree:f.tree,origin:f.origin,fonts:f.fonts});
 const fact=verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree);assert.equal(fact.effectsVerified,false);assert.equal(fact.acceptedContract,null);assert.equal(fact.boundaries.length,2);
 const draft=projectReactAuthoredTree(f);assert.equal(draft.status,'native-compiled',draft.problems.join('\n'));assert.equal(draft.contracts?.length,2);assert.equal(draft.components?.length,2);
 const ref=walkAnatomy(draft.contract!).find(p=>p.part.component)?.part.component;assert(ref);assert.equal(ref.id,draft.boundaries.find(b=>b.path==='0')!.contractId);
 assert(draft.contracts!.every(c=>walkAnatomy(c).every(p=>!p.part.slot)));assert(draft.components!.some(c=>c.variants[0].spec.children?.some(n=>n.type==='instance')));
 assert.deepEqual(projectReactAuthoredTree(f),draft);assert.deepEqual({program:f.program,ownership:f.ownership,tree:f.tree,origin:f.origin,fonts:f.fonts},before);
});

test('a complete authored sweep keeps one child identity while its position changes across input planes',async t=>{
 const f=fixture(t,true,true,'reference',false,true);
 const contract=ContractSchema.parse({id:'fixture.authored-state',name:'AuthoredStates',description:'Finite authored composition fixture',version:'0.1.0',status:'draft',
  props:[{name:'active',type:'boolean',bindings:{code:{prop:'active'},figma:{kind:'VARIANT',property:'Active',values:{false:'Off',true:'On'},unsetValue:'(unset)'}}}],
  states:[],semantics:{element:'section'},anatomy:{root:{}},bindings:{code:{anchors:{importPath:'./AuthoredStates',export:'AuthoredStates'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const axes=[{prop:'active',values:['unset','false','true'],unset:'unset'}],baseAxisValues={active:'unset'},enumeration=enumerate(axes,[],64,baseAxisValues);
 const space={contract,axes,presence:new Map(),stateProps:[],enumeration,baseAxisValues,baseComboKey:enumeration.combos.find(c=>c.axisValues.active==='unset')!.key,heldFixed:[]};
 const buildInputs=(background?:string)=>{
 const inputs=new Map<string,Parameters<typeof projectReactAuthoredTree>[0]>();
 for(const combo of enumeration.combos){
  const tree=structuredClone(f.tree),own=structuredClone(f.ownership),recorded=structuredClone(f.recorded),files=new Map(f.files);
  if(background)tree.style['background-color']=background;
  if(combo.axisValues.active!=='unset'){own.components[0].props.active=combo.axisValues.active==='true';recorded.components[0].props.active=combo.axisValues.active==='true';}
  if(tree.nodes[0].t==='el'){
   tree.nodes[0].el.style.transform=combo.axisValues.active==='true'?'matrix(1, 0, 0, 1, 15, 0)':'none';
   tree.nodes[0].el.style['background-color']=combo.axisValues.active==='true'?'rgb(17, 17, 17)':combo.axisValues.active==='false'?'rgb(34, 34, 34)':'rgb(51, 51, 51)';
  }
  const put=(name:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');files.set(name,bytes);return evidenceSha(bytes);};
  const helper=structuredClone(f.options.helper),treeSha256=evidenceSha(JSON.stringify(tree));
  helper.evidence!.ownershipSha256=put('ownership.json',recorded);
  helper.evidence!.pairedOwnershipSha256=put('paired-ownership.json',own);helper.evidence!.treeSha256=treeSha256;
  put('tree.json',{status:'captured',problems:[],tree,treeSha256,sourcePngSha256:helper.evidence!.pngSha256});put('report.json',helper);
  const content=readReactAuthoredContent({...f.options,ownership:own,tree,helper,read:name=>files.get(name)!});
  inputs.set(combo.key,{...f,content,ownership:own,tree,fonts:{...f.fonts,treeRevision:revisionOf(tree)}});
 }
 return inputs;
 };
 const inputs=buildInputs();
 const before=revisionOf({space,inputs:[...inputs]}),draft=projectReactAuthoredSweep(space,inputs);
 assert.equal(draft.status,'native-compiled',draft.problems.join('\n'));assert.equal(draft.contracts!.length,2);
 const dependency=draft.boundaries.find(b=>b.path==='0')!;assert.equal(dependency.planes.length,3);
 const part=walkAnatomy(draft.contract!).find(p=>p.part.component)!.part;
 assert.equal(part.component!.id,dependency.contractId);assert.equal(part.absolutePlacementByCombination!.rows.length,3);
 const parent=draft.components!.find(c=>c.contractId===draft.contract!.id)!;
 assert.equal(parent.variants.length,3);
 for(const variant of parent.variants){const child=variant.spec.children!.find(n=>n.type==='instance')!;assert(child);assert.equal(child.depContractId,dependency.contractId);assert.equal(child.absolute!.left,variant.name==='Active=On'?16:1);}
 assert.deepEqual(projectReactAuthoredSweep(space,inputs),draft);assert.equal(revisionOf({space,inputs:[...inputs]}),before);
 const namespace=reactAuthoredNamespace(draft),freshSpace=structuredClone(space);
 freshSpace.contract.id='fixture.fresh-observation';freshSpace.contract.name='FreshObservation';
 freshSpace.contract.bindings.code.anchors={importPath:'./FreshObservation',export:'FreshObservation'};
 const naturalFresh=projectReactAuthoredSweep(freshSpace,inputs),retained=projectReactAuthoredSweep(freshSpace,inputs,namespace);
 assert.equal(naturalFresh.status,'native-compiled');assert.equal(retained.status,'native-compiled',retained.problems.join('\n'));
 assert.notDeepEqual(naturalFresh.tokens,draft.tokens,'a new observation normally mints different token names');
 assert.deepEqual(retained.contracts,draft.contracts);assert.deepEqual(retained.components,draft.components);
 assert.deepEqual(retained.tokens,draft.tokens);assert.deepEqual(retained.assets,draft.assets);
 const changedAppearance=projectReactAuthoredSweep(freshSpace,buildInputs('rgb(128, 0, 0)'),namespace);
 assert.equal(changedAppearance.status,'native-compiled',changedAppearance.problems.join('\n'));
 assert.deepEqual([...flattenTokens(changedAppearance.tokens!)].map(([p])=>p),[...flattenTokens(draft.tokens!)].map(([p])=>p));
 assert.notDeepEqual(changedAppearance.tokens,draft.tokens,'preserving allocation names must not restore old appearance');
 assert.deepEqual(changedAppearance.contracts,draft.contracts,'the edit changes token values under the same contract bindings');
 const childComponent=(value:typeof draft)=>value.components!.find(c=>c.contractId===dependency.contractId);
 assert.deepEqual(childComponent(changedAppearance),childComponent(draft),'unchanged children retain their full compiled definition');
 assert.notEqual(retained.inputRevision,draft.inputRevision,'fresh evidence remains distinct from creation');
 for(const broken of [new Map([...namespace].slice(1)),new Map([...namespace,['unexpected',namespace.get('')!]]),
   new Map([...namespace].map(([p,n])=>[p,{...n,id:namespace.get('')!.id}])),
   new Map([...namespace].map(([p,n])=>[p,{...n,name:namespace.get('')!.name}]))])
  assert(projectReactAuthoredSweep(freshSpace,inputs,broken).problems.includes('react-authored-sweep-namespace-boundaries-mismatch'));
 assert.deepEqual(reactAuthoredNamespace(draft),namespace);
 assert.equal(projectReactAuthoredSweep(space,new Map([...inputs].slice(1))).status,'refused');
 const changed=new Map(inputs),first=enumeration.combos[0].key,last=enumeration.combos.at(-1)!.key;
 changed.set(last,{...inputs.get(last)!,content:inputs.get(first)!.content});
 assert(projectReactAuthoredSweep(space,changed).problems.includes('react-authored-content-context-changed'),'a baseline capability cannot stand in for a different state');
 changed.set(last,{...inputs.get(last)!,content:{...inputs.get(last)!.content}});
 assert(projectReactAuthoredSweep(space,changed).problems.includes('react-authored-content-authority-unavailable'));
 const mismatched=structuredClone(space);mismatched.enumeration.combos[0].axisValues.active='true';
 assert.equal(projectReactAuthoredSweep(mismatched,inputs).status,'refused');
 // Exercise the actual multi-variant writer and durable journal with a v2
 // request. The sealed source reader is tested separately; this adapter owns
 // one fixed fixture and cannot authorize a substituted request.
 const request:ReactAuthoredInitialNativeRequest={version:2,kind:'react-authored-draft',referenceId:'a'.repeat(64),caseId:'panel-default',
  ownership:{id:'20000000-0000-4000-8000-000000000001',sha256:'b'.repeat(64)},inventorySha256:'c'.repeat(64),helper:0,draftRevision:revisionOf(draft),
  initial:{key:'d'.repeat(64),id:'30000000-0000-4000-8000-000000000001',inventorySha256:'e'.repeat(64),reportSha256:'f'.repeat(64),
   instanceId:'instance-1',anchorDraftRevision:revisionOf('baseline')}};
 assert(isReactAuthoredOperationRequest(request));assert(!isReactAuthoredNativeRequest(request));
 const anchor=reactAuthoredOwnershipAnchor(request);assert(isReactAuthoredNativeRequest(anchor));
 assert.notEqual(reactAuthoredNativeReservation(anchor),reactAuthoredNativeReservation(request));
 assert.equal(reactAuthoredNativeReservation(request),reactAuthoredNativeReservation({...request,draftRevision:revisionOf('changed')}));
 assert.notEqual(reactAuthoredNativeReservation(request),reactAuthoredNativeReservation({...request,initial:{...request.initial,id:'30000000-0000-4000-8000-000000000002'}}));
 for(const patch of [{initial:{...request.initial,extra:true}},{initial:{...request.initial,key:'../escape'}},
   {initial:{...request.initial,instanceId:'instance-1/../../'}},{initial:{...request.initial,anchorDraftRevision:'bad'}},{draftRevision:'bad'},{extra:true}])
  assert(!isReactAuthoredOperationRequest({...request,...patch}));
 const evidence={draft,source:{revision:'sha256:'+request.referenceId,programSha256:evidenceSha(JSON.stringify(f.program)),evidenceRevision:revisionOf(request)}};
 let available=true;
 const verify=(r:unknown)=>{if(!available)throw Error('fixture-source-unavailable');assert.deepEqual(r,request);return evidence;};
 const options:NativeOperationJobsOptions={prepare:()=>{throw Error('wrong adapter');},reactAuthored:{
  prepare:(r,operation)=>({visual:{id:request.initial.id,reportSha256:request.initial.reportSha256},
   preparation:{id:request.initial.id,reportSha256:request.draftRevision.slice(7)},plan:prepareReactAuthoredNativePlan({...verify(r),operation})}),
  buildComponent:(r,context)=>buildReactAuthoredNativeWrite({...verify(r),operation:context.operation,tokens:context.tokens,expectedPlanRevision:context.planRevision}),
 }};
 let jobs=createNativeOperationJobs(f.options.sourceRoot,options);
 const firstOperation=jobs.prepare(request),host=nativeFixtureHost({consumerVariableModes:true});host.figma.fileKey=REACT_NATIVE_FILE_KEY;
 assert.deepEqual(jobs.reactOwnershipRequest(firstOperation.id),anchor);assert.deepEqual(jobs.reactAuthoredRequest(firstOperation.id),request);
 assert.equal(jobs.listReact(request.referenceId)[0].kind,'authored-initial');
 assert.equal(jobs.listReact(request.referenceId)[0].nestedInstanceId,undefined);
 for(const [phase,expected] of [['token-create','tokens-created'],['token-readback','tokens-observed'],['component-create','components-created'],['component-readback','component-structure-observed']] as const){
  const command=jobs.dispatch(firstOperation.id,phase);
  jobs=createNativeOperationJobs(f.options.sourceRoot,options);
  const observed=jobs.accept(firstOperation.id,await host.run(command));assert.equal(observed.phase,expected,JSON.stringify(observed.problems));
 }
 const nativeCount=host.figma.root.findAll(()=>true).length;
 assert.equal(host.figma.root.findAll((n:any)=>n.type==='COMPONENT').length,draft.components!.reduce((n,c)=>n+c.variants.length,0));
 assert.equal(jobs.prepare(request).id,firstOperation.id);assert.equal(host.figma.root.findAll(()=>true).length,nativeCount);
 assert.throws(()=>jobs.prepare({...request,initial:{...request.initial,reportSha256:'0'.repeat(64)}}),/baseline-already-reserved/);
 assert.throws(()=>jobs.reactUpdateBaseline(firstOperation.id),/react-update/);
 available=false;assert.equal(jobs.get(firstOperation.id).sourceCurrent,false);assert.throws(()=>jobs.dispatch(firstOperation.id,'component-create'));
 assert.equal(host.figma.root.findAll(()=>true).length,nativeCount);
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map(draft.contracts!.map(c=>[c.id,c])),icons:new Map(draft.assets),tokens:{primitives:draft.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}}};
 const child=draft.contracts!.find(c=>c.id===dependency.contractId)!;
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(draft.contract!,ctx),childFiles=emitter.emit(child,ctx);
  assert.deepEqual(generatedTypeErrors(draft.contract!.name,files[0].contents,{[child.name]:childFiles[0].contents}),[]);
  const page=await browser.newPage(),oracle=await browser.newPage();
  await mountGenerated(page,draft.contract!.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:childFiles[0].contents,css:childFiles.find(f=>f.path.endsWith('.css'))?.contents}});
  await page.addStyleTag({content:emitTokensCss([{name:'default',selector:':root',parts:[{slot:'observed',tree:draft.tokens!}]}]).css+'\nbody{margin:0}#root{padding:12px}'});
  await page.evaluate(()=>{(window as any).originalChild=document.querySelector('#root > * > *');});
  for(const active of [undefined,false,true,false,undefined]){
   await page.evaluate(props=>(window as any).renderSubject(props),active===undefined?{}:{active});
   const measured=await page.locator('#root > *').evaluate(root=>{const a=root.getBoundingClientRect(),child=root.children[0],b=child.getBoundingClientRect();return{width:a.width,height:a.height,x:b.x-a.x,y:b.y-a.y,childWidth:b.width,childHeight:b.height,same:child===(window as any).originalChild};});
   assert.deepEqual(measured,{width:100,height:30,x:active?16:1,y:1,childWidth:20,childHeight:10,same:true},emitter.name+':'+String(active));
   const paint=active===undefined?'#333':active?'#111':'#222';
   await oracle.setContent(`<style>body{margin:0}#root{padding:12px}section{display:flex;position:relative;width:100px;height:30px;box-sizing:border-box;background:white}span{display:flex;position:absolute;left:1px;top:1px;transform:translateX(${active?15:0}px);width:20px;height:10px;box-sizing:border-box;background:${paint}}</style><div id="root"><section><span></span></section></div>`);
   assert.deepEqual(await page.locator('#root').screenshot(),await oracle.locator('#root').screenshot(),emitter.name+':'+String(active));
  }
  await page.close();await oracle.close();
 }
});

test('finite automatic roots retain content sizing across changing child variants instead of freezing sample dimensions',async t=>{
 const f=fixture(t,false,false,'reference',false,true,true),inputs=new Map<string,Parameters<typeof projectReactAuthoredTree>[0]>();
 const contract=ContractSchema.parse({id:'fixture.intrinsic-states',name:'IntrinsicStates',description:'Intrinsic finite composition fixture',version:'0.1.0',status:'draft',
  props:[{name:'active',type:'boolean',bindings:{code:{prop:'active'},figma:{kind:'VARIANT',property:'Active',values:{false:'Off',true:'On'},unsetValue:'(unset)'}}}],
  states:[],semantics:{element:'section'},anatomy:{root:{}},bindings:{code:{anchors:{importPath:'./IntrinsicStates',export:'IntrinsicStates'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const axes=[{prop:'active',values:['unset','false','true'],unset:'unset'}],baseAxisValues={active:'unset'},enumeration=enumerate(axes,[],64,baseAxisValues);
 const space:PropSpace={contract,axes,presence:new Map(),stateProps:[],enumeration,baseAxisValues,baseComboKey:enumeration.combos[0].key,heldFixed:[]};
 for(const combo of enumeration.combos){
  const tree=structuredClone(f.tree),own=structuredClone(f.ownership),recorded=structuredClone(f.recorded),files=new Map(f.files),origin=structuredClone(f.origin);
  if(combo.axisValues.active!=='unset'){own.components[0].props.active=combo.axisValues.active==='true';recorded.components[0].props.active=combo.axisValues.active==='true';}
  const width=combo.axisValues.active==='true'?'35px':'20px';tree.style.width=width;
  assert.equal(tree.nodes[0].t,'el');if(tree.nodes[0].t!=='el')throw Error('fixture child missing');tree.nodes[0].el.style.width=width;
  origin.roots[1].sizes!.find(s=>s.channel==='width')!.value=width;
  const put=(name:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');files.set(name,bytes);return evidenceSha(bytes);};
  const helper=structuredClone(f.options.helper),treeSha256=evidenceSha(JSON.stringify(tree));
  helper.evidence!.ownershipSha256=put('ownership.json',recorded);helper.evidence!.pairedOwnershipSha256=put('paired-ownership.json',own);helper.evidence!.treeSha256=treeSha256;
  put('tree.json',{status:'captured',problems:[],tree,treeSha256,sourcePngSha256:helper.evidence!.pngSha256});put('report.json',helper);
  const content=readReactAuthoredContent({...f.options,ownership:own,tree,helper,read:name=>files.get(name)!});
  inputs.set(combo.key,{...f,content,ownership:own,tree,origin,fonts:{...f.fonts,treeRevision:revisionOf(tree)}});
 }
 const draft=projectReactAuthoredSweep(space,inputs);assert.equal(draft.status,'native-compiled',draft.problems.join('\n'));
 for(const width of ['width','height'])assert.equal(draft.contract!.anatomy.root.tokens?.[width],undefined,'automatic measured size must not become a token');
 const mixed=new Map(inputs),key=enumeration.combos[0].key,plane=inputs.get(key)!,origin=structuredClone(plane.origin);
 origin.roots[0].sizes![0]={channel:'width',status:'fixed',value:plane.tree.style.width,selectors:['.fixture']};
 mixed.set(key,{...plane,origin});assert(projectReactAuthoredSweep(space,mixed).problems.includes('react-authored-sweep-component-root-sizing-mixed:'));
 origin.roots[0].sizes![0]={channel:'width',status:'unresolved',reason:'responsive-size',selectors:[]};
 assert(projectReactAuthoredSweep(space,mixed).problems.includes('react-authored-sweep-component-root-sizing-unqualified:'));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map(draft.contracts!.map(c=>[c.id,c])),icons:new Map(draft.assets),tokens:{primitives:draft.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}}};
 const child=draft.contracts!.find(c=>c.id!==draft.contract!.id)!;
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(draft.contract!,ctx),childFiles=emitter.emit(child,ctx),page=await browser.newPage(),oracle=await browser.newPage();
  await mountGenerated(page,draft.contract!.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:childFiles[0].contents,css:childFiles.find(f=>f.path.endsWith('.css'))?.contents}});
  await page.addStyleTag({content:emitTokensCss([{name:'default',selector:':root',parts:[{slot:'observed',tree:draft.tokens!}]}]).css+'\nbody{margin:0}#root{display:inline-flex;padding:12px}'});
  await page.evaluate(()=>{(window as any).originalChild=document.querySelector('#root > * > *');});
  for(const active of [undefined,false,true,false,undefined]){
   await page.evaluate(props=>(window as any).renderSubject(props),active===undefined?{}:{active});
   const measured=await page.locator('#root > *').evaluate(root=>({width:root.getBoundingClientRect().width,height:root.getBoundingClientRect().height,same:root.children[0]===(window as any).originalChild}));
   assert.deepEqual(measured,{width:active?35:20,height:10,same:true});
   await oracle.setContent(`<style>body{margin:0}#root{display:inline-flex;padding:12px}section{display:flex;box-sizing:border-box;background:white}span{display:flex;width:${active?35:20}px;height:10px;box-sizing:border-box;background:black}</style><div id="root"><section><span></span></section></div>`);
   assert.deepEqual(await page.locator('#root').screenshot(),await oracle.locator('#root').screenshot(),emitter.name+':'+String(active));
  }
  await page.close();await oracle.close();
 }
});

test('authored capability refuses clones, altered observations, source bytes and every changed sealed artifact',t=>{
 const f=fixture(t);assert.throws(()=>verifiedReactAuthoredContent({...f.content},f.program,f.ownership,f.tree),/authority-unavailable/);
 const changed=structuredClone(f.tree);changed.style.width='101px';assert.throws(()=>verifiedReactAuthoredContent(f.content,f.program,f.ownership,changed),/context-changed/);
 for(const [name,bytes] of f.files){f.files.set(name,Buffer.concat([bytes,Buffer.from(' ')]));assert.throws(()=>verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree),/artifact-changed/,name);f.files.set(name,bytes);}
 const source=readFileSync(f.file);writeFileSync(f.file,Buffer.concat([source,Buffer.from('\n')]));assert.throws(()=>verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree),/inputs-changed/);writeFileSync(f.file,source);
 const fact=verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree);fact.boundaries.length=0;assert.equal(verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree).boundaries.length,2);
});

test('authored projection refuses positioned dependencies without fixed geometry and containing-block evidence',t=>{
 const f=fixture(t,true),draft=projectReactAuthoredTree(f);assert.equal(draft.status,'refused');assert(draft.problems.some(p=>p.includes('dependency-placement-unqualified')));assert.equal(draft.acceptedContract,null);
});

test('repackaging a mismatched creator cannot replace the original returned-tree proof',t=>{
 const f=fixture(t),helper=structuredClone(f.options.helper);assert.equal(helper.runtime?.status,'observed');if(helper.runtime?.status!=='observed')return;helper.runtime.renderGraph!.factories[3].createdIn=999;
 helper.evidence!.runtimeSha256=f.put('runtime.json',helper.runtime);f.put('report.json',helper);
 assert.throws(()=>readReactAuthoredContent({...f.options,helper}),/graph-mismatch/);
});


test('sealed authored tree separates parent placement from the child main exactly once',t=>{
 const f=fixture(t,true,true),before=structuredClone(f.tree),draft=projectReactAuthoredTree(f);
 assert.equal(draft.status,'native-compiled',draft.problems.join('\n'));
 const ref=walkAnatomy(draft.contract!).find(p=>p.part.component)!;
 assert.deepEqual(ref.part.absolutePlacement,{left:16,top:1});
 const child=draft.contracts!.find(c=>c.id===ref.part.component!.id)!;
 assert.equal(child.anatomy.root.declared?.transform,undefined);
 assert.equal(child.anatomy.root.literals?.left,undefined);
 const spec=draft.components!.find(c=>c.contractId===draft.contract!.id)?.variants[0].spec;
 assert(spec);assert.deepEqual(spec.children![0].absolute,{h:'MIN',v:'MIN',left:16,top:1});
 assert.deepEqual(f.tree,before);assert.deepEqual(projectReactAuthoredTree(f),draft);assert.equal(draft.acceptedContract,null);
});


function nativeArchive(t:test.TestContext,indexed=false) {
 const referenceId='a'.repeat(64),f=fixture(t,true,true,referenceId,indexed),repo=f.options.sourceRoot;
 const reference:ReactReference={id:referenceId,files:f.program.files,sourceRoot:repo,javascript:'',css:'',cohort:builtinReactCohort};
 const draft=projectReactAuthoredTree({content:f.content,program:f.program,ownership:f.ownership,tree:f.tree,origin:f.origin,fonts:f.fonts});assert.equal(draft.status,'native-compiled');
 const report={id:'20000000-0000-4000-8000-000000000001',referenceId,state:'complete',sourceUnchanged:true,matched:1,denominator:1,acceptedContract:null,
  rows:[{id:'panel-default',matched:true,problems:[],treeSha256:evidenceSha(JSON.stringify(f.tree)),ownership:f.ownership,
   jsxHelpers:[{path:'',result:f.options.helper}],authoredTrees:[{helper:0,draft}],propertyMatrix:{rows:[{id:'0',baseline:true}]}}]} as unknown as ReactOwnershipReport;
 const dir=path.join(repo,'private/react-source-ownership',referenceId,report.id),caseDir=path.join(dir,'panel-default');
 mkdirSync(path.join(caseDir,'matrix'),{recursive:true});mkdirSync(path.join(caseDir,'jsx-helpers/0'),{recursive:true});
 const save=(name:string,value:unknown)=>writeFileSync(path.join(dir,name),JSON.stringify(value));
 save('report.json',report);save('program.json',f.program);
 save('panel-default/source-tree.json',{status:'captured',problems:[],tree:f.tree,treeSha256:report.rows[0].treeSha256});
 save('panel-default/matrix/0.json',{treeSha256:report.rows[0].treeSha256,ownership:f.ownership,fonts:f.fonts,styleOrigin:f.origin});
 for(const [name,bytes] of f.files)writeFileSync(path.join(caseDir,'jsx-helpers/0',name),bytes);
 const seal=()=>{const files=inventoryEvidence(dir);delete files['integrity.json'];save('integrity.json',{version:1,files});};seal();
 const request=selectReactAuthoredNativeRequest(repo,report,'panel-default');
 return {...f,repo,reference,dir,report,request,seal,save,draft};
}

test('authored native selection reopens the sealed archive and refuses forged drafts or changed source',t=>{
 const f=nativeArchive(t),{request}=f;
 assert(isReactAuthoredNativeRequest(request));
 for(const change of [{script:'untrusted'},{helper:-1},{helper:0.5},{caseId:'../panel'},{ownership:{...request.ownership,id:'../outside'}},{draftRevision:'fake'}])
  assert(!isReactAuthoredNativeRequest({...request,...change}));
 const read=()=>readReactAuthoredNativeEvidence(f.repo,f.reference,request);
 assert.deepEqual(read().draft,f.draft);assert.equal(read().source.revision,'sha256:'+f.reference.id);
 const revision=request.draftRevision;assert.equal(reactAuthoredNativeReservation(request),reactAuthoredNativeReservation({...request,draftRevision:revisionOf('changed')}));
 assert.notEqual(reactAuthoredNativeReservation(request),reactAuthoredNativeReservation({...request,caseId:'panel-other'}));
 const source=readFileSync(f.file);writeFileSync(f.file,Buffer.concat([source,Buffer.from('\n')]));assert.throws(read);writeFileSync(f.file,source);
 const helperFile=path.join(f.dir,'panel-default/jsx-helpers/0/report.json'),helper=readFileSync(helperFile);
 writeFileSync(helperFile,Buffer.concat([helper,Buffer.from(' ')]));assert.throws(read);writeFileSync(helperFile,helper);
 const altered=structuredClone(f.report);altered.rows[0].authoredTrees![0].draft!.contract!.description='forged compiled draft';
 f.save('report.json',altered);f.seal();const forged=selectReactAuthoredNativeRequest(f.repo,altered,'panel-default');
 assert.throws(()=>readReactAuthoredNativeEvidence(f.repo,f.reference,forged),/unavailable/,'resealing a claimed draft cannot replace the rederived capability');
 assert.equal(request.draftRevision,revision);
});

test('authored inspection authenticates its public target without authorizing legacy native state writes',t=>{
 const f=nativeArchive(t,true),reference={...f.reference,cohort:{...f.reference.cohort,profile:(id:string)=>{
  assert.equal(id,'panel-default');return builtinReactCohort.profile('button-default');
 }}};
 const request=reactInspectionRequest(f.request,'panel-default','instance-0');
 assert.equal(request.version,3);
 assert.deepEqual(readReactInspectionOriginal(f.repo,reference,request).ownership,reactOwnershipStructure(f.ownership));
 assert(f.ownership.nodes[0].creationSite,'the sealed creation evidence remains intact');
 assert.throws(()=>reactInspectionRequest(f.request,'panel-default'),/target-required/);
 assert.throws(()=>reactInspectionRequest(f.request,'other-case','instance-0'),/target-required/);
 assert.throws(()=>reactInspectionRequest(f.request,'panel-default','../outside'),/instance-invalid/);
 for(const instanceId of ['instance-1','instance-99'])
  assert.throws(()=>readReactInspectionOriginal(f.repo,reference,{...request,version:3,anchor:f.request,instanceId}),/target-mismatch/);
 for(const change of [{helper:1},{inventorySha256:'b'.repeat(64)},{draftRevision:'sha256:'+'b'.repeat(64)},
  {ownership:{...f.request.ownership,sha256:'b'.repeat(64)}}])
  assert.throws(()=>readReactInspectionOriginal(f.repo,reference,{...request,version:3,instanceId:'instance-0',anchor:{...f.request,...change}}),/unavailable/);
 assert.throws(()=>readReactInspectionOriginal(f.repo,reference,{...request,version:1} as any),/unavailable|invalid/);
 assert(!isReactInitialNativeRequest({...request,kind:'react-initial-draft',observation:{id:f.report.id,inventorySha256:'a'.repeat(64),reportSha256:'a'.repeat(64)}}));
 const source=readFileSync(f.file);writeFileSync(f.file,Buffer.concat([source,Buffer.from('\n')]));
 assert.throws(()=>readReactInspectionOriginal(f.repo,reference,request),/unavailable/);
 writeFileSync(f.file,source);assert.deepEqual(readReactInspectionOriginal(f.repo,reference,request).ownership,reactOwnershipStructure(f.ownership));
});

test('explicit structure selection restores without a native operation and preserves seals on repeat',t=>{
 const f=nativeArchive(t,true),before=inventoryEvidence(f.dir);
 assert.equal(restoreSelectedReactOwnership(f.repo,f.reference),undefined);
 beginReactOwnershipSelection(f.repo,f.reference.id,f.report.id);
 assert.equal(restoreSelectedReactOwnership(f.repo,f.reference)!.report().problem,'react-ownership-selection-incomplete');
 sealReactOwnershipSelection(f.repo,f.reference,f.report);
 const restored=restoreSelectedReactOwnership(f.repo,f.reference)!;
 assert.deepEqual(restored.report(),JSON.parse(JSON.stringify(f.report)));
 assert.equal(restored.dir,f.dir);
 assert.deepEqual(readReactAuthoredNativeEvidence(f.repo,f.reference,selectReactAuthoredNativeRequest(f.repo,restored.report(),'panel-default')).draft,f.draft);
 const selected=path.join(f.repo,'private/react-source-selections',f.reference.id),unchanged=inventoryEvidence(selected);
 sealReactOwnershipSelection(f.repo,f.reference,f.report);
 assert.deepEqual(inventoryEvidence(selected),unchanged);
 assert.deepEqual(inventoryEvidence(f.dir),before);
 const later='20000000-0000-4000-8000-000000000002';
 beginReactOwnershipSelection(f.repo,f.reference.id,later);
 const pending=inventoryEvidence(selected);
 sealReactOwnershipSelection(f.repo,f.reference,f.report);
 assert.deepEqual(inventoryEvidence(selected),pending,'an earlier completion cannot override the explicit new choice');
 assert.equal(restored.report().problem,'react-ownership-selection-changed');
 const interrupted=restoreSelectedReactOwnership(f.repo,f.reference)!.report();
 assert.equal(interrupted.id,later);assert.equal(interrupted.problem,'react-ownership-selection-incomplete');
 assert.equal(interrupted.matched,0);assert.deepEqual(interrupted.rows,[]);
});

test('restored structure selection refuses changed archives, source, helper inputs and pointer data',t=>{
 const f=nativeArchive(t,true);
 beginReactOwnershipSelection(f.repo,f.reference.id,f.report.id);sealReactOwnershipSelection(f.repo,f.reference,f.report);
 const file=path.join(f.repo,'private/react-source-selections',f.reference.id,'selection.json'),pointer=readFileSync(file);
 const read=()=>restoreSelectedReactOwnership(f.repo,f.reference)!.report();
 for(const target of ['report.json','integrity.json','panel-default/jsx-helpers/0/tree.json']){
  const file=path.join(f.dir,target),bytes=readFileSync(file);writeFileSync(file,Buffer.concat([bytes,Buffer.from(' ')]));
  const rejected=read();assert.equal(rejected.matched,0);assert.deepEqual(rejected.rows,[]);assert.match(rejected.problem!,/evidence-changed/);
  writeFileSync(file,bytes);
 }
 const bytes=readFileSync(f.file);writeFileSync(f.file,Buffer.concat([bytes,Buffer.from('\n')]));
 assert.equal(read().problem,'react-ownership-selection-source-changed');writeFileSync(f.file,bytes);
 for(const mutate of [
  (s:any)=>{s.observationId='../escape';},(s:any)=>{s.referenceId=[s.referenceId];},
  (s:any)=>{s.reportSha256='0'.repeat(64);},(s:any)=>{s.extra='unexpected';},
 ]){
  const s=JSON.parse(pointer.toString());mutate(s);writeFileSync(file,JSON.stringify(s));
  const rejected=read();assert.equal(rejected.matched,0);assert.deepEqual(rejected.rows,[]);assert(rejected.problem);
  writeFileSync(file,pointer);
 }
 assert.deepEqual(read(),JSON.parse(JSON.stringify(f.report)));
 writeFileSync(path.join(f.dir,'extra.json'),'{}');f.seal();
 assert.throws(()=>sealReactOwnershipSelection(f.repo,f.reference,f.report),/selection-evidence-changed/,'a repeated completion cannot repin a modified inventory');
 assert.equal(readFileSync(file).toString(),pointer.toString());
});

test('selection restoration checks the observer inputs as well as component source',t=>{
 const f=nativeArchive(t,true),observer=path.join(f.repo,'observer.js');
 writeFileSync(observer,'original observer');f.options.helper.inputs![realpathSync(observer)]=evidenceSha('original observer');
 f.save('report.json',f.report);f.seal();
 beginReactOwnershipSelection(f.repo,f.reference.id,f.report.id);sealReactOwnershipSelection(f.repo,f.reference,f.report);
 const restored=restoreSelectedReactOwnership(f.repo,f.reference)!;
 assert.equal(restored.report().matched,1);
 writeFileSync(observer,'changed observer');
 assert.equal(restored.report().problem,'react-ownership-selection-source-changed');
 assert.deepEqual(restored.report().rows,[]);
});

test('selected ownership display copies stay isolated and reauthenticate source and archives after the response',t=>{
 const f=nativeArchive(t,true);
 beginReactOwnershipSelection(f.repo,f.reference.id,f.report.id);sealReactOwnershipSelection(f.repo,f.reference,f.report);
 const restored=restoreSelectedReactOwnership(f.repo,f.reference)!;
 const source=readFileSync(f.file);
 withEvidenceReadSnapshot(()=>{
  const first=restored.report();assert.equal(first.matched,1);first.rows.length=0;
  assert.equal(restored.report().rows.length,1,'a caller cannot mutate the retained display value');
  writeFileSync(f.file,Buffer.concat([source,Buffer.from('\nchanged')]));
  assert.equal(restored.report().matched,1,'one display consistently uses its already checked source');
  assert.throws(()=>sealReactOwnershipSelection(f.repo,f.reference,f.report),/write-during-evidence-read-snapshot/);
  assert.throws(()=>beginReactOwnershipSelection(f.repo,f.reference.id,f.report.id),/write-during-evidence-read-snapshot/);
 });
 assert.equal(restored.report().problem,'react-ownership-selection-source-changed');
 assert.equal(withEvidenceReadSnapshot(()=>restored.report()).problem,'react-ownership-selection-source-changed');
 writeFileSync(f.file,source);assert.equal(restored.report().matched,1);
 const reportPath=path.join(f.dir,'report.json'),report=readFileSync(reportPath);
 withEvidenceReadSnapshot(()=>{
  assert.equal(restored.report().matched,1);writeFileSync(reportPath,Buffer.concat([report,Buffer.from(' ')]));
  assert.equal(restored.report().matched,1);
 });
 assert.equal(restored.report().problem,'react-ownership-selection-evidence-changed');
 writeFileSync(reportPath,report);assert.equal(withEvidenceReadSnapshot(()=>restored.report()).matched,1);
});

test('cached selected archives never hide changed selection records or changed reference expectations',t=>{
 const f=nativeArchive(t,true);
 beginReactOwnershipSelection(f.repo,f.reference.id,f.report.id);sealReactOwnershipSelection(f.repo,f.reference,f.report);
 const restored=restoreSelectedReactOwnership(f.repo,f.reference)!;
 const root=path.join(f.repo,'private/react-source-selections',f.reference.id),pointer=path.join(root,'selection.json');
 const bytes=readFileSync(pointer),record=path.join(root,evidenceSha(bytes)+'.json');
 withEvidenceReadSnapshot(()=>{
  assert.equal(restored.report().matched,1);
  for(const [file,problem]of [[pointer,'react-ownership-selection-changed'],[record,'react-ownership-selection-record-changed']]){
   writeFileSync(file,Buffer.concat([bytes,Buffer.from(' ')]));
   assert.equal(restored.report().problem,problem);writeFileSync(file,bytes);
  }
  const input=Object.keys(f.reference.files)[0],original=f.reference.files[input];assert(original);
  f.reference.files[input]='0'.repeat(64);
  assert.equal(restored.report().problem,'react-ownership-selection-source-changed');
  f.reference.files[input]=original;assert.equal(restored.report().matched,1);
 });
 assert.equal(restored.report().matched,1);
});

test('authored native plan uses the shared graph writer with durable repeat and independent nested readback',async t=>{
 const f=nativeArchive(t),evidence=()=>readReactAuthoredNativeEvidence(f.repo,f.reference,f.request);
 const options:NativeOperationJobsOptions={prepare:()=>{throw Error('wrong adapter');},reactAuthored:{
  prepare:(request,operation)=>({visual:{id:request.ownership.id,reportSha256:request.ownership.sha256},
   preparation:{id:request.ownership.id,reportSha256:request.draftRevision.slice(7)},plan:prepareReactAuthoredNativePlan({...evidence(),operation})}),
  buildComponent:(_,context)=>buildReactAuthoredNativeWrite({...evidence(),operation:context.operation,tokens:context.tokens,expectedPlanRevision:context.planRevision}),
 }};
 let jobs=createNativeOperationJobs(f.repo,options);const first=jobs.prepare(f.request),host=nativeFixtureHost({consumerVariableModes:true});host.figma.fileKey=REACT_NATIVE_FILE_KEY;
 assert(first.sourceCurrent);assert.deepEqual(restoreReactOwnership(f.repo,f.reference,jobs.reactOwnershipRequest(first.id)).report(),JSON.parse(JSON.stringify(f.report)));
 assert(first.sourceCurrent);assert.equal(jobs.listReact(f.reference.id)[0].kind,'authored');assert.equal(jobs.reactIdentity(first.id).authored,true);
 assert.deepEqual(jobs.listReact(f.reference.id,'root'),[]);assert.deepEqual(jobs.listReact(f.reference.id,'mains'),[]);
 assert.equal(jobs.prepare(f.request).id,first.id);
 assert.throws(()=>jobs.prepare({...f.request,draftRevision:revisionOf('changed')}),/baseline-already-reserved/);
 for(const [phase,expected] of [['token-create','tokens-created'],['token-readback','tokens-observed'],['component-create','components-created'],['component-readback','component-structure-observed']] as const){
  const command=jobs.dispatch(first.id,phase),result=await host.run(command);
  const observed=jobs.accept(first.id,result);assert.equal(observed.phase,expected,JSON.stringify({problems:observed.problems,result:result.result}));
  jobs=createNativeOperationJobs(f.repo,options);
 }
 const count=host.figma.root.findAll(()=>true).length;
 assert.equal(jobs.prepare(f.request).id,first.id);assert.equal(host.figma.root.findAll(()=>true).length,count);
 assert.equal(jobs.get(first.id).nativeQualification,'unqualified');
 const components=host.figma.root.findAll((n:any)=>n.type==='COMPONENT');assert.equal(components.length,2);
 assert(host.figma.root.findAll((n:any)=>n.type==='INSTANCE').length>0);
 assert.throws(()=>jobs.reactUpdateBaseline(first.id),/react-update/,'authored creation does not authorize updates');
 const child=components.find((n:any)=>n.width===20);assert(child);const original=child.opacity;child.opacity=0.5;
 const changed=jobs.accept(first.id,await host.run(jobs.dispatch(first.id,'component-readback')));
 assert.equal(changed.phase,'component-observation-refused');child.opacity=original;
 assert.equal(jobs.accept(first.id,await host.run(jobs.dispatch(first.id,'component-readback'))).phase,'component-structure-observed');
 const plan=prepareReactAuthoredNativePlan({...evidence(),operation:{id:first.id,fileKey:REACT_NATIVE_FILE_KEY}});
 const context={...evidence(),operation:plan.plan.operation,tokens:{input:plan.plan.tokenInput} as any,expectedPlanRevision:revisionOf('stale')};
 assert.throws(()=>buildReactAuthoredNativeWrite(context),/plan-write-stale/);
 writeFileSync(f.file,'changed source');assert.equal(jobs.get(first.id).sourceCurrent,false);
 assert.throws(()=>jobs.prepare(f.request));assert.throws(()=>jobs.dispatch(first.id,'component-create'));
 assert.equal(host.figma.root.findAll(()=>true).length,count);
});
