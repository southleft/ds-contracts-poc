import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { saveState, policy } from "../src/roundtrip/session.mjs";
import { verifyProjection } from "../src/roundtrip/projection.mjs";
import { fixture } from "./roundtrip-fixture.mjs";

test("atomic session saves preserve an occupied temporary file and the prior state", (t) => {
  const f = fixture(t),
    file = join(f.policy.root, "session.json");
  saveState(file, { stage: "ready" });
  f.save("session.json.next", "another writer");
  assert.throws(() => saveState(file, { stage: "awaiting-figma" }), /EEXIST/);
  assert.deepEqual(JSON.parse(f.read("session.json")), { stage: "ready" });
  assert.equal(f.read("session.json.next"), "another writer");
  assert(existsSync(file));
});
test("ownership guards token sources without treating them as immutable component inputs", (t) => {
  const f = fixture(t),
    P = {
      source: "source.tsx",
      story: "source.tsx",
      stylesheet: "source.tsx",
      dependencies: {},
      capture: { inputs: ["tokens.json", "source.tsx"] },
    };
  const result = policy(P, f.B, f.before, f.policy.root);
  assert.deepEqual(
    result.inputs.map((input) => input.file),
    ["source.tsx"],
  );
  assert.deepEqual(result.guards.sort(), ["source.tsx", "tokens.json"]);
  assert.equal(result.tokens.length, 3);
});
function projection() {
  const B = {
    root: "control",
    system: { tokens: { color: { value: "#123456", css: "--color" } } },
    components: {
      glyph: { revision: "r1" },
      control: {
        instances: { icon: { component: "glyph", colorToken: "color" } },
        appearance: {
          variants: [{ key: "default", axes: {} }],
          parts: {
            root: {
              styles: {
                width: { base: { value: 43.71875 } },
                "width-sizing": { base: { value: "hug" } },
                fill: { base: { value: "#123456", token: "color" } },
              },
            },
          },
        },
      },
    },
  };
  const native = {
    parent: { component: "control" },
    tokens: { color: { value: "#123456", codeSyntax: { WEB: "var(--color)" } } },
    variants: [
      {
        key: "default",
        axes: {},
        parts: { root: { styles: { width: 44, "width-sizing": "hug", fill: "#123456" }, tokens: { fill: "color" } } },
        instances: { icon: { component: "glyph", revision: "r1", colorToken: "color" } },
      },
    ],
  };
  return { B, native };
}
test("intrinsic geometry remains an explicit difference; fixed geometry is refused", () => {
  const { B, native } = projection(),
    row = verifyProjection(B, native).find((row) => row.field === "width");
  assert.equal(row.result, "differs");
  assert.equal(row.code, 43.71875);
  assert.equal(row.figma, 44);
  B.components.control.appearance.parts.root.styles["width-sizing"].base.value = "fixed";
  native.variants[0].parts.root.styles["width-sizing"] = "fixed";
  assert.throws(() => verifyProjection(B, native), /native value differs: root.width/);
});
test("matching colors cannot conceal a lost binding or stale dependency", () => {
  const { B, native } = projection();
  native.variants[0].parts.root.tokens = {};
  assert.throws(() => verifyProjection(B, native), /native bindings differ/);
  native.variants[0].parts.root.tokens = { fill: "color" };
  native.variants[0].instances.icon.revision = "stale";
  assert.throws(() => verifyProjection(B, native), /dependency revision differs/);
});
test("a repeated native variant cannot conceal a missing contract variant", () => {
  const { B, native } = projection();
  B.components.control.appearance.variants.push({ key: "second", axes: { state: "second" } });
  native.variants.push(structuredClone(native.variants[0]));
  assert.throws(() => verifyProjection(B, native), /variant inventory changed/);
  native.variants[1].key = "unexpected";
  assert.throws(() => verifyProjection(B, native), /variant inventory changed/);
  native.variants[1].key = "second";
  native.variants[1].axes = { state: "second" };
  assert.doesNotThrow(() => verifyProjection(B, native));
  B.components.control.appearance.variants[1].key = "default";
  assert.throws(() => verifyProjection(B, native), /duplicate contract variant key/);
});
