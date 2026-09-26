import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {joinReactAuthoredStateApiEvidence} from './react-authored-state-api.js';
import {isReactAuthoredOperationRequest,reactAuthoredInitialAnchor,reactAuthoredOwnershipAnchor,
  reactAuthoredNativeReservation} from './react-authored-native-request.js';
import {prepareReactAuthoredNativePlan,buildReactAuthoredNativeWrite} from './react-authored-native-plan.js';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY,type NativeOperationJobsOptions} from './native-operation-jobs.js';
import {nativeFixtureHost} from './native-operation-test-fixture.js';
import {verifyNativeContractReadback} from '../core/native-source-observation.js';
import {asMinimalChildContract,proposeFromDump} from '../core/propose-figma.js';
import {tokenCorpusFromJson} from '../core/token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {figmaStateApi} from '../core/figma-state-api.js';
import {createNativeSourceSuccessions} from './native-source-succession.js';

import {authoredStateApiEvidence as fixture} from './react-authored-state-api-fixture.js';

test('stateful authored pins have distinct allocation and retain exact initial and ownership anchors',()=>{
  const {request}=fixture();assert(isReactAuthoredOperationRequest(request));
  const initial=reactAuthoredInitialAnchor(request),ownership=reactAuthoredOwnershipAnchor(request);
  assert.equal(initial.version,2);assert.equal(initial.draftRevision,request.initialDraftRevision);assert.equal(ownership.version,1);
  assert.equal(ownership.draftRevision,request.initial.anchorDraftRevision);
  assert.notEqual(reactAuthoredNativeReservation(request),reactAuthoredNativeReservation(initial));
  for(const patch of [{draftRevision:revisionOf('other')},{stateApi:{...request.stateApi,reportSha256:'0'.repeat(64)}},
    {initialDraftRevision:revisionOf('other')}])
    assert.equal(reactAuthoredNativeReservation({...request,...patch}),reactAuthoredNativeReservation(request));
  for(const patch of [{stateApi:{...request.stateApi,extra:true}},{stateApi:{...request.stateApi,key:'../escape'}},
    {initialDraftRevision:'bad'},{draftRevision:'bad'},{initial:{...request.initial,instanceId:'other'}},{extra:true}])
    assert(!isReactAuthoredOperationRequest({...request,...patch}));
});

test('joining graph behavior rejects mismatched inputs and stale or substituted declarations',()=>{
  const f=fixture(),before=revisionOf(f),joined=joinReactAuthoredStateApiEvidence(f.request,f.appearance,f.state);
  assert.equal(joined.draft.contracts?.length,2);assert.equal(joined.source.evidenceRevision,revisionOf(f.request));
  assert.equal(revisionOf(f),before);
  for(const mutate of [
    (x:typeof f)=>{x.state.pin={...x.state.pin,reportSha256:'0'.repeat(64)};},
    (x:typeof f)=>{x.state.initial={...x.initial,id:'40000000-0000-4000-8000-000000000001'};},
    (x:typeof f)=>{x.state.initial={...x.initial,instanceId:'instance-2'};},
    (x:typeof f)=>{x.appearance.draft={...x.appearance.draft,inputRevision:revisionOf('other')};},
    (x:typeof f)=>{x.state.report={...x.report,phase:'failed'};},
    (x:typeof f)=>{x.request={...x.request,draftRevision:revisionOf('other')};},
  ]){const changed=structuredClone(f);mutate(changed);assert.throws(()=>joinReactAuthoredStateApiEvidence(changed.request,changed.appearance,changed.state));}
});

test('state API composition refuses incomplete, remapped and initial-only child forwarding',()=>{
  const {draft}=fixture();assert(figmaStateApi(draft.contract!));
  const mappings:Record<string,string|boolean>[]=[{seed:'{seed}'},{seed:'{seed}',disabled:false},{seed:'{disabled}',disabled:'{disabled}'}];
  for(const props of mappings){
    const changed=structuredClone(draft.contract!);changed.anatomy.root.parts!.child.component!.props=props;
    assert.throws(()=>figmaStateApi(changed),/complete identity forwarding/);
  }
  const changed=structuredClone(draft.contract!);changed.anatomy.root.parts!.child.component!.initialProps={seed:'{seed}'};
  assert.throws(()=>figmaStateApi(changed),/complete identity forwarding/);
});

test('the durable shared graph writer preserves state metadata and dependencies across restart and refuses another allocation',async t=>{
  const f=fixture(),dir=mkdtempSync(path.join(tmpdir(),'authored-state-native-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const successions=createNativeSourceSuccessions(dir);
  let available=true;
  const evidence=(r:unknown)=>{if(!available)throw Error('fixture-unavailable');assert.deepEqual(r,f.request);return joinReactAuthoredStateApiEvidence(f.request,f.appearance,f.state);};
  const options:NativeOperationJobsOptions={prepare:()=>{throw Error('wrong adapter');},react:{
    prepare:()=>{throw Error('wrong root adapter');},buildComponent:()=>{throw Error('wrong root adapter');},
    effectiveSource:(id,original)=>successions.effective(id,original),
  },reactAuthored:{
    prepare:(r,operation)=>({visual:{id:f.request.initial.id,reportSha256:f.request.initial.reportSha256},
      preparation:{id:f.request.stateApi.id,reportSha256:f.request.draftRevision.slice(7)},
      plan:prepareReactAuthoredNativePlan({...evidence(r),operation})}),
    buildComponent:(r,context)=>buildReactAuthoredNativeWrite({...evidence(r),operation:context.operation,tokens:context.tokens,expectedPlanRevision:context.planRevision}),
  }};
  let jobs=createNativeOperationJobs(dir,options);const operation=jobs.prepare(f.request);
  const host=nativeFixtureHost({consumerVariableModes:true});host.figma.fileKey=REACT_NATIVE_FILE_KEY;
  assert.equal(jobs.listReact(f.request.referenceId)[0].kind,'authored-state-api');
  let tokenContext:ReturnType<typeof jobs.verifiedTokenContext>,creation:any;
  for(const [phase,expected] of [['token-create','tokens-created'],['token-readback','tokens-observed'],['component-create','components-created'],['component-readback','component-structure-observed']] as const){
    const command=jobs.dispatch(operation.id,phase);jobs=createNativeOperationJobs(dir,options);
    const raw=await host.run(command),result=jobs.accept(operation.id,raw);
    if(phase==='token-readback')tokenContext=jobs.verifiedTokenContext(operation.id);
    if(phase==='component-create')creation=raw.result;
    if(phase==='component-readback'){
      const planned=prepareReactAuthoredNativePlan({...evidence(f.request),operation:{id:operation.id,fileKey:REACT_NATIVE_FILE_KEY}});
      const checked=verifyNativeContractReadback({...planned.plan,planRevision:planned.revision,tokenIdentity:tokenContext!.tokens.identity,creation},raw.result);
      assert.equal(checked.status,'supported-structure-observed',JSON.stringify(checked));
    }
    assert.equal(result.phase,expected,JSON.stringify(result.problems));
  }
  const nodes=host.figma.root.findAll(()=>true),sets=nodes.filter((n:any)=>n.type==='COMPONENT_SET');assert.equal(sets.length,2);
  const plan=prepareReactAuthoredNativePlan({...evidence(f.request),operation:{id:operation.id,fileKey:REACT_NATIVE_FILE_KEY}}).plan;
  assert.equal(plan.graphComponents.length,2);assert.equal(plan.component.variants.length,f.appearance.draft.nativeVariants.length);
  const stamp=JSON.parse(sets.find((n:any)=>n.getSharedPluginData('ds_contracts','contractId').endsWith(':'+f.draft.contract!.id))!.getSharedPluginData('ds_contracts','codeValueAxes'));
  assert.deepEqual(stamp.stateApi.events,f.draft.contract!.events);
  const dumpScript=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify(sets.map((n:any)=>n.name))};`);
  const dump=await vm.runInNewContext(`(async()=>{${dumpScript}\n})()`,{figma:host.figma,console:{log(){},warn(){},error(){}}},{timeout:20000});
  const child=f.draft.contracts!.find(c=>c.id!==f.draft.contract!.id)!;
  const common={corpus:tokenCorpusFromJson({primitives:f.draft.tokens!,semantic:{},light:{},brandDefault:{}}),
    mintUnbound:true,projectionMode:'exact' as const,stampsObservable:true,fileKey:REACT_NATIVE_FILE_KEY};
  const backChild=ContractSchema.parse(proposeFromDump(dump[child.name],{...common,contractIdByName:new Map()}).contract);
  const importOptions={...common,contractIdByName:new Map([[child.name,backChild.id]]),
    contractIdByKey:new Map([[dump[child.name].key,backChild.id]]),contractsById:new Map([[backChild.id,asMinimalChildContract(backChild)]])};
  const back=ContractSchema.parse(proposeFromDump(dump[f.draft.contract!.name],importOptions).contract);
  assert.deepEqual(back.events,f.draft.contract!.events);
  assert.deepEqual(back.props.map(p=>p.bindings.code),f.draft.contract!.props.map(p=>p.bindings.code));
  assert.deepEqual(walkAnatomy(back).find(p=>p.part.component)?.part.component?.props,{seed:'{seed}',disabled:'{disabled}'});
  const missing=structuredClone(dump[f.draft.contract!.name]);
  delete missing.variants[0].children.find((c:any)=>c.type==='INSTANCE').componentProperties;
  assert.throws(()=>proposeFromDump(missing,importOptions));
  assert.equal(jobs.prepare(f.request).id,operation.id);assert.equal(host.figma.root.findAll(()=>true).length,nodes.length);
  assert.throws(()=>jobs.prepare({...f.request,stateApi:{...f.pin,reportSha256:'0'.repeat(64)}}),/baseline-already-reserved/);
  const successor={...f.request,referenceId:'5'.repeat(64),stateApi:{...f.request.stateApi,id:'60000000-0000-4000-8000-000000000001'}};
  const moved=jobs.listReactMoved(successor.referenceId,()=>successor);
  assert.equal(moved.length,1);assert.equal(moved[0].operationId,operation.id);assert.equal(moved[0].kind,'state-api');
  assert.equal(moved[0].observationRequired,false);
  assert.equal(jobs.listReactMoved(successor.referenceId,()=>{throw Error('fresh experiment missing');})[0].observationRequired,true);
  assert.deepEqual(jobs.reactSuccessionSubject(operation.id),f.request);
  successions.adopt(operation.id,f.request,successor);
  jobs=createNativeOperationJobs(dir,options);
  assert.deepEqual(jobs.reactAuthoredRequest(operation.id),f.request,'creation request never changes');
  assert.deepEqual(jobs.reactEffectiveAuthoredRequest(operation.id),successor);
  assert.deepEqual(jobs.reactUpdateBaseline(operation.id).source,successor);
  assert.equal(jobs.reactUpdateBaseline(operation.id).input.graphComponents?.length,2);
  assert.equal(jobs.reactIdentity(operation.id).referenceId,successor.referenceId);
  assert.equal(jobs.listReact(successor.referenceId)[0].operation.id,operation.id);
  assert.equal(jobs.listReact(f.request.referenceId).length,0);
  assert.deepEqual(jobs.listReactMoved(successor.referenceId,()=>successor),[]);
  assert.equal(successions.adopt(operation.id,f.request,successor).adopted,false);
  assert.equal(host.figma.root.findAll(()=>true).length,nodes.length);
  available=false;assert.equal(jobs.get(operation.id).sourceCurrent,false);assert.throws(()=>jobs.dispatch(operation.id,'component-create'));
  assert.equal(host.figma.root.findAll(()=>true).length,nodes.length);
});
