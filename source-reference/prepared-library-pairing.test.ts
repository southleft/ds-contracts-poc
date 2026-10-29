import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync,unlinkSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {parseLibraryRequest} from '../playground/server/react-library-input.js';
import {retainPreparedReactLibrary} from '../playground/server/react-library-artifact.js';
import {preparedLibraryNativeAdapter} from './prepared-library-native.js';
import {preparedLibraryNativeReservation,type PreparedLibraryNativeRequest} from './prepared-library-native-request.js';
import {createNativeOperationJobs,REACT_NATIVE_FILE_KEY,type NativeOperationJobsOptions} from './native-operation-jobs.js';
import {createNativeOperationTransport} from './native-operation-transport.js';
import {nativeFixtureHost} from './native-operation-test-fixture.js';
import {createReferenceService} from './service.js';

function fixture(t:test.TestContext) {
  const repo=mkdtempSync(path.join(tmpdir(),'prepared-library-pairing-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const input=parseLibraryRequest({rootId:'test.pairing',contracts:[{
    id:'test.pairing',name:'Pairing',version:'0.1.0',status:'draft',description:'Native pairing journal fixture',
    props:[],states:[],semantics:{element:'div'},anatomy:{root:{layout:{display:'flex'},parts:{
      label:{text:'Retained source',declared:{'font-family':'Inter'},tokens:{color:'{ink}'}}}}},
    bindings:{code:{anchors:{importPath:'test/Pairing',export:'Pairing'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}
  }],icons:[],tokens:{primitives:{ink:{$type:'color',$value:'#123456'}},semantic:{},light:{},dark:{},brands:{default:{},other:{}}}});
  // The native adapter verifies retained archive bytes, but never executes the
  // React package. A valid empty tar.gz keeps this journal fixture independent
  // of package installation and browser rendering.
  const bytes=gzipSync(Buffer.alloc(1024)),output={bytes,tarballSha256:createHash('sha256').update(bytes).digest('hex'),filename:'pairing.tgz',name:'test-pairing'};
  const saved=retainPreparedReactLibrary(repo,input,output);
  const request:PreparedLibraryNativeRequest={version:1,kind:'prepared-library-native',artifactId:saved.id,mode:'light',brand:'default'};
  const adapter=preparedLibraryNativeAdapter(repo);let sourceCalls=0;
  const options:NativeOperationJobsOptions={prepare:()=>{throw Error('unexpected other source preparer');},preparedLibrary:{...adapter,
    prepare(request,operation){sourceCalls++;return adapter.prepare(request,operation);}}};
  const jobs=createNativeOperationJobs(repo,options),id=jobs.prepare(request).id;
  sourceCalls=0;
  const directory=path.join(repo,'private/source-native-app/operations',id),pointer=path.join(repo,'private/source-native-app/baselines',preparedLibraryNativeReservation(request)+'.json');
  const services:ReturnType<typeof createReferenceService>[]=[];t.after(()=>services.forEach(s=>s.close()));
  const service=()=>{const s=createReferenceService(repo,undefined,undefined,{},options);services.push(s);return s;};
  return {repo,input,output,request,jobs,id,directory,pointer,artifact:path.join(repo,'private/react-library-artifacts',saved.id),options,
    sourceCalls:()=>sourceCalls,resetCalls:()=>{sourceCalls=0;},service};
}
async function call(service:ReturnType<typeof createReferenceService>,request:PreparedLibraryNativeRequest,action='connection',
  options:{method?:string;payload?:unknown;headers?:Record<string,string>;remote?:string}={}) {
  const method=options.method??'POST',payload=options.payload??{mode:request.mode,brand:request.brand};
  const body=JSON.stringify(payload),route=`/api/source-reference/prepared-library/${request.artifactId}/native`+
    (method==='GET'?`?mode=${request.mode}&brand=${request.brand}`:action?'/'+action:'');
  const req=Readable.from(method==='GET'?[]:[body]);Object.assign(req,{method,url:route,
    headers:{host:'localhost:5181',origin:'http://localhost:5181','content-type':'application/json',...options.headers},
    socket:{remoteAddress:options.remote??'127.0.0.1'}});
  let status=0,text='';
  await service.handle(req as any,{set statusCode(v:number){status=v;},setHeader(){},end(value:string){text=value;}} as any);
  return {status,body:JSON.parse(text)};
}

test('prepared-library pairing reopens a stale source without preparing it or adding journal events',async t=>{
  const f=fixture(t),service=f.service(),file=path.join(f.artifact,'input.json');
  writeFileSync(file,Buffer.concat([readFileSync(file),Buffer.from('\n')]));
  const before=readdirSync(path.join(f.directory,'events'));
  const first=await call(service,f.request),second=await call(service,f.request);
  assert.equal(first.status,200);assert.equal(second.status,200);
  assert.match(first.body.connection,new RegExp('^dscn_'+f.id+'\\.[a-f0-9]{64}$'));
  assert.deepEqual(second.body,first.body);assert.equal(f.sourceCalls(),0);
  assert.deepEqual(readdirSync(path.join(f.directory,'events')),before);
  assert.deepEqual(readdirSync(path.dirname(f.directory)),[f.id]);
  const inspected=await call(service,f.request,'',{method:'GET'});
  assert.equal(inspected.status,200);assert.equal(inspected.body.operation.sourceCurrent,false);
  assert(f.sourceCalls()>0,'GET retains current-source authentication');
  f.resetCalls();const started=await call(service,f.request,'start');
  assert.equal(started.status,409);assert(f.sourceCalls()>0,'start still authenticates source');
  assert.deepEqual(readdirSync(path.join(f.directory,'events')),before);
  assert.throws(()=>f.jobs.dispatch(f.id,'token-create'),/input-changed/);
});

test('pairing selector requires an exact typed request and an existing reservation',t=>{
  const f=fixture(t);
  assert.equal(f.jobs.preparedLibraryPairingOperation(f.request),f.id);
  for(const change of [{artifactId:'../bad'},{mode:'auto'},{brand:'../bad'},{kind:'react-authored-draft'},
    {script:'not accepted'},{version:2}])
    assert.throws(()=>f.jobs.preparedLibraryPairingOperation({...f.request,...change} as any),/request-invalid/);
  for(const key of Object.keys(f.request)){
    const missing:any={...f.request};delete missing[key];
    assert.throws(()=>f.jobs.preparedLibraryPairingOperation(missing),/request-invalid/);
  }
  assert.equal(f.jobs.preparedLibraryPairingOperation({...f.request,brand:'absent'}),null);
  assert.equal(f.sourceCalls(),0);
});

test('redirected reservations cannot pair another valid mode, brand or artifact',t=>{
  const f=fixture(t),original=readFileSync(f.pointer);
  const other=retainPreparedReactLibrary(f.repo,{...f.input,icons:[['other','<svg></svg>']]},f.output);
  for(const request of [{...f.request,mode:'dark' as const},{...f.request,brand:'other'},{...f.request,artifactId:other.id}]){
    const id=f.jobs.prepare(request).id;
    const header=readFileSync(path.join(f.repo,'private/source-native-app/operations',id,'operation.json'));
    writeFileSync(f.pointer,header);f.resetCalls();
    assert.throws(()=>f.jobs.preparedLibraryPairingOperation(f.request),/pairing-request-mismatch/);
    assert.equal(f.sourceCalls(),0);
    writeFileSync(f.pointer,original);
  }
});

test('pairing fails closed for changed pointer, header, plan, script and event files',async t=>{
  const f=fixture(t),service=f.service();
  assert.equal((await call(service,f.request)).status,200,'prime the validated journal memo');
  for(const file of [f.pointer,...['operation.json','plan.json','token-create.js'].map(n=>path.join(f.directory,n))]){
    const before=readFileSync(file);writeFileSync(file,Buffer.concat([before,Buffer.from('tampered')]));
    assert.equal((await call(service,f.request)).status,409,path.basename(file));
    writeFileSync(file,before);
  }
  const extra=path.join(f.directory,'events','unexpected.json');writeFileSync(extra,'{}');
  assert.equal((await call(service,f.request)).status,409);unlinkSync(extra);
  const before=readFileSync(f.pointer);unlinkSync(f.pointer);
  assert.equal((await call(service,f.request)).status,409);writeFileSync(f.pointer,before);
  assert.equal((await call(service,f.request)).status,200);
  assert.equal(f.sourceCalls(),0);
});

test('pairing rejects symbolic links even when the referenced bytes are identical',async t=>{
  const f=fixture(t),service=f.service();
  for(const file of [f.pointer,path.join(f.directory,'plan.json')]){
    const before=readFileSync(file),copy=file+'.copy';writeFileSync(copy,before);unlinkSync(file);symlinkSync(copy,file);
    assert.equal((await call(service,f.request)).status,409);unlinkSync(file);writeFileSync(file,before);unlinkSync(copy);
  }
  assert.equal(f.sourceCalls(),0);
});

test('pairing revalidates native result correlation and changes after operation selection',async t=>{
  const f=fixture(t),host=nativeFixtureHost();host.figma.fileKey=REACT_NATIVE_FILE_KEY;
  const command=f.jobs.dispatch(f.id,'token-create');
  f.jobs.accept(f.id,await host.run(command));f.resetCalls();
  assert.equal(f.jobs.preparedLibraryPairingOperation(f.request),f.id);
  const file=path.join(f.directory,'events','00000001.json'),before=readFileSync(file),event=JSON.parse(before.toString());
  event.envelope.nonce='0'.repeat(64);writeFileSync(file,JSON.stringify(event));
  const transport=createNativeOperationTransport(f.repo,f.jobs);
  assert.throws(()=>transport.pair(f.id),/result-correlation-mismatch/);
  assert.equal(existsSync(path.join(f.repo,'private/source-native-transport',f.id,'connection.json')),false);
  assert.equal((await call(f.service(),f.request)).status,409);
  writeFileSync(file,before);
  assert.equal((await call(f.service(),f.request)).status,200);
  assert.equal(f.sourceCalls(),0);
});

test('a paired and started native write still authenticates source before first delivery',t=>{
  const f=fixture(t),transport=createNativeOperationTransport(f.repo,f.jobs);
  const connection=transport.pair(f.id),secret=connection.split('.')[1];
  transport.start(f.id);
  const command=f.jobs.dispatch(f.id,'token-create');
  assert.equal(command.readOnly,false);
  const file=path.join(f.artifact,'input.json');
  writeFileSync(file,Buffer.concat([readFileSync(file),Buffer.from('\n')]));f.resetCalls();
  assert.throws(()=>transport.claim(f.id,secret,REACT_NATIVE_FILE_KEY),/input-changed/);
  assert(f.sourceCalls()>0);
  assert.equal(existsSync(path.join(f.repo,'private/source-native-transport',f.id,command.attemptId+'.json')),false);
});

test('pairing retains loopback, same-origin, port and request-shape boundaries',async t=>{
  const f=fixture(t),service=f.service();
  const blocked:Array<{remote?:string;headers?:Record<string,string>}>=
    [{remote:'203.0.113.8'},{headers:{origin:'https://foreign.invalid'}},{headers:{host:'foreign.invalid',origin:'http://foreign.invalid'}}];
  for(const options of blocked)
    assert.equal((await call(service,f.request,'connection',options)).status,403);
  assert.equal((await call(service,f.request,'connection',{headers:{host:'localhost:5182',origin:'http://localhost:5182'}})).status,409);
  assert.equal((await call(service,f.request,'connection',{payload:{mode:'light',brand:'default',operationId:f.id}})).status,400);
  assert.equal((await call(service,f.request,'connection',{payload:{mode:'light',brand:'default',script:'injected'}})).status,400);
  assert.equal(existsSync(path.join(f.repo,'private/source-native-transport',f.id,'connection.json')),false);
  assert.equal(f.sourceCalls(),0);
});
