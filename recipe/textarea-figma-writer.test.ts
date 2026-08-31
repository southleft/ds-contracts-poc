import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedTextarea } from "./adapters/textarea.js";
import {
  antdTextareaAdapterConfig,
  antdTextareaSource,
  astryxTextareaAdapterConfig,
  astryxTextareaSource,
  muiTextareaAdapterConfig,
  muiTextareaSource,
} from "./fixtures/library-textareas.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileTextareaRecipe, textareaRecipe } from "./recipes/textarea.js";
import {
  TEXTAREA_FIGMA_NAMESPACE,
  TEXTAREA_FIGMA_VARIANTS_PER_SOURCE,
  emitTextareaFigmaWriter,
  validateTextareaFigmaSourcePlans,
} from "./textarea-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-textarea-reviewed-v1",
    displayName: "Astryx",
    source: astryxTextareaSource,
    config: astryxTextareaAdapterConfig,
  },
  {
    adapterIdentity: "mui-textarea-reviewed-v1",
    displayName: "MUI",
    source: muiTextareaSource,
    config: muiTextareaAdapterConfig,
  },
  {
    adapterIdentity: "antd-textarea-reviewed-v1",
    displayName: "Ant Design",
    source: antdTextareaSource,
    config: antdTextareaAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedTextarea(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(textareaRecipe, instance),
    envelope: compileTextareaRecipe(instance),
  };
});

test("the writer plans three textarea sources without touching Figma", () => {
  const writer = emitTextareaFigmaWriter(sources);
  assert.equal(writer.namespace, TEXTAREA_FIGMA_NAMESPACE);
  assert.notEqual(writer.namespace, "ds.contracts.table.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.input.recipe.v5");
  assert.notEqual(writer.namespace, "ds.contracts.combobox.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.checkbox.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.radio.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.switch.recipe.v1");
  assert.match(writer.pageName, /^Recipe Pivot \/ Textarea \//);
  assert.match(writer.runIdentity, /-textarea-v1$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(
      plan.textareaSet.children.length,
      TEXTAREA_FIGMA_VARIANTS_PER_SOURCE,
    );
    assert.ok(plan.variables.length > 0, "a zero-variable mint is not a mint");
  }
  assert.equal(validateTextareaFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the set name carries the compile label — the Table live v25 class", () => {
  const writer = emitTextareaFigmaWriter(sources);
  assert.match(
    writer.code,
    /set\.name=setIr\.role\+" :: "\+\(setIr\.label\|\|source\.sourceName\)/,
  );
  assert.match(writer.code, /TEXTAREA-WRITER-SET-NAME-CARRIES-COMPILE-LABEL/);
});

test("hug text records intrinsic size before a 0-width parent can collapse it", () => {
  const writer = emitTextareaFigmaWriter(sources);
  assert.match(
    writer.code,
    /TEXTAREA-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE/,
  );
  assert.match(writer.code, /TEXTAREA-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC/);
});

test("a one-source emit can reuse the three-library run identity", () => {
  const all = emitTextareaFigmaWriter(sources);
  const one = emitTextareaFigmaWriter([sources[0]!], {
    runIdentity: all.runIdentity,
  });
  assert.equal(one.runIdentity, all.runIdentity);
  assert.equal(one.pageName, all.pageName);
  assert.equal(one.sourcePlans.length, 1);
});

test("the writer refuses signed pages and foreign identities", () => {
  const writer = emitTextareaFigmaWriter(sources);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-COMBOBOX-V42-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-BUTTON-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-TABLE-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-CALENDAR-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-CHECKBOX-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-RADIO-PAGE/);
  assert.match(writer.code, /TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE/);
  assert.match(writer.code, /TEXTAREA-FONT-PROVENANCE-TAMPER/);
  assert.match(writer.code, /TEXTAREA-PAGE-OWNERSHIP-COLLISION/);
  assert.equal(writer.code.includes("Inter"), false);
});
