import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {canonicalJson} from '../../../core/contract-provenance.js';
import {nativeFixtureHost} from '../../../source-reference/native-operation-test-fixture.js';
import {preparedLibraryNativeReservation} from '../../../source-reference/prepared-library-native-request.js';
import {prepareNativeSession} from '../src/commands/prepared-native-session.js';
import {servePreparedNative} from '../src/commands/prepared-native-serve.js';
import {preparedNativeCommand} from '../src/commands/prepared-native.js';
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
function fixture(t:test.TestContext) {
 const root=fs.mkdtempSync(path.join(tmpdir(),'prepared-cli-')),source=path.join(root,'input'),out=path.join(root,'session');
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(source);
 const request={rootId:'test.pairing',contracts:[{id:'test.pairing',name:'Pairing',version:'0.1.0',status:'draft',description:'Native pairing journal fixture',props:[],states:[],semantics:{element:'div'},anatomy:{root:{layout:{display:'flex'},parts:{label:{text:'Retained source',declared:{'font-family':'Inter'},tokens:{color:'{ink}'}}}}},bindings:{code:{anchors:{importPath:'test/Pairing',export:'Pairing'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}}],icons:[],tokens:{primitives:{ink:{$type:'color',$value:'#123456'}},semantic:{},light:{},dark:{},brands:{default:{},other:{}}}};
 const bytes=gzipSync(Buffer.alloc(1024)),result={rootId:request.rootId,component:'Pairing',packageName:'test-pairing',tarball:'pairing.tgz',tarballSha256:sha(bytes),requestSha256:sha(canonicalJson(request)),check:{status:'pass'}};
 fs.writeFileSync(path.join(source,'request.json'),JSON.stringify(request));fs.writeFileSync(path.join(source,'result.json'),JSON.stringify(result));fs.writeFileSync(path.join(source,result.tarball),bytes);
 const selection={fileKey:'ssdGtOxIX7GB7h0ra23aIj',mode:'light' as const,brand:'default'};
 return {root,source,out,selection,request,result,prepare:()=>prepareNativeSession(source,out,selection)};
}
test('prepared CLI session pins exact source bytes and refuses corrupt or unchecked inputs before reservation',t=>{
 const f=fixture(t);
 for(const [field,value,reason] of [['check',{status:'not-checked'},'checked-output-required'],['requestSha256','0'.repeat(64),'request-digest-mismatch'],['tarballSha256','0'.repeat(64),'archive-digest-mismatch'],['tarball','../pairing.tgz','archive-name-invalid'],['rootId','test.other','root-mismatch']] as const) {
  fs.writeFileSync(path.join(f.source,'result.json'),JSON.stringify({...f.result,[field]:value}));
  assert.throws(f.prepare,new RegExp(reason));assert.equal(fs.existsSync(f.out),false);
 }
 fs.writeFileSync(path.join(f.source,'result.json'),JSON.stringify(f.result));
 const first=f.prepare(),second=f.prepare();assert.equal(first.id,second.id);
 for(const name of ['request.json','result.json','pairing.tgz']) {
  const file=path.join(f.source,name),before=fs.readFileSync(file);fs.appendFileSync(file,' ');
  assert.throws(f.prepare,/session-input-changed/);fs.writeFileSync(file,before);
 }
 assert.throws(()=>prepareNativeSession(f.source,f.out,{...f.selection,fileKey:'AnotherFile123'}),/session-selection-changed/);
 assert.throws(()=>prepareNativeSession(f.source,f.out,{...f.selection,brand:'other'}),/session-selection-changed/);
 assert.deepEqual(fs.readdirSync(path.join(f.out,'private/source-native-app/operations')),[first.id]);
});
test('prepared CLI resumes delayed acknowledgements despite retained-source drift and never repeats a delivered write',async t=>{
 const f=fixture(t),run=f.prepare(),connection=run.transport.pair(run.id),secret=connection.split('.')[1];run.transport.start(run.id);
 const delivery=run.transport.claim(run.id,secret,f.selection.fileKey,undefined,undefined,2);assert.equal(delivery.status,'command');
 if(delivery.status!=='command')throw Error('command missing');
 run.transport.begin(run.id,secret,delivery.command.attemptId);
 const host=nativeFixtureHost();host.figma.fileKey=f.selection.fileKey;const result=await host.run(delivery.command);
 const session=JSON.parse(fs.readFileSync(path.join(f.out,'session.json'),'utf8'));
 fs.appendFileSync(path.join(f.out,'private/react-library-artifacts',session.request.artifactId,'input.json'),'\n');
 const reopened=f.prepare();assert.equal(reopened.id,run.id);assert.equal(reopened.transport.pair(run.id),connection);
 fs.rmSync(f.source,{recursive:true});
 assert.equal(prepareNativeSession(undefined,f.out,f.selection).id,run.id,'explicit resume needs no external source directory');
 assert.equal(reopened.jobs.get(run.id).sourceCurrent,false);
 assert.throws(()=>reopened.transport.claim(run.id,secret,f.selection.fileKey,undefined,undefined,2),/input-changed/);
 reopened.transport.acceptDelivery(run.id,secret,result);reopened.transport.acceptDelivery(run.id,secret,result);
 assert.equal(reopened.jobs.get(run.id).phase,'tokens-created');
 const next=reopened.transport.claim(run.id,secret,f.selection.fileKey,undefined,undefined,2);assert.equal(next.status,'command');
 if(next.status==='command')assert.equal(next.command.readOnly,true);
 assert.equal(reopened.transport.claim(run.id,secret,'AnotherFile123',undefined,undefined,2).status,'wrong-file');
 assert.deepEqual(fs.readdirSync(path.join(f.out,'private/source-native-app/operations')),[run.id]);
});
test('prepared CLI rejects missing or unsafe history without creating a replacement',t=>{
 const f=fixture(t),run=f.prepare(),manifest=JSON.parse(fs.readFileSync(path.join(f.out,'session.json'),'utf8'));
 const pointer=path.join(f.out,'private/source-native-app/baselines',preparedLibraryNativeReservation(manifest.request)+'.json');
 const before=fs.readFileSync(pointer);fs.unlinkSync(pointer);assert.throws(f.prepare,/session-journal-mismatch/);fs.writeFileSync(pointer,before);
 const file=path.join(f.source,'request.json'),bytes=fs.readFileSync(file);fs.unlinkSync(file);fs.symlinkSync(path.join(f.source,'result.json'),file);assert.throws(f.prepare,/ELOOP/);fs.unlinkSync(file);fs.writeFileSync(file,bytes);
 fs.unlinkSync(path.join(f.out,'session.json'));assert.throws(f.prepare,/session-unrecognized/);
 assert.deepEqual(fs.readdirSync(path.join(f.out,'private/source-native-app/operations')),[run.id]);
});
test('CLI host serves only its authenticated operation and waits for the companion to observe completion',async t=>{
 const f=fixture(t),run=f.prepare();let connected!:(value:string)=>void;
 t.after(()=>{process.emit('SIGINT');});
 const connection=new Promise<string>(resolve=>{connected=resolve;});
 const log=(line:string)=>{const match=/dscn_[a-f0-9-]+\.[a-f0-9]{64}/.exec(line);if(match)connected(match[0]);};
 let serving=servePreparedNative(run,log,26181);
 const pair=await connection,secret=pair.split('.')[1],base='http://127.0.0.1:26181/api/source-reference/native/';
 const post=async(route:string,payload:unknown,auth=secret)=>fetch(base+route,{method:'POST',headers:{origin:'null',connection:'close','content-type':'application/json',authorization:'Bearer '+auth},body:JSON.stringify(payload)});
 assert.equal((await post('00000000-0000-0000-0000-000000000000/claim',{})).status,404);
 assert.equal((await post(run.id+'/claim',{},'0'.repeat(64))).status,403);
 assert.equal((await (await post(run.id+'/claim',{fileKey:'AnotherFile123',protocol:2})).json()).status,'wrong-file');
 const host=nativeFixtureHost();host.figma.fileKey=f.selection.fileKey;
 Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string){this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};};
 const blocked=await (await post(run.id+'/claim',{fileKey:f.selection.fileKey,protocol:2})).json();
 assert.throws(()=>run.jobs.retryCreation(run.id),/creation-retry-refused/);
 assert.equal((await post(run.id+'/begin',{attemptId:blocked.command.attemptId})).status,200);
 const loader=host.figma.loadFontAsync;host.figma.loadFontAsync=async()=>{throw Error('missing');};
 assert.equal((await post(run.id+'/result',await host.run(blocked.command))).status,200);
 assert.equal(run.jobs.get(run.id).phase,'creation-refused');assert.equal(host.collections.length,0);
 await assert.rejects(servePreparedNative(run,()=>{},26181,true),/port-unavailable/);
 assert.equal(run.jobs.get(run.id).phase,'creation-refused','occupied port cannot retry');
 assert.equal((await (await post(run.id+'/claim',{fileKey:f.selection.fileKey,protocol:2})).json()).status,'finished');await serving;
 host.figma.loadFontAsync=loader;
 const retryConnected=new Promise<string>(resolve=>{connected=resolve;});serving=servePreparedNative(run,log,26181,true);
 assert.equal(await retryConnected,pair);
 let lastResult;
 for(const phase of ['token-create','token-readback','component-create','component-readback']) {
  let claimed=await (await post(run.id+'/claim',{fileKey:f.selection.fileKey,protocol:2})).json();assert.equal(claimed.status,'command');assert.equal(claimed.command.phase,phase);
  if(phase==='token-readback') {
   const previous=claimed.command.attemptId;claimed=await (await post(run.id+'/claim',{fileKey:f.selection.fileKey,protocol:2,replaceReadbackAttemptId:previous})).json();
   assert.equal(claimed.command.readOnly,true);assert.notEqual(claimed.command.attemptId,previous);
  }
  if(!claimed.command.readOnly)assert.equal((await post(run.id+'/begin',{attemptId:claimed.command.attemptId})).status,200);
  lastResult=await host.run(claimed.command);assert.equal((await post(run.id+'/result',lastResult)).status,200);
 }
 assert.equal(run.jobs.get(run.id).phase,'component-structure-observed');
 assert.equal((await (await post(run.id+'/claim',{fileKey:f.selection.fileKey,protocol:2})).json()).status,'finished');
 assert.deepEqual(await serving,{interrupted:false});
 const resumed=f.prepare();assert.equal(resumed.id,run.id);assert.equal(resumed.jobs.get(run.id).phase,'component-structure-observed');
 const reconnected=new Promise<string>(resolve=>{connected=resolve;});
 const again=servePreparedNative(resumed,line=>{const match=/dscn_[a-f0-9-]+\.[a-f0-9]{64}/.exec(line);if(match)connected(match[0]);},26181);
 assert.equal(await reconnected,pair);assert.equal((await post(run.id+'/result',lastResult)).status,200);
 assert.deepEqual(await (await post(run.id+'/claim',{fileKey:f.selection.fileKey,protocol:2})).json(),{status:'finished',stopPolling:true});await again;
});
test('a recognized preparing stage finishes the same reservation after interrupted setup',t=>{
 const f=fixture(t),run=f.prepare(),file=path.join(f.out,'session.json'),ready=JSON.parse(fs.readFileSync(file,'utf8'));
 fs.writeFileSync(file,JSON.stringify({...ready,id:null,request:null}));
 assert.throws(()=>prepareNativeSession(undefined,f.out,f.selection),/resume-ready-session-required/);
 assert.equal(f.prepare().id,run.id);
 assert.deepEqual(fs.readdirSync(path.join(f.out,'private/source-native-app/operations')),[run.id]);
});
test('prepared command requires explicit selection and rewrites derived reports despite an abandoned temporary file',async t=>{
 const f=fixture(t),args=['--out',f.out,'--file-key',f.selection.fileKey];
 await assert.rejects(preparedNativeCommand([...args,'--prepared',f.source,'--resume']),/requires --prepared/);
 await assert.rejects(preparedNativeCommand([...args,'--resume','--retry-creation']),/requires --resume --write/);
 assert.equal(await preparedNativeCommand([...args,'--prepared',f.source],()=>{}),0);
 fs.writeFileSync(path.join(f.out,'result.json.tmp'),'interrupted derived report');
 assert.equal(await preparedNativeCommand([...args,'--resume'],()=>{}),0);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.out,'result.json'),'utf8')).operation.phase,'prepared');
});
