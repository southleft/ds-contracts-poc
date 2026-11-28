import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { hash } from "../src/roundtrip/surface.mjs";
import { planWriteback, applyWriteback } from "../src/roundtrip/writeback.mjs";
import { fixture } from "./roundtrip-fixture.mjs";

test("reviewed edits preserve alias layers, JSON formatting and authored behavior", (t) => {
  const f = fixture(t),
    plan = planWriteback(f.B, f.before, f.after, f.policy);
  assert.equal(plan.digest, planWriteback(f.B, f.before, f.after, f.policy).digest);
  assert.equal(plan.edits.length, 1);
  assert.throws(() => applyWriteback(plan, f.policy, "unreviewed"), /reviewed plan digest/);
  applyWriteback(plan, f.policy, plan.digest);
  assert.equal(
    f.read("tokens.json"),
    '{\n  "primitive": "#abcdef", "semantic": "{primitive}", "component": "{semantic}"\n}\n',
  );
  assert.equal(f.read("source.tsx"), "authored behavior");
});
test("unresolved dependencies and unsupported native edits cannot become source edits", (t) => {
  const f = fixture(t),
    incomplete = structuredClone(f.B);
  delete incomplete.components.glyph;
  assert.throws(() => planWriteback(incomplete, f.before, f.after, f.policy), /unresolved-contract/);
  for (const mutate of [
    (n) => n.variants[0].parts.root.styles.padding[0]++,
    (n) => (n.variants[0].instances.icon.main = "replacement"),
    (n) => (n.tokens.component.codeSyntax.WEB = "bad"),
  ]) {
    const changed = structuredClone(f.after);
    mutate(changed);
    assert.throws(() => planWriteback(f.B, f.before, changed, f.policy), /unsupported-native-edit|metadata changed/);
  }
});
test("stale source and an occupied temporary path leave existing files intact", (t) => {
  const f = fixture(t),
    plan = planWriteback(f.B, f.before, f.after, f.policy),
    original = f.read("tokens.json");
  f.save("source.tsx", "concurrent edit");
  assert.throws(() => applyWriteback(plan, f.policy, plan.digest), /source-revision-conflict/);
  assert.equal(f.read("tokens.json"), original);
  assert.equal(f.read("source.tsx"), "concurrent edit");
  f.save("source.tsx", "authored behavior");
  f.save("tokens.json.ds-contracts-writeback", "occupied");
  assert.throws(() => applyWriteback(plan, f.policy, plan.digest), /EEXIST/);
  assert.equal(f.read("tokens.json"), original);
  assert.equal(f.read("tokens.json.ds-contracts-writeback"), "occupied");
});
test("an alias edit stays a source alias rather than becoming a resolved color", (t) => {
  const f = fixture(t),
    native = structuredClone(f.before);
  native.tokens.component.alias = "primitive";
  const plan = planWriteback(f.B, f.before, native, f.policy);
  assert.equal(plan.edits[0].after, "{primitive}");
  applyWriteback(plan, f.policy, plan.digest);
  assert.equal(JSON.parse(f.read("tokens.json")).component, "{primitive}");
});

for (const fault of ["deleted", "changed", "unwritable"]) {
  test(`rollback restores other files when one committed file is ${fault}`, (t) => {
    const f = fixture(t),
      names = ["a.json", "b.json", "c.json"];
    const before = '"#123456"',
      after = '"#abcdef"';
    names.forEach((name) => f.save(name, before));
    const policy = { ...f.policy, guards: names, tokens: names.map((file) => ({ file, path: [] })) };
    const body = {
      version: 1,
      system: policy.system,
      policySha256: hash(policy),
      guards: names.map((file) => ({ file, sha256: hash(before) })),
      files: names.map((file) => ({ file, beforeSha256: hash(before), afterSha256: hash(after) })),
      edits: names.map((file) => ({ id: file, file, path: [], before: "#123456", after: "#abcdef" })),
    };
    const plan = { ...body, digest: hash(body) },
      failed = Error("C commit failed");
    const rename = fs.renameSync,
      write = fs.writeFileSync,
      b = join(policy.root, "b.json");
    fs.renameSync = (from, to) => {
      if (to.endsWith("/c.json")) {
        if (fault === "deleted") fs.unlinkSync(b);
        if (fault === "changed") write(b, "concurrent content");
        throw failed;
      }
      return rename(from, to);
    };
    fs.writeFileSync = (file, ...args) => {
      if (fault === "unwritable" && file === b) throw Error("B rollback denied");
      return write(file, ...args);
    };
    syncBuiltinESMExports();
    try {
      assert.throws(
        () => applyWriteback(plan, policy, plan.digest),
        (error) => {
          if (fault === "changed") assert.equal(error, failed);
          else {
            assert.equal(error.cause, failed);
            assert.match(error.message, /rollback failed.*b.json/);
          }
          return true;
        },
      );
    } finally {
      fs.renameSync = rename;
      fs.writeFileSync = write;
      syncBuiltinESMExports();
    }
    assert.equal(f.read("a.json"), before);
    assert.equal(f.read("c.json"), before);
    if (fault === "deleted") assert.equal(fs.existsSync(b), false);
    else assert.equal(f.read("b.json"), fault === "changed" ? "concurrent content" : after);
    assert(names.every((name) => !fs.existsSync(join(policy.root, name + ".ds-contracts-writeback"))));
  });
}
