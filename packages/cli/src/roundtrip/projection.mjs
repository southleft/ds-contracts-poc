import assert from "node:assert/strict";
import { values } from "./surface.mjs";

const stable = (v) =>
  JSON.stringify(v, (_, x) =>
    typeof x === "number"
      ? Math.round(x * 1e6) / 1e6
      : x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
        : x,
  );
export const same = (a, b, message) => assert.equal(stable(a), stable(b), message);
export const snapshot = (v) => v.result?.snapshot ?? v.result?.after ?? v.result ?? v.snapshot ?? v.after ?? v;
export function verifyProjection(B, native) {
  const comparisons = [],
    parent = B.components[B.root];
  assert.equal(native.parent.component, B.root, "wrong native component");
  const keys = parent.appearance.variants.map((v) => v.key).sort();
  assert.equal(new Set(keys).size, keys.length, "duplicate contract variant key");
  same(native.variants.map((v) => v.key).sort(), keys, "variant inventory changed");
  for (const v of native.variants) {
    const expected = parent.appearance.variants.find((x) => x.key === v.key);
    assert(expected, "unexpected variant");
    same(v.axes, expected.axes, "variant axes differ");
    same(Object.keys(v.parts).sort(), Object.keys(parent.appearance.parts).sort(), "part inventory differs");
    for (const [id, part] of Object.entries(parent.appearance.parts)) {
      const cells = values(part, expected.axes);
      for (const [field, c] of Object.entries(cells)) {
        const observed = v.parts[id].styles[field],
          matches = stable(observed) === stable(c.value),
          derived = ["width", "height"].includes(field) && cells[field + "-sizing"]?.value === "hug";
        comparisons.push({
          variant: v.key,
          part: id,
          field,
          result: matches ? "match" : "differs",
          code: c.value,
          figma: observed,
          derived,
        });
        if (!matches && !derived) same(observed, c.value, "native value differs: " + id + "." + field);
      }
      same(
        v.parts[id].tokens,
        Object.fromEntries(
          Object.entries(cells)
            .filter(([, c]) => c.token)
            .map(([k, c]) => [k, c.token]),
        ),
        "native bindings differ: " + id,
      );
    }
    for (const [slot, d] of Object.entries(parent.instances)) {
      assert.equal(v.instances[slot]?.component, d.component, "missing component dependency: " + slot);
      assert.equal(v.instances[slot].revision, B.components[d.component].revision, "dependency revision differs");
      assert.equal(v.instances[slot].colorToken, d.colorToken, "dependency binding differs");
    }
  }
  for (const [id, t] of Object.entries(B.system.tokens)) {
    const n = native.tokens[id];
    assert(n, "missing native token: " + id);
    same(n.alias ?? n.value, t.alias ?? t.value, "native token differs: " + id);
    assert.equal(n.codeSyntax.WEB, "var(" + t.css + ")", "native code syntax differs");
  }
  return comparisons;
}

export function identity(n) {
  return {
    parent: n.parent,
    components: Object.fromEntries(Object.entries(n.components).map(([id, c]) => [id, c.id])),
    tokens: Object.fromEntries(Object.entries(n.tokens).map(([id, t]) => [id, t.id])),
    variants: n.variants.map((v) => ({
      id: v.id,
      parts: Object.fromEntries(Object.entries(v.parts).map(([id, p]) => [id, p.id])),
      instances: Object.fromEntries(Object.entries(v.instances).map(([id, i]) => [id, { id: i.id, main: i.main }])),
    })),
  };
}
