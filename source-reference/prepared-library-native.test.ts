import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer,request as httpRequest} from 'node:http';
import {buildReactLibrary, parseLibraryRequest} from '../playground/server/react-library.js';
import {retainPreparedReactLibrary} from '../playground/server/react-library-artifact.js';
import {preparedLibraryNativeAdapter} from './prepared-library-native.js';
import {isPreparedLibraryNativeRequest, preparedLibraryNativeReservation, type PreparedLibraryNativeRequest} from './prepared-library-native-request.js';
import {createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationJobsOptions} from './native-operation-jobs.js';
import {createNativeOperationTransport} from './native-operation-transport.js';
import {nativeFixtureHost} from './native-operation-test-fixture.js';
import {createReferenceService} from './service.js';
import {revisionOf} from '../core/contract-provenance.js';
import {verifyNativePartialReadback,type NativePartialObservationInput} from '../core/native-partial-observation.js';
import {emitNativeLibraryReplacementReadbackScript,prepareNativeLibraryReplacement,wrapNativeLibraryReplacement} from '../core/native-library-replacement.js';
import {emitNativeInspectionReadbackScript,verifyNativeInspectionReadback} from '../core/native-source-observation.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t: test.TestContext, statefulRoot = false, unsupportedGrowth = false, callerContent=false) {
  const repo = mkdtempSync(path.join(tmpdir(), 'prepared-library-journal-'));
  t.after(() => rmSync(repo, {recursive:true, force:true}));
  const leaf = {id:'test.journal-leaf', name:'Leaf', version:'0.1.0', status:'draft', description:'Journal integration fixture',
    semantics:{element:'button'}, states:['hover'],
    props:[{name:'label', type:'text', default:'Library label', bindings:{code:{prop:'label'}, figma:{kind:'TEXT',property:'Label'}}},
      {name:'shown',type:'boolean',default:true,bindings:{code:{prop:'shown'},figma:{kind:'BOOLEAN',property:'Shown'}}},
      {name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}],
    anatomy:{root:{layout:{display:'inline-flex'},states:{hover:{opacity:'{fade}'}},parts:{
      text:{content:{prop:'label'},visibleWhen:{prop:'shown'},declared:{'font-family':'Inter'},tokens:{color:'{label}'}}}}},
    bindings:{code:{anchors:{importPath:'test/Leaf',export:'Leaf'}},figma:{statePreviews:true,anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-leaf-key'}}}};
  const panel = {id:'test.journal-panel',name:'Panel',version:'0.1.0',status:'draft',description:'Nested default slot',props:[],states:[],semantics:{element:'div'},
    anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{
      slot:{...(unsupportedGrowth?{layout:{grow:true,growBasis:'zero'}}:{}),slot:{name:'children',defaultContent:[{id:leaf.id,props:{size:'large',label:'Default caller'}}],accepts:[leaf.id]}},
      leaf:{component:{id:leaf.id,props:{shown:true}}}}}},
    bindings:{code:{anchors:{importPath:'test/Panel',export:'Panel'}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-panel-key'}}}};
  const outer = {...panel,id:'test.journal-outer',name:'Outer',anatomy:{root:{layout:{display:'flex'},parts:{panel:{component:{id:panel.id},
    ...(callerContent?{parts:{selected:{component:{id:leaf.id,props:{label:'Slot caller'}}}}}:{})},
    ...(callerContent?{tail:{text:'Stop after caller',declared:{'font-family':'Inter'},tokens:{color:'{label}'}}}:{})}}}};
  const input = parseLibraryRequest({rootId:statefulRoot ? leaf.id : outer.id, contracts:statefulRoot ? [leaf] : [outer,panel,leaf], icons:[],
    tokens:{primitives:{ink:{$type:'color',$value:'#123456'},fade:{$type:'number',$value:0.5}},
      semantic:{label:{$type:'color',$value:'{ink}'}},light:{},dark:{},brands:{default:{}}}});
  const output = await buildReactLibrary(repoRoot,input), artifact = retainPreparedReactLibrary(repo,input,output);
  const request: PreparedLibraryNativeRequest = {version:1,kind:'prepared-library-native',artifactId:artifact.id,mode:'light',brand:'default'};
  const options: NativeOperationJobsOptions = {prepare:()=>{throw Error('unexpected source preparer');},preparedLibrary:preparedLibraryNativeAdapter(repo)};
  const reopen = () => createNativeOperationJobs(repo,options), transport = () => createNativeOperationTransport(repo,reopen());
  const host = nativeFixtureHost({instanceVariantSelection:true}); host.figma.fileKey = REACT_NATIVE_FILE_KEY;
  Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection = function(c:any,mode:string) {
    this.explicitVariableModes = {...this.explicitVariableModes,[c.id]:mode};
  };
  const artifactDir = path.join(repo,'private/react-library-artifacts',artifact.id);
  return {repo,request,reopen,transport,host,artifactDir,options};
}

test('unrepresented zero-basis growth refuses before reserving a native operation and preserves the archive',async t=>{
  const f=await fixture(t,false,true),manager=f.reopen();
  const before=readFileSync(path.join(f.artifactDir,'input.json'));
  const reservation=preparedLibraryNativeReservation(f.request);
  assert.equal(manager.forBaseline(reservation),null);
  for(let i=0;i<2;i++)assert.throws(()=>manager.prepare(f.request),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED.*height allocation/);
  assert.equal(manager.forBaseline(reservation),null);
  assert.deepEqual(readdirSync(path.join(f.repo,'private/source-native-app/operations')),[]);
  assert.deepEqual(readFileSync(path.join(f.artifactDir,'input.json')),before);
});

test('retained-library requests cannot supply a target, program or fabricated source pins',()=>{
  const request: PreparedLibraryNativeRequest = {version:1,kind:'prepared-library-native',artifactId:'a'.repeat(64),mode:'light',brand:'default'};
  assert.equal(isPreparedLibraryNativeRequest(request),true);
  for (const change of [{fileKey:'OriginalSourceFile'},{operationId:'00000000-0000-4000-8000-000000000001'},
    {script:'arbitrary code'},{visual:{id:'invented'}},{mode:'auto'},{brand:'../default'},{artifactId:'../input'}])
    assert.equal(isPreparedLibraryNativeRequest({...request,...change}),false);
  assert.equal(preparedLibraryNativeReservation({...request}),preparedLibraryNativeReservation(request));
  assert.notEqual(preparedLibraryNativeReservation({...request,mode:'dark'}),preparedLibraryNativeReservation(request));
});

test('journal preparation rejects fabricated evidence, different context and downgraded verification before reserving a library',async t=>{
  const f = await fixture(t), adapter = f.options.preparedLibrary!;
  for (const mutate of [
    (p:any)=>{p.artifact.inputSha256='0'.repeat(64);},
    (p:any)=>{delete p.artifact;p.visual={id:'10000000-0000-4000-8000-000000000001',reportSha256:'a'.repeat(64)};p.preparation=p.visual;},
    (p:any)=>{p.visual={id:'10000000-0000-4000-8000-000000000001',reportSha256:'a'.repeat(64)};},
    (p:any)=>{p.plan.plan.projection.context.mode='dark';},
    (p:any)=>{p.plan.plan.graphVerification=1;},
    (p:any)=>{p.plan.plan.projection.source.artifactId='0'.repeat(64);},
    (p:any)=>{p.plan.plan.tokenInput.source.inputSha256='0'.repeat(64);},
  ]) {
    const options:NativeOperationJobsOptions = {...f.options,preparedLibrary:{...adapter,prepare(request,operation){
      const prepared=structuredClone(adapter.prepare(request,operation));mutate(prepared);
      prepared.plan.revision=revisionOf(prepared.plan.plan);return prepared;
    }}};
    assert.throws(()=>createNativeOperationJobs(f.repo,options).prepare(f.request),/native-operation-preparation-invalid/);
  }
  assert.deepEqual(readdirSync(path.join(f.repo,'private/source-native-app/operations')),[]);
  assert.deepEqual(readdirSync(path.join(f.repo,'private/source-native-app/baselines')),[]);
});

test('a retained library survives journal and transport reopen, lost acknowledgements and refused observations without duplicate creation',async t=>{
  const f = await fixture(t), first = f.reopen().prepare(f.request), id = first.id;
  assert.equal(first.graphVerification,2); assert.equal(first.counters.sourceCases,0);
  assert.deepEqual(first.preparedLibrary,{artifactId:f.request.artifactId,mode:'light',brand:'default'});
  const header = JSON.parse(readFileSync(path.join(f.repo,'private/source-native-app/operations',id,'operation.json'),'utf8'));
  assert.equal('visual' in header,false); assert.equal('preparation' in header,false);
  assert.equal(header.artifact.id,f.request.artifactId); assert.equal(header.policy.fileKey,REACT_NATIVE_FILE_KEY);
  const connection = f.transport().pair(id), secret = connection.split('.')[1];
  f.transport().start(id);
  for (const phase of ['token-create','token-readback','component-create','component-readback'] as const) {
    const claimed = f.transport().claim(id,secret,REACT_NATIVE_FILE_KEY);
    assert.ok(claimed.status === 'command');
    const command = claimed.command;
    assert.equal(command.phase,phase);
    f.transport().begin(id,secret,command.attemptId);
    const result = await f.host.run(command);
    assert.equal(f.reopen().pendingCommand(id)?.attemptId,command.attemptId);
    if (phase === 'component-create') {
      assert.throws(()=>f.reopen().retryCreation(id),/creation-retry-refused/);
      assert.equal(f.reopen().prepare(f.request).id,id);
    }
    const receipt = f.transport().acceptDelivery(id,secret,result);
    assert.equal(receipt.status,'result-recorded');
    assert.deepEqual(f.transport().acceptDelivery(id,secret,result),receipt,'lost response may redeliver the exact acknowledgement');
    assert.equal(f.reopen().get(id).sourceCurrent,true);
  }
  const terminal = f.reopen().get(id);
  assert.equal(terminal.phase,'component-structure-observed',JSON.stringify(terminal.problems));
  assert.equal(terminal.acceptedContract,null); assert.equal(terminal.nativeQualification,'unqualified');
  const nodes = f.host.figma.root.findAll(()=>true).map((n:any)=>n.id);
  assert.equal(f.reopen().prepare(f.request).id,id);
  assert.throws(()=>f.reopen().dispatch(id,'component-create'),/component-creation-already-dispatched/);
  const command = f.reopen().retryObservation(id), result = await f.host.run(command);
  const content = result.result as any;
  content.nodes.find((n:any)=>n.type==='TEXT').values.characters='Changed native dependency';
  assert.equal(f.reopen().accept(id,result).phase,'component-observation-refused');
  assert.equal(f.reopen().accept(id,await f.host.run(f.reopen().retryObservation(id))).phase,'component-structure-observed');
  assert.deepEqual(f.host.figma.root.findAll(()=>true).map((n:any)=>n.id),nodes);
  assert.throws(()=>f.reopen().reactUpdateBaseline(id),/react.*required|update.*unavailable/);
  const original = readFileSync(path.join(f.artifactDir,'input.json'));
  writeFileSync(path.join(f.artifactDir,'input.json'),Buffer.concat([original,Buffer.from('\n')]));
  assert.equal(f.reopen().get(id).sourceCurrent,false);
  assert.equal(f.reopen().accept(id,await f.host.run(f.reopen().retryObservation(id))).phase,'component-structure-observed',
    'saved native allocations remain readable without authorizing another write');
  assert.equal(f.reopen().get(id).sourceCurrent,false);
  assert.throws(()=>f.reopen().prepare(f.request),/input-changed/);
  assert.ok(readFileSync(path.join(f.artifactDir,'input.json')).equals(Buffer.concat([original,Buffer.from('\n')])));
});

test('partial library inspection survives compiler changes, interrupted reads and restart without another allocation',async t=>{
  const f=await fixture(t,true), first=f.reopen().prepare(f.request), id=first.id;
  const secret=f.transport().pair(id).split('.')[1]; f.transport().start(id);
  for(const phase of ['token-create','token-readback'] as const) {
    const claim=f.transport().claim(id,secret,REACT_NATIVE_FILE_KEY); assert.equal(claim.status,'command');
    if(claim.status!=='command') throw Error('command required');
    assert.equal(claim.command.phase,phase);
    f.transport().acceptDelivery(id,secret,await f.host.run(claim.command));
  }
  const createText=f.host.figma.createText; let textCalls=0;
  f.host.figma.createText=()=>{if(++textCalls===2) throw Error('injected-native-construction-failure'); return createText();};
  const claim=f.transport().claim(id,secret,REACT_NATIVE_FILE_KEY); assert.equal(claim.status,'command');
  if(claim.status!=='command')throw Error('command required');
  assert.equal(claim.command.phase,'component-create');
  const birth=await f.host.run(claim.command); f.host.figma.createText=createText;
  assert.equal((birth.result as any).status,'partial-or-unknown-allocation');
  f.transport().acceptDelivery(id,secret,birth);
  assert.equal(f.reopen().get(id).canInspectPartial,true);
  assert.equal(f.reopen().get(id).canResumeComparison,false);
  const allIds=()=>f.host.figma.root.findAll(()=>true).map((n:any)=>n.id);
  const beforeIds=allIds(), directory=path.join(f.repo,'private/source-native-app/operations',id);
  const originalFiles=new Map(['plan.json','operation.json','component-creation.json',...readdirSync(path.join(directory,'events')).map(n=>'events/'+n)]
    .map(n=>[n,readFileSync(path.join(directory,n))]));
  const originalInput=readFileSync(path.join(f.artifactDir,'input.json'));
  const prepare=f.options.preparedLibrary!.prepare;
  f.options.preparedLibrary!.prepare=(...args)=>{
    const current=prepare(...args); current.plan.plan.limitations.push('test-compiler-revision-changed');
    current.plan.revision=revisionOf(current.plan.plan); return current;
  };
  assert.equal(f.reopen().get(id).sourceCurrent,false);
  assert.equal(f.reopen().forBaseline(preparedLibraryNativeReservation(f.request))!.id,id);
  assert.throws(()=>f.transport().start(id),/start-refused/);
  assert.throws(()=>f.reopen().dispatch(id,'component-create'),/component-creation-already-dispatched/);
  assert.throws(()=>f.reopen().dispatch(id,'comparison-recovery-readback'),/comparison-recovery-refused/);
  const claimRead=(prior?:string)=>{
    const next=f.transport().claim(id,secret,REACT_NATIVE_FILE_KEY,prior);
    assert.equal(next.status,'command'); if(next.status!=='command')throw Error('read command required');
    return next.command;
  };
  f.transport().retryObservation(id);
  const interrupted=claimRead();
  assert.equal(interrupted.phase,'partial-component-readback'); assert.equal(interrupted.readOnly,true);
  const oldResult=await f.host.run(interrupted);
  f.transport().retryObservation(id);
  const replacement=claimRead(interrupted.attemptId);
  assert.notEqual(replacement.attemptId,interrupted.attemptId);
  assert.throws(()=>f.reopen().accept(id,oldResult),/mismatch|stale|unsolicited/);
  const inspected=await f.host.run(replacement);
  const receipt=f.transport().acceptDelivery(id,secret,inspected);
  assert.deepEqual(f.transport().acceptDelivery(id,secret,inspected),receipt);
  const result=f.reopen().get(id);
  assert.equal(result.phase,'component-partial-allocation');
  assert.equal(result.partialObservation?.status,'partial-output-inspected');
  assert.equal(result.partialObservation?.nodeCount,(birth.result as any).nodes.length);
  assert.equal(result.partialObservation?.recordedNodeCount,(birth.result as any).nodes.length);
  assert.deepEqual(result.partialObservation?.problems,[]);
  assert.equal(result.partialObservation?.tokensObserved,true);
  assert.equal(result.nativeOutcome,'unknown'); assert.equal(result.sourceCurrent,false);
  assert.equal(result.nativeQualification,'unqualified'); assert.equal(result.structuralObservation,undefined);
  assert.equal(f.transport().status(id).finished,true);
  assert.deepEqual(allIds(),beforeIds);
  assert.deepEqual(readFileSync(path.join(f.artifactDir,'input.json')),originalInput);
  for(const [name,bytes] of originalFiles) assert.deepEqual(readFileSync(path.join(directory,name)),bytes,name);

  // Independent inventory exposes foreign/removed identities. It cannot
  // promote them to owned nodes or authorize a recovery write.
  const savedPlan=JSON.parse(readFileSync(path.join(directory,'plan.json'),'utf8'));
  const input={operation:savedPlan.plan.operation,planRevision:savedPlan.revision,creation:birth.result,
    sourceContractId:savedPlan.plan.projection.contractId,sourceContractRevision:savedPlan.plan.projection.contractRevision,
    tokenInput:savedPlan.plan.tokenInput,tokenIdentity:undefined as any};
  // The identity is taken from the original allocation acknowledgement, not
  // invented from a successful read or a component name.
  const events=readdirSync(path.join(directory,'events')).map(n=>JSON.parse(readFileSync(path.join(directory,'events',n),'utf8')));
  input.tokenIdentity=events.find(e=>e.kind==='result'&&e.envelope.phase==='token-create').envelope.result.creationIdentity;
  const altered=structuredClone(inspected.result) as any;
  const victim=altered.nodes.find((n:any)=>n.type!=='PAGE');
  victim.metadata.nativeSourceOperation='{}';
  const mismatch=verifyNativePartialReadback(input,altered);
  assert.equal(mismatch.status,'partial-output-inspected');
  assert(mismatch.ownershipMismatchNodeIds.includes(victim.id));
  assert(mismatch.problems.includes('native-partial-observation-ownership-mismatch'));
  altered.nodes.push(structuredClone(victim));
  assert.equal(verifyNativePartialReadback(input,altered).status,'refused','duplicate inventory identities refuse');
  assert.equal(verifyNativePartialReadback(input,{...inspected.result,fileKey:'WrongFile'}).status,'refused');

  const page=await f.host.figma.getNodeByIdAsync((birth.result as any).pageId);
  const extra=f.host.figma.createFrame(); page.appendChild(extra);
  f.transport().retryObservation(id);
  const withExtra=await f.host.run(claimRead());
  f.transport().acceptDelivery(id,secret,withExtra);
  const differences=f.reopen().get(id).partialObservation!;
  assert.equal(differences.status,'partial-output-inspected');
  assert.deepEqual(differences.additionalNodeIds,[extra.id]);
  assert.deepEqual(differences.ownershipMismatchNodeIds,[extra.id]);
  assert(f.host.figma.root.findAll(()=>true).some((n:any)=>n.id===extra.id),'inspection preserves foreign content');
  assert.throws(()=>f.reopen().dispatch(id,'component-create'),/component-creation-already-dispatched/);
  const removed=await f.host.figma.getNodeByIdAsync((birth.result as any).nodes.find((n:any)=>n.type==='TEXT').id);
  const removedId=removed.id; removed.remove();
  f.transport().retryObservation(id);
  f.transport().acceptDelivery(id,secret,await f.host.run(claimRead()));
  assert.deepEqual(f.reopen().get(id).partialObservation!.missingNodeIds,[removedId]);
});

async function partialReplacementFixture(t:test.TestContext,callerContent=false) {
  const f=await fixture(t,false,false,callerContent), id=f.reopen().prepare(f.request).id;
  const secret=f.transport().pair(id).split('.')[1];f.transport().start(id);
  // The shipped companion uses the all-pages API. The shared mock exposes
  // async lookups by default; provide their synchronous API counterparts.
  f.host.figma.getNodeById=(nodeId:string)=>f.host.figma.root.id===nodeId?f.host.figma.root:f.host.figma.root.findOne((n:any)=>n.id===nodeId);
  f.host.figma.variables.getVariableById=(variableId:string)=>f.host.variables.find((v:any)=>v.id===variableId)??null;
  f.host.figma.variables.getVariableCollectionById=(collectionId:string)=>f.host.collections.find((c:any)=>c.id===collectionId)??null;
  Object.defineProperty(Object.getPrototypeOf(f.host.figma.currentPage),'mainComponent',{
    configurable:true,get(){return this._mainComponent??null;}
  });
  for(const phase of ['token-create','token-readback'] as const)
    f.reopen().accept(id,await f.host.run(f.reopen().dispatch(id,phase)));
  const createText=f.host.figma.createText; let calls=0;
  f.host.figma.createText=()=>{
    if(!callerContent&&++calls===2)throw Error('injected-partial-build');
    const node=createText();
    if(callerContent){let value=node.characters;Object.defineProperty(node,'characters',{get:()=>value,set(next){
      if(next==='Stop after caller')throw Error('injected-partial-build');value=next;
    }});}
    return node;
  };
  const command=f.reopen().dispatch(id,'component-create'), birth=await f.host.run(command);
  f.host.figma.createText=createText; f.reopen().accept(id,birth);
  assert.equal((birth.result as any).status,'partial-or-unknown-allocation');
  let virtualCaller:{recordedId:string;nodeId:string}|undefined;
  if(callerContent){
    const caller=f.host.figma.root.findOne((n:any)=>n.type==='INSTANCE'&&n.name==='selected');
    assert(caller);assert.equal(caller.parent.type,'SLOT');
    const recordedId=caller.id;caller.id=caller.parent.id+';remapped-caller';
    virtualCaller={recordedId,nodeId:caller.id};
  }
  const directory=path.join(f.repo,'private/source-native-app/operations',id);
  const plan=JSON.parse(readFileSync(path.join(directory,'plan.json'),'utf8'));
  const events=readdirSync(path.join(directory,'events')).map(n=>JSON.parse(readFileSync(path.join(directory,'events',n),'utf8')));
  const tokenIdentity=events.find(e=>e.kind==='result'&&e.envelope.phase==='token-create').envelope.result.creationIdentity;
  const input:NativePartialObservationInput={operation:plan.plan.operation,planRevision:plan.revision,creation:birth.result,
    sourceContractId:plan.plan.projection.contractId,sourceContractRevision:plan.plan.projection.contractRevision,
    tokenInput:plan.plan.tokenInput,tokenIdentity};
  // Runtime-only probes: these scripts are NOT accepted into the app journal.
  // Application replacement dispatch/claims are a separate integration task.
  const companion=readFileSync(path.join(repoRoot,'figma-sync/plugin/code.js'),'utf8');
  const guard=companion.slice(companion.indexOf('function createReadOnlyFigma('),companion.indexOf('// --- READ-ONLY GUARD (end)'));
  assert(guard.startsWith('function createReadOnlyFigma('));
  const run=async(script:string,readOnly=true)=>(await f.host.run({...command,
    script:readOnly?`${guard}\nreturn await (async(figma)=>{${script}\n})(createReadOnlyFigma(figma));`:script,readOnly})).result as any;
  const observe=()=>run(emitNativeLibraryReplacementReadbackScript(input));
  const observation=await observe();
  assert.equal(observation.status,'partial-replacement-observed',JSON.stringify({problems:observation.problems,content:observation.content?.problems}));
  const recovery=prepareNativeLibraryReplacement(input,observation);
  const compiled=f.options.preparedLibrary!.buildComponent(f.request,{operation:input.operation,planRevision:plan.revision,
    journalRevision:'unit-test-only',tokens:{input:input.tokenInput,identity:tokenIdentity,receipt:observation.content.tokens.receipt}});
  const script=wrapNativeLibraryReplacement(recovery,compiled.script);
  const ids=()=>f.host.figma.root.findAll(()=>true).map((n:any)=>n.id);
  const tokens=async()=>JSON.stringify({collections:await f.host.figma.variables.getLocalVariableCollectionsAsync(),
    variables:await f.host.figma.variables.getLocalVariablesAsync()});
  return {...f,id,secret,plan,input,run,observe,recovery,script,ids,tokens,virtualCaller};
}

test('partial replacement authenticates virtual caller IDs and inherited main layers without rewriting the creation record',async t=>{
  const f=await partialReplacementFixture(t,true),before=JSON.stringify(f.input.creation),tokens=await f.tokens();
  const inspected=verifyNativePartialReadback(f.input,f.recovery.observation.content);
  assert.deepEqual(inspected.problems,[]);
  assert.deepEqual(inspected.allocationAliases,[f.virtualCaller]);
  assert(inspected.inheritedNodeIds.length>0);
  assert.equal(inspected.nodeCount,inspected.recordedNodeCount+inspected.inheritedNodeIds.length);
  const result=await f.run(f.script,false);
  assert.equal(result.status,'replacement-executed',JSON.stringify(result));
  assert.equal(result.creation.status,'created-candidate',JSON.stringify(result.creation));
  assert(result.retiredNodeIds.includes(f.virtualCaller!.nodeId));
  assert(!f.ids().includes(f.input.creation.pageId));
  assert.equal(await f.tokens(),tokens);
  assert.equal(JSON.stringify(f.input.creation),before);
  assert.equal((await f.run(f.script,false)).mutationAttempted,false);
});

test('partial caller ownership refuses unrelated aliases, altered inheritance and unrecorded slot content',async t=>{
  const f=await partialReplacementFixture(t,true),observed=f.recovery.observation;
  const mutate:Array<(r:any)=>void>=[
    r=>{r.content.nodes.find((n:any)=>n.id===f.virtualCaller!.nodeId).metadata.nativeSourceAllocation='unrecorded';},
    r=>{r.content.nodes.find((n:any)=>n.id===f.virtualCaller!.nodeId).metadata.nativeSourceOperation='{}';},
    r=>{r.content.nodes.find((n:any)=>n.id===f.virtualCaller!.nodeId).mainId='unrelated';},
    r=>{const n=r.content.nodes.find((n:any)=>n.id===f.virtualCaller!.nodeId);n.type='FRAME';},
    r=>{const n=r.content.nodes.find((n:any)=>n.id===f.virtualCaller!.nodeId);const old=n.id;n.id='foreign-identity';for(const x of r.content.nodes){x.childIds=x.childIds.map((id:string)=>id===old?n.id:id);if(x.parentId===old)x.parentId=n.id;}},
    r=>{const inherited=verifyNativePartialReadback(f.input,r.content).inheritedNodeIds[0];r.content.nodes.find((n:any)=>n.id===inherited).metadata.nativeSourceAllocation='unrelated';},
    r=>{const inherited=verifyNativePartialReadback(f.input,r.content).inheritedNodeIds[0];r.content.nodes.find((n:any)=>n.id===inherited).metadata.nativeContractPart='{}';},
    r=>{const original=r.content.nodes.find((n:any)=>n.id===f.virtualCaller!.nodeId),copy=structuredClone(original);copy.id=f.virtualCaller!.recordedId;copy.childIds=[];r.content.nodes.push(copy);r.content.nodes.find((n:any)=>n.id===copy.parentId).childIds.push(copy.id);},
  ];
  for(const change of mutate){const changed=structuredClone(observed);change(changed);assert.throws(()=>prepareNativeLibraryReplacement(f.input,changed),/allocation-changed/,String(change));}
  const caller=await f.host.figma.getNodeByIdAsync(f.virtualCaller!.nodeId),extra=f.host.figma.createFrame();caller.parent.appendChild(extra);
  const withExtra=await f.observe();
  assert.throws(()=>prepareNativeLibraryReplacement(f.input,withExtra),/allocation-changed/);
  const result=await f.run(f.script,false);assert.equal(result.mutationAttempted,false);
  assert(f.ids().includes(extra.id),'foreign slot content survives refused replacement');
});

test('replacement runtime rebuilds the complete library with the same tokens and refuses a replay',async t=>{
  const f=await partialReplacementFixture(t), beforeTokens=await f.tokens();
  const result=await f.run(f.script,false);
  assert.equal(result.status,'replacement-executed',JSON.stringify(result));
  assert.equal(result.creation.status,'created-candidate',JSON.stringify(result.creation.problems));
  assert.equal(result.retiredPageId,f.input.creation.pageId);
  assert.deepEqual([...result.retiredNodeIds].sort(),f.input.creation.nodes.map((n:any)=>n.id).sort());
  assert(f.input.creation.nodes.every((n:any)=>!f.ids().includes(n.id)));
  assert.equal(await f.tokens(),beforeTokens,'no new variable collection, ID or value');
  const observationInput={operation:f.input.operation,planRevision:f.plan.revision,component:f.plan.plan.component,
    projection:f.plan.plan.projection,graphComponents:f.plan.plan.graphComponents,graphVerification:2 as const,
    tokenInput:f.input.tokenInput,tokenIdentity:f.input.tokenIdentity,creation:result.creation};
  const readback=await f.run(emitNativeInspectionReadbackScript(observationInput));
  assert.equal(verifyNativeInspectionReadback(observationInput,readback).status,'supported-structure-observed');
  const after=f.ids();
  const repeated=await f.run(f.script,false);
  assert.equal(repeated.status,'refused');assert.equal(repeated.mutationAttempted,false);
  assert.deepEqual(f.ids(),after); assert.equal(await f.tokens(),beforeTokens);
  assert.equal(f.reopen().get(f.id).phase,'component-partial-allocation','a runtime-only test cannot rewrite journal truth');
});

test('replacement refuses external instances, swap defaults and prototype references before removal',async t=>{
  const f=await partialReplacementFixture(t), initialPage=f.host.figma.root.children[0];
  const main=await f.host.figma.getNodeByIdAsync(f.input.creation.nodes.find((n:any)=>n.type==='COMPONENT').id);
  for(const kind of ['instance','swap','reaction']) {
    const external=kind==='instance'?main.createInstance():kind==='swap'?f.host.figma.createComponent():f.host.figma.createFrame();
    initialPage.appendChild(external);
    if(kind==='swap')external.addComponentProperty('Other','INSTANCE_SWAP',main.id);
    if(kind==='reaction')await external.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:main.id,navigation:'NAVIGATE',transition:null}]}]);
    const observed=await f.observe();
    assert.throws(()=>prepareNativeLibraryReplacement(f.input,observed),/external-(instance|reference)-consumer/,kind);
    const before=f.ids(), tokens=await f.tokens();
    const refused=await f.run(f.script,false);
    assert.equal(refused.status,'refused'); assert.equal(refused.mutationAttempted,false);
    assert.deepEqual(f.ids(),before); assert.equal(await f.tokens(),tokens);
    external.remove();
  }
});

test('replacement rechecks geometry, token values, allocation keys, extra content and claim metadata synchronously',async t=>{
  const f=await partialReplacementFixture(t);
  const page=await f.host.figma.getNodeByIdAsync(f.input.creation.pageId);
  const main=await f.host.figma.getNodeByIdAsync(f.input.creation.nodes.find((n:any)=>n.type==='COMPONENT').id);
  const beforeName=main.name; main.name+=' edited after review';
  let result=await f.run(f.script,false);
  assert.equal(result.status,'refused');assert.equal(result.mutationAttempted,false);assert.equal(main.name,beforeName+' edited after review');main.name=beforeName;
  const originalX=main.x;main.x+=7;
  result=await f.run(f.script,false);
  assert.equal(result.status,'refused');assert.equal(result.mutationAttempted,false);assert.equal(main.x,originalX+7);main.x=originalX;
  const extra=f.host.figma.createFrame();page.appendChild(extra);
  const extraObservation=await f.observe();
  assert.throws(()=>prepareNativeLibraryReplacement(f.input,extraObservation),/allocation-changed/);
  result=await f.run(f.script,false);assert.equal(result.mutationAttempted,false);assert(f.ids().includes(extra.id));extra.remove();
  const corrupted=structuredClone(f.recovery.observation);
  corrupted.content.nodes.find((n:any)=>n.id===main.id).key='different-main-key';
  assert.throws(()=>prepareNativeLibraryReplacement(f.input,corrupted),/allocation-key-changed/);
  const collection=(await f.host.figma.variables.getLocalVariableCollectionsAsync())[0], name=collection.name;
  collection.name+=' changed';result=await f.run(f.script,false);
  assert.equal(result.mutationAttempted,false);assert.equal(collection.name,name+' changed');collection.name=name;
  const variable=f.host.variables.find((v:any)=>v.resolvedType==='COLOR');
  assert(variable,'fixture must contain a color token');
  const mode=Object.keys(variable.valuesByMode)[0], originalValue=variable.valuesByMode[mode];
  const changedValue={r:1,g:0,b:0,a:1};
  variable.setValueForMode(mode,changedValue);result=await f.run(f.script,false);
  assert.equal(result.status,'refused');assert.equal(result.mutationAttempted,false);
  assert.deepEqual(variable.valuesByMode[mode],changedValue);variable.setValueForMode(mode,originalValue);
  page.setSharedPluginData('ds_contracts','nativeLibraryReplacementClaim','previous-claim');
  const claimed=await f.observe();assert.throws(()=>prepareNativeLibraryReplacement(f.input,claimed),/already-claimed/);
  result=await f.run(f.script,false);assert.equal(result.mutationAttempted,false);
  assert(f.ids().includes(page.id));
});

test('replacement records unknown retirement or creation without attempting an automatic replay',async t=>{
  await t.test('throw after page removal',async sub=>{
    const f=await partialReplacementFixture(sub), tokens=await f.tokens();
    const page=await f.host.figma.getNodeByIdAsync(f.input.creation.pageId), remove=page.remove.bind(page);
    page.remove=()=>{remove();throw Error('injected-removal-result-loss');};
    const result=await f.run(f.script,false);
    assert.equal(result.status,'retirement-unknown');assert.equal(result.mutationAttempted,true);assert.equal(result.creation,null);
    assert.equal(await f.tokens(),tokens);
    const after=f.ids();const repeated=await f.run(f.script,false);
    assert.equal(repeated.mutationAttempted,false);assert.deepEqual(f.ids(),after);
  });
  await t.test('throw before replacement result',async sub=>{
    const f=await partialReplacementFixture(sub), tokens=await f.tokens();
    const result=await f.run(wrapNativeLibraryReplacement(f.recovery,'throw Error("injected-new-writer-loss");'),false);
    assert.equal(result.status,'replacement-creation-unknown');assert.equal(result.mutationAttempted,true);
    assert.equal(result.retiredPageId,f.input.creation.pageId);assert.equal(result.creation,null);
    assert.equal(await f.tokens(),tokens);
  });
});

test('replacement refuses incomplete visibility and unavailable synchronous APIs without mutation',async t=>{
  const f=await partialReplacementFixture(t), before=f.ids(), tokens=await f.tokens();
  f.host.figma.skipInvisibleInstanceChildren=true;
  let observation=await f.observe();
  assert(observation.problems.includes('complete-instance-inventory-unavailable'));
  assert.throws(()=>prepareNativeLibraryReplacement(f.input,observation),/observation-invalid/);
  assert.equal((await f.run(f.script,false)).mutationAttempted,false);
  f.host.figma.skipInvisibleInstanceChildren=false;
  const lookup=f.host.figma.getNodeById;delete f.host.figma.getNodeById;
  observation=await f.observe();
  assert.equal(observation.status,'refused');
  assert.equal((await f.run(f.script,false)).mutationAttempted,false);
  f.host.figma.getNodeById=lookup;
  const protectedRead=await f.run(`figma.getNodeById(${JSON.stringify(f.input.creation.pageId)}).remove();`)
    .then(()=>false,error=>/Read-only run refused/.test(String(error)));
  assert.equal(protectedRead,true,'the actual companion facade rejects document mutation');
  assert.deepEqual(f.ids(),before);assert.equal(await f.tokens(),tokens);
});

test('replacement journal pins a new compiler, requires review, survives restart and keeps the original history',async t=>{
  const f=await partialReplacementFixture(t,true),tokens=await f.tokens();
  const directory=path.join(f.repo,'private/source-native-app/operations',f.id);
  const original=new Map(['operation.json','plan.json','creation.json','component-creation.json','token-create.js',
    ...readdirSync(path.join(directory,'events')).map(n=>'events/'+n)].map(n=>[n,readFileSync(path.join(directory,n))]));
  const adapter=f.options.preparedLibrary!,prepare=adapter.prepare,build=adapter.buildComponent;
  let generation=1;
  adapter.prepare=(...args)=>{const p=prepare(...args);p.plan.plan.limitations.push('test-compiler-'+generation);p.plan.revision=revisionOf(p.plan.plan);return p;};
  adapter.buildComponent=(request,context)=>{
    const original=prepare(request,context.operation),current=adapter.prepare(request,context.operation);
    assert.equal(context.planRevision,current.plan.revision);
    return {...build(request,{...context,planRevision:original.plan.revision}),planRevision:current.plan.revision};
  };
  const claim=()=>{
    const r=f.transport().claim(f.id,f.secret,REACT_NATIVE_FILE_KEY);
    assert.equal(r.status,'command');if(r.status!=='command')throw Error('expected command');return r.command;
  };
  assert.equal(f.reopen().get(f.id).sourceCurrent,false);
  assert.throws(()=>f.transport().applyLibraryReplacement(f.id,'sha256:'+'0'.repeat(64)),/review-required/);
  f.transport().reviewLibraryReplacement(f.id);
  const firstRead=claim(),late=await f.host.run(firstRead);
  f.transport().retryObservation(f.id);
  const next=f.transport().claim(f.id,f.secret,REACT_NATIVE_FILE_KEY,firstRead.attemptId);
  assert.equal(next.status,'command');if(next.status!=='command')throw Error('expected replacement read');
  assert.throws(()=>f.transport().acceptDelivery(f.id,f.secret,late),/correlation-mismatch/);
  f.transport().acceptDelivery(f.id,f.secret,await f.host.run(next.command));
  let view=f.reopen().get(f.id);
  assert.equal(view.phase,'library-replacement-observed',JSON.stringify(view.problems));
  assert.equal(view.libraryReplacement?.nodeCount,f.recovery.observation.content.nodes.length);
  assert.equal(f.transport().claim(f.id,f.secret,REACT_NATIVE_FILE_KEY).status,'finished','review must never auto-apply');
  const priorReview=view.libraryReplacement!.revision;
  generation=2;
  assert.throws(()=>f.transport().applyLibraryReplacement(f.id,priorReview),/source-plan-stale/);
  assert(!readdirSync(directory).includes('library-replacement.json'));
  f.transport().reviewLibraryReplacement(f.id);
  f.transport().acceptDelivery(f.id,f.secret,await f.host.run(claim()));
  view=f.reopen().get(f.id);
  assert.notEqual(view.libraryReplacement!.revision,priorReview,'review binds both native inventory and compiler plan');
  assert.throws(()=>f.transport().applyLibraryReplacement(f.id,priorReview),/review-required/);
  f.transport().applyLibraryReplacement(f.id,view.libraryReplacement!.revision);
  assert(readdirSync(directory).includes('library-replacement.json'));
  assert.throws(()=>f.transport().applyLibraryReplacement(f.id,view.libraryReplacement!.revision),/outcome-unknown/);
  generation=3;assert.throws(()=>f.transport().claim(f.id,f.secret,REACT_NATIVE_FILE_KEY),/source-plan-stale/);
  generation=2;
  const write=claim();assert.equal(write.phase,'library-replacement-apply');
  assert.equal(f.transport().claim(f.id,f.secret,REACT_NATIVE_FILE_KEY).status,'awaiting-result');
  f.transport().begin(f.id,f.secret,write.attemptId);
  const result=await f.host.run(write);
  assert.equal((result.result as any).status,'replacement-executed');
  f.transport().acceptDelivery(f.id,f.secret,result);
  assert.equal(f.reopen().get(f.id).phase,'components-created');
  assert.equal(f.reopen().get(f.id).sourceCurrent,true);
  const read=claim();assert.equal(read.phase,'component-readback');
  const readResult=await f.host.run(read),prepared=adapter.prepare(f.request,f.input.operation);
  const observation=verifyNativeInspectionReadback({operation:f.input.operation,planRevision:prepared.plan.revision,
    component:prepared.plan.plan.component,projection:prepared.plan.plan.projection,
    graphComponents:prepared.plan.plan.graphComponents,graphVerification:2,
    tokenInput:f.input.tokenInput,tokenIdentity:f.input.tokenIdentity,creation:(result.result as any).creation},readResult.result);
  assert.equal(observation.status,'supported-structure-observed',JSON.stringify(observation));
  f.transport().acceptDelivery(f.id,f.secret,readResult);
  assert.equal(f.reopen().get(f.id).phase,'component-structure-observed');
  assert.equal(f.reopen().get(f.id).nativeQualification,'unqualified');
  const after=f.ids(),events=readdirSync(path.join(directory,'events'));
  f.transport().acceptDelivery(f.id,f.secret,result);
  assert.deepEqual(f.ids(),after);assert.deepEqual(readdirSync(path.join(directory,'events')),events);
  assert.equal(await f.tokens(),tokens);
  for(const [name,bytes] of original)assert.deepEqual(readFileSync(path.join(directory,name)),bytes,name);
  assert.throws(()=>f.transport().reviewLibraryReplacement(f.id),/unavailable/);
  assert.throws(()=>f.reopen().dispatch(f.id,'component-create'),/already-dispatched/);
});

test('replacement acknowledgement must retire the exact reviewed physical inventory',async t=>{
  for(const mode of ['original-allocation-ids','extra-node','missing-node'] as const)await t.test(mode,async t=>{
    const f=await partialReplacementFixture(t,true);
    const review=f.reopen().reviewLibraryReplacement(f.id);f.reopen().accept(f.id,await f.host.run(review));
    const write=f.reopen().applyLibraryReplacement(f.id,f.reopen().get(f.id).libraryReplacement!.revision);
    const result=await f.host.run(write),receipt=result.result as any;
    assert.equal(receipt.status,'replacement-executed');
    if(mode==='original-allocation-ids')receipt.retiredNodeIds=f.input.creation.nodes.map((n:any)=>n.id);
    if(mode==='extra-node')receipt.retiredNodeIds.push('unrelated-node');
    if(mode==='missing-node')receipt.retiredNodeIds.pop();
    f.reopen().accept(f.id,result);
    assert.equal(f.reopen().get(f.id).phase,'library-replacement-unknown');
    assert.throws(()=>f.reopen().dispatch(f.id,'component-create'),/already-dispatched|unavailable/);
  });
});

test('replacement claims fail closed when delivery is lost or the journal tail is removed',async t=>{
  const f=await partialReplacementFixture(t);
  const review=f.reopen().reviewLibraryReplacement(f.id);f.reopen().accept(f.id,await f.host.run(review));
  const revision=f.reopen().get(f.id).libraryReplacement!.revision;
  const write=f.reopen().applyLibraryReplacement(f.id,revision);
  const before=f.ids(),tokens=await f.tokens();
  assert.throws(()=>f.reopen().retryObservation(f.id),/observation-retry-refused/);
  assert.throws(()=>f.reopen().reviewLibraryReplacement(f.id),/outcome-unknown/);
  assert.equal(f.reopen().pendingCommand(f.id)!.attemptId,write.attemptId);
  const events=path.join(f.repo,'private/source-native-app/operations',f.id,'events');
  unlinkSync(path.join(events,readdirSync(events).sort().at(-1)!));
  assert.throws(()=>f.reopen().get(f.id),/journal-incomplete/);
  assert.throws(()=>f.reopen().applyLibraryReplacement(f.id,revision),/journal-incomplete/);
  assert.deepEqual(f.ids(),before);assert.equal(await f.tokens(),tokens);
});

test('application routes require the displayed replacement revision and deliver one replacement followed by readback',async t=>{
  const f=await partialReplacementFixture(t),tokens=await f.tokens();
  let service=createReferenceService(f.repo);
  const server=createServer((req,res)=>void service.handle(req,res));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{service.close();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const port=(server.address() as {port:number}).port;
  const send=(route:string,payload:unknown,auth=false)=>new Promise<{status:number;body:any}>((resolve,reject)=>{
    const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/source-reference/'+route,method:'POST',
      headers:{Host:'localhost:5181',Origin:auth?'null':'http://localhost:5181','Content-Type':'application/json',
        ...(auth?{Authorization:'Bearer '+f.secret}:{})}},res=>{
      const chunks:Buffer[]=[];res.on('data',c=>chunks.push(Buffer.from(c)));
      res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(e){reject(e);}});
    });req.on('error',reject);req.end(JSON.stringify(payload));
  });
  const route=`prepared-library/${f.request.artifactId}/native`,selection={mode:'light',brand:'default'};
  assert.equal((await send(route+'/apply-replacement',selection)).status,400);
  assert.equal((await send(route+'/review-replacement',{...selection,script:'injected'})).status,400);
  assert.equal((await send(route+'/review-replacement',selection)).status,202);
  const claim=async()=>{
    const r=await send(`native/${f.id}/claim`,{fileKey:REACT_NATIVE_FILE_KEY,protocol:2},true);
    assert.equal(r.status,200,JSON.stringify(r.body));return r.body;
  };
  const review=await claim();assert.equal(review.command.phase,'library-replacement-readback');
  assert.equal((await send(`native/${f.id}/result`,await f.host.run(review.command),true)).body.status,'result-recorded');
  const revision=f.reopen().get(f.id).libraryReplacement!.revision;
  assert.equal((await claim()).status,'finished');
  service.close();service=createReferenceService(f.repo);
  assert.equal((await send(route+'/apply-replacement',{...selection,reviewRevision:'sha256:'+'0'.repeat(64)})).status,409);
  assert.equal((await send(route+'/apply-replacement',{...selection,reviewRevision:revision})).status,202);
  for(const phase of ['library-replacement-apply','component-readback']) {
    const r=await claim();assert.equal(r.command.phase,phase);
    assert.equal((await send(`native/${f.id}/result`,await f.host.run(r.command),true)).body.status,'result-recorded');
  }
  assert.equal(f.reopen().get(f.id).phase,'component-structure-observed');
  assert.equal(await f.tokens(),tokens);
  assert.equal((await send(route+'/apply-replacement',{...selection,reviewRevision:revision})).status,409);
});

test('an acknowledged retirement failure needs a fresh claimed-page observation before a separately claimed continuation',async t=>{
  const f=await partialReplacementFixture(t),tokens=await f.tokens();
  const page=f.host.figma.getNodeById(f.input.creation.pageId),remove=page.remove.bind(page);
  const inspect=async()=>{
    const command=f.reopen().reviewLibraryReplacement(f.id);
    f.reopen().accept(f.id,await f.host.run(command));return f.reopen().get(f.id);
  };
  let review=await inspect();
  const first=f.reopen().applyLibraryReplacement(f.id,review.libraryReplacement!.revision);
  page.remove=()=>{throw Error('injected-native-removal-refusal');};
  f.reopen().accept(f.id,await f.host.run(first));
  assert.equal(f.reopen().get(f.id).phase,'library-replacement-unknown');
  assert(f.ids().includes(page.id));
  assert.equal(page.getSharedPluginData('ds_contracts','nativeLibraryReplacementClaim'),f.recovery.revision);
  assert.throws(()=>f.reopen().applyLibraryReplacement(f.id,review.libraryReplacement!.revision),/review-required/);
  page.remove=()=>{if(f.host.figma.currentPage.id===page.id)throw Error('current-page-removal-refused');remove();};
  await f.host.figma.setCurrentPageAsync(page);
  const firstRevision=review.libraryReplacement!.revision;
  review=await inspect();
  assert.equal(review.phase,'library-replacement-observed');
  assert.notEqual(review.libraryReplacement!.revision,firstRevision);
  const second=f.reopen().applyLibraryReplacement(f.id,review.libraryReplacement!.revision);
  assert.notEqual(second.attemptId,first.attemptId);
  const result=await f.host.run(second);assert.equal((result.result as any).status,'replacement-executed');
  f.reopen().accept(f.id,result);
  const read=f.reopen().dispatch(f.id,'component-readback');
  assert.equal(f.reopen().accept(f.id,await f.host.run(read)).phase,'component-structure-observed');
  assert.equal(await f.tokens(),tokens);
  const directory=path.join(f.repo,'private/source-native-app/operations',f.id);
  assert.equal(readdirSync(directory).filter(n=>n.startsWith('library-replacement')).length,2);
  const before=f.ids();f.reopen().accept(f.id,result);assert.deepEqual(f.ids(),before);
});

test('stateful root inventory is complete and incomplete birth evidence stays unknown across restarts',async t=>{
  const f = await fixture(t,true), first = f.reopen().prepare(f.request), id = first.id;
  assert.equal(first.counters.variants,4,'two sizes each have Default and Hover');
  for (const phase of ['token-create','token-readback'] as const)
    f.reopen().accept(id,await f.host.run(f.reopen().dispatch(id,phase)));
  const birth = await f.host.run(f.reopen().dispatch(id,'component-create'));
  const original = structuredClone(birth);
  delete (birth.result as any).graphTargets[0].variants;
  const refused = f.reopen().accept(id,birth);
  assert.equal(refused.phase,'component-creation-invalid'); assert.equal(refused.nativeOutcome,'unknown');
  assert.equal(f.reopen().get(id).nativeOutcome,'unknown');
  assert.throws(()=>f.reopen().accept(id,original),/native-operation-result-replay-conflict/);
  assert.throws(()=>f.reopen().retryCreation(id),/creation-retry-refused/);
  assert.throws(()=>f.reopen().dispatch(id,'component-readback'),/component-allocation-identity-unavailable/);
  const baselineDir = path.join(f.repo,'private/source-native-app/baselines');
  unlinkSync(path.join(baselineDir,readdirSync(baselineDir)[0]));
  assert.throws(()=>f.reopen().prepare(f.request),/baseline-reservation-missing/);
});

test('the application HTTP route reopens the retained selection and the actual transport reads every state after a restart',async t=>{
  const f = await fixture(t,true);
  let service = createReferenceService(f.repo);
  const server = createServer((req,res)=>void service.handle(req,res));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{service.close();await new Promise<void>((resolve,reject)=>server.close(error=>error ? reject(error) : resolve()));});
  const port = (server.address() as {port:number}).port;
  const send = (method:string,route:string,payload?:unknown,headers:Record<string,string>={}) => new Promise<{status:number;body:any}>((resolve,reject)=>{
    const req = httpRequest({hostname:'127.0.0.1',port,path:'/api/source-reference/'+route,method,
      headers:{Host:'localhost:5181',Origin:'http://localhost:5181','Content-Type':'application/json',...headers}},res=>{
      const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(Buffer.from(chunk)));
      res.on('end',()=>{try {resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(error){reject(error);}});
    });
    req.on('error',reject);req.end(payload === undefined ? undefined : JSON.stringify(payload));
  });
  const route = `prepared-library/${f.request.artifactId}/native`, selection = {mode:f.request.mode,brand:f.request.brand};
  const selected = route+'?mode=light&brand=default';
  assert.equal((await send('POST',route,selection,{Origin:'https://foreign.invalid'})).status,403);
  assert.equal((await send('POST',route,{...selection,fileKey:'OriginalSourceFile'})).status,400);
  assert.equal((await send('GET',selected)).body.operation,null,'a page read does not reserve an operation');
  const prepared = await send('POST',route,selection);
  assert.equal(prepared.status,202,JSON.stringify(prepared.body));
  const id = prepared.body.operation.id;
  service.close(); service = createReferenceService(f.repo);
  assert.equal((await send('POST',route,selection)).body.operation.id,id);
  assert.equal((await send('GET',selected)).body.operation.counters.variants,4);
  assert.equal((await send('POST',route+'/connection',selection,{Host:'localhost:5182',Origin:'http://localhost:5182'})).status,409);
  const paired = await send('POST',route+'/connection',selection);
  assert.equal(paired.status,200);
  const secret = paired.body.connection.split('.')[1], auth = {Origin:'null',Authorization:'Bearer '+secret};
  assert.equal((await send('POST',route+'/start',selection)).status,202);
  assert.equal((await send('POST',`native/${id}/claim`,{fileKey:'OriginalSourceFile',protocol:2},auth)).status,409);
  for (const phase of ['token-create','token-readback','component-create','component-readback']) {
    const claim = await send('POST',`native/${id}/claim`,{fileKey:REACT_NATIVE_FILE_KEY,protocol:2},auth);
    assert.equal(claim.status,200,JSON.stringify(claim.body));
    const command = claim.body.command; assert.equal(command.phase,phase);
    if (!command.readOnly) assert.equal((await send('POST',`native/${id}/begin`,{attemptId:command.attemptId},auth)).status,200);
    const result = await f.host.run(command);
    if (phase === 'component-create') {
      service.close();service = createReferenceService(f.repo);
      const pending = (await send('GET',selected)).body.operation;
      assert.equal(pending.nativeOutcome,'unknown');
      assert.equal((await send('POST',route,selection)).body.operation.id,id);
      assert.equal((await send('POST',route+'/start',selection)).status,409);
    }
    assert.equal((await send('POST',`native/${id}/result`,result,auth)).body.status,'result-recorded');
    assert.equal((await send('POST',`native/${id}/result`,result,auth)).body.status,'result-recorded');
  }
  const terminal = (await send('GET',selected)).body;
  assert.equal(terminal.operation.phase,'component-structure-observed',JSON.stringify(terminal));
  assert.equal(terminal.operation.counters.sourceCases,0); assert.equal(terminal.connection.finished,true);
  assert.equal('script' in terminal.operation,false); assert.equal('visual' in terminal.operation,false);
  const count = f.host.figma.root.findAll(()=>true).length;
  assert.equal((await send('POST',route,selection)).body.operation.id,id);
  assert.equal((await send('POST',route+'/start',selection)).status,409);
  assert.equal(f.host.figma.root.findAll(()=>true).length,count);
  const original=readFileSync(path.join(f.artifactDir,'input.json'));
  writeFileSync(path.join(f.artifactDir,'input.json'),Buffer.concat([original,Buffer.from('\n')]));
  const stale=await send('GET',selected);
  assert.equal(stale.status,200,'unavailable metadata cannot hide a retained native operation');
  assert.equal(stale.body.operation.id,id);assert.equal(stale.body.operation.sourceCurrent,false);
  assert.equal(stale.body.library,null);
  assert.equal((await send('POST',route,selection)).status,409);
  assert.equal(f.host.figma.root.findAll(()=>true).length,count);
});
