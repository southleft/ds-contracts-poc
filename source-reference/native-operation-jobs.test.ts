import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { revisionOf } from "../core/contract-provenance.js";
import {
  createNativeOperationJobs,
  SOURCE_NATIVE_FILE_KEY,
  type NativeOperationJobsOptions,
  type NativeOperationResult,
} from "./native-operation-jobs.js";
import {
  nativeFixtureHost,
  nativeFixturePreparation,
  nativeFixturePrepare,
  nativeFixtureRequest as request,
} from "./native-operation-test-fixture.js";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
function fixture(
  t: test.TestContext,
  prepare: NativeOperationJobsOptions["prepare"] = nativeFixturePrepare,
  buildComponent?: NativeOperationJobsOptions["buildComponent"],
) {
  const repo = mkdtempSync(path.join(tmpdir(), "native-journal-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const reopen = () =>
    createNativeOperationJobs(repo, { prepare, buildComponent });
  const jobs = reopen(),
    snapshot = jobs.prepare(request);
  const directory = path.join(
    repo,
    "private/source-native-app/operations",
    snapshot.id,
  );
  const event = (sequence: number) =>
    path.join(directory, "events", `${String(sequence).padStart(8, "0")}.json`);
  const inventory = () => {
    const out: Record<string, string> = {};
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(target);
        else out[path.relative(repo, target)] = sha(readFileSync(target));
      }
    };
    walk(repo);
    return out;
  };
  return { repo, jobs, reopen, snapshot, directory, event, inventory };
}
async function created(t: test.TestContext) {
  const f = fixture(t),
    host = nativeFixtureHost();
  const command = f.jobs.dispatch(f.snapshot.id, "token-create");
  const result = await host.run(command);
  assert.equal(result.result.status, "created-candidate");
  assert.equal(f.jobs.accept(f.snapshot.id, result).phase, "tokens-created");
  return { ...f, host, command, result };
}

test('display snapshots reuse checked reads but cannot authorize writes or leak into later requests', t => {
  let calls=0,stale=false;
  const f=fixture(t,(request,operation)=>{calls++;if(stale)throw Error('source changed');return nativeFixturePrepare(request,operation);});
  const id=f.snapshot.id,before=f.inventory();calls=0;
  f.jobs.withReadSnapshot(()=>{
    const first=f.jobs.get(id);assert.equal(first.sourceCurrent,true);
    first.counters.variables=999;
    stale=true;
    const second=f.jobs.withReadSnapshot(()=>f.jobs.get(id));
    assert.equal(second.sourceCurrent,true);assert.notEqual(second.counters.variables,999);
    for(const write of [()=>f.jobs.prepare(request),()=>f.jobs.dispatch(id,'token-create'),
      ()=>f.jobs.pendingCommand(id),()=>f.jobs.accept(id,{} as NativeOperationResult),
      ()=>f.jobs.retryObservation(id),()=>f.jobs.retryCreation(id)])
      assert.throws(write,/write-during-read-snapshot/);
  });
  assert.equal(calls,1);assert.deepEqual(f.inventory(),before);
  assert.equal(f.jobs.get(id).sourceCurrent,false);assert.equal(calls,2);
  assert.throws(()=>f.jobs.dispatch(id,'token-create'),/source changed/);
  assert.deepEqual(f.inventory(),before);
  stale=false;
  assert.throws(()=>f.jobs.withReadSnapshot(()=>{f.jobs.get(id);throw Error('display failed')}),/display failed/);
  stale=true;assert.equal(f.jobs.get(id).sourceCurrent,false);
  assert.throws(()=>f.jobs.withReadSnapshot(()=>Promise.resolve()),/async-read-snapshot/);
  stale=false;assert.equal(f.jobs.get(id).sourceCurrent,true);
});

test('display caching retains the fresh journal check during source authentication',t=>{
  let change: (()=>void)|undefined;
  const f=fixture(t,(request,operation)=>{change?.();change=undefined;return nativeFixturePrepare(request,operation);});
  const file=path.join(f.directory,'operation.json');
  change=()=>{const header=JSON.parse(readFileSync(file,'utf8'));header.startedAt='2025-01-01T00:00:00.000Z';writeFileSync(file,JSON.stringify(header));};
  assert.equal(f.jobs.withReadSnapshot(()=>f.jobs.get(f.snapshot.id)).sourceCurrent,false);
});

test("private token accessor requires independent observation and returns isolated host context", async (t) => {
  const f = await created(t);
  assert.throws(
    () => f.jobs.verifiedTokenContext(f.snapshot.id),
    /verified-token-observation-required/,
  );
  const command = f.jobs.dispatch(f.snapshot.id, "token-readback");
  assert.throws(
    () => f.jobs.verifiedTokenContext(f.snapshot.id),
    /verified-token-observation-required/,
  );
  const result = await f.host.run(command);
  f.jobs.accept(f.snapshot.id, result);
  const before = f.inventory();
  const context = f.reopen().verifiedTokenContext(f.snapshot.id);
  assert.equal(context.operation.id, f.snapshot.id);
  assert.equal(context.operation.fileKey, SOURCE_NATIVE_FILE_KEY);
  assert.equal(context.planRevision, command.planRevision);
  assert.equal(context.tokens.identity.origin, "created");
  assert.deepEqual(context.tokens.receipt, (result.result as any).receipt);
  context.tokens.identity.variables[0].id = "edited-return-value";
  assert.notEqual(
    f.reopen().verifiedTokenContext(f.snapshot.id).tokens.identity.variables[0]
      .id,
    "edited-return-value",
  );
  assert.deepEqual(f.inventory(), before);
  const publicSnapshot = JSON.stringify(f.jobs.get(f.snapshot.id));
  assert(!publicSnapshot.includes("journalRevision"));
  assert(!publicSnapshot.includes("receipt"));
  assert(!publicSnapshot.includes("fileKey"));
});

test("private token accessor refuses a previously successful observation when source changes", async (t) => {
  let stale = false;
  const f = fixture(t, (...args) => {
    if (stale) throw Error("source changed");
    return nativeFixturePrepare(...args);
  });
  const host = nativeFixtureHost();
  for (const phase of ["token-create", "token-readback"] as const) {
    const command = f.jobs.dispatch(f.snapshot.id, phase);
    f.jobs.accept(f.snapshot.id, await host.run(command));
  }
  assert.equal(f.jobs.get(f.snapshot.id).phase, "tokens-observed");
  stale = true;
  assert.throws(
    () => f.jobs.verifiedTokenContext(f.snapshot.id),
    /source changed/,
  );
});

test("prepare and reopen retain one operation, exact pins and all historical bytes", (t) => {
  const f = fixture(t),
    before = f.inventory();
  assert.equal(f.snapshot.phase, "prepared");
  assert.deepEqual(f.snapshot.counters, {
    variants: 1,
    sourceCases: 2,
    loweredCases: 1,
    variables: 3,
  });
  assert.deepEqual(f.reopen().prepare(request), f.snapshot);
  assert.deepEqual(f.jobs.get(f.snapshot.id), f.snapshot);
  assert.deepEqual(f.inventory(), before);
  const serialized = JSON.stringify(f.snapshot);
  for (const secret of [
    f.directory,
    "tokenInput",
    "fileKey",
    "nonce",
    "script",
    "reportSha256",
  ])
    assert.ok(!serialized.includes(secret));
  const header = JSON.parse(
    readFileSync(path.join(f.directory, "operation.json"), "utf8"),
  );
  assert.equal(header.policy.fileKey, SOURCE_NATIVE_FILE_KEY);
  assert.equal(header.visual.reportSha256, "d".repeat(64));
});

test("dispatch is persisted before delivery and a restart never reissues creation", (t) => {
  const f = fixture(t);
  const command = f.jobs.dispatch(f.snapshot.id, "token-create");
  const saved = JSON.parse(readFileSync(f.event(0), "utf8"));
  assert.deepEqual(saved.command, command);
  assert.equal(command.scriptSha256, sha(command.script));
  assert.equal(command.readOnly, false);
  assert.match(command.nonce, /^[a-f0-9]{64}$/);
  const restarted = f.reopen();
  assert.equal(restarted.get(f.snapshot.id).nativeOutcome, "unknown");
  assert.throws(
    () => restarted.dispatch(f.snapshot.id, "token-create"),
    /native-outcome-unknown/,
  );
  assert.throws(
    () => restarted.dispatch(f.snapshot.id, "token-readback"),
    /native-outcome-unknown/,
  );
});

test("actual shared writer acknowledgement survives restart and only independent readback observes tokens", async (t) => {
  const f = await created(t),
    first = f.inventory();
  assert.equal(f.reopen().get(f.snapshot.id).phase, "tokens-created");
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "token-create"),
    /creation-already-dispatched/,
  );
  assert.equal(f.jobs.accept(f.snapshot.id, f.result).phase, "tokens-created");
  assert.deepEqual(f.inventory(), first);
  const read = f.reopen().dispatch(f.snapshot.id, "token-readback");
  assert.equal(read.readOnly, true);
  assert.notEqual(read.nonce, f.command.nonce);
  const snapshot = f.reopen().accept(f.snapshot.id, await f.host.run(read));
  assert.equal(snapshot.phase, "tokens-observed");
  assert.equal(snapshot.acceptedContract, null);
  assert.equal(snapshot.nativeQualification, "unqualified");
  assert.equal(f.host.collections.length, 1);
  assert.equal(f.host.variables.length, 3);
  // A second independently observed pass creates no further native objects.
  const repeat = f.jobs.dispatch(f.snapshot.id, "token-readback");
  assert.equal(
    f.jobs.accept(f.snapshot.id, await f.host.run(repeat)).phase,
    "tokens-observed",
  );
  assert.equal(f.host.variables.length, 3);
  assert.equal(f.host.collections.length, 1);
});

for (const key of [
  "operationId",
  "phase",
  "attemptId",
  "nonce",
  "fileKey",
  "planRevision",
  "scriptSha256",
  "version",
] as const)
  test(`mismatched ${key} cannot acknowledge an execution`, async (t) => {
    const f = fixture(t),
      h = nativeFixtureHost();
    const result = await h.run(f.jobs.dispatch(f.snapshot.id, "token-create"));
    const before = f.inventory();
    (result as any)[key] = key === "version" ? 2 : "wrong";
    assert.throws(
      () => f.jobs.accept(f.snapshot.id, result),
      /result-correlation-mismatch/,
    );
    assert.deepEqual(f.inventory(), before);
  });

test("duplicate results are idempotent but contradictory duplicate payloads refuse", async (t) => {
  const f = await created(t),
    before = f.inventory();
  const changed = structuredClone(f.result);
  (changed.result as any).created++;
  assert.throws(
    () => f.jobs.accept(f.snapshot.id, changed),
    /result-replay-conflict/,
  );
  assert.deepEqual(f.inventory(), before);
});

test("native value drift and equal-looking forged verification flags cannot advance observation", async (t) => {
  const f = await created(t);
  const radius = f.host.variables.find((v) => v.name === "radius")!;
  radius.setValueForMode(f.host.collections[0].defaultModeId, 99);
  const command = f.jobs.dispatch(f.snapshot.id, "token-readback");
  const result = await f.host.run(command);
  (result.result as any).verification = "PASS";
  assert.equal(
    f.jobs.accept(f.snapshot.id, result).phase,
    "observation-refused",
  );
  assert.equal(radius.valuesByMode[f.host.collections[0].defaultModeId], 99);
});

test("changing source blocks creation but cannot discard a late allocation acknowledgement", async (t) => {
  let available = true;
  const f = fixture(t, (r, op) => {
    if (!available) throw Error("changed source");
    return nativeFixturePrepare(r, op);
  });
  const h = nativeFixtureHost(),
    command = f.jobs.dispatch(f.snapshot.id, "token-create");
  available = false;
  const snapshot = f.reopen().accept(f.snapshot.id, await h.run(command));
  assert.equal(snapshot.phase, "tokens-created");
  assert.equal(snapshot.sourceCurrent, false);
  const read = f.jobs.dispatch(f.snapshot.id, "token-readback");
  assert.equal(
    f.jobs.accept(f.snapshot.id, await h.run(read)).phase,
    "tokens-observed",
  );
  assert.equal(f.jobs.get(f.snapshot.id).sourceCurrent, false);
  assert.throws(() => f.jobs.prepare(request), /changed source/);
  assert.equal(h.variables.length, 3);
});

test("changed latest visual pin refuses an otherwise identical saved plan before dispatch", (t) => {
  let changed = false;
  const f = fixture(t, (r, op) => {
    const p = nativeFixturePrepare(r, op);
    if (changed) p.visual.reportSha256 = "f".repeat(64);
    return p;
  });
  changed = true;
  const before = f.inventory();
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "token-create"),
    /source-plan-stale/,
  );
  assert.equal(f.jobs.get(f.snapshot.id).sourceCurrent, false);
  assert.deepEqual(f.inventory(), before);
});

test("a persisted plan cannot retarget Scratch even with recomputed hashes", (t) => {
  const f = fixture(t);
  const file = path.join(f.directory, "plan.json"),
    headerFile = path.join(f.directory, "operation.json");
  const value = JSON.parse(readFileSync(file, "utf8"));
  value.plan.operation.fileKey = "AnotherFile123";
  value.revision = revisionOf(value.plan);
  const text = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(file, text);
  const header = JSON.parse(readFileSync(headerFile, "utf8"));
  header.planRevision = value.revision;
  header.planSha256 = sha(text);
  // The published pointer is the same immutable header inode; this adversary
  // intentionally reseals both. Current server policy must still refuse.
  writeFileSync(headerFile, JSON.stringify(header, null, 2) + "\n");
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "token-create"),
    /preparation-invalid/,
  );
});

for (const artifact of [
  "plan.json",
  "token-create.js",
  "operation.json",
  "events",
])
  test(`symlinked ${artifact} cannot provide operation evidence`, (t) => {
    const f = fixture(t),
      target = path.join(f.directory, artifact),
      external = path.join(f.repo, "external");
    if (artifact === "events") {
      mkdirSync(external);
      rmSync(target, { recursive: true });
    } else {
      writeFileSync(external, readFileSync(target));
      unlinkSync(target);
    }
    symlinkSync(external, target);
    assert.throws(
      () => f.jobs.get(f.snapshot.id),
      /directory-refused|artifact-refused/,
    );
  });

test("a dangling baseline reservation is an error, never an unbounded preparation retry", (t) => {
  const f = fixture(t),
    pointer = path.join(
      f.repo,
      "private/source-native-app/baselines",
      `${request.baseline.id}.json`,
    );
  unlinkSync(pointer);
  symlinkSync(path.join(f.repo, "absent"), pointer);
  assert.throws(() => f.jobs.prepare(request), /artifact-refused/);
  assert.equal(
    f.jobs.forBaseline(request.baseline.id)?.phase,
    "evidence-unavailable",
  );
});

test("truncated, removed and rewritten journal events cannot become a completed pass", async (t) => {
  const f = await created(t),
    original = readFileSync(f.event(0));
  writeFileSync(f.event(0), "{");
  assert.throws(() => f.jobs.get(f.snapshot.id));
  writeFileSync(f.event(0), original);
  const changed = JSON.parse(original.toString());
  changed.command.script += "\n";
  writeFileSync(f.event(0), JSON.stringify(changed));
  assert.throws(
    () => f.jobs.get(f.snapshot.id),
    /dispatch-invalid|creation-claim-mismatch/,
  );
  unlinkSync(f.event(0));
  assert.throws(() => f.jobs.get(f.snapshot.id), /journal-sequence-invalid/);
});

test("partial allocation is retained and cannot trigger another create", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  const original = h.figma.variables.createVariable;
  h.figma.variables.createVariable = (...args: any[]) => {
    const v = original(...args);
    v.setValueForMode = () => {
      throw Error("injected partial write");
    };
    return v;
  };
  const result = await h.run(f.jobs.dispatch(f.snapshot.id, "token-create"));
  assert.equal(result.result.status, "partial-allocation");
  assert.equal(
    f.jobs.accept(f.snapshot.id, result).phase,
    "partial-allocation",
  );
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "token-create"),
    /creation-already-dispatched/,
  );
  const stored = JSON.parse(readFileSync(f.event(1), "utf8"));
  assert.equal(
    stored.envelope.result.allocation.variables[0].id,
    h.variables[0].id,
  );
  assert.equal(
    stored.envelope.result.allocation.collection.id,
    h.collections[0].id,
  );
});

test("a native-returned refusal is preserved even though script execution returned successfully", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  h.figma.fileKey = "wrong-file";
  const result = await h.run(f.jobs.dispatch(f.snapshot.id, "token-create"));
  assert.equal(f.jobs.accept(f.snapshot.id, result).phase, "creation-refused");
  assert.equal(h.collections.length, 0);
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "token-create"),
    /creation-already-dispatched/,
  );
});

test("incomplete creation identity cannot be laundered as observed tokens", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  const result = await h.run(f.jobs.dispatch(f.snapshot.id, "token-create"));
  delete (result.result as any).creationIdentity;
  assert.equal(f.jobs.accept(f.snapshot.id, result).phase, "creation-invalid");
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "token-readback"),
    /allocation-identity-unavailable/,
  );
});

test("read-only inspection creates no journal directory", (t) => {
  const repo = mkdtempSync(path.join(tmpdir(), "native-readonly-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const jobs = createNativeOperationJobs(repo, {
    prepare: nativeFixturePrepare,
  });
  assert.equal(jobs.forBaseline(request.baseline.id), null);
  assert.deepEqual(readdirSync(repo), []);
});

test("deleting the entire event history cannot erase the durable creation claim", async (t) => {
  const f = await created(t);
  for (const file of readdirSync(path.join(f.directory, "events")))
    unlinkSync(path.join(f.directory, "events", file));
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "token-create"),
    /creation-journal-incomplete/,
  );
});

test("an interrupted read-only observation can be replaced without repeating creation", async (t) => {
  const f = await created(t);
  const lost = f.jobs.dispatch(f.snapshot.id, "token-readback");
  const retry = f.reopen().retryObservation(f.snapshot.id);
  assert.notEqual(retry.nonce, lost.nonce);
  assert.equal(retry.readOnly, true);
  assert.throws(
    () => f.jobs.retryCreation(f.snapshot.id),
    /creation-retry-refused/,
  );
  assert.throws(
    () =>
      f.jobs.accept(f.snapshot.id, {
        version: 1,
        operationId: lost.operationId,
        phase: lost.phase,
        attemptId: lost.attemptId,
        nonce: lost.nonce,
        fileKey: lost.fileKey,
        planRevision: lost.planRevision,
        scriptSha256: lost.scriptSha256,
        result: {} as any,
      }),
    /result-correlation-mismatch/,
  );
  assert.equal(
    f.jobs.accept(f.snapshot.id, await f.host.run(retry)).phase,
    "tokens-observed",
  );
  assert.equal(f.host.collections.length, 1);
});

test("a confirmed zero-allocation native refusal permits explicit retry; unknown and partial creation do not", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  h.figma.fileKey = "wrong-file";
  const first = f.jobs.dispatch(f.snapshot.id, "token-create");
  assert.throws(
    () => f.jobs.retryCreation(f.snapshot.id),
    /creation-retry-refused/,
  );
  assert.equal(
    f.jobs.accept(f.snapshot.id, await h.run(first)).phase,
    "creation-refused",
  );
  h.figma.fileKey = SOURCE_NATIVE_FILE_KEY;
  const retry = f.reopen().retryCreation(f.snapshot.id);
  assert.notEqual(retry.attemptId, first.attemptId);
  assert.equal(
    f.jobs.accept(f.snapshot.id, await h.run(retry)).phase,
    "tokens-created",
  );
  assert.equal(h.collections.length, 1);
  assert.throws(
    () => f.jobs.retryCreation(f.snapshot.id),
    /creation-retry-refused/,
  );
});

test("source changes during initial compilation leave no executable reservation", (t) => {
  const repo = mkdtempSync(path.join(tmpdir(), "native-unstable-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  let calls = 0;
  const jobs = createNativeOperationJobs(repo, {
    prepare: (_r, op) => {
      const value = nativeFixturePreparation(op);
      if (++calls > 1) value.visual.reportSha256 = "f".repeat(64);
      return value;
    },
  });
  assert.throws(
    () => jobs.prepare(request),
    /source-changed-during-preparation/,
  );
  assert.equal(jobs.forBaseline(request.baseline.id), null);
});

test("an absent native result cannot poison the durable journal", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  const command = f.jobs.dispatch(f.snapshot.id, "token-create");
  const valid = await h.run(command),
    malformed = {
      ...valid,
      result: undefined,
    } as unknown as NativeOperationResult;
  const before = f.inventory();
  assert.throws(
    () => f.jobs.accept(f.snapshot.id, malformed),
    /result-envelope-invalid/,
  );
  assert.deepEqual(f.inventory(), before);
  assert.equal(f.jobs.accept(f.snapshot.id, valid).phase, "tokens-created");
});

test("a missing baseline reservation cannot create a new scope over a prior native allocation", async (t) => {
  const f = await created(t);
  unlinkSync(
    path.join(
      f.repo,
      "private/source-native-app/baselines",
      `${request.baseline.id}.json`,
    ),
  );
  const before = f.inventory();
  assert.throws(
    () => f.reopen().prepare(request),
    /baseline-reservation-missing/,
  );
  assert.equal(
    f.jobs.forBaseline(request.baseline.id)?.phase,
    "evidence-unavailable",
  );
  assert.deepEqual(f.inventory(), before);
  assert.equal(f.host.collections.length, 1);
});

test("concurrent preparations publish one baseline reservation; unpublished plans cannot dispatch", (t) => {
  const repo = mkdtempSync(path.join(tmpdir(), "native-reservation-race-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const rival = createNativeOperationJobs(repo, {
    prepare: nativeFixturePrepare,
  });
  let otherId = "",
    interleave = true;
  const first = createNativeOperationJobs(repo, {
    prepare: (r, op) => {
      if (interleave) {
        interleave = false;
        otherId = rival.prepare(r).id;
      }
      return nativeFixturePrepare(r, op);
    },
  });
  const result = first.prepare(request);
  assert.equal(result.id, otherId);
  const directories = readdirSync(
    path.join(repo, "private/source-native-app/operations"),
  );
  assert.equal(directories.length, 2);
  const unpublished = directories.find((id) => id !== result.id)!;
  assert.throws(
    () => first.dispatch(unpublished, "token-create"),
    /baseline-reservation-mismatch/,
  );
  assert.equal(first.prepare(request).id, otherId);
});

test("a competing dispatch during fresh source validation prevents a second delivery", (t) => {
  let interleave = false,
    delivered = 0;
  let rival: ReturnType<typeof createNativeOperationJobs>;
  const f = fixture(t, (r, op) => {
    if (interleave) {
      interleave = false;
      rival.dispatch(op.id, "token-create");
      delivered++;
    }
    return nativeFixturePrepare(r, op);
  });
  rival = createNativeOperationJobs(f.repo, { prepare: nativeFixturePrepare });
  interleave = true;
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "token-create"),
    /evidence-changed-during-validation/,
  );
  assert.equal(delivered, 1);
  assert.equal(f.reopen().get(f.snapshot.id).nativeOutcome, "unknown");
  assert.equal(readdirSync(path.join(f.directory, "events")).length, 1);
});

test("a delayed acknowledgement from a prior script version retains IDs without authorizing fresh creation", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  const command = f.jobs.dispatch(f.snapshot.id, "token-create");
  // Model bytes produced by a prior writer version. No native semantics are
  // changed; the current emitter produces a different header spelling.
  command.script += "\n// prior writer version\n";
  command.scriptSha256 = sha(command.script);
  writeFileSync(path.join(f.directory, "token-create.js"), command.script);
  const headerPath = path.join(f.directory, "operation.json");
  const header = JSON.parse(readFileSync(headerPath, "utf8"));
  header.tokenScriptSha256 = command.scriptSha256;
  const headerBytes = JSON.stringify(header, null, 2) + "\n";
  writeFileSync(headerPath, headerBytes);
  writeFileSync(
    path.join(f.directory, "creation.json"),
    JSON.stringify(command, null, 2) + "\n",
  );
  const event = JSON.parse(readFileSync(f.event(0), "utf8"));
  event.previousSha256 = sha(headerBytes);
  event.command = command;
  writeFileSync(f.event(0), JSON.stringify(event, null, 2) + "\n");
  const snapshot = f.reopen().accept(f.snapshot.id, await h.run(command));
  assert.equal(snapshot.phase, "tokens-created");
  assert.equal(snapshot.sourceCurrent, false);
  assert.throws(() => f.jobs.prepare(request), /compiled-script-changed/);
  const read = f.jobs.dispatch(f.snapshot.id, "token-readback");
  assert.equal(
    f.jobs.accept(f.snapshot.id, await h.run(read)).phase,
    "tokens-observed",
  );
  assert.equal(h.variables.length, 3);
});

test("an allocation API that throws after a side effect is not a zero-write refusal", async (t) => {
  const f = fixture(t),
    h = nativeFixtureHost();
  const original = h.figma.variables.createVariableCollection;
  h.figma.variables.createVariableCollection = (name: string) => {
    original(name);
    throw Error("native API outcome unavailable");
  };
  const result = await h.run(f.jobs.dispatch(f.snapshot.id, "token-create"));
  assert.equal(result.result.status, "refused");
  assert.equal((result.result as any).allocation.collection, null);
  assert.equal(h.collections.length, 1);
  const snapshot = f.jobs.accept(f.snapshot.id, result);
  assert.equal(snapshot.phase, "creation-invalid");
  assert.equal(snapshot.nativeOutcome, "unknown");
  assert.throws(
    () => f.jobs.retryCreation(f.snapshot.id),
    /creation-retry-refused/,
  );
});

/** Opaque component acknowledgement fixture for journal transitions only.
 * Actual renderer/source comparisons are tested separately, never inferred
 * from this deliberately synthetic allocation report. */
const componentBuilder: NonNullable<
  NativeOperationJobsOptions["buildComponent"]
> = (_request, context) => ({
  planRevision: context.planRevision,
  script: `return ${JSON.stringify({
    version: 1,
    status: "created-candidate",
    operationId: context.operation.id,
    fileKey: context.operation.fileKey,
    acceptedContract: null,
    nativeQualification: "unqualified",
    allocationAttempted: true,
    pageId: "page",
    target: { id: "main", key: "main-key", type: "COMPONENT" },
    comparisonBoardId: "board",
    nodes: [
      { id: "page", type: "PAGE" },
      { id: "main", type: "COMPONENT" },
      { id: "board", type: "FRAME" },
      { id: "instance", type: "INSTANCE" },
    ],
    variants: [{ id: "main", key: "main-key", name: "fixture" }],
    propertyDefinitions: {},
    problems: [],
    comparisons: [
      {
        id: "observed",
        status: "created-comparison",
        instanceId: "instance",
        mainId: "main",
        sourceParts: [{ partPath: ["root"], nodeId: "instance" }],
        slots: [],
      },
      { id: "refused", status: "refused", problems: ["fixture-refusal"] },
    ],
  })};`,
});
async function componentReady(
  t: test.TestContext,
  build = componentBuilder,
  prepare: NativeOperationJobsOptions["prepare"] = nativeFixturePrepare,
) {
  const f = fixture(t, prepare, build),
    host = nativeFixtureHost();
  for (const phase of ["token-create", "token-readback"] as const) {
    const command = f.jobs.dispatch(f.snapshot.id, phase);
    f.jobs.accept(f.snapshot.id, await host.run(command));
  }
  return { ...f, host };
}

test("component command is durable before delivery, uses observed identities, and cannot be repeated", async (t) => {
  let seen: any;
  const f = await componentReady(t, (request, context) => {
    seen = context;
    return componentBuilder(request, context);
  });
  const command = f.jobs.dispatch(f.snapshot.id, "component-create");
  assert.equal(command.readOnly, false);
  assert.equal(seen.tokens.identity.origin, "created");
  assert(seen.tokens.receipt.collection.id);
  assert.deepEqual(
    JSON.parse(
      readFileSync(path.join(f.directory, "component-creation.json"), "utf8"),
    ),
    command,
  );
  assert.deepEqual(
    JSON.parse(readFileSync(f.event(4), "utf8")).command,
    command,
  );
  assert.equal(f.reopen().get(f.snapshot.id).pendingPhase, "component-create");
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "component-create"),
    /native-outcome-unknown/,
  );
  const result = await f.host.run(command);
  const snapshot = f.jobs.accept(f.snapshot.id, result);
  assert.equal(snapshot.phase, "components-created");
  assert.equal(snapshot.acceptedContract, null);
  assert.equal(snapshot.nativeQualification, "unqualified");
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "component-create"),
    /component-creation-already-dispatched/,
  );
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "token-readback"),
    /component-phase-already-started/,
  );
  assert.deepEqual(f.reopen().accept(f.snapshot.id, result), snapshot);
  assert(!JSON.stringify(snapshot).includes("main-key"));
});

test("component creation requires independent token observation, not a creation acknowledgement", async (t) => {
  const f = fixture(t, nativeFixturePrepare, componentBuilder),
    host = nativeFixtureHost();
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-create"),
    /verified-token-observation-required/,
  );
  const command = f.jobs.dispatch(f.snapshot.id, "token-create");
  f.jobs.accept(f.snapshot.id, await host.run(command));
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-create"),
    /verified-token-observation-required/,
  );
  assert.equal(readdirSync(path.join(f.directory, "events")).length, 2);
});

test("removing later component events cannot rewind to a successful token observation", async (t) => {
  const f = await componentReady(t);
  f.jobs.dispatch(f.snapshot.id, "component-create");
  unlinkSync(f.event(4));
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "component-create"),
    /component-creation-journal-incomplete/,
  );
});

test("removing component claim with its dispatch retained refuses the journal", async (t) => {
  const f = await componentReady(t);
  f.jobs.dispatch(f.snapshot.id, "component-create");
  unlinkSync(path.join(f.directory, "component-creation.json"));
  assert.throws(
    () => f.reopen().get(f.snapshot.id),
    /component-creation-precondition-invalid/,
  );
});

test("late component acknowledgement is preserved after source changes", async (t) => {
  let changed = false;
  const f = await componentReady(t, componentBuilder, (...args) => {
    if (changed) throw Error("source changed");
    return nativeFixturePrepare(...args);
  });
  const command = f.jobs.dispatch(f.snapshot.id, "component-create");
  const result = await f.host.run(command);
  changed = true;
  const snapshot = f.reopen().accept(f.snapshot.id, result);
  assert.equal(snapshot.phase, "components-created");
  assert.equal(snapshot.sourceCurrent, false);
  assert.deepEqual(
    JSON.parse(readFileSync(f.event(5), "utf8")).envelope,
    result,
  );
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "component-create"),
    /component-creation-already-dispatched/,
  );
});

test("historical component commands are not recompiled while accepting their results", async (t) => {
  let changed = false;
  const f = await componentReady(t, (request, context) => {
    if (changed) throw Error("new compiler refuses");
    return componentBuilder(request, context);
  });
  const command = f.jobs.dispatch(f.snapshot.id, "component-create"),
    result = await f.host.run(command);
  changed = true;
  assert.equal(
    f.reopen().accept(f.snapshot.id, result).phase,
    "components-created",
  );
});

test("a source change during component compilation prevents dispatch", async (t) => {
  let changed = false;
  const f = await componentReady(
    t,
    (request, context) => {
      changed = true;
      return componentBuilder(request, context);
    },
    (...args) => {
      if (changed) throw Error("source changed");
      return nativeFixturePrepare(...args);
    },
  );
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-create"),
    /source changed/,
  );
  assert.equal(readdirSync(path.join(f.directory, "events")).length, 4);
  assert(!readdirSync(f.directory).includes("component-creation.json"));
});

for (const [name, mutate] of Object.entries({
  "duplicate allocation IDs": (r: any) => {
    r.nodes.push(r.nodes[0]);
  },
  "missing page identity": (r: any) => {
    r.pageId = "unknown";
  },
  "missing comparison case": (r: any) => {
    r.comparisons.pop();
  },
  "promoted refused case": (r: any) => {
    r.comparisons[1].status = "created-comparison";
  },
  "unknown comparison main": (r: any) => {
    r.comparisons[0].mainId = "unknown";
  },
  "accepted Contract claim": (r: any) => {
    r.acceptedContract = true;
  },
}))
  test(`component acknowledgement with ${name} stays invalid and unretryable`, async (t) => {
    const f = await componentReady(t),
      command = f.jobs.dispatch(f.snapshot.id, "component-create");
    const result = await f.host.run(command);
    mutate(result.result);
    const snapshot = f.jobs.accept(f.snapshot.id, result);
    assert.equal(snapshot.phase, "component-creation-invalid");
    assert.equal(snapshot.nativeOutcome, "unknown");
    assert.deepEqual(
      JSON.parse(readFileSync(f.event(5), "utf8")).envelope,
      result,
    );
    assert.throws(
      () => f.reopen().dispatch(f.snapshot.id, "component-create"),
      /component-creation-already-dispatched/,
    );
  });

test("partial component allocation is retained without granting creation retry", async (t) => {
  const f = await componentReady(t),
    command = f.jobs.dispatch(f.snapshot.id, "component-create");
  const result = await f.host.run(command);
  Object.assign(result.result, {
    status: "partial-or-unknown-allocation",
    problems: ["API failed"],
  });
  const snapshot = f.jobs.accept(f.snapshot.id, result);
  assert.equal(snapshot.phase, "component-partial-allocation");
  assert.equal(snapshot.nativeOutcome, "unknown");
  assert.throws(
    () => f.jobs.retryCreation(f.snapshot.id),
    /creation-retry-refused/,
  );
  assert.throws(
    () => f.reopen().dispatch(f.snapshot.id, "component-create"),
    /component-creation-already-dispatched/,
  );
});

test("a competing component dispatch during compilation delivers at most one command", async (t) => {
  let nested = false,
    other: ReturnType<typeof createNativeOperationJobs>,
    delivered: any;
  const f = await componentReady(t, (request, context) => {
    if (!nested) {
      nested = true;
      delivered = other.dispatch(context.operation.id, "component-create");
    }
    return componentBuilder(request, context);
  });
  other = f.reopen();
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-create"),
    /evidence-changed-during-validation/,
  );
  assert.equal(delivered.phase, "component-create");
  assert.equal(readdirSync(path.join(f.directory, "events")).length, 5);
  assert.deepEqual(
    JSON.parse(readFileSync(f.event(4), "utf8")).command,
    delivered,
  );
});

/** Exercise the actual shared component writer and independent reader through
 * the durable journal; this synthetic compiler fixture is not native evidence. */
async function independentlyObservedComponents(t: test.TestContext) {
  const { comparisonFixture } =
    await import("../core/native-source-writer-test-fixture.js");
  const { prepareNativeTokenContext } =
    await import("../core/native-token-context.js");
  const template = await comparisonFixture();
  let stale = false;
  const prepare: NativeOperationJobsOptions["prepare"] = (
    _request,
    operation,
  ) => {
    if (stale) throw Error("source changed");
    const seed = nativeFixturePreparation(operation);
    const tokenInput = {
      ...template.context.tokens.input,
      fileKey: operation.fileKey,
      scopeId: `source-${operation.id}`,
    };
    const plan = {
      ...seed.plan.plan,
      operation,
      tokenInput,
      tokenPreparation: prepareNativeTokenContext(tokenInput),
      component: template.source.compile(),
      sourceProjection: template.source.projection,
      samples: template.samples,
    };
    return {
      ...seed,
      plan: { plan, revision: revisionOf(plan) } as typeof seed.plan,
    };
  };
  const build: NonNullable<NativeOperationJobsOptions["buildComponent"]> = (
    _request,
    context,
  ) => ({
    planRevision: context.planRevision,
    script: template.source
      .engine()
      .buildNativeSourceComponentScript(
        template.source.contract,
        new Map([[template.source.contract.id, template.source.contract]]),
        {
          operation: context.operation,
          tokens: context.tokens,
          comparisons: {
            samples: template.samples,
            revision: revisionOf(template.samples),
          },
        },
      ),
  });
  const f = fixture(t, prepare, build),
    host = nativeFixtureHost();
  Object.getPrototypeOf(
    host.figma.currentPage,
  ).setExplicitVariableModeForCollection = function (
    collection: any,
    mode: string,
  ) {
    this.explicitVariableModes = { [collection.id]: mode };
  };
  for (const phase of [
    "token-create",
    "token-readback",
    "component-create",
  ] as const) {
    const command = f.jobs.dispatch(f.snapshot.id, phase);
    f.jobs.accept(f.snapshot.id, await host.run(command));
  }
  assert.equal(f.jobs.get(f.snapshot.id).phase, "components-created");
  const creation = JSON.parse(readFileSync(f.event(5), "utf8")).envelope.result;
  return {
    ...f,
    host,
    creation,
    makeStale: () => {
      stale = true;
    },
  };
}

test("component readback observes the saved allocation independently and reopens without qualification", async (t) => {
  const f = await independentlyObservedComponents(t);
  assert.equal(f.jobs.get(f.snapshot.id).structuralObservation, undefined);
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  assert.equal(command.readOnly, true);
  assert.deepEqual(
    JSON.parse(readFileSync(f.event(6), "utf8")).command,
    command,
  );
  const envelope = await f.host.run(command);
  const result = f.jobs.accept(f.snapshot.id, envelope);
  assert.equal(
    result.phase,
    "component-structure-observed",
    JSON.stringify(result),
  );
  assert.equal(result.nativeQualification, "unqualified");
  assert.equal(result.acceptedContract, null);
  assert.equal(result.structuralObservation?.scope, "supported-structure");
  assert(
    result.structuralObservation?.limitations.includes(
      "native-visual-fidelity-unverified",
    ),
  );
  assert.deepEqual(f.reopen().get(f.snapshot.id), result);
  const saved = f.inventory();
  assert.deepEqual(f.jobs.accept(f.snapshot.id, envelope), result);
  assert.deepEqual(f.inventory(), saved);
  for (const privateValue of [
    f.creation.pageId,
    command.nonce,
    command.scriptSha256,
    "nativeSourceOperation",
  ])
    assert(!JSON.stringify(result).includes(privateValue));
});

test("component observation retry uses a new nonce and never repeats allocation", async (t) => {
  const f = await independentlyObservedComponents(t),
    first = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const oldResult = await f.host.run(first);
  const pages = f.host.figma.root.children.length;
  const variables = f.host.variables.length;
  const second = f.reopen().retryObservation(f.snapshot.id);
  assert.equal(second.phase, "component-readback");
  assert.equal(second.readOnly, true);
  assert.notEqual(second.nonce, first.nonce);
  assert.notEqual(second.attemptId, first.attemptId);
  assert.equal(second.scriptSha256, first.scriptSha256);
  assert.throws(
    () => f.jobs.accept(f.snapshot.id, oldResult),
    /correlation-mismatch/,
  );
  assert.equal(
    f.jobs.accept(f.snapshot.id, await f.host.run(second)).phase,
    "component-structure-observed",
  );
  assert.equal(f.host.figma.root.children.length, pages);
  assert.equal(f.host.variables.length, variables);
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-create"),
    /already-dispatched/,
  );
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "token-readback"),
    /component-phase-already-started/,
  );
  assert.throws(
    () => f.jobs.retryCreation(f.snapshot.id),
    /creation-retry-refused/,
  );
});

test("native drift refuses observation and a later read can observe an externally corrected value", async (t) => {
  const f = await independentlyObservedComponents(t);
  const page = await f.host.figma.getNodeByIdAsync(f.creation.pageId);
  const text = page.findOne((n: any) => n.type === "TEXT"),
    original = text.characters;
  text.characters = "native edit";
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const refused = f.jobs.accept(f.snapshot.id, await f.host.run(command));
  assert.equal(refused.phase, "component-observation-refused");
  assert.deepEqual(refused.problems, [
    "native-operation-component-readback-refused",
  ]);
  assert.equal(refused.structuralObservation?.status, "refused");
  text.characters = original;
  const next = f.jobs.dispatch(f.snapshot.id, "component-readback");
  assert.equal(f.jobs.get(f.snapshot.id).structuralObservation, undefined);
  assert.equal(
    f.jobs.accept(f.snapshot.id, await f.host.run(next)).phase,
    "component-structure-observed",
  );
});

test("known component allocations remain inspectable after source changes without claiming current-source agreement", async (t) => {
  const f = await independentlyObservedComponents(t);
  f.makeStale();
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const result = f.jobs.accept(f.snapshot.id, await f.host.run(command));
  assert.equal(result.phase, "component-structure-observed");
  assert.equal(result.sourceCurrent, false);
  assert(
    result.problems.includes("native-operation-source-evidence-unavailable"),
  );
  assert.equal(result.nativeQualification, "unqualified");
});

test("source changes after dispatch do not discard a correlated component readback", async (t) => {
  const f = await independentlyObservedComponents(t),
    command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const result = await f.host.run(command);
  f.makeStale();
  assert.equal(f.jobs.accept(f.snapshot.id, result).sourceCurrent, false);
  assert.deepEqual(
    JSON.parse(readFileSync(f.event(7), "utf8")).envelope,
    result,
  );
});

test("a self-reported component observation without independent native facts is refused and retained", async (t) => {
  const f = await independentlyObservedComponents(t),
    command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const envelope = await f.host.run(command);
  envelope.result = {
    status: "supported-structure-observed",
    acceptedContract: null,
    nativeQualification: "unqualified",
  };
  assert.equal(
    f.jobs.accept(f.snapshot.id, envelope).phase,
    "component-observation-refused",
  );
  assert.deepEqual(
    JSON.parse(readFileSync(f.event(7), "utf8")).envelope,
    envelope,
  );
});

test("component readback cannot start before successful component allocation", async (t) => {
  const f = await componentReady(t);
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-readback"),
    /component-allocation-identity-unavailable/,
  );
  const command = f.jobs.dispatch(f.snapshot.id, "component-create");
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-readback"),
    /native-outcome-unknown/,
  );
  const result = await f.host.run(command);
  (result.result as any).status = "partial-or-unknown-allocation";
  f.jobs.accept(f.snapshot.id, result);
  assert.throws(
    () => f.jobs.dispatch(f.snapshot.id, "component-readback"),
    /component-allocation-identity-unavailable/,
  );
});

test("native PNGs are private, pinned to the current readback, and survive reopen without qualification", async (t) => {
  const f = await independentlyObservedComponents(t);
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const envelope = await f.host.run(command);
  // Valid diagnostic images remain useful when authored structure is refused.
  (envelope.result as any).nodes = [];
  const snapshot = f.jobs.accept(f.snapshot.id, envelope);
  assert.equal(snapshot.phase, "component-observation-refused");
  const images = snapshot.imageObservation!;
  assert.equal(images.status, "collected");
  assert.equal(images.qualification, "unqualified");
  assert.equal(
    images.images.length,
    f.creation.comparisons.filter((c: any) => c.status === "created-comparison")
      .length,
  );
  const hash = images.images[0].sha256;
  const png = f.reopen().image(f.snapshot.id, command.attemptId, hash);
  assert.equal(sha(png), hash);
  assert.deepEqual(
    png,
    readFileSync(path.join(f.directory, "images", `${hash}.png`)),
  );
  assert(!JSON.stringify(snapshot).includes("pngBase64"));
  assert.throws(
    () => f.jobs.image(f.snapshot.id, command.attemptId, "0".repeat(64)),
    /image-unavailable/,
  );
  // Images remain inspectable when the original changes, without agreement.
  f.makeStale();
  assert.equal(f.jobs.get(f.snapshot.id).sourceCurrent, false);
  assert.deepEqual(f.jobs.image(f.snapshot.id, command.attemptId, hash), png);
  // A retry immediately withdraws old current URLs, while preserving history.
  f.jobs.retryObservation(f.snapshot.id);
  assert.equal(f.jobs.get(f.snapshot.id).imageObservation, undefined);
  assert.throws(
    () => f.jobs.image(f.snapshot.id, command.attemptId, hash),
    /image-unavailable/,
  );
  assert.deepEqual(
    readFileSync(path.join(f.directory, "images", `${hash}.png`)),
    png,
  );
});

for (const [name, mutate, problem] of [
  [
    "wrong case",
    (r: any) => {
      r.images[0].caseId = "foreign";
    },
    "instance-mismatch",
  ],
  [
    "wrong instance",
    (r: any) => {
      r.images[0].nodeId = "foreign";
    },
    "instance-mismatch",
  ],
  [
    "duplicate case",
    (r: any) => {
      r.images[1] = r.images[0];
    },
    "instance-mismatch",
  ],
  [
    "missing case",
    (r: any) => {
      r.images.pop();
    },
    "denominator-mismatch",
  ],
  [
    "invalid PNG",
    (r: any) => {
      r.images[0].pngBase64 = Buffer.from("not a PNG").toString("base64");
    },
    "png-invalid",
  ],
  [
    "noncanonical base64",
    (r: any) => {
      r.images[0].pngBase64 += "\n";
    },
    "encoding-invalid",
  ],
  [
    "CRC corruption",
    (r: any) => {
      const p = Buffer.from(r.images[0].pngBase64, "base64");
      p[29] ^= 1;
      r.images[0].pngBase64 = p.toString("base64");
    },
    "png-invalid",
  ],
  [
    "pixel bomb",
    (r: any) => {
      const p = Buffer.from(r.images[0].pngBase64, "base64");
      p.writeUInt32BE(0xffffffff, 16);
      r.images[0].pngBase64 = p.toString("base64");
    },
    "pixel-limit",
  ],
] as Array<[string, (r: any) => void, string]>) {
  test(`native image rejects ${name} independently of structural status`, async (t) => {
    const f = await independentlyObservedComponents(t);
    const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
    const result = await f.host.run(command);
    mutate(result.result);
    const snapshot = f.jobs.accept(f.snapshot.id, result);
    assert.equal(snapshot.phase, "component-structure-observed");
    assert.equal(snapshot.imageObservation?.status, "unavailable");
    assert(
      snapshot.imageObservation?.problems.some((p) => p.includes(problem)),
    );
    assert.deepEqual(snapshot.imageObservation?.images, []);
    assert.equal(snapshot.nativeQualification, "unqualified");
  });
}

test("native exports explicitly refuse aggregate overflow without returning an undeliverable result", async (t) => {
  const f = await independentlyObservedComponents(t);
  Object.getPrototypeOf(f.host.figma.currentPage).exportAsync = async () =>
    new Uint8Array(1024 * 1024 + 1);
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const result = await f.host.run(command);
  assert.deepEqual((result.result as any).problems, [
    "native-source-readback-image-byte-limit",
  ]);
  assert.equal((result.result as any).images, undefined);
  const snapshot = f.jobs.accept(f.snapshot.id, result);
  assert.equal(snapshot.phase, "component-observation-refused");
  assert.equal(snapshot.nativeOutcome, undefined);
});

test("export cache recovers from a missing file but refuses changed bytes and symlinks", async (t) => {
  const f = await independentlyObservedComponents(t);
  const c = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const snapshot = f.jobs.accept(f.snapshot.id, await f.host.run(c));
  const hash = snapshot.imageObservation!.images[0].sha256;
  const file = path.join(f.directory, "images", `${hash}.png`);
  const original = readFileSync(file);
  unlinkSync(file);
  assert.deepEqual(
    f.reopen().image(f.snapshot.id, c.attemptId, hash),
    original,
  );
  writeFileSync(file, "changed");
  assert.throws(
    () => f.reopen().image(f.snapshot.id, c.attemptId, hash),
    /image-artifact-changed/,
  );
  unlinkSync(file);
  symlinkSync(f.event(0), file);
  assert.throws(
    () => f.reopen().image(f.snapshot.id, c.attemptId, hash),
    /artifact-refused/,
  );
});

test("HTTP serves only the current attempt's validated PNG through the local app boundary", async (t) => {
  const f = await independentlyObservedComponents(t);
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const snapshot = f.jobs.accept(f.snapshot.id, await f.host.run(command));
  const image = snapshot.imageObservation!.images[0];
  const { createReferenceService } = await import("./service.js");
  const { createServer } = await import("node:http");
  const service = createReferenceService(f.repo);
  const server = createServer((req, res) => {
    void service.handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    service.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/source-reference/native/${f.snapshot.id}/images/${command.attemptId}/${image.sha256}.png`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );
  assert.equal(sha(Buffer.from(await response.arrayBuffer())), image.sha256);
  assert.equal(
    (await fetch(url, { headers: { Origin: "https://example.com" } })).status,
    403,
  );
  assert.equal(
    (await fetch(url.replace(image.sha256, "0".repeat(64)))).status,
    404,
  );
  f.jobs.dispatch(f.snapshot.id, "component-readback");
  assert.equal((await fetch(url)).status, 404);
});

test("oversized multibyte native metadata returns a bounded explicit refusal", async (t) => {
  const f = await independentlyObservedComponents(t);
  const node = await f.host.figma.getNodeByIdAsync(f.creation.target.id);
  node.getSharedPluginData = () => "界".repeat(200_000);
  const command = f.jobs.dispatch(f.snapshot.id, "component-readback");
  const envelope = await f.host.run(command);
  assert.deepEqual((envelope.result as any).problems, [
    "native-source-readback-result-byte-limit",
  ]);
  assert.equal((envelope.result as any).nodes, undefined);
  assert.equal((envelope.result as any).images, undefined);
  assert.equal(
    f.jobs.accept(f.snapshot.id, envelope).phase,
    "component-observation-refused",
  );
});
