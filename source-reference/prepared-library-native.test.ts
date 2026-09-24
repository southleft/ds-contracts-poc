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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t: test.TestContext, statefulRoot = false) {
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
      slot:{slot:{name:'children',defaultContent:[{id:leaf.id,props:{size:'large',label:'Default caller'}}],accepts:[leaf.id]}},
      leaf:{component:{id:leaf.id,props:{shown:true}}}}}},
    bindings:{code:{anchors:{importPath:'test/Panel',export:'Panel'}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-panel-key'}}}};
  const outer = {...panel,id:'test.journal-outer',name:'Outer',anatomy:{root:{layout:{display:'flex'},parts:{panel:{component:{id:panel.id}}}}}};
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
