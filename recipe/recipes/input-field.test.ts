import assert from "node:assert/strict";
import test from "node:test";

import type { RecipeEnvelope } from "../envelope.js";
import { canonicalInputFieldRecipeInstance } from "../fixtures/input-field.js";
import type {
  ComponentNode,
  ComponentSetNode,
  FrameNode,
} from "../figma-ir.js";
import { deriveRecipeIntegrity } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import { hashRecipeInstance, RecipeRefusal } from "../recipe.js";
import {
  INPUT_FIELD_ADORNMENTS,
  INPUT_FIELD_CONTENT,
  INPUT_FIELD_REQUIRED,
  INPUT_FIELD_SIZES,
  INPUT_FIELD_STATES,
  collapseInputFieldRecipe,
  compileInputFieldRecipe,
  inputFieldRecipe,
  normalizeInputFieldRecipeInstance,
  type InputFieldRecipeInstance,
} from "./input-field.js";

const selection = canonicalInputFieldRecipeInstance.provenance.selection;
const resign = (envelope: RecipeEnvelope): RecipeEnvelope => {
  const changed = structuredClone(envelope);
  changed.integrity = deriveRecipeIntegrity(changed);
  return changed;
};
const rootOf = (envelope: RecipeEnvelope): ComponentSetNode => {
  assert.equal(envelope.ir.kind, "component-set");
  return envelope.ir as ComponentSetNode;
};
const expectRefusal = (envelope: RecipeEnvelope, expected: RegExp): void => {
  assert.throws(
    () => collapseInputFieldRecipe(resign(envelope), selection),
    (error: unknown) =>
      error instanceof RecipeRefusal && expected.test(error.message),
  );
};
const componentFor = (
  root: ComponentSetNode,
  values: Record<string, string>,
): ComponentNode => {
  const component = root.children.find((candidate) =>
    Object.entries(values).every(
      ([axis, value]) => candidate.variantProperties[axis] === value,
    ),
  );
  assert.ok(component);
  return component;
};
const surfaceOf = (component: ComponentNode): FrameNode => {
  const surface = component.children.find(
    (child) => child.role === "input-field/surface",
  );
  assert.equal(surface?.kind, "frame");
  return surface as FrameNode;
};

test("input-field@1 is deterministic and compiles the complete edit surface", () => {
  const first = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  const second = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.integrity.canonicalHash, second.integrity.canonicalHash);
  assert.equal(
    hashRecipeInstance(inputFieldRecipe, canonicalInputFieldRecipeInstance),
    hashRecipeInstance(inputFieldRecipe, {
      ...canonicalInputFieldRecipeInstance,
    }),
  );

  const root = rootOf(first);
  assert.equal(root.role, "input-field/set");
  assert.deepEqual(
    root.variantAxes.map((axis) => [axis.name, axis.values]),
    [
      ["Size", [...INPUT_FIELD_SIZES]],
      ["State", [...INPUT_FIELD_STATES]],
      ["Content", [...INPUT_FIELD_CONTENT]],
      ["Required", [...INPUT_FIELD_REQUIRED]],
      ["Adornments", [...INPUT_FIELD_ADORNMENTS]],
    ],
  );
  assert.equal(
    root.children.length,
    INPUT_FIELD_SIZES.length *
      INPUT_FIELD_STATES.length *
      INPUT_FIELD_CONTENT.length *
      INPUT_FIELD_REQUIRED.length *
      INPUT_FIELD_ADORNMENTS.length,
  );
});

test("input-field@1 has a canonical two-cycle offline fixed point", () => {
  const firstEnvelope = compileInputFieldRecipe(
    canonicalInputFieldRecipeInstance,
  );
  const firstCollapsed = collapseInputFieldRecipe(firstEnvelope, selection);
  const secondEnvelope = compileInputFieldRecipe(firstCollapsed);
  const secondCollapsed = collapseInputFieldRecipe(secondEnvelope, selection);
  const thirdEnvelope = compileInputFieldRecipe(secondCollapsed);

  assert.deepEqual(
    firstCollapsed,
    normalizeInputFieldRecipeInstance(canonicalInputFieldRecipeInstance),
  );
  assert.deepEqual(secondCollapsed, firstCollapsed);
  assert.equal(canonicalJson(secondEnvelope), canonicalJson(firstEnvelope));
  assert.equal(canonicalJson(thirdEnvelope), canonicalJson(secondEnvelope));
});

test("vertical field, horizontal surface, text, messages, and slots are explicit", () => {
  const root = rootOf(
    compileInputFieldRecipe(canonicalInputFieldRecipeInstance),
  );
  const component = componentFor(root, {
    Size: "medium",
    State: "error",
    Content: "value",
    Required: "true",
    Adornments: "both",
  });
  assert.equal(component.layout.mode, "vertical");
  assert.equal(component.layout.width.mode, "fixed");
  assert.equal(component.layout.height.mode, "hug");
  assert.deepEqual(
    component.children.map((child) => child.role),
    [
      "input-field/label-row",
      "input-field/surface",
      "input-field/message-container",
    ],
  );
  const messageContainer = component.children[2];
  assert.equal(messageContainer?.kind, "frame");
  if (messageContainer?.kind !== "frame") {
    throw new Error("message container absent");
  }
  assert.deepEqual(
    messageContainer.children.map((child) => child.role),
    ["input-field/message/error"],
  );
  const surface = surfaceOf(component);
  assert.equal(surface.layout.mode, "horizontal");
  assert.equal(surface.layout.width.mode, "fill");
  assert.equal(surface.layout.height.mode, "fixed");
  assert.deepEqual(
    surface.children.map((child) => child.role),
    [
      "input-field/slot/leading",
      "input-field/content/value",
      "input-field/slot/trailing",
    ],
  );
  const labelRow = component.children[0];
  assert.equal(labelRow?.kind, "frame");
  if (labelRow?.kind !== "frame") throw new Error("label row absent");
  assert.deepEqual(
    labelRow.children.map((child) => child.role),
    ["input-field/label", "input-field/required-indicator"],
  );
});

test("floating generic fields compile nested label and content rows", () => {
  const floating = structuredClone(
    canonicalInputFieldRecipeInstance,
  ) as InputFieldRecipeInstance;
  floating.structure = {
    ...floating.structure,
    labelPlacement: "floating",
    floatingActivation: "focus-value-or-leading-adornment",
    outlineTreatment: "notched",
  };
  const root = rootOf(compileInputFieldRecipe(floating));
  const component = componentFor(root, {
    Size: "medium",
    State: "focus-visible",
    Content: "placeholder",
    Required: "false",
    Adornments: "none",
  });
  assert.deepEqual(
    component.children.map((child) => child.role),
    ["input-field/surface", "input-field/message-container"],
  );
  const surface = surfaceOf(component);
  assert.equal(surface.layout.mode, "horizontal");
  assert.deepEqual(
    surface.children.map((child) => child.role),
    ["input-field/content-row", "input-field/label-row"],
  );
  const labelRow = surface.children[1]!;
  assert.equal(labelRow.kind, "frame");
  if (labelRow.kind !== "frame") throw new Error("label row absent");
  assert.equal(labelRow.layout.positioning, "absolute");
  assert.deepEqual(labelRow.layout.constraints, {
    horizontal: "left",
    vertical: "top",
  });
  assert.ok(labelRow.layout.offset);
});

test("inconsistent generic label and notch combinations refuse by name", () => {
  for (const structure of [
    {
      ...canonicalInputFieldRecipeInstance.structure,
      labelPlacement: "floating" as const,
      floatingActivation: "never" as const,
      outlineTreatment: "notched" as const,
    },
    {
      ...canonicalInputFieldRecipeInstance.structure,
      labelPlacement: "stacked" as const,
      floatingActivation: "focus-value-or-leading-adornment" as const,
      outlineTreatment: "plain" as const,
    },
  ]) {
    const invalid = structuredClone(
      canonicalInputFieldRecipeInstance,
    ) as InputFieldRecipeInstance;
    invalid.structure = structure;
    assert.throws(
      () => compileInputFieldRecipe(invalid),
      /inconsistent generic field structure/,
    );
  }
});

test("selection is explicit and hand-built trees are never guessed", () => {
  const missing = structuredClone(canonicalInputFieldRecipeInstance) as {
    provenance: { selection?: unknown };
  };
  delete missing.provenance.selection;
  assert.throws(
    () => compileInputFieldRecipe(missing),
    /recipe selection is absent/,
  );
  const ambiguous = structuredClone(selection);
  ambiguous.candidates.push({ id: "input-field", version: 1 });
  assert.throws(
    () =>
      collapseInputFieldRecipe(
        compileInputFieldRecipe(canonicalInputFieldRecipeInstance),
        ambiguous,
      ),
    /recipe selection is ambiguous/,
  );
  assert.throws(
    () => collapseInputFieldRecipe({ kind: "frame", children: [] }, selection),
    /Invalid input/,
  );
});

test("missing, unexpected, and semantically broken roles refuse by name", () => {
  const missing = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  rootOf(missing).children[0]!.children = rootOf(
    missing,
  ).children[0]!.children.filter(
    (child) => child.role !== "input-field/label-row",
  );
  expectRefusal(missing, /required role input-field\/label-row|composition/);

  const unexpected = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  surfaceOf(rootOf(unexpected).children[0]!).children[0]!.role =
    "input-field/mystery";
  expectRefusal(unexpected, /unexpected role/);

  const association = compileInputFieldRecipe(
    canonicalInputFieldRecipeInstance,
  );
  association.extensions = association.extensions.filter(
    (extension) => extension.id !== "input-field/label-input-association",
  );
  expectRefusal(association, /broken label\/input association/);
});

test("fake layout and invalid placeholder/value coexistence refuse by name", () => {
  const fake = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  surfaceOf(rootOf(fake).children[0]!).layout.mode = "none";
  expectRefusal(fake, /fake layout/);

  const coexistence = compileInputFieldRecipe(
    canonicalInputFieldRecipeInstance,
  );
  const surface = surfaceOf(rootOf(coexistence).children[0]!);
  const content = surface.children.find(
    (child) => child.role === "input-field/content/placeholder",
  );
  assert.ok(content);
  surface.children.push({
    ...structuredClone(content),
    role: "input-field/content/value",
  });
  expectRefusal(coexistence, /invalid placeholder\/value coexistence/);
});

test("dead state and size axes refuse even when every cell still exists", () => {
  for (const [axis, target, source, expected] of [
    ["State", "focus-visible", "default", /dead state axis/],
    ["Size", "small", "medium", /dead size axis/],
  ] as const) {
    const envelope = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
    const root = rootOf(envelope);
    for (let index = 0; index < root.children.length; index += 1) {
      const targetComponent = root.children[index]!;
      if (targetComponent.variantProperties[axis] !== target) continue;
      const sourceComponent = componentFor(root, {
        ...targetComponent.variantProperties,
        [axis]: source,
      });
      const clone = structuredClone(sourceComponent);
      clone.role = targetComponent.role;
      clone.label = targetComponent.label;
      clone.variantProperties = targetComponent.variantProperties;
      root.children[index] = clone;
    }
    expectRefusal(envelope, expected);
  }
});

test("missing token bindings and unsupported structural edits refuse", () => {
  const missingBinding = compileInputFieldRecipe(
    canonicalInputFieldRecipeInstance,
  );
  const surface = surfaceOf(rootOf(missingBinding).children[0]!);
  surface.bindings = surface.bindings?.filter(
    (binding) => binding.field !== "fills.0.color",
  );
  expectRefusal(
    missingBinding,
    /required token binding fills\.0\.color must appear exactly once/,
  );

  const edited = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  const target = componentFor(rootOf(edited), {
    Size: "small",
    State: "error",
    Content: "value",
    Required: "true",
    Adornments: "both",
  });
  surfaceOf(target).layout.padding.left += 1;
  expectRefusal(edited, /unsupported structural edit at \$\.children/);
});
