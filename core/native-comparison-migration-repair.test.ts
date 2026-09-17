import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY,type NativeOperationJobsOptions} from '../source-reference/native-operation-jobs.js';
import {prepareReactComparisonPlan,buildReactComparisonWrite} from '../source-reference/react-comparison-plan.js';
import {refreshedComparisonPlan} from '../source-reference/react-comparison-refresh.js';
import type {ReactComparisonRequest} from '../source-reference/react-comparison-request.js';
import type {ObservedContentDraft} from '../source-reference/observed-content.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBackgroundUpdateFixture} from './native-contract-background-update-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {prepareNativeContractComparison} from './native-contract-comparison.js';
import {emitNativeContractReadbackScript} from './native-source-observation.js';
import {emitNativeContractUpdateScript,nativeContractUpdateAfter} from './native-contract-update.js';
import {verifiedComparisonMainMigration,rebaseComparisonCreation} from './native-comparison-main-migration.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from './native-contract-comparison-observation.js';
import {prepareNativeComparisonMigrationRepair} from './native-comparison-migration-repair.js';
import {emitNativeComparisonRepairScript,nativeComparisonRepairMatches} from './native-comparison-repair.js';

async function inheritPaint(f:Awaited<ReturnType<typeof nativeBackgroundUpdateFixture>>,creation:any) {
 const instance=await f.figma.getNodeByIdAsync(creation.comparisons[0].instanceId),mainPaint=f.root.children[0],paint=f.figma.createRectangle();
 const oldSlot=instance.children[0];
 for(const key of mainPaint.getSharedPluginDataKeys('ds_contracts'))paint.setSharedPluginData('ds_contracts',key,mainPaint.getSharedPluginData('ds_contracts',key));
 instance.insertChild(0,paint);paint.layoutPositioning='ABSOLUTE';paint.name=mainPaint.name;
 paint.fills=structuredClone(mainPaint.fills);paint.strokes=[];paint.effects=[];
 paint.resize(instance.width-2,instance.height-2);paint.x=1;paint.y=1;paint.cornerRadius=7;paint.constraints={horizontal:'STRETCH',vertical:'STRETCH'};
 paint.explicitVariableModes=structuredClone(mainPaint.explicitVariableModes);instance.fills=[];
 return {instance,paint,oldSlot};
}

async function fixture() {
 const f=await nativeBackgroundUpdateFixture(),context=await f.context('10000000-0000-4000-8000-000000000003');
 const selected={parent:f.input.before,receipt:f.input.baseline,caseId:'retained',variantName:f.input.before.component.variants[0].name,slotSpecPath:[0]};
 const byId=new Map([[f.content.id,f.content]]),content=f.engine.compileComponentData(f.content,byId);
 const comparison=prepareNativeContractComparison(f.content,content,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},selected);
 const creation=await f.run(f.engine.buildNativeContractComparisonScript(f.content,byId,f.source,context,selected));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const original={operation:context.operation,planRevision:revisionOf('retained comparison'),comparison,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
 const before=await f.run(emitNativeContractComparisonReadbackScript(original));
 assert.equal(verifyNativeContractComparisonReadback(original,before).status,'supported-comparison-structure-observed');
 const moved=await f.run(emitNativeContractUpdateScript(f.plan));assert.equal(moved.status,'updated',JSON.stringify(moved.problems));
 const receipt=await f.run(emitNativeContractReadbackScript(f.plan.after));delete receipt.images;
 const parent=nativeContractUpdateAfter(f.plan,receipt);
 const migration=verifiedComparisonMainMigration(f.input.before,f.input.baseline,parent,receipt,selected.parent.creation.variants[0].id,-1);
 const updated={...comparison,parent,receipt,slotSpecPath:[1]};
 const input={...original,comparison:updated,creation:rebaseComparisonCreation(creation,[migration]),mainMigrations:[migration]};
 // The minimal mock snapshots instances. Model Figma's inherited paint child
 // and root fill update; do not grant it comparison ownership or rewrite the
 // old explicit slot metadata. Product repair must account for those changes.
 const {instance,paint,oldSlot}=await inheritPaint(f,creation);
 const observed=await f.run(emitNativeContractComparisonReadbackScript(input));
 return {...f,input,original,before,observed,instance,paint,oldSlot,migration};
}

test('retained comparison adopts only inherited paint and shifted identities, preserving content and instance IDs',async()=>{
 const f=await fixture(),saved=JSON.stringify(f.original),ids=f.observed.content.nodes.map((n:any)=>n.id);
 assert.equal(verifyNativeContractComparisonReadback(f.input,f.observed).status,'refused');
 const repair=prepareNativeComparisonMigrationRepair(f.input,f.observed);
 assert.equal(repair.version,3);assert.equal(repair.changes.length,3);
 const pre=await f.run(emitNativeComparisonRepairScript(repair,true));assert.equal(pre.status,'preflight-observed');
 assert.ok(nativeComparisonRepairMatches(repair,pre.observation));
 const result=await f.run(emitNativeComparisonRepairScript(repair));assert.equal(result.status,'updated',JSON.stringify(result.problems));
 const read=await f.run(emitNativeContractComparisonReadbackScript(repair.input));
 assert.ok(nativeComparisonRepairMatches(repair,read,true));
 assert.equal(verifyNativeContractComparisonReadback(repair.input,read).status,'supported-comparison-structure-observed');
 assert.deepEqual(read.content.nodes.map((n:any)=>n.id),ids);assert.equal(f.instance.children[1].id,f.oldSlot.id);
 assert.equal(JSON.stringify(f.original),saved);
 assert.equal((await f.run(emitNativeComparisonRepairScript(repair))).status,'no-op');
});

test('unrelated content, geometry, ownership or main proof differences refuse comparison adoption',async()=>{
 const f=await fixture();
 for(const corrupt of [
  (r:any)=>{r.content.nodes.find((n:any)=>n.type==='TEXT').values.characters='Changed text';},
  (r:any)=>{r.content.nodes.find((n:any)=>n.id===f.paint.id).values.width=116;},
  (r:any)=>{r.content.nodes.find((n:any)=>n.id===f.paint.id).metadata.nativeSourceAllocation='foreign';},
  (r:any)=>{r.content.nodes.find((n:any)=>n.id===f.oldSlot.id).metadata.nativeContractPart='{}';},
  (r:any)=>{r.parent.nodes.find((n:any)=>n.type==='COMPONENT').values.opacity=0.5;},
 ]){const changed=structuredClone(f.observed);corrupt(changed);assert.throws(()=>prepareNativeComparisonMigrationRepair(f.input,changed));}
 const forged=structuredClone(f.input.comparison.parent);forged.backgroundMigration!.desiredRevision=revisionOf('other');
 assert.throws(()=>verifiedComparisonMainMigration(f.original.comparison.parent,f.original.comparison.receipt,forged,f.input.comparison.receipt,f.input.comparison.mainId,-1));
});

test('metadata assignment failure rolls back and preserves the inherited layer for a fresh inspection',async()=>{
 const f=await fixture(),repair=prepareNativeComparisonMigrationRepair(f.input,f.observed);
 const original=f.oldSlot.setSharedPluginData.bind(f.oldSlot);let fail=true;
 f.oldSlot.setSharedPluginData=(ns:string,key:string,value:string)=>{if(fail&&key==='nativeContractPart'){fail=false;throw Error('injected');}original(ns,key,value);};
 const result=await f.run(emitNativeComparisonRepairScript(repair));
 assert.equal(result.status,'rolled-back',JSON.stringify(result.problems));assert.deepEqual(result.unrestored,[]);
 assert.ok(nativeComparisonRepairMatches(repair,await f.run(emitNativeContractComparisonReadbackScript(f.input))));
 assert.equal(f.instance.children[0].id,f.paint.id);
});


test('application refresh adopts inherited paint once, survives restart and preserves original journal evidence',async t=>{
 const f=await nativeBackgroundUpdateFixture(false,REACT_NATIVE_FILE_KEY),repo=mkdtempSync(path.join(tmpdir(),'comparison-migration-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 const selected={parent:f.input.before,receipt:f.input.baseline,caseId:'sample',variantName:f.input.before.component.variants[0].name,slotSpecPath:[0]};
 let current=selected,sourceCurrent=true;
 const content:ObservedContentDraft={version:1,status:'compiled-comparison-draft',qualification:'observed-comparison-content-only',acceptedContract:null,nativeQualification:'unqualified',
  inputRevision:revisionOf('observations'),treeRevision:revisionOf('tree'),fontsRevision:revisionOf('fonts'),contract:f.content,tokens:f.tokens,assets:f.assets,
  component:f.engine.compileComponentData(f.content,new Map([[f.content.id,f.content]])),receipts:[],residuals:[],problems:[],limitations:['synthetic-test-only']};
 const request:ReactComparisonRequest={version:1,kind:'react-content-comparison',parentOperationId:selected.parent.operation.id,
  root:{version:1,kind:'react-root-draft',referenceId:'a'.repeat(64),ownership:{id:'10000000-0000-4000-8000-000000000010',sha256:'b'.repeat(64)},inventorySha256:'c'.repeat(64),caseId:'sample',matrixRevision:revisionOf('matrix')},
  content:{id:'10000000-0000-4000-8000-000000000011',reportSha256:'d'.repeat(64),inventorySha256:'e'.repeat(64)}};
 const options:NativeOperationJobsOptions={prepare:()=>{throw Error('unexpected source adapter');},reactComparison:{
  prepare:(req,operation)=>{assert.deepEqual(req,request);if(!sourceCurrent)throw Error('changed source');return {
   visual:{id:request.root.ownership.id,reportSha256:request.root.ownership.sha256},preparation:{id:request.content.id,reportSha256:request.content.reportSha256},
   plan:prepareReactComparisonPlan({operation,content,source:f.source,comparison:current})};},
  refresh:(req,operation)=>{if(!sourceCurrent)throw Error('changed source');return {request:req,plan:prepareReactComparisonPlan({operation,content,source:f.source,comparison:current})};},
  buildComponent:(_,ctx)=>buildReactComparisonWrite({operation:ctx.operation,content,source:f.source,comparison:selected,expectedPlanRevision:ctx.planRevision,tokens:ctx.tokens})
 }};
 let jobs=createNativeOperationJobs(repo,options);const saved=jobs.prepare(request);
 const run=async(phase:Parameters<typeof jobs.dispatch>[1])=>{const {script,kind:_k,readOnly:_ro,...identity}=jobs.dispatch(saved.id,phase);const result=await f.run(script);
  jobs.accept(saved.id,{...identity,result});jobs=createNativeOperationJobs(repo,options);return result;};
 const tokenCreation=await run('token-create');await run('token-readback');const creation=await run('component-create');await run('component-readback');
 assert.equal(jobs.get(saved.id).phase,'component-structure-observed');
 const events=path.join(repo,'private/source-native-app/operations',saved.id,'events');
 const originals=readdirSync(events).map(n=>[n,readFileSync(path.join(events,n),'utf8')] as const);
 assert.equal((await f.run(emitNativeContractUpdateScript(f.plan))).status,'updated');
 const receipt=await f.run(emitNativeContractReadbackScript(f.plan.after));delete receipt.images;
 current={...selected,parent:nativeContractUpdateAfter(f.plan,receipt),receipt,slotSpecPath:[1]};
 const oldPlan=prepareReactComparisonPlan({operation:{id:saved.id,fileKey:REACT_NATIVE_FILE_KEY},content,source:f.source,comparison:selected});
 const fresh={request,plan:prepareReactComparisonPlan({operation:oldPlan.plan.operation,content,source:f.source,comparison:current})};
 const refreshed=refreshedComparisonPlan(oldPlan,request,fresh);assert.equal(refreshed.mainMigrations?.length,1);
 assert.deepEqual(refreshed.plan.comparison.slotSpecPath,[1]);assert.equal(refreshed.revision,oldPlan.revision);
 const changed=structuredClone(fresh);changed.request.content.reportSha256='f'.repeat(64);assert.throws(()=>refreshedComparisonPlan(oldPlan,request,changed));
 const changedContent=structuredClone(fresh);changedContent.plan.plan.comparison.caseId='other';changedContent.plan.revision=revisionOf(changedContent.plan.plan);
 assert.throws(()=>refreshedComparisonPlan(oldPlan,request,changedContent));
 const {instance,paint}=await inheritPaint(f,creation),nodeCount=f.figma.root.findAll(()=>true).length;
 const migratedRead=await run('component-readback');assert.equal(jobs.get(saved.id).phase,'component-observation-refused');
 prepareNativeComparisonMigrationRepair({operation:oldPlan.plan.operation,planRevision:oldPlan.revision,comparison:refreshed.plan.comparison,tokenInput:oldPlan.plan.tokenInput,tokenIdentity:tokenCreation.creationIdentity,creation:rebaseComparisonCreation(creation,refreshed.mainMigrations!),mainMigrations:refreshed.mainMigrations},migratedRead);
 assert.deepEqual(jobs.get(saved.id).comparisonRepair?.changes.map(c=>c.kind),['metadata','metadata','metadata']);
 await run('comparison-repair-preflight-readback');assert.equal(jobs.get(saved.id).phase,'comparison-repair-observed');
 sourceCurrent=false;assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));sourceCurrent=true;
 const {script,kind:_k,readOnly:_ro,...identity}=jobs.dispatch(saved.id,'comparison-repair-apply');
 const result=await f.run(script);assert.equal(result.status,'updated',JSON.stringify(result));
 jobs=createNativeOperationJobs(repo,options);assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));assert.throws(()=>jobs.retryObservation(saved.id));
 jobs.accept(saved.id,{...identity,result});await run('component-readback');
 assert.equal(jobs.get(saved.id).phase,'component-structure-observed');assert.equal(jobs.get(saved.id).comparisonRepair,undefined);
 await run('component-readback');assert.equal(jobs.get(saved.id).phase,'component-structure-observed');
 assert.equal(instance.children[0].id,paint.id);assert.equal(f.figma.root.findAll(()=>true).length,nodeCount);
 assert.throws(()=>jobs.dispatch(saved.id,'comparison-repair-apply'));
 for(const [name,bytes] of originals)assert.equal(readFileSync(path.join(events,name),'utf8'),bytes);
 assert.equal(readdirSync(events).map(n=>JSON.parse(readFileSync(path.join(events,n),'utf8'))).filter(e=>e.kind==='dispatch'&&e.command.phase==='comparison-repair-apply').length,1);
});


test('an independent content edit during adoption is preserved and reported for recovery',async()=>{
 const f=await fixture(),repair=prepareNativeComparisonMigrationRepair(f.input,f.observed);
 const label=f.instance.findOne((n:any)=>n.type==='TEXT'),write=f.oldSlot.setSharedPluginData.bind(f.oldSlot);let edited=false;
 f.oldSlot.setSharedPluginData=(ns:string,key:string,value:string)=>{write(ns,key,value);if(!edited&&key==='nativeContractPart'){edited=true;label.characters='Designer change';}};
 const result=await f.run(emitNativeComparisonRepairScript(repair));
 assert.equal(result.status,'recovery-required');assert.equal(label.characters,'Designer change');
 assert.equal(f.paint.getSharedPluginData('ds_contracts','nativeSourceAllocation'),f.migration.additions[0].mainNodeId);
});


test('comparison caller content excludes only the synthetic paint on the replaced root',async()=>{
 const f=await fixture(),contract=structuredClone(f.content);
 contract.anatomy.root.tokens={'background-color':'{surface}'};
 contract.anatomy.root.declared={'background-clip':'padding-box'};
 contract.anatomy.root.literals={'border-width':'1px','border-radius':'8px'};
 const component=f.engine.compileComponentData(contract,new Map([[contract.id,contract]]));
 assert.ok(component.variants[0].spec.children![0].backgroundPaint);
 const comparison=prepareNativeContractComparison(contract,component,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},f.input.comparison);
 assert.deepEqual(comparison.specs.map(s=>s.type),['svg','text']);
 assert.deepEqual(comparison.specs.map(s=>s.nativeContractSample!.specPath),[[0],[1]]);
 assert.equal(comparison.specs[1].characters,'Save changes');
});
