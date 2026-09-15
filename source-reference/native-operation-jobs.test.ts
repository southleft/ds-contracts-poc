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
) {
  const repo = mkdtempSync(path.join(tmpdir(), "native-journal-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const reopen = () => createNativeOperationJobs(repo, { prepare });
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
