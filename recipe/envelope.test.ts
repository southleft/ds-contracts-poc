/**
 * The envelope's invariant: EVERY input fact lands in exactly one of carried /
 * extensions / receipts. Under-reporting is a silent loss; over-reporting is a
 * fabricated disclosure. Both must be named.
 *
 * docs/32-recipe-ir-pivot.md §2, §5, §10 (`recipe:totality:check`).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ENVELOPE_VERSION,
  LOSS_REASONS,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type FactRef,
  type RecipeEnvelope,
} from "./envelope.js";
import type { IRNode } from "./figma-ir.js";
import { RECIPE_HASH_DOMAIN } from "./hash.js";

const hug = { mode: "hug" } as const;

const ir: IRNode = {
  kind: "frame",
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
    itemSpacing: 8,
    padding: { top: 8, right: 16, bottom: 8, left: 16 },
    width: hug,
    height: hug,
  },
  fills: [{ kind: "solid", color: "#2563ebff" }],
  children: [],
};

const CARRIED: FactRef = { path: "root", channel: "background-color" };
const ABSORBED: FactRef = { path: "root", channel: "cursor" };
const RECEIPTED: FactRef = { path: "root", channel: "backdrop-filter" };

const envelope: RecipeEnvelope = {
  envelope: ENVELOPE_VERSION,
  id: "ds.button",
  name: "Button",
  archetype: "button",
  recipe: { id: "recipe.button", version: 1 },
  ir,
  accounting: { carried: [CARRIED] },
  extensions: [
    {
      id: "button/pointer-affordance",
      kind: "behaviour",
      stated: "the pointer cursor over an interactive surface",
      why: "the canvas has no cursor property; the affordance is a code fact",
      absorbs: [ABSORBED],
    },
  ],
  receipts: [
    {
      fact: RECEIPTED,
      value: "blur(4px)",
      reason: "no-figma-primitive",
      evidence: "spec/channel-table.json backdrop-filter (REFUSED)",
    },
  ],
  provenance: {
    source: "contracts/button.contract.json",
    tool: "recipe.button@1",
    generatedAt: "2026-08-26T00:00:00.000Z",
  },
  integrity: {
    algorithm: "sha256",
    domain: RECIPE_HASH_DOMAIN,
    canonicalHash: "0".repeat(64),
  },
};

const INPUT: FactRef[] = [CARRIED, ABSORBED, RECEIPTED];

test("a fully accounted envelope validates and is total", () => {
  assert.equal(RecipeEnvelopeSchema.safeParse(envelope).success, true);
  const result = checkTotality(INPUT, envelope);
  assert.equal(isTotal(result), true);
  assert.deepEqual(totalityLines(envelope.id, result), []);
});

test("an unaccounted input fact is named, not tolerated", () => {
  // The falsification: drop the receipt and keep the input fact.
  const lossy = { ...envelope, receipts: [] };
  const result = checkTotality(INPUT, lossy);
  assert.equal(isTotal(result), false);
  assert.deepEqual(result.unaccounted.map(factId), ["root#backdrop-filter"]);

  const lines = totalityLines(lossy.id, result);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /root#backdrop-filter/);
  assert.match(lines[0], /silent loss/);
});

test("a fact accounted for twice is a defect — two answers is no answer", () => {
  const doubled: RecipeEnvelope = {
    ...envelope,
    accounting: { carried: [CARRIED, RECEIPTED] },
  };
  const result = checkTotality(INPUT, doubled);
  assert.equal(isTotal(result), false);
  assert.deepEqual(
    result.doubleCounted.map((entry) => factId(entry.fact)),
    ["root#backdrop-filter"],
  );
  assert.deepEqual(result.doubleCounted[0].places.sort(), [
    "carried",
    "receipt:no-figma-primitive",
  ]);
});

test("totality is a multiset and never collapses duplicate occurrences", () => {
  const duplicatedInput = [CARRIED, CARRIED];
  const collapsed = checkTotality(duplicatedInput, envelope);
  assert.equal(isTotal(collapsed), false);
  assert.deepEqual(collapsed.unaccounted.map(factId), [
    "root#background-color",
  ]);

  const preserved = checkTotality(duplicatedInput, {
    ...envelope,
    accounting: { carried: [CARRIED, CARRIED] },
    extensions: [],
    receipts: [],
  });
  assert.equal(isTotal(preserved), true);
});

test("a receipt for a fact the input never carried is a fabricated disclosure", () => {
  const result = checkTotality([CARRIED, ABSORBED], envelope);
  assert.equal(isTotal(result), false);
  assert.deepEqual(result.invented.map(factId), ["root#backdrop-filter"]);
  assert.match(totalityLines(envelope.id, result)[0], /fabricated disclosure/);
});

test("the envelope version is a literal — an unknown version refuses", () => {
  assert.equal(
    RecipeEnvelopeSchema.safeParse({ ...envelope, envelope: 2 }).success,
    false,
    "a reader that does not know a version must refuse, not best-effort",
  );
});

test("the hash is shaped like a derivation, and cannot be prose", () => {
  for (const wrong of ["", "pending", "0".repeat(63), "Z".repeat(64)]) {
    assert.equal(
      RecipeEnvelopeSchema.safeParse({
        ...envelope,
        integrity: {
          algorithm: "sha256",
          domain: RECIPE_HASH_DOMAIN,
          canonicalHash: wrong,
        },
      }).success,
      false,
      `${wrong || "(empty)"} must not pass as a canonical hash`,
    );
  }
});

test("the hash domain is a literal — normalization revisions require a new schema", () => {
  assert.equal(
    RecipeEnvelopeSchema.safeParse({
      ...envelope,
      integrity: { ...envelope.integrity, domain: "unversioned" },
    }).success,
    false,
  );
});

test("the loss-reason enum is closed", () => {
  assert.deepEqual(
    [...LOSS_REASONS],
    [
      "no-figma-primitive",
      "code-only",
      "lowered",
      "refused-by-recipe",
      "inert",
    ],
  );
  const invented = {
    ...envelope,
    receipts: [{ ...envelope.receipts[0], reason: "dropped" }],
  };
  assert.equal(
    RecipeEnvelopeSchema.safeParse(invented).success,
    false,
    "a sixth kind of loss must require a schema change, not a free string",
  );
});

test("a receipt without evidence does not validate", () => {
  const unevidenced = {
    ...envelope,
    receipts: [{ ...envelope.receipts[0], evidence: "" }],
  };
  assert.equal(RecipeEnvelopeSchema.safeParse(unevidenced).success, false);
});

test("the envelope itself is closed against unknown keys", () => {
  assert.equal(
    RecipeEnvelopeSchema.safeParse({ ...envelope, css: { color: "red" } })
      .success,
    false,
  );
});
