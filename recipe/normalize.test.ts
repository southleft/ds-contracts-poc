import assert from "node:assert/strict";
import test from "node:test";

import {
  CanonicalizationError,
  canonicalJson,
  normalizeCanonicalJson,
} from "./normalize.js";

test("normalization is idempotent across nested objects and arrays", () => {
  const input = {
    z: true,
    nested: { omega: null, alpha: [3, { y: "last", x: "first" }] },
    a: 1,
  };
  const once = normalizeCanonicalJson(input);
  const twice = normalizeCanonicalJson(once);

  assert.deepEqual(twice, once);
  assert.equal(
    canonicalJson(input),
    '{"a":1,"nested":{"alpha":[3,{"x":"first","y":"last"}],"omega":null},"z":true}',
  );
});

test("object insertion order is irrelevant at every depth", () => {
  const left = {
    recipe: { version: 1, id: "recipe.button" },
    ir: { fills: [{ color: "#2563ebff", kind: "solid" }], kind: "frame" },
  };
  const right = {
    ir: { kind: "frame", fills: [{ kind: "solid", color: "#2563ebff" }] },
    recipe: { id: "recipe.button", version: 1 },
  };

  assert.equal(canonicalJson(left), canonicalJson(right));
});

test("arrays retain semantic order", () => {
  assert.notEqual(
    canonicalJson({ children: ["label", "icon"] }),
    canonicalJson({ children: ["icon", "label"] }),
    "a planted child-order mutation must make the canonical check red",
  );
});

test("Unicode is preserved without locale sorting or normalization", () => {
  const composed = "é";
  const decomposed = "e\u0301";
  const value = { "😀": "rocket 🚀", [composed]: composed, a: decomposed };

  assert.equal(
    canonicalJson(value),
    `{"a":"${decomposed}","${composed}":"${composed}","😀":"rocket 🚀"}`,
  );
  assert.notEqual(
    canonicalJson(composed),
    canonicalJson(decomposed),
    "Unicode normalization would silently change string identity",
  );
  assert.equal(canonicalJson("\ud800"), '"\\ud800"');
});

test("negative zero has the explicit canonical policy zero", () => {
  const normalized = normalizeCanonicalJson(-0);
  assert.equal(Object.is(normalized, -0), false);
  assert.equal(normalized, 0);
  assert.equal(canonicalJson({ value: -0 }), '{"value":0}');
});

test("values JSON would omit or coerce are rejected by path", () => {
  const rejected: Array<[unknown, RegExp]> = [
    [undefined, /undefined/],
    [{ value: undefined }, /\$\["value"\]: undefined/],
    [[undefined], /\$\[0\]: undefined/],
    [Number.NaN, /non-finite/],
    [Number.POSITIVE_INFINITY, /non-finite/],
    [1n, /bigint/],
    [() => undefined, /function/],
    [Symbol("value"), /symbol/],
    [new Date(0), /non-plain object Date/],
    [new Map(), /non-plain object Map/],
  ];

  for (const [value, expected] of rejected) {
    assert.throws(
      () => normalizeCanonicalJson(value),
      (error: unknown) =>
        error instanceof CanonicalizationError && expected.test(error.message),
    );
  }
});

test("sparse and decorated arrays are rejected", () => {
  const sparse: unknown[] = Array(2);
  sparse[1] = "present";
  assert.throws(
    () => canonicalJson(sparse),
    /sparse arrays are not canonical JSON/,
  );

  const decorated = ["value"] as string[] & { note?: string };
  decorated.note = "not an element";
  assert.throws(
    () => canonicalJson(decorated),
    /array has unsupported own property note/,
  );

  const hiddenElement = ["value"];
  Object.defineProperty(hiddenElement, "0", {
    enumerable: false,
    value: "value",
  });
  assert.throws(
    () => canonicalJson(hiddenElement),
    /non-enumerable array elements/,
  );
});

test("symbols, accessors, and hidden properties cannot disappear silently", () => {
  const symbolKeyed = { visible: true, [Symbol("hidden")]: false };
  assert.throws(() => canonicalJson(symbolKeyed), /symbol-keyed properties/);

  let getterCalled = false;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      getterCalled = true;
      return 1;
    },
  });
  assert.throws(() => canonicalJson(accessor), /accessors/);
  assert.equal(
    getterCalled,
    false,
    "canonicalization must not execute getters",
  );

  const hidden = Object.defineProperty({}, "value", {
    enumerable: false,
    value: 1,
  });
  assert.throws(() => canonicalJson(hidden), /non-enumerable properties/);
});

test("cycles are detected while repeated non-cyclic references remain values", () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assert.throws(
    () => canonicalJson(cyclic),
    (error: unknown) =>
      error instanceof CanonicalizationError &&
      error.path === '$["self"]' &&
      /cycle detected/.test(error.message),
  );

  const shared = { value: 1 };
  assert.equal(
    canonicalJson({ left: shared, right: shared }),
    '{"left":{"value":1},"right":{"value":1}}',
  );
});

test("falsification: a host serializer fails the key-order check", () => {
  const first = { b: 2, a: 1 };
  const second = { a: 1, b: 2 };

  assert.throws(
    () => assert.equal(JSON.stringify(first), JSON.stringify(second)),
    /Expected values to be strictly equal/,
    "the planted non-canonical implementation must be observable as red",
  );
  assert.equal(canonicalJson(first), canonicalJson(second));
});
