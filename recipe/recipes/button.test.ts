import assert from "node:assert/strict";
import test from "node:test";

import type { RecipeEnvelope } from "../envelope.js";
import { canonicalButtonRecipeInstance } from "../fixtures/button.js";
import type { ComponentSetNode } from "../figma-ir.js";
import { deriveRecipeIntegrity } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import { hashRecipeInstance, RecipeRefusal } from "../recipe.js";
import {
  BUTTON_ICON_PRESENCE,
  BUTTON_SIZES,
  BUTTON_STATES,
  BUTTON_VARIANTS,
  buttonRecipe,
  collapseButtonRecipe,
  compileButtonRecipe,
  normalizeButtonRecipeInstance,
} from "./button.js";

const selection = canonicalButtonRecipeInstance.provenance.selection;

const reverseObjectInsertionOrder = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(reverseObjectInsertionOrder);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseObjectInsertionOrder(child)]),
  );
};

const resign = (envelope: RecipeEnvelope): RecipeEnvelope => {
  const changed = structuredClone(envelope);
  changed.integrity = deriveRecipeIntegrity(changed);
  return changed;
};

const rootOf = (envelope: RecipeEnvelope): ComponentSetNode => {
  assert.equal(envelope.ir.kind, "component-set");
  return envelope.ir as ComponentSetNode;
};

const expectNamedRefusal = (
  envelope: RecipeEnvelope,
  expected: RegExp,
): void => {
  assert.throws(
    () => collapseButtonRecipe(resign(envelope), selection),
    (error: unknown) =>
      error instanceof RecipeRefusal && expected.test(error.message),
  );
};

test("button@1 compilation is deterministic and object-order-insensitive", () => {
  const first = compileButtonRecipe(canonicalButtonRecipeInstance);
  const second = compileButtonRecipe(canonicalButtonRecipeInstance);
  const reordered = reverseObjectInsertionOrder(canonicalButtonRecipeInstance);

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.integrity.canonicalHash, second.integrity.canonicalHash);
  assert.equal(
    hashRecipeInstance(buttonRecipe, canonicalButtonRecipeInstance),
    hashRecipeInstance(buttonRecipe, reordered),
  );
  assert.equal(
    first.integrity.canonicalHash,
    compileButtonRecipe(reordered).integrity.canonicalHash,
  );
});

test("meaningful Button parameters alter recipe and envelope hashes", () => {
  const labelChanged = normalizeButtonRecipeInstance(
    canonicalButtonRecipeInstance,
  );
  labelChanged.label.default = "Submit";
  const tokenChanged = normalizeButtonRecipeInstance(
    canonicalButtonRecipeInstance,
  );
  assert.equal(tokenChanged.tokens.sizes.medium.gap.kind, "token");
  if (tokenChanged.tokens.sizes.medium.gap.kind !== "token") {
    throw new Error("canonical medium gap must be token-backed");
  }
  tokenChanged.tokens.sizes.medium.gap.fallback = 10;

  const baselineRecipeHash = hashRecipeInstance(
    buttonRecipe,
    canonicalButtonRecipeInstance,
  );
  const baselineEnvelopeHash = compileButtonRecipe(
    canonicalButtonRecipeInstance,
  ).integrity.canonicalHash;
  assert.notEqual(
    hashRecipeInstance(buttonRecipe, labelChanged),
    baselineRecipeHash,
  );
  assert.notEqual(
    hashRecipeInstance(buttonRecipe, tokenChanged),
    baselineRecipeHash,
  );
  assert.notEqual(
    compileButtonRecipe(labelChanged).integrity.canonicalHash,
    baselineEnvelopeHash,
  );
  assert.notEqual(
    compileButtonRecipe(tokenChanged).integrity.canonicalHash,
    baselineEnvelopeHash,
  );
});

test("compile → collapse → compile is a canonical fixed point for two cycles", () => {
  const firstEnvelope = compileButtonRecipe(canonicalButtonRecipeInstance);
  const firstCollapsed = collapseButtonRecipe(firstEnvelope, selection);
  const secondEnvelope = compileButtonRecipe(firstCollapsed);
  const secondCollapsed = collapseButtonRecipe(secondEnvelope, selection);
  const thirdEnvelope = compileButtonRecipe(secondCollapsed);

  assert.deepEqual(
    firstCollapsed,
    normalizeButtonRecipeInstance(canonicalButtonRecipeInstance),
  );
  assert.deepEqual(secondCollapsed, firstCollapsed);
  assert.equal(canonicalJson(secondEnvelope), canonicalJson(firstEnvelope));
  assert.equal(canonicalJson(thirdEnvelope), canonicalJson(secondEnvelope));
  assert.equal(
    thirdEnvelope.integrity.canonicalHash,
    firstEnvelope.integrity.canonicalHash,
  );
});

test("the compiled set carries every declared role, axis, and token binding", () => {
  const root = rootOf(compileButtonRecipe(canonicalButtonRecipeInstance));
  assert.equal(root.role, "button/set");
  assert.deepEqual(
    root.variantAxes.map((axis) => [axis.name, axis.values]),
    [
      ["Variant", [...BUTTON_VARIANTS]],
      ["Size", [...BUTTON_SIZES]],
      ["State", [...BUTTON_STATES]],
      ["Icons", [...BUTTON_ICON_PRESENCE]],
    ],
  );
  assert.equal(
    root.children.length,
    BUTTON_VARIANTS.length *
      BUTTON_SIZES.length *
      BUTTON_STATES.length *
      BUTTON_ICON_PRESENCE.length,
  );

  const ordinary = root.children.find(
    (component) =>
      component.role === "button/variant/primary/medium/default/both",
  );
  const loading = root.children.find(
    (component) =>
      component.role === "button/variant/primary/medium/loading/both",
  );
  assert.ok(ordinary);
  assert.ok(loading);
  assert.deepEqual(
    ordinary.children.map((child) => child.role),
    ["button/slot/leading", "button/label", "button/slot/trailing"],
  );
  assert.deepEqual(
    loading.children.map((child) => child.role),
    ["button/loading-indicator", "button/label", "button/slot/trailing"],
  );
  assert.ok(
    ordinary.bindings?.some(
      (binding) =>
        binding.field === "layout.padding.left" &&
        binding.variable === "button.medium.padding-x",
    ),
  );
  assert.ok(
    ordinary.bindings?.some(
      (binding) =>
        binding.field === "fills.0.color" &&
        binding.variable === "button.primary.default.background",
    ),
  );
  const label = ordinary.children.find(
    (child) => child.role === "button/label",
  );
  assert.ok(
    label?.bindings?.some((binding) => binding.field === "type.fontSize"),
  );
});

test("malformed and dead axes refuse by name", () => {
  const malformed = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  const malformedRoot = rootOf(malformed);
  delete malformedRoot.children[0]!.variantProperties.Variant;
  expectNamedRefusal(malformed, /missing axis property Variant/);

  const dead = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  const stateAxis = rootOf(dead).variantAxes.find(
    (axis) => axis.name === "State",
  );
  assert.ok(stateAxis);
  stateAxis.values.push("ghost");
  expectNamedRefusal(dead, /dead axis State: ghost/);
});

test("fake layout, missing roles, and unexpected roles refuse by name", () => {
  const fakeLayout = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  rootOf(fakeLayout).children[0]!.layout.mode = "none";
  expectNamedRefusal(fakeLayout, /fake layout mode none/);

  const missingRole = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  const baseline = rootOf(missingRole).children.find(
    (component) =>
      component.role === "button/variant/primary/medium/default/none",
  );
  assert.ok(baseline);
  baseline.children = baseline.children.filter(
    (child) => child.role !== "button/label",
  );
  expectNamedRefusal(missingRole, /required role button\/label/);

  const unexpectedRole = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  rootOf(unexpectedRole).children[0]!.children[0]!.role = "button/mystery";
  expectNamedRefusal(unexpectedRole, /unexpected role button\/mystery/);
});

test("responsive label invariants reject planted sizing and visibility defects", () => {
  for (const [name, mutate, expected] of [
    [
      "HUG snap-back",
      (component: any) => {
        component.layout.width = { mode: "fixed", value: 96 };
      },
      /source intent must be HUG/,
    ],
    [
      "frozen label",
      (component: any) => {
        component.children.find(
          (child: any) => child.role === "button/label",
        ).width = { mode: "fixed", value: 40 };
      },
      /responsive label must HUG/,
    ],
    [
      "empty label",
      (component: any) => {
        component.children.find(
          (child: any) => child.role === "button/label",
        ).characters = " ";
      },
      /label text, font, and dimensions/,
    ],
    [
      "invisible label",
      (component: any) => {
        component.children.find(
          (child: any) => child.role === "button/label",
        ).fills = [{ kind: "solid", color: "#00000000" }];
      },
      /visible solid paint/,
    ],
    [
      "incorrect alignment",
      (component: any) => {
        component.layout.primaryAxisAlign = "min";
      },
      /centered responsive content/,
    ],
  ] as const) {
    const envelope = structuredClone(
      compileButtonRecipe(canonicalButtonRecipeInstance),
    );
    mutate(rootOf(envelope).children[0]);
    expectNamedRefusal(envelope, expected);
    assert.ok(name);
  }
});

test("unsupported structural edits refuse at their canonical path", () => {
  const edited = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  const target = rootOf(edited).children.find(
    (component) =>
      component.role === "button/variant/secondary/large/hover/none",
  );
  assert.ok(target);
  target.layout.padding.left += 1;

  expectNamedRefusal(edited, /unsupported structural edit at \$\.children/);
});

test("code-only extensions and receipts survive collapse unchanged", () => {
  const collapsed = collapseButtonRecipe(
    compileButtonRecipe(canonicalButtonRecipeInstance),
    selection,
  );
  const normalized = normalizeButtonRecipeInstance(
    canonicalButtonRecipeInstance,
  );

  assert.deepEqual(collapsed.extensions, normalized.extensions);
  assert.deepEqual(collapsed.receipts, normalized.receipts);
});

test("collapse refuses a differently selected recipe instead of guessing", () => {
  const wrong = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  wrong.recipe.id = "acme-button";

  expectNamedRefusal(wrong, /explicit button@1 selection is required/);
});

test("falsification: duplicate Button token bindings are observable as red", () => {
  const missingBinding = structuredClone(
    compileButtonRecipe(canonicalButtonRecipeInstance),
  );
  const baseline = rootOf(missingBinding).children.find(
    (component) =>
      component.role === "button/variant/primary/medium/default/none",
  );
  assert.ok(baseline);
  const fillBinding = baseline.bindings?.find(
    (binding) => binding.field === "fills.0.color",
  );
  assert.ok(fillBinding);
  baseline.bindings?.push({ ...fillBinding });

  assert.throws(
    () => collapseButtonRecipe(resign(missingBinding), selection),
    /button\/variant\/primary\/medium\/default\/none: token binding fills\.0\.color must appear at most once/,
    "the gate must catch a planted duplicate token binding",
  );
});

test("recipe acquisition refuses absent and ambiguous selection by name", () => {
  const missing = structuredClone(canonicalButtonRecipeInstance) as {
    provenance: { selection?: unknown };
  };
  delete missing.provenance.selection;
  assert.throws(
    () => compileButtonRecipe(missing),
    /recipe selection is absent; code→canvas requires a reviewed human\/config adapter/,
  );

  const ambiguous = structuredClone(
    canonicalButtonRecipeInstance.provenance.selection,
  );
  ambiguous.candidates.push({ id: "button", version: 1 });
  assert.throws(
    () =>
      collapseButtonRecipe(
        compileButtonRecipe(canonicalButtonRecipeInstance),
        ambiguous,
      ),
    /recipe selection is ambiguous/,
  );
});
