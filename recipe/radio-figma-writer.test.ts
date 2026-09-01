import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedRadio } from "./adapters/radio.js";
import {
  antdRadioAdapterConfig,
  antdRadioSource,
  astryxRadioAdapterConfig,
  astryxRadioSource,
  muiRadioAdapterConfig,
  muiRadioSource,
} from "./fixtures/library-radios.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileRadioRecipe, radioRecipe } from "./recipes/radio.js";
import {
  RADIO_FIGMA_NAMESPACE,
  RADIO_FIGMA_VARIANTS_PER_SOURCE,
  emitRadioFigmaWriter,
  validateRadioFigmaSourcePlans,
} from "./radio-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-radio-reviewed-v1",
    displayName: "Astryx",
    source: astryxRadioSource,
    config: astryxRadioAdapterConfig,
  },
  {
    adapterIdentity: "mui-radio-reviewed-v1",
    displayName: "MUI",
    source: muiRadioSource,
    config: muiRadioAdapterConfig,
  },
  {
    adapterIdentity: "antd-radio-reviewed-v1",
    displayName: "Ant Design",
    source: antdRadioSource,
    config: antdRadioAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedRadio(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(radioRecipe, instance),
    envelope: compileRadioRecipe(instance),
  };
});

test("the writer plans three list-shaped radio sources without touching Figma", () => {
  const writer = emitRadioFigmaWriter(sources);
  assert.equal(writer.namespace, RADIO_FIGMA_NAMESPACE);
  assert.notEqual(writer.namespace, "ds.contracts.table.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.input.recipe.v5");
  assert.notEqual(writer.namespace, "ds.contracts.combobox.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.checkbox.recipe.v1");
  assert.match(writer.pageName, /^Recipe Pivot \/ Radio \//);
  assert.match(writer.runIdentity, /-radio-v4$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.radioSet.children.length, RADIO_FIGMA_VARIANTS_PER_SOURCE);
    assert.ok(plan.variables.length > 0, "a zero-variable mint is not a mint");
  }
  assert.equal(validateRadioFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the set name carries the compile label — the Table live v25 class", () => {
  const writer = emitRadioFigmaWriter(sources);
  assert.match(
    writer.code,
    /set\.name=setIr\.role\+" :: "\+\(setIr\.label\|\|source\.sourceName\)/,
  );
  assert.match(writer.code, /RADIO-WRITER-SET-NAME-CARRIES-COMPILE-LABEL/);
});

test("hug text records intrinsic size before a 0-width parent can collapse it", () => {
  const writer = emitRadioFigmaWriter(sources);
  assert.match(
    writer.code,
    /RADIO-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE/,
  );
  assert.match(writer.code, /RADIO-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC/);
});

test("a one-source emit can reuse the three-library run identity", () => {
  const all = emitRadioFigmaWriter(sources);
  const one = emitRadioFigmaWriter([sources[0]!], {
    runIdentity: all.runIdentity,
  });
  assert.equal(one.runIdentity, all.runIdentity);
  assert.equal(one.pageName, all.pageName);
  assert.equal(one.sourcePlans.length, 1);
});

test("the writer refuses signed pages and foreign identities", () => {
  const writer = emitRadioFigmaWriter(sources);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-COMBOBOX-V42-PAGE/);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-BUTTON-PAGE/);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-TABLE-PAGE/);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-CALENDAR-PAGE/);
  assert.match(writer.code, /RADIO-MUST-NOT-WRITE-CHECKBOX-PAGE/);
  assert.match(writer.code, /RADIO-FONT-PROVENANCE-TAMPER/);
  assert.match(writer.code, /RADIO-PAGE-OWNERSHIP-COLLISION/);
  assert.equal(writer.code.includes("Inter"), false);
});
