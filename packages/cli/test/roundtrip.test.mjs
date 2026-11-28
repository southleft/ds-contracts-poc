import test from "node:test";
import assert from "node:assert/strict";
import fs, { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { hash } from "../src/roundtrip/surface.mjs";
import { runRoundtrip } from "../src/roundtrip/index.mjs";
import { fixture, sessionFixture } from "./roundtrip-fixture.mjs";

test("failed session review is recoverable and leaves ready state intact", async (t) => {
  const f = fixture(t),
    state = { version: 1, root: f.dir, profile: { figma: {} }, stage: "ready", native: f.before, policy: f.policy };
  f.save("session.json", state);
  f.save("bundle.json", f.B);
  const bad = structuredClone(f.after);
  bad.variants[0].parts.root.styles.padding[0] = 9;
  f.save("native.json", bad);
  await assert.rejects(
    runRoundtrip(["review", "--session", f.dir, "--snapshot", join(f.dir, "native.json")], { log: () => {} }),
    /unsupported-native-edit/,
  );
  assert.deepEqual(JSON.parse(f.read("session.json")), state);
  assert(!existsSync(join(f.dir, ".lock")));
  f.save("native.json", f.after);
  await runRoundtrip(["review", "--session", f.dir, "--snapshot", join(f.dir, "native.json")], { log: () => {} });
  assert.equal(JSON.parse(f.read("session.json")).stage, "reviewed");
  await runRoundtrip(["discard", "--session", f.dir], { log: () => {} });
  assert.equal(JSON.parse(f.read("session.json")).stage, "ready");
  f.save("native.json", f.before);
  await runRoundtrip(["review", "--session", f.dir, "--snapshot", join(f.dir, "native.json")], { log: () => {} });
  assert.equal(JSON.parse(f.read("session.json")).stage, "ready");
});
test("accept refuses source changed since capture and retains pending state", async (t) => {
  const f = fixture(t),
    state = {
      version: 1,
      root: f.dir,
      profile: { figma: {} },
      stage: "awaiting-figma",
      inputs: [{ file: join(f.dir, "source.tsx"), sha256: hash("authored behavior") }],
    };
  f.save("session.json", state);
  f.save("bundle.json", f.B);
  f.save("native.json", f.before);
  f.save("source.tsx", "changed");
  await assert.rejects(
    runRoundtrip(["accept", "--session", f.dir, "--snapshot", join(f.dir, "native.json")], { log: () => {} }),
    /source changed since capture/,
  );
  assert.deepEqual(JSON.parse(f.read("session.json")), state);
});
test("session lock prevents concurrent writers without removing their lock", async (t) => {
  const f = fixture(t);
  f.save("session.json", {});
  f.save(".lock", "owner");
  await assert.rejects(runRoundtrip(["status", "--session", f.dir]), /EEXIST/);
  assert.equal(f.read(".lock"), "owner");
});
test("accept reports intrinsic-size differences but refuses fixed-size changes", async (t) => {
  const f = fixture(t);
  f.B.components.parent.instances = {};
  f.B.components.parent.appearance = {
    parts: {
      root: {
        styles: Object.fromEntries(
          Object.entries({ width: 43.71875, height: 20, "width-sizing": "hug", "height-sizing": "fixed" }).map(
            ([k, value]) => [k, { base: { value, token: null } }],
          ),
        ),
      },
    },
    variants: [{ key: "default", axes: {} }],
  };
  const n = {
    parent: { component: "parent", id: "set" },
    components: {},
    tokens: f.before.tokens,
    variants: [
      {
        key: "default",
        axes: {},
        parts: {
          root: { styles: { width: 44, height: 20, "width-sizing": "hug", "height-sizing": "fixed" }, tokens: {} },
        },
        instances: {},
      },
    ],
  };
  const state = {
    version: 1,
    root: f.dir,
    profile: { figma: {}, dependencies: {}, capture: {}, source: "source.tsx" },
    stage: "awaiting-figma",
    inputs: [],
  };
  f.save("session.json", state);
  f.save("bundle.json", f.B);
  f.save("snapshot.json", n);
  let result;
  await runRoundtrip(["accept", "--session", f.dir, "--snapshot", join(f.dir, "snapshot.json")], {
    log: (v) => (result = v),
  });
  assert.equal(result.status, "synchronized-with-measurement-differences");
  assert.equal(result.differences[0].code, 43.71875);
  assert.equal(result.differences[0].figma, 44);
  assert.equal(result.differences[0].result, "differs");
  f.save("session.json", state);
  n.variants[0].parts.root.styles.height = 21;
  f.save("snapshot.json", n);
  await assert.rejects(
    runRoundtrip(["accept", "--session", f.dir, "--snapshot", join(f.dir, "snapshot.json")], { log: () => {} }),
    /native value differs: root.height/,
  );
  assert.equal(JSON.parse(f.read("session.json")).stage, "awaiting-figma");
});

test("read cannot replace a pending projection", async (t) => {
  const f = sessionFixture(t);
  f.state.stage = "awaiting-figma";
  f.save("session.json", f.state);
  await assert.rejects(runRoundtrip(["read", "--session", f.dir], { log: () => {} }), /accept the pending projection/);
  assert.equal(f.read("figma.js"), "pending program");
});
test("failed capture preserves a concurrent edit to generated CSS", async (t) => {
  const f = sessionFixture(t),
    original = f.read("tokens.json"),
    state = f.read("session.json");
  const captureSource = async (_P, _root, _out, _reader, { onGenerated }) => {
    f.save("generated.css", "built CSS");
    onGenerated(join(f.dir, "generated.css"), hash("built CSS"));
    f.save("generated.css", "concurrent CSS");
    throw Error("capture failed");
  };
  await assert.rejects(runRoundtrip(f.args, { reader: {}, captureSource, log: () => {} }), /capture failed/);
  assert.equal(f.read("tokens.json"), original);
  assert.equal(f.read("generated.css"), "concurrent CSS");
  assert.equal(f.read("session.json"), state);
});
test("program-generation and state-commit failures preserve the prior session and source", async (t) => {
  for (const kind of ["program", "state"]) {
    const f = sessionFixture(t);
    if (kind === "program") {
      f.state.profile.figma = {};
      f.save("session.json", f.state);
    } else f.save("session.json.next", "other writer");
    const before = {
      source: f.read("tokens.json"),
      bundle: f.read("bundle.json"),
      state: f.read("session.json"),
      program: f.read("figma.js"),
    };
    await assert.rejects(
      runRoundtrip(f.args, { reader: {}, captureSource: f.captureSource, log: () => {} }),
      kind === "program" ? /missing Figma target/ : /EEXIST/,
    );
    assert.equal(f.read("tokens.json"), before.source);
    assert.equal(f.read("bundle.json"), before.bundle);
    assert.equal(f.read("session.json"), before.state);
    assert.equal(f.read("figma.js"), before.program);
    if (kind === "state") assert.equal(f.read("session.json.next"), "other writer");
  }
});
test("a derived-artifact failure leaves an authoritative resumable committed session", async (t) => {
  const f = sessionFixture(t),
    captureSource = async (...args) => {
      const next = await f.captureSource(...args);
      rmSync(join(f.dir, "bundle.json"));
      mkdirSync(join(f.dir, "bundle.json"));
      return next;
    };
  await assert.rejects(
    runRoundtrip(f.args, { reader: {}, captureSource, log: () => {} }),
    /session committed; retry sync/,
  );
  const saved = JSON.parse(f.read("session.json"));
  assert.equal(saved.stage, "awaiting-figma");
  assert.equal(saved.bundle.system.tokens.primitive.value, "#abcdef");
  assert.equal(JSON.parse(f.read("tokens.json")).primitive, "#abcdef");
  assert(!existsSync(join(f.dir, "session.json.next")));
  let status;
  await runRoundtrip(["status", "--session", f.dir], { log: (v) => (status = v) });
  assert.equal(status.stage, "awaiting-figma");
});
test("a failed start retains a retryable starting session", async (t) => {
  const f = sessionFixture(t),
    dir = join(f.dir, "new-session");
  f.save("profile.json", f.state.profile);
  const args = ["start", "--profile", join(f.dir, "profile.json"), "--out", dir, "--root", f.dir];
  const captureSource = async (...args) => {
    await f.captureSource(...args);
    throw Error("capture failed");
  };
  await assert.rejects(runRoundtrip(args, { reader: {}, captureSource, log: () => {} }), /capture failed/);
  assert.equal(JSON.parse(fs.readFileSync(join(dir, "session.json"))).stage, "starting");
  await runRoundtrip(args, { reader: {}, captureSource: f.captureSource, log: () => {} });
  assert.equal(JSON.parse(fs.readFileSync(join(dir, "session.json"))).stage, "awaiting-figma");
});
test("failed refresh restores generated inputs so the same command can retry", async (t) => {
  const f = sessionFixture(t);
  f.state.stage = "ready";
  f.state.inputs = [{ file: join(f.dir, "generated.css"), sha256: hash("original generated") }];
  f.save("session.json", f.state);
  const args = ["refresh", "--session", f.dir];
  const captureSource = async (_P, _root, _out, _reader, { onGenerated }) => {
    f.save("generated.css", "built");
    onGenerated(join(f.dir, "generated.css"), hash("built"));
    throw Error("refresh capture failed");
  };
  await assert.rejects(runRoundtrip(args, { reader: {}, captureSource, log: () => {} }), /refresh capture failed/);
  assert.equal(f.read("generated.css"), "original generated");
  assert.equal(JSON.parse(f.read("session.json")).stage, "ready");
  await runRoundtrip(args, { reader: {}, captureSource: f.captureSource, log: () => {} });
  assert.equal(JSON.parse(f.read("session.json")).stage, "awaiting-figma");
});
test("one failed rollback does not prevent other restores or hide the capture error", async (t) => {
  const f = sessionFixture(t),
    original = f.read("tokens.json"),
    write = fs.writeFileSync;
  const captureSource = async (_P, _root, _out, _reader, { onGenerated }) => {
    f.save("generated.css", "built");
    onGenerated(join(f.dir, "generated.css"), hash("built"));
    fs.writeFileSync = (file, data, ...args) => {
      if (file === join(f.dir, "generated.css") && data === "original generated") throw Error("restore denied");
      return write(file, data, ...args);
    };
    syncBuiltinESMExports();
    throw Error("capture failed");
  };
  try {
    await assert.rejects(runRoundtrip(f.args, { reader: {}, captureSource, log: () => {} }), (error) => {
      assert(error instanceof AggregateError);
      assert.match(error.message, /capture failed.*restore denied/);
      assert.equal(error.cause.message, "capture failed");
      return true;
    });
  } finally {
    fs.writeFileSync = write;
    syncBuiltinESMExports();
  }
  assert.equal(f.read("tokens.json"), original);
  assert.equal(JSON.parse(f.read("session.json")).stage, "reviewed");
});
test("failed comparison output keeps acceptance pending and can be retried", async (t) => {
  const f = sessionFixture(t);
  f.state.stage = "awaiting-figma";
  f.state.bundle.components.parent.instances = {};
  f.save("session.json", f.state);
  const native = {
    parent: { component: "parent" },
    components: {},
    tokens: f.before.tokens,
    variants: [{ key: "default", axes: {}, parts: { root: { styles: { layout: "row" }, tokens: {} } }, instances: {} }],
  };
  delete f.state.native;
  f.save("session.json", f.state);
  f.save("snapshot.json", native);
  mkdirSync(join(f.dir, "comparison.json"));
  const args = ["accept", "--session", f.dir, "--snapshot", join(f.dir, "snapshot.json")];
  await assert.rejects(runRoundtrip(args, { log: () => {} }), /EISDIR/);
  assert.equal(JSON.parse(f.read("session.json")).stage, "awaiting-figma");
  rmSync(join(f.dir, "comparison.json"), { recursive: true });
  await runRoundtrip(args, { log: () => {} });
  assert.equal(JSON.parse(f.read("session.json")).stage, "ready");
  assert.equal(JSON.parse(f.read("comparison.json"))[0].result, "match");
});
test("a start retry cannot overwrite a session completed while it acquired the lock", async (t) => {
  const f = sessionFixture(t),
    open = fs.openSync;
  f.state.stage = "starting";
  f.save("session.json", f.state);
  f.save("profile.json", f.state.profile);
  fs.openSync = (file, ...args) => {
    const fd = open(file, ...args);
    if (file === join(f.dir, ".lock")) f.save("session.json", { ...f.state, stage: "ready", winner: true });
    return fd;
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(
      runRoundtrip(["start", "--out", f.dir, "--profile", join(f.dir, "profile.json")], {
        reader: {},
        captureSource: f.captureSource,
        log: () => {},
      }),
      /session already started/,
    );
  } finally {
    fs.openSync = open;
    syncBuiltinESMExports();
  }
  assert.equal(JSON.parse(f.read("session.json")).winner, true);
  assert(!existsSync(join(f.dir, ".lock")));
});
