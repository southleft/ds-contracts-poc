import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync,readdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY,type NativeOperationJobsOptions} from '../source-reference/native-operation-jobs.js';
import {createNativeOperationTransport} from '../source-reference/native-operation-transport.js';
import {prepareReactComparisonPlan,buildReactComparisonWrite} from '../source-reference/react-comparison-plan.js';
import type {ReactComparisonRequest} from '../source-reference/react-comparison-request.js';
import type {ObservedContentDraft} from '../source-reference/observed-content.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {prepareNativeContractComparison} from './native-contract-comparison.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeComparisonRecoveryReadbackScript,prepareNativeComparisonRecovery} from './native-comparison-recovery.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from './native-contract-comparison-observation.js';
import {emitNativeContractReadbackScript} from './native-source-observation.js';

async function partialFixture(nested=false) {
  const f=await nativeComparisonFixture(undefined,'column'),selected={...f.comparison,instanceWidth:360};
  if(nested){
    f.content=f.contract('fixture.composed',{root:{layout:{display:'flex',direction:'column'},parts:{child:{layout:{display:'flex',direction:'column'},parts:{label:{text:'Nested content',tokens:{color:'{ink}','font-size':'{size}'},declared:{'font-family':'Inter'}}}}}}});
    selected.instances=[{parent:f.comparison.parent,receipt:f.comparison.receipt,variantName:f.comparison.variantName,slotSpecPath:[0],specPath:[0]}];
  }
  const main=await f.figma.getNodeByIdAsync(selected.parent.creation.variants[0].id);
  const create=main.createInstance.bind(main);let allocated:any;
  main.createInstance=()=>{
    allocated=create();const resize=allocated.resize.bind(allocated);
    allocated.resize=(_w:number,h:number)=>resize(allocated.width,h);
    return allocated;
  };
  const creation=await f.run(f.emit(f.content,selected));
  assert.equal(creation.status,'partial-or-unknown-allocation');
  assert.deepEqual(creation.problems,['native-source-write-comparison-instance-width-refused']);
  delete allocated.resize;main.createInstance=create;
  const data=f.engine.compileComponentData(f.content,new Map([[f.content.id,f.content]]));
  const comparison=prepareNativeContractComparison(f.content,data,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},selected);
  const input={operation:f.supplemental.operation,planRevision:revisionOf('comparison'),comparison,
    tokenInput:f.supplemental.tokens.input,tokenIdentity:f.supplemental.tokens.identity,creation};
  const observation=await f.run(emitNativeComparisonRecoveryReadbackScript(input));
  const prepare=()=>prepareNativeComparisonRecovery(input,observation);
  const emit=()=>f.engine.buildNativeContractComparisonScript(f.content,new Map([[f.content.id,f.content]]),f.source,
    {...f.supplemental,comparisonRecovery:prepare()},selected);
  return {...f,input,observation,prepare,emit};
}
for(const nested of [false,true]) test(`empty retained comparison resumes with the same objects (nested=${nested})`,async()=>{
  const f=await partialFixture(nested), original=structuredClone(f.input.creation), mainBefore=await f.run(emitNativeContractReadbackScript(f.input.comparison.parent));
  const script=f.emit(), result=await f.run(script);
  assert.equal(result.status,'created-candidate',JSON.stringify(result));
  if(nested) assert.equal(result.comparisons[0].nested.length,1);
  assert.equal(result.pageId,original.pageId);assert.equal(result.comparisonBoardId,original.comparisonBoardId);
  assert.equal(result.comparisons[0].instanceId,original.comparisons[0].instanceId);
  assert.equal(result.comparisons[0].slots[0].nodeId,original.comparisons[0].sourceParts[1].nodeId);
  const after={...f.input,creation:result},receipt=await f.run(emitNativeContractComparisonReadbackScript(after));
  const report=verifyNativeContractComparisonReadback(after,receipt);
  assert.equal(report.status,'supported-comparison-structure-observed',JSON.stringify(report));
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.input.comparison.parent)),mainBefore);
  assert.deepEqual(f.input.creation,original);
  const count=f.figma.root.findAll(()=>true).length,again=await f.run(script);
  assert.equal(again.status,'refused');assert.equal(again.allocationAttempted,false);
  assert.equal(f.figma.root.findAll(()=>true).length,count);
});
test('preflight refuses changed ownership, topology, properties, source dependencies and unknown partial points',async()=>{
  const f=await partialFixture();f.prepare();
  const mutations=[
    (r:any)=>{r.content.nodes.find((n:any)=>n.type==='INSTANCE').mainId='other'},
    (r:any)=>{r.content.nodes.find((n:any)=>n.type==='SLOT').childIds.push('foreign')},
    (r:any)=>{r.content.nodes.find((n:any)=>n.type==='INSTANCE').values.opacity=.5},
    (r:any)=>{r.content.nodes[0].metadata.nativeComparisonRecoveryClaim='already'},
    (r:any)=>{r.content.nodes[0].metadata.nativeSourceAllocation='other'},
    (r:any)=>{r.content.nodes.push(r.content.nodes[0])},
    (r:any)=>{r.parents[0].nodes[0].name='changed'},
    (r:any)=>{r.content.tokens.receipt.variables[0].key='changed'},
  ];
  for(const change of mutations){const r=structuredClone(f.observation);change(r);assert.throws(()=>prepareNativeComparisonRecovery(f.input,r));}
  for(const change of [(c:any)=>{c.problems=['unknown']},(c:any)=>{c.comparisons[0].slots=[{}]},(c:any)=>{c.nodes.pop()},(c:any)=>{c.comparisons[0].nested=[{}]}]){
    const input=structuredClone(f.input);change(input.creation);assert.throws(()=>emitNativeComparisonRecoveryReadbackScript(input));
  }
});
test('live changes after preflight refuse before allocating; failed continuation cannot be replayed',async()=>{
  for(const changed of ['instance','main','token','interruption']){
    const f=await partialFixture(),script=f.emit(),instance=await f.figma.getNodeByIdAsync(f.input.creation.comparisons[0].instanceId);
    if(changed==='instance') instance.opacity=.3;
    if(changed==='main') (await f.figma.getNodeByIdAsync(f.input.comparison.mainId)).name='changed';
    if(changed==='token') f.variables.find((v:any)=>v.id===f.supplemental.tokens.identity.variables[0].id)!.setValueForMode(f.supplemental.tokens.identity.modes[0].modeId,'changed');
    if(changed==='interruption') f.figma.createNodeFromSvg=()=>{throw Error('interrupted allocation')};
    const count=f.figma.root.findAll(()=>true).length,result=await f.run(script);
    assert.equal(result.status,changed==='interruption'?'partial-or-unknown-allocation':'refused',JSON.stringify(result));
    assert.equal(f.figma.root.findAll(()=>true).length,count);
    const again=await f.run(script);assert.equal(again.status,'refused');assert.equal(again.allocationAttempted,false);
  }
});

test('app journal continues once, retains original evidence, and recovers interrupted readback without replay',async t=>{
  const f=await nativeComparisonFixture(REACT_NATIVE_FILE_KEY,'column'),selected={...f.comparison,instanceWidth:360};
  const repo=mkdtempSync(path.join(tmpdir(),'comparison-recovery-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const content: ObservedContentDraft = { version: 1, status: 'compiled-comparison-draft', qualification: 'observed-comparison-content-only',
    acceptedContract: null, nativeQualification: 'unqualified', inputRevision: revisionOf('observations'), treeRevision: revisionOf('tree'), fontsRevision: revisionOf('fonts'),
    contract: f.content, tokens: f.tokens, assets: f.assets, component: f.engine.compileComponentData(f.content, new Map([[f.content.id, f.content]])),
    receipts: [], residuals: [], problems: [], limitations: ['synthetic-test-only'] };
  const request: ReactComparisonRequest = { version: 1, kind: 'react-content-comparison', parentOperationId: selected.parent.operation.id,
    root: { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64), ownership: { id: '10000000-0000-4000-8000-000000000010', sha256: 'b'.repeat(64) },
      inventorySha256: 'c'.repeat(64), caseId: 'sample', matrixRevision: revisionOf('matrix') },
    content: { id: '10000000-0000-4000-8000-000000000011', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  let current = true, preparations = 0;
  const options: NativeOperationJobsOptions = { prepare: () => { throw Error('unexpected source adapter'); }, reactComparison: {
    prepare: (picked, operation) => {
      preparations++; assert.deepEqual(picked, request); if (!current) throw Error('source changed');
      return { visual: { id: request.root.ownership.id, reportSha256: request.root.ownership.sha256 },
        preparation: { id: request.content.id, reportSha256: request.content.reportSha256 },
        plan: prepareReactComparisonPlan({ operation, content, source: f.source, comparison: selected }) };
    },
    buildComponent: (_, context) => buildReactComparisonWrite({ operation: context.operation, content, source: f.source,
      comparison: selected, expectedPlanRevision: context.planRevision, tokens: context.tokens, comparisonRecovery:context.comparisonRecovery }),
  } };

  let jobs=createNativeOperationJobs(repo,options),transport=createNativeOperationTransport(repo,jobs);
  const saved=jobs.prepare(request),connection=transport.pair(saved.id),secret=connection.split('.')[1];transport.start(saved.id);
  const main=await f.figma.getNodeByIdAsync(selected.parent.creation.variants[0].id),create=main.createInstance.bind(main);let instance:any;
  main.createInstance=()=>{instance=create();const resize=instance.resize.bind(instance);instance.resize=(_w:number,h:number)=>resize(instance.width,h);return instance;};
  const deliver=async()=>{
    const next=transport.claim(saved.id,secret,REACT_NATIVE_FILE_KEY) as any;
    assert.equal(next.status,'command',JSON.stringify(next));
    const command=next.command,{script,kind,readOnly,...identity}=command,result=await f.run(script);
    jobs.accept(saved.id,{...identity,result});return command;
  };
  await deliver();await deliver();await deliver();
  assert.equal(jobs.get(saved.id).phase,'component-partial-allocation');assert.equal(jobs.get(saved.id).canResumeComparison,true);
  const events=path.join(repo,'private/source-native-app/operations',saved.id,'events');
  const originals=readdirSync(events).map(name=>[name,readFileSync(path.join(events,name),'utf8')] as const);
  delete instance.resize;main.createInstance=create;
  current=false;assert.throws(()=>jobs.dispatch(saved.id,'comparison-recovery-readback'));current=true;
  jobs.dispatch(saved.id,'comparison-recovery-readback');await deliver();
  assert.equal(jobs.get(saved.id).phase,'comparison-recovery-observed');
  current=false;assert.throws(()=>jobs.dispatch(saved.id,'comparison-recovery-apply'));current=true;
  await deliver();assert.equal(jobs.get(saved.id).phase,'components-created');
  const count=f.figma.root.findAll(()=>true).length;
  assert.throws(()=>jobs.dispatch(saved.id,'comparison-recovery-apply'));
  const read=transport.claim(saved.id,secret,REACT_NATIVE_FILE_KEY) as any;assert.equal(read.command.phase,'component-readback');
  jobs=createNativeOperationJobs(repo,options);transport=createNativeOperationTransport(repo,jobs);
  jobs.retryObservation(saved.id);await deliver();
  assert.equal(jobs.get(saved.id).phase,'component-structure-observed');
  assert.equal(jobs.get(saved.id).canResumeComparison,false);
  assert.equal(f.figma.root.findAll(()=>true).length,count);
  for(const [name,bytes] of originals) assert.equal(readFileSync(path.join(events,name),'utf8'),bytes);
  const entries=readdirSync(events).map(name=>JSON.parse(readFileSync(path.join(events,name),'utf8')));
  assert.equal(entries.filter(e=>e.kind==='dispatch'&&e.command.phase==='component-create').length,1);
  assert.equal(entries.filter(e=>e.kind==='dispatch'&&e.command.phase==='comparison-recovery-apply').length,1);
  // Model a historical, semantically equivalent reader with different bytes.
  // Re-sign this synthetic journal only; production journals are immutable.
  const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
  let previous=sha(readFileSync(path.join(events,'../operation.json'),'utf8')),readerAttempt='',readerSha='',readerFile='';
  for(const name of readdirSync(events).sort()){
    const file=path.join(events,name),event=JSON.parse(readFileSync(file,'utf8'));
    if(event.kind==='dispatch'&&event.command.phase==='comparison-recovery-readback'){
      event.command.script+='\n// Historical reader formatting';event.command.scriptSha256=sha(event.command.script);
      readerAttempt=event.command.attemptId;readerSha=event.command.scriptSha256;readerFile=file;
    }
    if(event.kind==='result'&&event.envelope.attemptId===readerAttempt)event.envelope.scriptSha256=readerSha;
    event.previousSha256=previous;const bytes=JSON.stringify(event);writeFileSync(file,bytes);previous=sha(bytes);
  }
  jobs=createNativeOperationJobs(repo,options);
  assert.equal(jobs.get(saved.id).phase,'component-structure-observed');
  assert.throws(()=>jobs.dispatch(saved.id,'comparison-recovery-apply'));
  const stored=readFileSync(readerFile,'utf8'),tampered=JSON.parse(stored);tampered.command.script+='\n// Unhashed edit';writeFileSync(readerFile,JSON.stringify(tampered));
  assert.throws(()=>jobs.get(saved.id),/dispatch-invalid|journal-chain-invalid/);writeFileSync(readerFile,stored);
  for(const name of readdirSync(events).slice(8)) unlinkSync(path.join(events,name));
  assert.throws(()=>jobs.get(saved.id),/recovery-write-journal-incomplete/);
});
