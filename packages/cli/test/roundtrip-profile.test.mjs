import test from "node:test";
import assert from "node:assert/strict";
import { inspectProfile } from "../src/roundtrip/profile.mjs";
import { fixture } from "./roundtrip-fixture.mjs";

function profile(t) {
  const f = fixture(t);
  f.save("font.woff2", "font preflight input");
  f.save("tokens.json", {
    $type: "color",
    primitive: { value: "#123456" },
    semantic: { value: "{primitive}" },
    component: { value: "{semantic}" },
  });
  const P = {
    version: 1,
    system: { id: "test", mode: "light" },
    architecture: ["primitive", "semantic", "component"],
    component: { id: "parent", export: "Control", name: "Control" },
    source: "source.tsx",
    appearance: { variants: [{ key: "default" }] },
    tokens: Object.fromEntries(
      ["primitive", "semantic", "component"].map((tier) => [tier, { tier, file: "tokens.json", field: "value" }]),
    ),
    dependencies: { glyph: { name: "Glyph", source: "source.tsx", selector: "svg", export: "Glyph" } },
    instances: { icon: { component: "glyph", colorToken: "component" } },
    capture: { font: { family: "Test Font", file: "font.woff2" } },
    figma: {},
  };
  return { ...f, P };
}
test("a declared profile preserves inherited token types, aliases and dependency revisions", (t) => {
  const { P, policy } = profile(t),
    B = inspectProfile(P, policy.root);
  assert.deepEqual(B, inspectProfile(P, policy.root));
  assert.equal(B.system.tokens.component.alias, "semantic");
  assert.equal(B.system.tokens.semantic.alias, "primitive");
  assert.deepEqual(B.system.tokens.component.source.path, ["component", "value"]);
  assert.deepEqual(B.components.parent.requires, [{ id: "glyph", revision: B.components.glyph.revision }]);
  assert.deepEqual(B.components.parent.behavior, {
    owner: "react-source",
    source: { ...B.components.parent.source, export: "Control" },
    equivalence: "not-asserted",
    tests: "not-recorded",
  });
  P.component.export = "OtherControl";
  assert.notEqual(inspectProfile(P, policy.root).components.parent.revision, B.components.parent.revision);
  P.behavior = { equivalence: "verified" };
  assert.throws(() => inspectProfile(P, policy.root), /profile.behavior is unsupported/);
  delete P.behavior;
  P.codeOnly = "all interactions";
  assert.throws(() => inspectProfile(P, policy.root), /invalid codeOnly declarations/);
});
test("missing fonts, dependencies and token aliases are named before capture", (t) => {
  const { P, policy } = profile(t),
    missingFont = structuredClone(P),
    missingDependency = structuredClone(P),
    missingToken = structuredClone(P);
  missingFont.capture.font.file = "absent.woff2";
  assert.throws(() => inspectProfile(missingFont, policy.root), /missing font: Test Font/);
  delete missingDependency.dependencies.glyph;
  assert.throws(() => inspectProfile(missingDependency, policy.root), /missing-component-contract: glyph/);
  delete missingToken.tokens.primitive;
  assert.throws(() => inspectProfile(missingToken, policy.root), /missing-token.*primitive/);
});
test("duplicate variant keys or axis assignments are refused before capture", (t) => {
  const { P, policy } = profile(t);
  for (const [variants, field] of [
    [[{ key: "default" }, { key: "second" }], "axes"],
    [
      [
        { key: "a", axes: { state: "on", size: "sm" } },
        { key: "b", axes: { size: "sm", state: "on" } },
      ],
      "axes",
    ],
    [
      [
        { key: "a", axes: { state: "on" } },
        { key: "a", axes: { state: "off" } },
      ],
      "key",
    ],
  ]) {
    P.appearance.variants = variants;
    assert.throws(() => inspectProfile(P, policy.root), new RegExp("duplicate variant " + field));
  }
  P.appearance.variants = [
    { key: "a", axes: { size: "sm", state: "on" } },
    { key: "b", axes: { size: "sm" } },
  ];
  assert.throws(() => inspectProfile(P, policy.root), /inconsistent variant axes/);
});
test("typed axes retain their values but cannot collide after Figma string conversion", (t) => {
  const { P, policy } = profile(t);
  for (const value of [false, 1]) {
    P.appearance.variants = [
      { key: "a", axes: { state: value } },
      { key: "b", axes: { state: String(value) } },
    ];
    assert.throws(() => inspectProfile(P, policy.root), /duplicate variant axes/);
  }
  P.appearance.variants = [
    { key: "a", axes: { state: false } },
    { key: "b", axes: { state: "true" } },
  ];
  assert.doesNotThrow(() => inspectProfile(P, policy.root));
  assert.equal(P.appearance.variants[0].axes.state, false);
});
