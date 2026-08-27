import assert from "node:assert/strict";
import test from "node:test";

import type { RecipeEnvelope } from "./envelope.js";
import {
  RECIPE_HASH_ALGORITHM,
  RECIPE_HASH_DOMAIN,
  canonicalRecipeEnvelopeJson,
  deriveRecipeIntegrity,
  hashCanonicalJson,
  hashRecipeEnvelope,
  type RecipeEnvelopeHashInput,
} from "./hash.js";

const unsignedEnvelope = {
  envelope: 1,
  id: "ds.button",
  name: "Button",
  archetype: "button",
  recipe: { id: "recipe.button", version: 1 },
  ir: {
    kind: "frame",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 8,
      padding: { top: 8, right: 16, bottom: 8, left: 16 },
      width: { mode: "hug" },
      height: { mode: "hug" },
    },
    fills: [{ kind: "solid", color: "#2563ebff" }],
    children: [],
  },
  accounting: {
    carried: [{ path: "root", channel: "background-color" }],
  },
  extensions: [],
  receipts: [],
  provenance: {
    source: "contracts/button.contract.json",
    tool: "recipe.button@1",
    generatedAt: "2026-08-26T00:00:00.000Z",
  },
} satisfies Omit<RecipeEnvelope, "integrity">;

test("SHA-256 is insensitive to recursive object insertion order", () => {
  const left = {
    recipe: { version: 1, id: "recipe.button" },
    ir: { kind: "frame", children: [{ kind: "text", characters: "Save" }] },
  };
  const right = {
    ir: { children: [{ characters: "Save", kind: "text" }], kind: "frame" },
    recipe: { id: "recipe.button", version: 1 },
  };

  assert.equal(
    hashCanonicalJson(left, RECIPE_HASH_DOMAIN),
    hashCanonicalJson(right, RECIPE_HASH_DOMAIN),
  );
});

test("meaningful array order and scalar changes alter the hash", () => {
  const baseline = hashCanonicalJson(
    { children: ["icon", "label"], gap: 8 },
    RECIPE_HASH_DOMAIN,
  );
  const reordered = hashCanonicalJson(
    { children: ["label", "icon"], gap: 8 },
    RECIPE_HASH_DOMAIN,
  );
  const changed = hashCanonicalJson(
    { children: ["icon", "label"], gap: 12 },
    RECIPE_HASH_DOMAIN,
  );

  assert.notEqual(
    reordered,
    baseline,
    "the planted child-order mutation must make recipe:hash:check red",
  );
  assert.notEqual(
    changed,
    baseline,
    "the planted scalar mutation must make recipe:hash:check red",
  );
});

test("the versioned domain participates in the digest", () => {
  const value = { text: "保存 🚀" };
  const v1 = hashCanonicalJson(value, RECIPE_HASH_DOMAIN);
  const hypotheticalV2 = hashCanonicalJson(
    value,
    "ds-contracts/recipe-envelope-json/v2",
  );

  assert.match(v1, /^[0-9a-f]{64}$/);
  assert.notEqual(v1, hypotheticalV2);
  assert.throws(() => hashCanonicalJson(value, ""), /non-empty/);
  assert.throws(
    () => hashCanonicalJson(value, "bad\0domain"),
    /contain no NUL/,
  );
});

test("the canonical UTF-8 + domain digest has a pinned test vector", () => {
  assert.equal(
    hashCanonicalJson(
      { text: "保存 🚀", nested: { b: 2, a: 1 } },
      RECIPE_HASH_DOMAIN,
    ),
    "b46ba20961616d19acb17db728b7e20139b434114215c129771995393a33fb9f",
  );
});

test("envelope integrity is removed from its own hash", () => {
  const first: RecipeEnvelope = {
    ...unsignedEnvelope,
    integrity: {
      algorithm: RECIPE_HASH_ALGORITHM,
      domain: RECIPE_HASH_DOMAIN,
      canonicalHash: "0".repeat(64),
    },
  };
  const second: RecipeEnvelope = {
    ...unsignedEnvelope,
    integrity: {
      algorithm: RECIPE_HASH_ALGORITHM,
      domain: RECIPE_HASH_DOMAIN,
      canonicalHash: "f".repeat(64),
    },
  };

  assert.equal(hashRecipeEnvelope(first), hashRecipeEnvelope(second));
  assert.equal(hashRecipeEnvelope(first), hashRecipeEnvelope(unsignedEnvelope));
  assert.doesNotMatch(canonicalRecipeEnvelopeJson(first), /integrity/);
});

test("derived integrity pins algorithm, domain, and canonical hash", () => {
  const integrity = deriveRecipeIntegrity(unsignedEnvelope);

  assert.deepEqual(integrity, {
    algorithm: "sha256",
    domain: "ds-contracts/recipe-envelope-json/v1",
    canonicalHash: hashRecipeEnvelope(unsignedEnvelope),
  });
  assert.match(integrity.canonicalHash, /^[0-9a-f]{64}$/);
});

function collisionFindings(
  hash: (value: RecipeEnvelopeHashInput) => string,
): string[] {
  const baseline = hash(unsignedEnvelope);
  const changed: RecipeEnvelopeHashInput = {
    ...unsignedEnvelope,
    ir: { ...unsignedEnvelope.ir, children: [unsignedEnvelope.ir] },
  };
  return hash(changed) === baseline
    ? ["different recipe trees produced one hash"]
    : [];
}

test("falsification: the hash sensitivity check detects a planted collision", () => {
  assert.deepEqual(collisionFindings(hashRecipeEnvelope), []);
  assert.deepEqual(
    collisionFindings(() => "0".repeat(64)),
    ["different recipe trees produced one hash"],
  );
});
