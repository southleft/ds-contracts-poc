import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedMenu } from "./adapters/menu.js";
import {
  antdMenuAdapterConfig,
  antdMenuSource,
  astryxMenuAdapterConfig,
  astryxMenuSource,
  muiMenuAdapterConfig,
  muiMenuSource,
} from "./fixtures/library-menus.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileMenuRecipe, menuRecipe } from "./recipes/menu.js";
import {
  MENU_FIGMA_NAMESPACE,
  MENU_FIGMA_VARIANTS_PER_SOURCE,
  emitMenuFigmaWriter,
  validateMenuFigmaSourcePlans,
} from "./menu-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-menu-reviewed-v1",
    displayName: "Astryx",
    source: astryxMenuSource,
    config: astryxMenuAdapterConfig,
  },
  {
    adapterIdentity: "mui-menu-reviewed-v1",
    displayName: "MUI",
    source: muiMenuSource,
    config: muiMenuAdapterConfig,
  },
  {
    adapterIdentity: "antd-menu-reviewed-v1",
    displayName: "Ant Design",
    source: antdMenuSource,
    config: antdMenuAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedMenu(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(menuRecipe, instance),
    envelope: compileMenuRecipe(instance),
  };
});

test("the writer plans three menu sources without touching Figma", () => {
  const writer = emitMenuFigmaWriter(sources);
  assert.equal(writer.namespace, MENU_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Menu \//);
  assert.match(writer.runIdentity, /-menu-v7$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "menu/variant/default");
    assert.equal(MENU_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateMenuFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Tabs", () => {
  const writer = emitMenuFigmaWriter(sources);
  assert.match(writer.code, /MENU-MUST-NOT-WRITE-TABS-PAGE/);
  assert.match(writer.code, /MENU-MUST-NOT-WRITE-LINK-PAGE/);
  assert.match(writer.code, /MENU-MUST-NOT-WRITE-AVATAR-PAGE/);
  assert.match(writer.code, /MENU-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
