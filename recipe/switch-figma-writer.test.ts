import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedSwitch } from "./adapters/switch.js";
import {
  antdSwitchAdapterConfig,
  antdSwitchSource,
  astryxSwitchAdapterConfig,
  astryxSwitchSource,
  muiSwitchAdapterConfig,
  muiSwitchSource,
} from "./fixtures/library-switches.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileSwitchRecipe, switchRecipe } from "./recipes/switch.js";
import {
  SWITCH_FIGMA_NAMESPACE,
  SWITCH_FIGMA_VARIANTS_PER_SOURCE,
  emitSwitchFigmaWriter,
  validateSwitchFigmaSourcePlans,
} from "./switch-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-switch-reviewed-v1",
    displayName: "Astryx",
    source: astryxSwitchSource,
    config: astryxSwitchAdapterConfig,
  },
  {
    adapterIdentity: "mui-switch-reviewed-v1",
    displayName: "MUI",
    source: muiSwitchSource,
    config: muiSwitchAdapterConfig,
  },
  {
    adapterIdentity: "antd-switch-reviewed-v1",
    displayName: "Ant Design",
    source: antdSwitchSource,
    config: antdSwitchAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedSwitch(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(switchRecipe, instance),
    envelope: compileSwitchRecipe(instance),
  };
});

test("the writer plans three switch sources without touching Figma", () => {
  const writer = emitSwitchFigmaWriter(sources);
  assert.equal(writer.namespace, SWITCH_FIGMA_NAMESPACE);
  assert.notEqual(writer.namespace, "ds.contracts.table.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.input.recipe.v5");
  assert.notEqual(writer.namespace, "ds.contracts.combobox.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.checkbox.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.radio.recipe.v1");
  assert.match(writer.pageName, /^Recipe Pivot \/ Switch \//);
  assert.match(writer.runIdentity, /-switch-v2$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.switchSet.children.length, SWITCH_FIGMA_VARIANTS_PER_SOURCE);
    assert.ok(plan.variables.length > 0, "a zero-variable mint is not a mint");
  }
  assert.equal(validateSwitchFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the set name carries the compile label — the Table live v25 class", () => {
  const writer = emitSwitchFigmaWriter(sources);
  assert.match(
    writer.code,
    /set\.name=setIr\.role\+" :: "\+\(setIr\.label\|\|source\.sourceName\)/,
  );
  assert.match(writer.code, /SWITCH-WRITER-SET-NAME-CARRIES-COMPILE-LABEL/);
});

test("hug text records intrinsic size before a 0-width parent can collapse it", () => {
  const writer = emitSwitchFigmaWriter(sources);
  assert.match(
    writer.code,
    /SWITCH-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE/,
  );
  assert.match(writer.code, /SWITCH-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC/);
});

test("a one-source emit can reuse the three-library run identity", () => {
  const all = emitSwitchFigmaWriter(sources);
  const one = emitSwitchFigmaWriter([sources[0]!], {
    runIdentity: all.runIdentity,
  });
  assert.equal(one.runIdentity, all.runIdentity);
  assert.equal(one.pageName, all.pageName);
  assert.equal(one.sourcePlans.length, 1);
});

test("the writer refuses signed pages and foreign identities", () => {
  const writer = emitSwitchFigmaWriter(sources);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-COMBOBOX-V42-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-BUTTON-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-TABLE-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-CALENDAR-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-CHECKBOX-PAGE/);
  assert.match(writer.code, /SWITCH-MUST-NOT-WRITE-RADIO-PAGE/);
  assert.match(writer.code, /SWITCH-FONT-PROVENANCE-TAMPER/);
  assert.match(writer.code, /SWITCH-PAGE-OWNERSHIP-COLLISION/);
  assert.equal(writer.code.includes("Inter"), false);
});
