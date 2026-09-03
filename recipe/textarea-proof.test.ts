import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedTextarea } from "./adapters/textarea.js";
import {
  TEXTAREA_THREE_LIBRARY_PROOF_PROTOCOL,
  antdTextareaAdapterConfig,
  antdTextareaSource,
  astryxTextareaAdapterConfig,
  astryxTextareaSource,
  muiTextareaAdapterConfig,
  muiTextareaSource,
} from "./fixtures/library-textareas.js";
import {
  TEXTAREA_CONTENT,
  TEXTAREA_DISABLED,
  collapseTextareaRecipe,
  compileTextareaRecipe,
  validateTextareaStructure,
} from "./recipes/textarea.js";

const PAIRS = [
  ["astryx", astryxTextareaSource, astryxTextareaAdapterConfig],
  ["mui", muiTextareaSource, muiTextareaAdapterConfig],
  ["antd", antdTextareaSource, antdTextareaAdapterConfig],
] as const;

test("textarea@1 adapts Astryx, MUI, and AntD from named package facts", () => {
  const started = performance.now();
  const astryx = adaptReviewedTextarea(
    astryxTextareaSource,
    astryxTextareaAdapterConfig,
  );
  const mui = adaptReviewedTextarea(muiTextareaSource, muiTextareaAdapterConfig);
  const antd = adaptReviewedTextarea(
    antdTextareaSource,
    antdTextareaAdapterConfig,
  );
  assert.equal(astryx.identity.id, "astryx.textarea");
  assert.equal(astryx.tokens.box.rows.fallback, 3, "TextArea.tsx rows default");
  assert.equal(astryx.tokens.box.height.fallback, 70, "3*20+8+2");
  assert.equal(astryx.tokens.box.paddingY.fallback, 4, "--spacing-1");
  assert.equal(astryx.tokens.box.paddingX.fallback, 8, "--spacing-2");
  assert.equal(astryx.tokens.box.radius.fallback, 8, "--radius-element");
  assert.equal(astryx.tokens.box.lineHeight.fallback, 20, "14 * 1.4286");
  assert.equal(astryx.tokens.strokeAlign, "inside");
  assert.equal(astryx.tokens.typography.label.requestedFamily, "-apple-system");
  assert.notEqual(astryx.tokens.typography.label.resolvedFamily, "Inter");
  assert.equal(mui.tokens.box.rows.fallback, 1, "TextareaAutosize minRows");
  assert.equal(mui.tokens.box.height.fallback, 56, "23+16.5*2");
  assert.equal(mui.tokens.box.paddingY.fallback, 16.5);
  assert.equal(mui.tokens.box.paddingX.fallback, 14);
  assert.equal(mui.tokens.box.radius.fallback, 4, "shape.borderRadius");
  assert.equal(mui.tokens.box.lineHeight.fallback, 23, "1.4375em");
  assert.equal(mui.tokens.strokeAlign, "outside");
  assert.equal(mui.tokens.labelPlacement, "floating");
  assert.equal(mui.tokens.outlineTreatment, "notched");
  assert.equal(mui.tokens.labelInsetX.fallback, 14);
  assert.equal(mui.tokens.labelInactiveOffsetY.fallback, 16);
  assert.equal(mui.tokens.labelFloatingOffsetY.fallback, -9);
  assert.equal(mui.tokens.floatingLabelFontSize.fallback, 12);
  assert.equal(mui.tokens.notchFill.fallback, "#ffffffff");
  assert.equal(mui.tokens.typography.label.resolvedFamily, "Roboto");
  const muiEnvelope = compileTextareaRecipe(mui);
  const muiEmpty = (muiEnvelope.ir as { children: Array<{ kind: string; variantProperties?: Record<string, string>; role?: string; visible?: boolean; children?: unknown[] }> }).children.find(
    (child) =>
      child.kind === "component" &&
      child.variantProperties?.Disabled === "false" &&
      child.variantProperties?.Content === "empty",
  );
  const muiFocus = (muiEnvelope.ir as { children: Array<{ kind: string; variantProperties?: Record<string, string>; role?: string; visible?: boolean; children?: unknown[] }> }).children.find(
    (child) =>
      child.kind === "component" &&
      child.variantProperties?.Disabled === "false" &&
      child.variantProperties?.Content === "focus",
  );
  const walk = (
    node: { role?: string; visible?: boolean; children?: unknown[] },
    found: Array<{ role?: string; visible?: boolean }>,
  ) => {
    found.push(node);
    for (const child of node.children ?? [])
      walk(child as { role?: string; visible?: boolean; children?: unknown[] }, found);
  };
  const emptyNodes: Array<{ role?: string; visible?: boolean }> = [];
  const focusNodes: Array<{ role?: string; visible?: boolean }> = [];
  if (muiEmpty && muiEmpty.kind === "component") walk(muiEmpty, emptyNodes);
  if (muiFocus && muiFocus.kind === "component") walk(muiFocus, focusNodes);
  assert.equal(
    emptyNodes.find((node) => node.role === "textarea/value")?.visible,
    false,
    "MUI rest empty hides placeholder (InputBase.js:179-188)",
  );
  assert.notEqual(
    focusNodes.find((node) => node.role === "textarea/value")?.visible,
    false,
    "MUI focused empty shows placeholder",
  );
  assert.equal(antd.tokens.box.rows.fallback, 2, "HTML textarea rows default");
  assert.equal(antd.tokens.box.height.fallback, 54, "2*22+8+2");
  assert.equal(antd.tokens.box.paddingY.fallback, 4);
  assert.equal(antd.tokens.box.paddingX.fallback, 11);
  assert.equal(antd.tokens.box.radius.fallback, 6, "--border-radius");
  assert.equal(antd.tokens.box.lineHeight.fallback, 22);
  assert.equal(TEXTAREA_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 18);
  assert.ok(performance.now() - started < 4000);
});

test("textarea@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedTextarea(source, config);
    const first = compileTextareaRecipe(instance);
    validateTextareaStructure(first.ir);
    const collapsed = collapseTextareaRecipe(
      first,
      instance.provenance.selection,
    );
    const second = compileTextareaRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "input / field", name);
    const envelope = first as {
      ir: { kind: string; children: Array<{ kind: string }> };
    };
    assert.equal(envelope.ir.kind, "component-set", name);
    assert.equal(
      envelope.ir.children.length,
      TEXTAREA_DISABLED.length * TEXTAREA_CONTENT.length,
      name,
    );
  }
});

test("textarea@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/textarea.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
  const adapter = readFileSync("recipe/adapters/textarea.ts", "utf8").toLowerCase();
  for (const forbidden of ["if (library)", "polar"])
    assert.equal(adapter.includes(forbidden), false, forbidden);
});
