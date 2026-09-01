import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedCheckbox } from "./adapters/checkbox.js";
import {
  antdCheckboxAdapterConfig,
  antdCheckboxSource,
  astryxCheckboxAdapterConfig,
  astryxCheckboxSource,
  muiCheckboxAdapterConfig,
  muiCheckboxSource,
} from "./fixtures/library-checkboxes.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  checkboxRecipe,
  compileCheckboxRecipe,
} from "./recipes/checkbox.js";
import {
  CHECKBOX_FIGMA_NAMESPACE,
  CHECKBOX_FIGMA_VARIANTS_PER_SOURCE,
  emitCheckboxFigmaWriter,
  validateCheckboxFigmaSourcePlans,
} from "./checkbox-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-checkbox-reviewed-v1",
    displayName: "Astryx",
    source: astryxCheckboxSource,
    config: astryxCheckboxAdapterConfig,
  },
  {
    adapterIdentity: "mui-checkbox-reviewed-v1",
    displayName: "MUI",
    source: muiCheckboxSource,
    config: muiCheckboxAdapterConfig,
  },
  {
    adapterIdentity: "antd-checkbox-reviewed-v1",
    displayName: "Ant Design",
    source: antdCheckboxSource,
    config: antdCheckboxAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedCheckbox(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(checkboxRecipe, instance),
    envelope: compileCheckboxRecipe(instance),
  };
});

test("the writer plans three checkbox sources without touching Figma", () => {
  const writer = emitCheckboxFigmaWriter(sources);
  assert.equal(writer.namespace, CHECKBOX_FIGMA_NAMESPACE);
  assert.notEqual(writer.namespace, "ds.contracts.table.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.input.recipe.v5");
  assert.notEqual(writer.namespace, "ds.contracts.combobox.recipe.v1");
  assert.match(writer.pageName, /^Recipe Pivot \/ Checkbox \//);
  assert.match(writer.runIdentity, /-checkbox-v5$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.checkboxSet.children.length, CHECKBOX_FIGMA_VARIANTS_PER_SOURCE);
    assert.ok(plan.variables.length > 0, "a zero-variable mint is not a mint");
  }
  assert.equal(validateCheckboxFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the set name carries the compile label — the Table live v25 class", () => {
  const writer = emitCheckboxFigmaWriter(sources);
  assert.match(
    writer.code,
    /set\.name=setIr\.role\+" :: "\+\(setIr\.label\|\|source\.sourceName\)/,
  );
  assert.match(writer.code, /CHECKBOX-WRITER-SET-NAME-CARRIES-COMPILE-LABEL/);
});

test("hug text records intrinsic size before a 0-width parent can collapse it", () => {
  const writer = emitCheckboxFigmaWriter(sources);
  assert.match(
    writer.code,
    /CHECKBOX-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE/,
  );
  assert.match(writer.code, /CHECKBOX-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC/);
});

test("a one-source emit can reuse the three-library run identity", () => {
  const all = emitCheckboxFigmaWriter(sources);
  const one = emitCheckboxFigmaWriter([sources[0]!], {
    runIdentity: all.runIdentity,
  });
  assert.equal(one.runIdentity, all.runIdentity);
  assert.equal(one.pageName, all.pageName);
  assert.equal(one.sourcePlans.length, 1);
});

test("the writer refuses signed pages and foreign identities", () => {
  const writer = emitCheckboxFigmaWriter(sources);
  assert.match(writer.code, /CHECKBOX-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(writer.code, /CHECKBOX-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(writer.code, /CHECKBOX-MUST-NOT-WRITE-COMBOBOX-V42-PAGE/);
  assert.match(writer.code, /CHECKBOX-MUST-NOT-WRITE-BUTTON-PAGE/);
  assert.match(writer.code, /CHECKBOX-MUST-NOT-WRITE-TABLE-PAGE/);
  assert.match(writer.code, /CHECKBOX-MUST-NOT-WRITE-CALENDAR-PAGE/);
  assert.match(writer.code, /CHECKBOX-FONT-PROVENANCE-TAMPER/);
  assert.match(writer.code, /CHECKBOX-PAGE-OWNERSHIP-COLLISION/);
  assert.equal(writer.code.includes("Inter"), false);
});
