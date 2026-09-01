import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedDialog } from "./adapters/dialog.js";
import {
  antdDialogAdapterConfig,
  antdDialogSource,
  astryxDialogAdapterConfig,
  astryxDialogSource,
  muiDialogAdapterConfig,
  muiDialogSource,
} from "./fixtures/library-dialogs.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileDialogRecipe, dialogRecipe } from "./recipes/dialog.js";
import {
  DIALOG_FIGMA_NAMESPACE,
  DIALOG_FIGMA_VARIANTS_PER_SOURCE,
  emitDialogFigmaWriter,
  validateDialogFigmaSourcePlans,
} from "./dialog-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-dialog-reviewed-v1",
    displayName: "Astryx",
    source: astryxDialogSource,
    config: astryxDialogAdapterConfig,
  },
  {
    adapterIdentity: "mui-dialog-reviewed-v1",
    displayName: "MUI",
    source: muiDialogSource,
    config: muiDialogAdapterConfig,
  },
  {
    adapterIdentity: "antd-dialog-reviewed-v1",
    displayName: "Ant Design",
    source: antdDialogSource,
    config: antdDialogAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedDialog(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(dialogRecipe, instance),
    envelope: compileDialogRecipe(instance),
  };
});

test("the writer plans three dialog sources without touching Figma", () => {
  const writer = emitDialogFigmaWriter(sources);
  assert.equal(writer.namespace, DIALOG_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Dialog \//);
  assert.match(writer.runIdentity, /-dialog-v2$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "dialog/variant/default");
    assert.equal(DIALOG_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateDialogFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Menu", () => {
  const writer = emitDialogFigmaWriter(sources);
  assert.match(writer.code, /DIALOG-MUST-NOT-WRITE-MENU-PAGE/);
  assert.match(writer.code, /DIALOG-MUST-NOT-WRITE-TABS-PAGE/);
  assert.match(writer.code, /DIALOG-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
