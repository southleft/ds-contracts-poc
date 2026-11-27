import test from "node:test";
import assert from "node:assert/strict";
import { planWriteback } from "../src/roundtrip/plan.mjs";
import { fixture } from "./roundtrip-fixture.mjs";

test("planning is deterministic, preserves aliases and leaves source untouched", (t) => {
  const f = fixture(t),
    original = f.read("tokens.json");
  const plan = planWriteback(f.B, f.before, f.after, f.policy);
  assert.deepEqual(plan, planWriteback(f.B, f.before, f.after, f.policy));
  assert.deepEqual(plan.edits, [
    { id: "primitive", file: "tokens.json", path: ["primitive"], before: "#123456", after: "#abcdef" },
  ]);
  assert.equal(f.read("tokens.json"), original);
  const aliased = structuredClone(f.before);
  aliased.tokens.component.alias = "primitive";
  assert.equal(planWriteback(f.B, f.before, aliased, f.policy).edits[0].after, "{primitive}");
});
test("planning refuses missing dependencies, unsupported edits and stale input", (t) => {
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
  f.save("source.tsx", "concurrent edit");
  assert.throws(() => planWriteback(f.B, f.before, f.after, f.policy), /source-revision-conflict/);
});
