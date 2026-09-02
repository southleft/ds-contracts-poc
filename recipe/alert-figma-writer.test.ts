import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedAlert } from "./adapters/alert.js";
import {
  antdAlertAdapterConfig,
  antdAlertSource,
  astryxAlertAdapterConfig,
  astryxAlertSource,
  muiAlertAdapterConfig,
  muiAlertSource,
} from "./fixtures/library-alerts.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileAlertRecipe, alertRecipe } from "./recipes/alert.js";
import {
  ALERT_FIGMA_NAMESPACE,
  ALERT_FIGMA_VARIANTS_PER_SOURCE,
  emitAlertFigmaWriter,
  validateAlertFigmaSourcePlans,
} from "./alert-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-alert-reviewed-v1",
    displayName: "Astryx",
    source: astryxAlertSource,
    config: astryxAlertAdapterConfig,
  },
  {
    adapterIdentity: "mui-alert-reviewed-v1",
    displayName: "MUI",
    source: muiAlertSource,
    config: muiAlertAdapterConfig,
  },
  {
    adapterIdentity: "antd-alert-reviewed-v1",
    displayName: "Ant Design",
    source: antdAlertSource,
    config: antdAlertAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedAlert(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(alertRecipe, instance),
    envelope: compileAlertRecipe(instance),
  };
});

test("the writer plans three alert sources without touching Figma", () => {
  const writer = emitAlertFigmaWriter(sources);
  assert.equal(writer.namespace, ALERT_FIGMA_NAMESPACE);
  assert.notEqual(writer.namespace, "ds.contracts.table.recipe.v1");
  assert.notEqual(writer.namespace, "ds.contracts.input.recipe.v5");
  assert.notEqual(writer.namespace, "ds.contracts.textarea.recipe.v1");
  assert.match(writer.pageName, /^Recipe Pivot \/ Alert \//);
  assert.match(writer.runIdentity, /-alert-v9$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.alertSet.children.length, ALERT_FIGMA_VARIANTS_PER_SOURCE);
    assert.ok(plan.variables.length > 0, "a zero-variable mint is not a mint");
  }
  assert.equal(validateAlertFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the set name carries the compile label — the Table live v25 class", () => {
  const writer = emitAlertFigmaWriter(sources);
  assert.match(
    writer.code,
    /set\.name=setIr\.role\+" :: "\+\(setIr\.label\|\|source\.sourceName\)/,
  );
  assert.match(writer.code, /ALERT-WRITER-SET-NAME-CARRIES-COMPILE-LABEL/);
});

test("hug text records intrinsic size before a 0-width parent can collapse it", () => {
  const writer = emitAlertFigmaWriter(sources);
  assert.match(
    writer.code,
    /ALERT-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE/,
  );
  assert.match(writer.code, /ALERT-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC/);
});

test("a one-source emit can reuse the three-library run identity", () => {
  const all = emitAlertFigmaWriter(sources);
  const one = emitAlertFigmaWriter([sources[0]!], {
    runIdentity: all.runIdentity,
  });
  assert.equal(one.runIdentity, all.runIdentity);
  assert.equal(one.pageName, all.pageName);
  assert.equal(one.sourcePlans.length, 1);
});

test("the writer refuses signed pages and foreign identities", () => {
  const writer = emitAlertFigmaWriter(sources);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-BUTTON-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-TABLE-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-CALENDAR-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-CHECKBOX-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-RADIO-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-SWITCH-PAGE/);
  assert.match(writer.code, /ALERT-MUST-NOT-WRITE-TEXTAREA-PAGE/);
  assert.match(writer.code, /ALERT-FONT-PROVENANCE-TAMPER/);
  assert.match(writer.code, /ALERT-PAGE-OWNERSHIP-COLLISION/);
  assert.equal(writer.code.includes("Inter"), false);
});
