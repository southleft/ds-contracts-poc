import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, watch, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {
  DRIFT_STDERR_LIMIT_BYTES,
  parseDriftWorkers,
  isDriftProcessFailure,
  runDriftLibraryJobs,
  validateDriftOutputRoots,
  type DriftLibraryJob,
} from './drift-library-runs.js';

// Actual children, controlled by files: no sleep, performance threshold, or mocked spawn.
const childSource = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const [root, control, name, mode, value] = process.argv.slice(2);
fs.mkdirSync(root, {recursive:true});
fs.writeFileSync(path.join(root, 'started'), name);
if (mode === 'barrier') {
  const event = type => fs.appendFileSync(path.join(control, 'events'), JSON.stringify({type,name})+'\n');
  event('start');
  const release = path.join(control, name+'.release');
  let done = false;
  const finish = () => {
    if (done || !fs.existsSync(release)) return;
    done = true;
    watcher.close();
    fs.writeFileSync(path.join(root, 'result'), name);
    event('end');
  };
  const watcher = fs.watch(control, finish);
  finish();
} else if (mode === 'exit') {
  fs.writeFileSync(path.join(root, 'result'), name);
  process.stderr.write('REFUSED '+name+': owned by '+name+'\n');
  process.exitCode = Number(value);
} else if (mode === 'signal') {
  process.stderr.write('REFUSED '+name+': signal is still a hard failure\n');
  process.kill(process.pid, 'SIGTERM');
} else if (mode === 'overflow') {
  // Continue until the parent enforces its fixed cap. Keep the event loop alive
  // after writing so a successful early exit cannot hide the termination path.
  process.stderr.on('error', () => {});
  const chunk = Buffer.alloc(1024*1024, 'x');
  let remaining = Number(value);
  const send = () => {
    while (remaining > 0) {
      const current = chunk.subarray(0, Math.min(chunk.length, remaining));
      remaining -= current.length;
      if (!process.stderr.write(current)) { process.stderr.once('drain', send); return; }
    }
    setInterval(() => {}, 1000);
  };
  send();
}
`;

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'drift-library-runs-'));
  const control = path.join(root, 'control');
  const scratch = path.join(root, 'scratch');
  mkdirSync(control); mkdirSync(scratch);
  const script = path.join(root, 'child.cjs');
  writeFileSync(script, childSource);
  const job = (name: string, mode = 'exit', value = '0'): DriftLibraryJob => ({
    name, command: process.execPath, cwd: root,
    outputRoot: path.join(scratch, name),
    args: [script, path.join(scratch, name), control, name, mode, value],
  });
  return {root, control, scratch, job, close: () => rmSync(root, {recursive:true, force:true})};
}

function waitFor(directory: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let watcher: ReturnType<typeof watch>;
    const stop = () => { clearTimeout(watchdog); watcher.close(); };
    const check = () => { if (ready()) { stop(); resolve(); } };
    // A deadlock watchdog, not a required runtime or performance assertion.
    const watchdog = setTimeout(() => { stop(); reject(Error('child coordination did not complete')); }, 15000);
    watcher = watch(directory, check);
    check();
  });
}

for (const workers of [1, 2] as const) {
  test(`actual children respect ${workers} worker(s), complete every job, and retain input order`, {timeout:25000}, async () => {
    const f = fixture();
    const jobs = ['a','b','c','d'].map(name => f.job(name, 'barrier'));
    // Watch one common directory; each child also records its own output ownership.
    const events = () => existsSync(path.join(f.control,'events'))
      ? readFileSync(path.join(f.control,'events'),'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as {type:string; name:string}) : [];
    const started = (name:string) => events().some(event => event.type === 'start' && event.name === name);
    const ended = (name:string) => events().some(event => event.type === 'end' && event.name === name);
    const release = (name:string) => writeFileSync(path.join(f.control,`${name}.release`),'go');
    validateDriftOutputRoots(f.scratch,jobs);
    const completed: Array<{name:string; index:number}> = [];
    const running = runDriftLibraryJobs(jobs, workers, (result,index) => {
      completed.push({name:result.name,index});
      // Progress is diagnostic: callback mutation/throws cannot change scores
      // or stop the remaining queue. The readonly cast models an untyped caller.
      (result as {status:number|null}).status = 99;
      if (result.name === 'b') throw Error('progress observer failed');
    });
    try {
      if (workers === 2) {
        await waitFor(f.control, () => started('a') && started('b'));
        // Hold a while the other worker executes b, c, d, forcing completion
        // order to differ from the returned configuration order.
        for (const name of ['b','c','d']) {
          await waitFor(f.control, () => started(name));
          release(name);
          await waitFor(f.control, () => ended(name));
        }
        release('a');
      } else {
        for (const name of ['a','b','c','d']) {
          await waitFor(f.control, () => started(name));
          release(name);
          await waitFor(f.control, () => ended(name));
        }
      }
      const results = await running;
      assert.deepEqual(results.map(result => result.name), ['a','b','c','d']);
      assert.deepEqual(results.map(result => result.outputRoot), jobs.map(job => job.outputRoot));
      for (const result of results) {
        assert.equal(result.status,0); assert.equal(result.signal,null); assert.equal(result.error,null);
        assert.equal(result.stderr,''); assert.equal(result.stderrOverflow,false);
        assert(Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0);
        assert.equal(readFileSync(path.join(result.outputRoot,'result'),'utf8'), result.name);
      }
      const active = new Set<string>();
      let peak = 0;
      for (const event of events()) {
        if (event.type === 'start') { assert(!active.has(event.name)); active.add(event.name); }
        else { assert(active.delete(event.name)); }
        peak = Math.max(peak,active.size);
        assert(active.size <= workers,`active children exceeded ${workers}`);
      }
      assert.equal(peak,workers); assert.equal(active.size,0);
      assert.equal(events().filter(event => event.type === 'end').length,4);
      const completionOrder = workers === 2 ? ['b','c','d','a'] : ['a','b','c','d'];
      assert.deepEqual(completed.map(item => item.name),completionOrder);
      assert.deepEqual(completed.map(item => item.index),completionOrder.map(name => jobs.findIndex(job => job.name === name)));
      assert.deepEqual(events().filter(event => event.type === 'end').map(event => event.name),completionOrder);
    } finally {
      for (const job of jobs) release(job.name);
      await running;
      f.close();
    }
  });
}

test('exit 0, 1, and 2 retain their own refusal stderr and do not skip later jobs', async () => {
  const f = fixture();
  try {
    const jobs = [0,1,2,0].map((status,index) => f.job(`job${index}`,'exit',String(status)));
    const results = await runDriftLibraryJobs(jobs,2);
    assert.deepEqual(results.map(result => result.status),[0,1,2,0]);
    for (const [index,result] of results.entries()) {
      assert.equal(result.name,`job${index}`);
      assert.equal(result.stderr,`REFUSED job${index}: owned by job${index}\n`);
      assert.equal(result.error,null); assert.equal(result.signal,null); assert.equal(result.stderrOverflow,false);
      assert.equal(readFileSync(path.join(result.outputRoot,'result'),'utf8'),result.name);
    }
  } finally { f.close(); }
});

test('spawn error and signal remain hard failures beside named refusals, and later jobs run', async () => {
  const f = fixture();
  try {
    const missing = {...f.job('missing'),command:path.join(f.root,'no-such-executable')};
    const results = await runDriftLibraryJobs([missing,f.job('signal','signal'),f.job('later')],2);
    assert.match(results[0].error ?? '',/ENOENT/);
    assert.notEqual(results[0].status,0);
    assert.equal(results[1].signal,'SIGTERM'); assert.equal(results[1].status,null);
    assert.match(results[1].stderr,/^REFUSED signal:/);
    assert.equal(results[2].status,0);
    assert.equal(readFileSync(path.join(results[2].outputRoot,'result'),'utf8'),'later');
  } finally { f.close(); }
});

test('stderr overflow is capped, terminates that child, and preserves subsequent jobs', {timeout:25000}, async () => {
  const f = fixture();
  try {
    const results = await runDriftLibraryJobs([f.job('overflow','overflow',String(DRIFT_STDERR_LIMIT_BYTES+1)),f.job('later')],1);
    assert.equal(results[0].stderrOverflow,true);
    assert.match(results[0].error ?? '',/stderr exceeded/);
    assert.equal(Buffer.byteLength(results[0].stderr),DRIFT_STDERR_LIMIT_BYTES);
    assert.equal(results[0].signal,'SIGTERM'); assert.equal(results[0].status,null);
    assert.equal(results[1].status,0);
    assert.equal(readFileSync(path.join(results[1].outputRoot,'result'),'utf8'),'later');
  } finally { f.close(); }
});

test('output roots reject duplicates, nesting, case collisions, symlink aliases, and escapes before spawning', async () => {
  const f = fixture();
  try {
    const rootJob = (name:string, outputRoot:string) => ({...f.job(name),outputRoot});
    const a = path.join(f.scratch,'a');
    const invalid = [
      [rootJob('a',a),rootJob('duplicate',path.join(a,'.'))],
      [rootJob('a',a),rootJob('nested',path.join(a,'child'))],
      [rootJob('a',a),rootJob('case',path.join(f.scratch,'A'))],
      [rootJob('a',a),rootJob('case-nested',path.join(f.scratch,'A','child'))],
    ];
    for (const jobs of invalid) {
      assert.throws(() => validateDriftOutputRoots(f.scratch,jobs),/overlapping/);
      await assert.rejects(runDriftLibraryJobs(jobs,2),/overlapping/);
      assert(!existsSync(a));
    }
    for (const escaped of [f.scratch, path.join(f.root,'outside'), path.join(f.scratch,'..','outside')])
      assert.throws(() => validateDriftOutputRoots(f.scratch,[rootJob('escape',escaped)]),/strictly inside/);
    mkdirSync(a);
    const alias = path.join(f.scratch,'alias');
    symlinkSync(a,alias,'dir');
    const aliases = [rootJob('a',a),rootJob('alias',alias)];
    assert.throws(() => validateDriftOutputRoots(f.scratch,aliases),/overlapping/);
    await assert.rejects(runDriftLibraryJobs(aliases,2),/overlapping/);
    assert.throws(() => validateDriftOutputRoots(f.scratch,[rootJob('a',a),rootJob('alias-child',path.join(alias,'child'))]),/overlapping/);
    const outsideAlias = path.join(f.scratch,'outside-alias');
    symlinkSync(f.control,outsideAlias,'dir');
    assert.throws(() => validateDriftOutputRoots(f.scratch,[rootJob('escape',outsideAlias)]),/strictly inside/);
    const dangling = path.join(f.scratch,'dangling');
    symlinkSync(path.join(f.root,'absent'),dangling,'dir');
    assert.throws(() => validateDriftOutputRoots(f.scratch,[rootJob('dangling',dangling)]),/symlink/);
    const scratchAlias = path.join(f.root,'scratch-alias'); symlinkSync(f.scratch,scratchAlias,'dir');
    assert.throws(() => validateDriftOutputRoots(scratchAlias,[rootJob('a',a)]),/scratch.*symlink/);
    validateDriftOutputRoots(f.scratch,[rootJob('a',a),rootJob('ab',path.join(f.scratch,'ab'))]);
    assert(!existsSync(path.join(a,'started')));
    await assert.rejects(runDriftLibraryJobs([f.job('invalid')],3 as 1),/workers/);
    assert(!existsSync(path.join(f.scratch,'invalid')));
    assert.deepEqual(await runDriftLibraryJobs([],2),[]);
  } finally { f.close(); }
});

test('workers CLI defaults to serial and accepts exact 1 or 2 only in read-only remeasure mode', () => {
  for (const mode of [{remeasure:false,write:false},{remeasure:true,write:false},{remeasure:true,write:true}])
    assert.equal(parseDriftWorkers([],mode),1);
  const mode = {remeasure:true,write:false};
  for (const workers of ['1','2'] as const) {
    assert.equal(parseDriftWorkers(['--workers',workers],mode),Number(workers));
    assert.equal(parseDriftWorkers([`--workers=${workers}`],mode),Number(workers));
  }
  for (const value of ['','0','3','-1','01','1.0','2.0','NaN','Infinity',' 2','2 ','2x'])
    for (const args of [['--workers',value],[`--workers=${value}`]])
      assert.throws(() => parseDriftWorkers(args,mode),/exactly 1 or 2/);
  for (const args of [['--workers'],['--workers','--other'],['--workers','1','--workers=2'],['--workers=2','--workers','1'],['--workers=1','--workers=1']])
    assert.throws(() => parseDriftWorkers(args,mode));
  for (const forbidden of [{remeasure:false,write:false},{remeasure:true,write:true},{remeasure:false,write:true}])
    for (const args of [['--workers','1'],['--workers=2']])
      assert.throws(() => parseDriftWorkers(args,forbidden),/only with --remeasure, without --write/);
});


test('only ordinary success or exit 1 with a named refusal can avoid process-level failure', () => {
  const clean = {status:0, signal:null, error:null, stderrOverflow:false};
  assert.equal(isDriftProcessFailure(clean,false),false);
  assert.equal(isDriftProcessFailure(clean,true),false);
  assert.equal(isDriftProcessFailure({...clean,status:1},true),false);
  assert.equal(isDriftProcessFailure({...clean,status:1},false),true);
  for (const status of [2,3,-1,null])
    for (const named of [false,true])
      assert.equal(isDriftProcessFailure({...clean,status},named),true);
  for (const status of [0,1,null]) {
    assert.equal(isDriftProcessFailure({...clean,status,signal:'SIGTERM'},true),true);
    assert.equal(isDriftProcessFailure({...clean,status,stderrOverflow:true},true),true);
    assert.equal(isDriftProcessFailure({...clean,status,error:'spawn ENOENT'},true),true);
  }
});
