import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
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
    manifest.networkAccess.devAllowedDomains.includes("http://127.0.0.1:5181"),
  );
  assert(
    !manifest.networkAccess.allowedDomains.includes("http://127.0.0.1:5181"),
  );
});
async function fixture(t: test.TestContext) {
  const repo = mkdtempSync(path.join(tmpdir(), "native-transport-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const template = await comparisonFixture();
  let stale = false;
  const options: NativeOperationJobsOptions = {
    prepare: (_request, operation) => {
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
        `http://127.0.0.1:5181/api/source-reference/native/${id}/`,
      ),
    );
    const supplied = init.headers.Authorization.slice(7),
      payload = JSON.parse(init.body);
    let body: any;
    if (url.endsWith("/claim")) {
      body = transport.claim(id, supplied, payload.fileKey);
      if (body.command) delivered.push(body.command);
    } else {
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
  await f.poll();
  f.reboot();
  await f.poll();
  assert.equal(f.delivered.length, 4);
  assert.equal(f.host.variables.length, variables);
  assert.equal(f.host.figma.root.children.length, pages);
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
  assert.equal(next.command?.readOnly, true);
  const g = await fixture(t);
  g.start();
  g.stale();
  assert.throws(() =>
    g.transport.claim(g.id, g.secret, SOURCE_NATIVE_FILE_KEY),
  );
  assert.equal(g.host.variables.length, 0);
});
