import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chmodSync,closeSync,existsSync,mkdirSync,mkdtempSync,openSync,readFileSync,readdirSync,
  realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createSourceFileTransactions} from './react-source-file-transaction.js';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
function fixture(t:test.TestContext){
  const repo=realpathSync(mkdtempSync(path.join(tmpdir(),'react-source-files-')));t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const root=path.join(repo,'source');mkdirSync(root);
  const source=path.join(root,'control.tsx'),css=path.join(root,'output.css'),peer=path.join(root,'peer.tsx');
  const before=['source before','css before'],after=['source after','css after'];
  writeFileSync(source,before[0]);writeFileSync(css,before[1]);writeFileSync(peer,'untouched');
  let checkpoint:((point:string,index?:number)=>void)|undefined;
  const store=createSourceFileTransactions(repo,{checkpoint:(p,i)=>checkpoint?.(p,i)});
  const args={sourceRoot:root,selectionRevision:'sha256:'+sha('selected review'),
    inputs:{[source]:sha(before[0]),[css]:sha(before[1]),[peer]:sha('untouched')},
    edits:[source,css].map((file,i)=>({file,beforeSha256:sha(before[i]),after:Buffer.from(after[i])}))};
  const state=store.prepare(args),dir=path.join(repo,'private/react-source-file-transactions',state.id);
  const contents=()=>[readFileSync(source,'utf8'),readFileSync(css,'utf8')];
  return {repo,root,source,css,peer,before,after,args,store,id:state.id,dir,contents,
    hook(fn:typeof checkpoint){checkpoint=fn;},fresh:()=>createSourceFileTransactions(repo)};
}

test('source and CSS apply together, repeat without writing, roll back, and preserve old evidence',t=>{
  const f=fixture(t);assert.equal(f.store.prepare(f.args).id,f.id);
  let authenticated=0;const auth=()=>{authenticated++;return undefined;};
  assert.equal(f.store.run(f.id,'apply',auth).phase,'applied');assert.deepEqual(f.contents(),f.after);
  const events=readdirSync(path.join(f.dir,'events'));
  assert.equal(f.fresh().run(f.id,'apply',auth).wrote,false);
  assert.deepEqual(readdirSync(path.join(f.dir,'events')),events);assert.equal(authenticated,2);
  assert.equal(f.fresh().run(f.id,'rollback',auth).phase,'rolled-back');assert.deepEqual(f.contents(),f.before);
  assert.equal(f.fresh().run(f.id,'rollback',auth).wrote,false);
  assert.throws(()=>f.store.run(f.id,'apply',auth),/new-review-required/);
  assert.equal(readFileSync(path.join(f.dir,'files/0/before'),'utf8'),f.before[0]);
  assert.equal(readFileSync(path.join(f.dir,'files/0/after'),'utf8'),f.after[0]);
  assert.equal(readFileSync(f.peer,'utf8'),'untouched');
});

test('every persisted apply boundary can resume after losing the caller result',t=>{
  for(const [point,index] of [['journal-apply',undefined],['journal-file-intent',0],['moved',0],['installed',0],['journal-file-complete',0],
    ['journal-file-intent',1],['moved',1],['installed',1],['journal-file-complete',1],['journal-complete',undefined]] as const){
    const f=fixture(t);let reached=false;
    f.hook((p,i)=>{if(p===point&&i===index){reached=true;throw Error('simulated process loss');}});
    assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/simulated process loss/);assert.equal(reached,true);
    const result=f.fresh().run(f.id,'apply',()=>{});assert.equal(result.phase,'applied');assert.deepEqual(f.contents(),f.after);
    assert.equal(readFileSync(path.join(f.dir,'files/0/held-original'),'utf8'),f.before[0]);
    assert.equal(readFileSync(path.join(f.dir,'files/1/held-original'),'utf8'),f.before[1]);
  }
});

test('rollback resumes at each file boundary and can reverse a source-only application',t=>{
  for(const [point,index] of [['journal-rollback',undefined],['journal-file-intent',0],['moved',0],['installed',0],['journal-file-complete',0],
    ['moved',1],['installed',1],['journal-complete',undefined]] as const){
    const f=fixture(t);f.store.run(f.id,'apply',()=>{});
    f.hook((p,i)=>{if(p===point&&i===index)throw Error('lost rollback');});
    assert.throws(()=>f.store.run(f.id,'rollback',()=>{}),/lost rollback/);
    assert.equal(f.fresh().run(f.id,'rollback',()=>{}).phase,'rolled-back');assert.deepEqual(f.contents(),f.before);
  }
  const f=fixture(t);f.hook((p,i)=>{if(p==='installed'&&i===0)throw Error('lost apply');});
  assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/lost apply/);
  assert.equal(f.fresh().run(f.id,'rollback',()=>{}).phase,'rolled-back');assert.deepEqual(f.contents(),f.before);
});

test('changed source, CSS, inputs, permissions and a failed fresh authority check cannot write',t=>{
  for(const which of ['source','css','peer','mode','authority'] as const){
    const f=fixture(t);
    if(which==='mode')chmodSync(f.source,0o600);
    else if(which!=='authority')writeFileSync(f[which],'owner edit');
    const before=f.contents();
    assert.throws(()=>f.store.run(f.id,'apply',()=>{if(which==='authority')throw Error('fresh canvas changed');}),/conflict|fresh canvas/);
    assert.deepEqual(f.contents(),before);
  }
});

test('an asynchronous authority callback cannot bypass the synchronous write boundary',t=>{
  const f=fixture(t),asyncAssertion=(async()=>{}) as unknown as ()=>undefined;
  assert.throws(()=>f.store.run(f.id,'apply',asyncAssertion),/authentication-must-be-synchronous/);
  assert.deepEqual(f.contents(),f.before);
});

test('edits between the source and CSS installation survive refusal and restart',t=>{
  const f=fixture(t);f.hook((p,i)=>{if(p==='installed'&&i===0)writeFileSync(f.css,'owner CSS');});
  assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/conflict/);
  assert.deepEqual(f.contents(),[f.after[0],'owner CSS']);
  assert.throws(()=>f.fresh().run(f.id,'apply',()=>{}),/conflict/);
  assert.throws(()=>f.fresh().run(f.id,'rollback',()=>{}),/conflict/);
  assert.deepEqual(f.contents(),[f.after[0],'owner CSS']);
});

test('an independently recreated destination is never overwritten',t=>{
  const f=fixture(t);f.hook((p,i)=>{if(p==='moved'&&i===0)writeFileSync(f.source,'new owner file',{flag:'wx'});});
  assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/destination-conflict/);
  assert.equal(readFileSync(f.source,'utf8'),'new owner file');
  assert.equal(readFileSync(path.join(f.dir,'files/0/held-original'),'utf8'),f.before[0]);
  assert.equal(f.fresh().inspect(f.id).phase,'conflict');
});

test('an editor restoring the old bytes into a moved path still owns that replacement',t=>{
  const f=fixture(t);f.hook((p,i)=>{if(p==='moved'&&i===0)throw Error('stopped');});
  assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/stopped/);
  writeFileSync(f.source,f.before[0],{flag:'wx'});
  assert.ok(f.fresh().inspect(f.id).problems.includes('source-recreated:0'));
  assert.throws(()=>f.fresh().run(f.id,'apply',()=>{}),/conflict/);assert.deepEqual(f.contents(),f.before);
});

test('an open-descriptor edit racing the move is retained and restored to the empty source path',t=>{
  const f=fixture(t),fd=openSync(f.source,'r+');t.after(()=>closeSync(fd));
  f.hook((p,i)=>{if(p==='moved'&&i===0)writeFileSync(fd,'owner changed');});
  assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/held-file-conflict/);
  assert.equal(readFileSync(f.source,'utf8'),'owner changed');assert.equal(readFileSync(f.css,'utf8'),f.before[1]);
});

test('missing or mutated journals and immutable evidence refuse',t=>{
  for(const mode of ['manifest','before','after','journal'] as const){
    const f=fixture(t);
    if(mode==='manifest')writeFileSync(path.join(f.dir,'transaction.json'),'{}');
    else if(mode==='journal'){
      f.hook(p=>{if(p==='journal-apply')throw Error('stop');});assert.throws(()=>f.store.run(f.id,'apply',()=>{}));
      const file=path.join(f.dir,'events/00000000.json'),entry=JSON.parse(readFileSync(file,'utf8'));entry.kind='complete';writeFileSync(file,JSON.stringify(entry));
    }else writeFileSync(path.join(f.dir,'files/0',mode),'tampered');
    assert.throws(()=>f.fresh().run(f.id,'apply',()=>{}),/manifest|evidence|journal/);assert.deepEqual(f.contents(),f.before);
  }
});

test('another live writer blocks and a dead-process lock is preserved during recovery',t=>{
  for(const alive of [true,false]){
    const f=fixture(t),root=path.join(f.repo,'private/react-source-file-transactions/locks',sha(f.root));
    mkdirSync(path.join(root,'00000000'),{recursive:true});
    writeFileSync(path.join(root,'00000000/owner.json'),JSON.stringify({pid:alive?process.pid:2147483647,nonce:'test-lock'}));
    if(alive){assert.throws(()=>f.store.run(f.id,'apply',()=>{}),/writer-already-running/);assert.deepEqual(f.contents(),f.before);}
    else{assert.equal(f.store.run(f.id,'apply',()=>{}).phase,'applied');assert.equal(JSON.parse(readFileSync(path.join(root,'00000001/owner.json'),'utf8')).priorLost,true);}
  }
});

test('a later reviewed transaction can change an installed source without mutating earlier blobs',t=>{
  const f=fixture(t);f.store.run(f.id,'apply',()=>{});
  const next=f.store.prepare({...f.args,selectionRevision:'sha256:'+sha('second review'),
    inputs:{...f.args.inputs,[f.source]:sha(f.after[0]),[f.css]:sha(f.after[1])},
    edits:[{file:f.source,beforeSha256:sha(f.after[0]),after:Buffer.from('source third')}]});
  assert.equal(f.store.run(next.id,'apply',()=>{}).phase,'applied');assert.equal(readFileSync(f.source,'utf8'),'source third');
  assert.equal(readFileSync(path.join(f.dir,'files/0/after'),'utf8'),f.after[0]);
});

test('symlink targets and paths outside the selected root refuse before any write',t=>{
  const f=fixture(t),outside=path.join(f.repo,'outside.tsx');writeFileSync(outside,'outside');
  assert.throws(()=>f.store.prepare({...f.args,inputs:{[outside]:sha('outside')},edits:[{file:outside,beforeSha256:sha('outside'),after:Buffer.from('bad')}]}),/selection-invalid/);
  const link=path.join(f.root,'alias.tsx');symlinkSync(outside,link);
  assert.throws(()=>f.store.prepare({...f.args,inputs:{[link]:sha('outside')},edits:[{file:link,beforeSha256:sha('outside'),after:Buffer.from('bad')}]}),/file-type/);
  assert.equal(readFileSync(outside,'utf8'),'outside');assert.ok(existsSync(f.source));
});

test('actual process death between rename and installation leaves recoverable evidence',t=>{
  for(const direction of ['apply','rollback'] as const){
    const f=fixture(t);if(direction==='rollback')f.store.run(f.id,'apply',()=>{});
    const module=new URL('./react-source-file-transaction.ts',import.meta.url).href;
    const script=`import {createSourceFileTransactions} from ${JSON.stringify(module)};
      const store=createSourceFileTransactions(${JSON.stringify(f.repo)},{checkpoint(point,index){
        if(point==='moved'&&index===0)process.kill(process.pid,'SIGKILL');
      }});store.run(${JSON.stringify(f.id)},${JSON.stringify(direction)},()=>{});`;
    const child=spawnSync(process.execPath,[...process.execArgv,'--input-type=module','-e',script],{encoding:'utf8',timeout:15000});
    assert.equal(child.signal,'SIGKILL',child.stderr);assert.equal(existsSync(f.source),false);
    const resumed=f.fresh().run(f.id,direction,()=>{});
    assert.equal(resumed.phase,direction==='apply'?'applied':'rolled-back');
    assert.deepEqual(f.contents(),direction==='apply'?f.after:f.before);
    const lockRoot=path.join(f.repo,'private/react-source-file-transactions/locks',sha(f.root));
    assert.ok(readdirSync(lockRoot).filter(n=>/^\d{8}$/.test(n)).some(n=>JSON.parse(readFileSync(path.join(lockRoot,n,'owner.json'),'utf8')).priorLost));
  }
});

test('two simultaneous dead-writer recoveries cannot replace each other’s lock',async t=>{
  const f=fixture(t),locks=path.join(f.repo,'private/react-source-file-transactions/locks',sha(f.root));
  mkdirSync(path.join(locks,'00000000'),{recursive:true});
  writeFileSync(path.join(locks,'00000000/owner.json'),JSON.stringify({pid:2147483647,nonce:'dead-writer'}));
  const module=new URL('./react-source-file-transaction.ts',import.meta.url).href;
  const children=[0,1].map(index=>{
    const script=`import {createSourceFileTransactions} from ${JSON.stringify(module)};
      import {existsSync,writeFileSync} from 'node:fs';
      const ready=${JSON.stringify([path.join(f.repo,'ready-0'),path.join(f.repo,'ready-1')])};
      const store=createSourceFileTransactions(${JSON.stringify(f.repo)},{checkpoint(point){
        if(point!=='before-lock-publish')return;
        writeFileSync(ready[${index}],'ready',{flag:'wx'});
        const deadline=Date.now()+5000;
        while(!ready.every(file=>existsSync(file))){
          if(Date.now()>deadline)throw Error('test-barrier-timeout');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2);
        }
      }});
      try{const result=store.run(${JSON.stringify(f.id)},'apply',()=>{});console.log(JSON.stringify({phase:result.phase,wrote:result.wrote}));}
      catch(error){console.log(JSON.stringify({error:error.message}));}`;
    return promisify(execFile)(process.execPath,[...process.execArgv,'--input-type=module','-e',script],{timeout:15000});
  });
  const results=(await Promise.all(children)).map(result=>JSON.parse(result.stdout));
  assert.equal(results.filter(r=>r.phase==='applied'&&r.wrote===true).length,1);
  assert.equal(results.filter(r=>r.error==='react-source-transaction-writer-already-running').length,1);
  assert.deepEqual(f.contents(),f.after);assert.equal(f.fresh().inspect(f.id).phase,'applied');
});
