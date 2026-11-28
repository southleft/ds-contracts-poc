import test from "node:test";
import assert from "node:assert/strict";
import { contractFromCapture, makePlan } from "../src/roundtrip/surface.mjs";

function fixture() {
  const variants = [
    { key: "default", axes: { state: "default" } },
    { key: "active", axes: { state: "active" } },
  ];
  return {
    profile: {
      component: { name: "Control", slug: "control" },
      axes: [{ name: "state", values: ["default", "active"] }],
      props: [],
      variants,
      parts: { root: { kind: "frame", parent: null, order: 0, selector: "button", binds: {} } },
    },
    capture: {
      variants: variants.map((v, i) => ({ ...v, parts: { root: { styles: { layout: "row", width: 10 + i * 10 } } } })),
    },
  };
}
test("distinct variant measurements survive capture to the native plan", () => {
  const { profile, capture } = fixture();
  const contract = contractFromCapture(profile, capture, { kind: "code-capture" });
  assert.deepEqual(
    makePlan(contract).variants.map((v) => v.parts.root.styles.width),
    [10, 20],
  );
});
test("duplicate axis assignments cannot silently replace the first variant's values", () => {
  const { profile, capture } = fixture();
  const contract = contractFromCapture(profile, capture, { kind: "code-capture" });
  profile.variants[1].axes = profile.variants[0].axes;
  assert.throws(() => contractFromCapture(profile, capture, { kind: "code-capture" }), /duplicate variant axes/);
  contract.variants[1].axes = contract.variants[0].axes;
  assert.throws(() => makePlan(contract), /duplicate variant axes/);
});
test("partial axis assignments cannot shadow a fully assigned variant", () => {
  const { profile, capture } = fixture();
  profile.variants[0].axes.size = "sm";
  profile.variants[1].axes = { size: "sm" };
  assert.throws(() => contractFromCapture(profile, capture, { kind: "code-capture" }), /inconsistent variant axes/);
});
