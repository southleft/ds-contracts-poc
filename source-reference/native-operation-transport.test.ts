import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import test from "node:test";
import {
  createNativeOperationJobs,
  SOURCE_NATIVE_FILE_KEY,
  type NativeOperationJobsOptions,
} from "./native-operation-jobs.js";
import { createNativeOperationTransport } from "./native-operation-transport.js";
import {
  nativeFixturePreparation,
  nativeFixtureRequest,
  nativeFixtureHost,
} from "./native-operation-test-fixture.js";
import { comparisonFixture } from "../core/native-source-writer-test-fixture.js";
import { prepareNativeTokenContext } from "../core/native-token-context.js";
import { revisionOf } from "../core/contract-provenance.js";

const plugin = readFileSync(
  new URL("../figma-sync/plugin/code.js", import.meta.url),
  "utf8",
);
test("development manifest exposes file identity and the fixed local app endpoint", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../figma-sync/plugin/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.enablePrivatePluginApi, true);
  assert(
    manifest.networkAccess.devAllowedDomains.includes("http://localhost:5181"),
  );
  assert(
    !manifest.networkAccess.allowedDomains.includes("http://localhost:5181"),
  );
});
async function fixture(t: test.TestContext) {
  const repo = mkdtempSync(path.join(tmpdir(), "native-transport-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const template = await comparisonFixture();
  let stale = false;
  let preparations = 0;
  const options: NativeOperationJobsOptions = {
    prepare: (_request, operation) => {
      preparations++;
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
    },
    buildComponent: (_request, context) => ({
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
    }),
  };
  const jobs = createNativeOperationJobs(repo, options),
    id = jobs.prepare(nativeFixtureRequest).id;
  const transport = createNativeOperationTransport(repo, jobs),
    connection = transport.pair(id),
    secret = connection.split(".")[1];
  const host = nativeFixtureHost();
  Object.getPrototypeOf(
    host.figma.currentPage,
  ).setExplicitVariableModeForCollection = function (
    collection: any,
    mode: string,
  ) {
    this.explicitVariableModes = { [collection.id]: mode };
  };
  const storage = new Map<string, any>(),
    messages: any[] = [],
    delivered: any[] = [];
  let responseFailure = "",
    storageFailure = "",
    tamper: ((body: any) => void) | undefined;
  host.figma.showUI = () => {};
  host.figma.clientStorage = {
    getAsync: async (key: string) => structuredClone(storage.get(key)),
    setAsync: async (key: string, value: any) => {
      if (value?.stage === storageFailure) throw Error("storage failed");
      storage.set(key, JSON.parse(JSON.stringify(value)));
    },
    deleteAsync: async (key: string) => {
      storage.delete(key);
    },
  };
  const fetch = async (url: string, init: any) => {
    assert(
      url.startsWith(
        `http://localhost:5181/api/source-reference/native/${id}/`,
      ),
    );
    const supplied = init.headers.Authorization.slice(7),
      payload = JSON.parse(init.body);
    let body: any;
    if (url.endsWith("/begin")) return { ok: true, json: async () => transport.begin(id, supplied, payload.attemptId) };
    if (url.endsWith("/claim")) {
      body = transport.claim(
        id,
        supplied,
        payload.fileKey,
        payload.replaceReadbackAttemptId,
        payload.resolveWriteAttemptId,
        payload.protocol,
      );
      if (body.command) delivered.push(body.command);
    } else {
      if (responseFailure === "before-result") {
        responseFailure = "";
        throw Error("response unavailable");
      }
      body = transport.accept(id, supplied, payload);
    }
    if (responseFailure === (url.endsWith("/claim") ? "claim" : "result")) {
      responseFailure = "";
      throw Error("response lost");
    }
    body = JSON.parse(JSON.stringify(body));
    tamper?.(body);
    return { ok: true, json: async () => body };
  };
  const boot = () => {
    host.figma.ui = {
      postMessage: (msg: any) => messages.push(JSON.parse(JSON.stringify(msg))),
    };
    vm.runInNewContext(
      plugin,
      { figma: host.figma, fetch, __html__: "", console },
      { timeout: 5000 },
    );
    return (msg: any) => host.figma.ui.onmessage(msg);
  };
  let send = boot();
  await send({ type: "native-connect", connection });
  assert.equal(messages.at(-1).status, "ready");
  return {
    repo,
    jobs,
    transport,
    id,
    secret,
    connection,
    host,
    storage,
    messages,
    delivered,
    preparationCount: () => preparations,
    poll: () => send({ type: "native-poll" }),
    reboot: () => {
      send = boot();
    },
    lose: (which: string) => {
      responseFailure = which;
    },
    failStorage: (stage: string) => {
      storageFailure = stage;
    },
    tamper: (fn: (body: any) => void) => {
      tamper = fn;
    },
    stale: () => {
      stale = true;
    },
    start: () => transport.start(id),
  };
}

test("companion plugin completes all four journal phases through one local connection", async (t) => {
  const f = await fixture(t);
  f.start();
  for (const phase of [
    "tokens-created",
    "tokens-observed",
    "components-created",
    "component-structure-observed",
  ]) {
    await f.poll();
    assert.equal(
      f.jobs.get(f.id).phase,
      phase,
      JSON.stringify(f.messages.at(-1)),
    );
  }
  await f.poll();
  assert.equal(f.messages.at(-1).status, "finished");
  assert.equal(f.jobs.get(f.id).nativeQualification, "unqualified");
  assert.equal(f.jobs.get(f.id).acceptedContract, null);
  assert.deepEqual(
    f.delivered.map((c) => c.readOnly),
    [false, true, false, true],
  );
  assert(!JSON.stringify(f.messages).includes(f.secret));
  const variables = f.host.variables.length,
    pages = f.host.figma.root.children.length;
  const preparations = f.preparationCount();
  await f.poll();
  f.reboot();
  await f.poll();
  assert.equal(f.delivered.length, 4);
  assert.equal(f.host.variables.length, variables);
  assert.equal(f.host.figma.root.children.length, pages);
  assert.equal(
    f.preparationCount(),
    preparations,
    "idle finished polling does not revalidate the source",
  );
});

test("lost acknowledgement is recovered after plugin restart without allocating twice", async (t) => {
  const f = await fixture(t);
  f.start();
  f.lose("result");
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "tokens-created");
  const count = f.host.variables.length;
  assert.equal(f.storage.get(`ds_native_receipt:${f.id}`).stage, "result");
  f.reboot();
  await f.poll();
  assert.equal(f.host.variables.length, count);
  assert.equal(f.delivered.length, 1);
  assert.equal(f.storage.has(`ds_native_receipt:${f.id}`), false);
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "tokens-observed");
});

test("lost command response never becomes a second creation delivery, including across host restart", async (t) => {
  const f = await fixture(t);
  f.start();
  f.lose("claim");
  await f.poll();
  assert.equal(f.host.variables.length, 0);
  assert.equal(f.delivered.length, 1);
  f.reboot();
  await f.poll();
  assert.equal(f.messages.at(-1).status, "awaiting-result");
  const other = createNativeOperationTransport(f.repo, f.jobs);
  assert.deepEqual(other.claim(f.id, f.secret, SOURCE_NATIVE_FILE_KEY), {
    status: "awaiting-result",
  });
  assert.equal(f.host.variables.length, 0);
  assert.equal(f.jobs.get(f.id).nativeOutcome, "unknown");
});

for (const stage of ["received", "result"])
  test(`plugin storage failure at ${stage} does not repeat an operation`, async (t) => {
    const f = await fixture(t);
    f.start();
    f.failStorage(stage);
    await f.poll();
    const count = f.host.variables.length;
    assert.equal(count > 0, stage === "result");
    f.failStorage("");
    f.reboot();
    await f.poll();
    assert.equal(f.host.variables.length, count);
    assert.equal(f.delivered.length, 1);
    assert.equal(f.jobs.get(f.id).phase, "awaiting-native-result");
  });

for (const field of ["script", "fileKey", "readOnly", "operationId", "phase"])
  test(`plugin refuses altered command ${field}`, async (t) => {
    const f = await fixture(t);
    f.start();
    f.tamper((body) => {
      if (body.command)
        body.command[field] = field === "readOnly" ? true : "altered";
    });
    await f.poll();
    assert.equal(f.messages.at(-1).status, "refused");
    assert.equal(f.host.variables.length, 0);
  });

test("wrong capability, wrong file and unknown identity cannot receive commands or create connection records", async (t) => {
  const f = await fixture(t);
  f.start();
  const directory = path.join(f.repo, "private/source-native-transport"),
    before = readdirSync(directory);
  assert.throws(
    () => f.transport.claim(f.id, "0".repeat(64), SOURCE_NATIVE_FILE_KEY),
    /unauthorized/,
  );
  assert.throws(
    () => f.transport.claim(f.id, f.secret, "other-file"),
    /file-refused/,
  );
  assert.throws(() =>
    f.transport.claim(
      "00000000-0000-4000-8000-000000000099",
      f.secret,
      SOURCE_NATIVE_FILE_KEY,
    ),
  );
  assert.deepEqual(readdirSync(directory), before);
  assert.equal(f.jobs.get(f.id).phase, "prepared");
});

test("source changes block first creation delivery and a late result remains durable", async (t) => {
  const f = await fixture(t);
  f.start();
  const delivered = f.transport.claim(f.id, f.secret, SOURCE_NATIVE_FILE_KEY);
  assert.equal(delivered.status, "command");
  const envelope = await f.host.run(delivered.command!);
  f.stale();
  const result = f.transport.accept(f.id, f.secret, envelope);
  assert.equal(result.phase, "tokens-created");
  assert.equal(result.sourceCurrent, false);
  // Readback remains available, but never grants a stale-source write.
  const next = f.transport.claim(f.id, f.secret, SOURCE_NATIVE_FILE_KEY);
  assert.equal(next.status, "command");
  assert.equal(next.command?.readOnly, true);
  const g = await fixture(t);
  g.start();
  g.stale();
  assert.throws(() =>
    g.transport.claim(g.id, g.secret, SOURCE_NATIVE_FILE_KEY),
  );
  assert.equal(g.host.variables.length, 0);
});

for (const interrupt of ["result-storage", "result-upload", "command-response"])
  test(`readback retry recovers ${interrupt} without allocating again`, async (t) => {
    const f = await fixture(t);
    f.start();
    await f.poll();
    const count = f.host.variables.length,
      pages = f.host.figma.root.children.length;
    if (interrupt === "result-storage") f.failStorage("result");
    else f.lose(interrupt === "result-upload" ? "before-result" : "claim");
    await f.poll();
    assert.equal(f.jobs.get(f.id).pendingPhase, "token-readback");
    const first = f.delivered.at(-1);
    f.transport.retryObservation(f.id);
    f.failStorage("");
    f.reboot();
    await f.poll();
    assert.equal(
      f.jobs.get(f.id).phase,
      "tokens-observed",
      JSON.stringify(f.messages.at(-1)),
    );
    const replacement = f.delivered.at(-1);
    assert.equal(replacement.readOnly, true);
    assert.equal(replacement.phase, first.phase);
    assert.notEqual(replacement.attemptId, first.attemptId);
    assert.notEqual(replacement.nonce, first.nonce);
    assert.equal(replacement.scriptSha256, first.scriptSha256);
    assert.equal(f.host.variables.length, count);
    assert.equal(f.host.figma.root.children.length, pages);
  });

test("creation interruptions never qualify for the readback replacement protocol", async (t) => {
  const f = await fixture(t);
  f.start();
  f.failStorage("result");
  await f.poll();
  const first = f.delivered[0];
  assert.throws(
    () => f.transport.retryObservation(f.id),
    /observation-retry-refused/,
  );
  assert.deepEqual(
    f.transport.claim(f.id, f.secret, SOURCE_NATIVE_FILE_KEY, first.attemptId),
    { status: "awaiting-result" },
  );
  const count = f.host.variables.length;
  f.failStorage("");
  f.reboot();
  await f.poll();
  assert.equal(f.host.variables.length, count);
  assert.equal(f.delivered.length, 1);
});

test("an accepted readback cannot lend replacement authority to the next creation phase", async (t) => {
  const f = await fixture(t);
  f.start();
  await f.poll();
  await f.poll();
  const readback = f.delivered.at(-1);
  assert.equal(f.jobs.get(f.id).phase, "tokens-observed");
  assert.deepEqual(
    f.transport.claim(
      f.id,
      f.secret,
      SOURCE_NATIVE_FILE_KEY,
      readback.attemptId,
    ),
    { status: "awaiting-result" },
  );
  assert.equal(f.jobs.get(f.id).phase, "tokens-observed");
  assert.throws(
    () => f.transport.retryObservation(f.id),
    /observation-retry-refused/,
  );
});

test("retry resumes after interruption between abandoning the old readback and dispatching its replacement", async (t) => {
  const f = await fixture(t);
  f.start();
  await f.poll();
  f.lose("claim");
  await f.poll();
  f.transport.retryObservation(f.id);
  // Model a process stopping before the replacement dispatch was published.
  const events = path.join(
    f.repo,
    "private/source-native-app/operations",
    f.id,
    "events",
  );
  const files = readdirSync(events).sort();
  const last = path.join(events, files.at(-1)!);
  assert.equal(JSON.parse(readFileSync(last, "utf8")).kind, "dispatch");
  unlinkSync(last);
  assert.equal(f.jobs.get(f.id).phase, "observation-refused");
  const reopened = createNativeOperationTransport(f.repo, f.jobs);
  reopened.retryObservation(f.id);
  f.reboot();
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "tokens-observed");
});

test("finished inspections keep a read-only failed observation retryable", async (t) => {
  const f = await fixture(t);
  f.start();
  await f.poll();
  await f.poll();
  await f.poll();
  const page = f.host.figma.root.children.find(
    (node: any) => node.children.length,
  );
  const text = page.findOne((node: any) => node.type === "TEXT");
  const original = text.characters;
  text.characters = "native drift";
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "component-observation-refused");
  assert.equal(f.transport.status(f.id).finished, true);
  text.characters = original;
  f.transport.retryObservation(f.id);
  assert.equal(f.transport.status(f.id).finished, false);
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "component-structure-observed");
});

test("source validation latency cannot expire a heartbeat sampled at request entry", async (t) => {
  const f = await fixture(t);
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  await f.poll();
  const observedAt = now;
  assert.equal(f.transport.status(f.id).connected, true);
  now += 16_000;
  assert.equal(f.transport.status(f.id, observedAt).connected, true);
  assert.equal(
    f.transport.status(f.id).connected,
    false,
    "a later request sees real expiry",
  );
  await f.poll();
  assert.equal(f.transport.status(f.id).connected, true);
  assert.equal(
    f.jobs.get(f.id).phase,
    "prepared",
    "heartbeat grants no dispatch authority",
  );
});

test("a completed inspection can observe unchanged or edited nodes without allocating again", async (t) => {
  const f = await fixture(t);
  f.start();
  for (let i = 0; i < 4; i++) await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "component-structure-observed");
  const page = f.host.figma.root.children.find(
    (node: any) => node.children.length,
  );
  const before = {
    pages: f.host.figma.root.children.length,
    nodes: page.findAll().length,
    variables: f.host.variables.length,
  };
  const firstAttempt = f.jobs.get(f.id).imageObservation?.attemptId;
  f.transport.retryObservation(f.id);
  assert.equal(f.transport.status(f.id).finished, false);
  assert.equal(
    f.jobs.get(f.id).imageObservation,
    undefined,
    "prior images stop representing the current observation",
  );
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "component-structure-observed");
  assert.notEqual(f.jobs.get(f.id).imageObservation?.attemptId, firstAttempt);
  const text = page.findOne((node: any) => node.type === "TEXT");
  const original = text.characters;
  text.characters = "independent edit";
  f.transport.retryObservation(f.id);
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "component-observation-refused");
  text.characters = original;
  f.transport.retryObservation(f.id);
  await f.poll();
  assert.equal(f.jobs.get(f.id).phase, "component-structure-observed");
  assert.deepEqual(
    {
      pages: f.host.figma.root.children.length,
      nodes: page.findAll().length,
      variables: f.host.variables.length,
    },
    before,
  );
  assert.deepEqual(
    f.delivered.map((c) => c.phase),
    [
      "token-create",
      "token-readback",
      "component-create",
      "component-readback",
      "component-readback",
      "component-readback",
      "component-readback",
    ],
  );
});
