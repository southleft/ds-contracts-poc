import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedTabs } from "./adapters/tabs.js";
import {
  antdTabsAdapterConfig,
  antdTabsSource,
  astryxTabsAdapterConfig,
  astryxTabsSource,
  muiTabsAdapterConfig,
  muiTabsSource,
} from "./fixtures/library-tabs.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileTabsRecipe, tabsRecipe } from "./recipes/tabs.js";
import {
  TABS_FIGMA_NAMESPACE,
  TABS_FIGMA_VARIANTS_PER_SOURCE,
  emitTabsFigmaWriter,
  validateTabsFigmaSourcePlans,
} from "./tabs-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-tabs-reviewed-v1",
    displayName: "Astryx",
    source: astryxTabsSource,
    config: astryxTabsAdapterConfig,
  },
  {
    adapterIdentity: "mui-tabs-reviewed-v1",
    displayName: "MUI",
    source: muiTabsSource,
    config: muiTabsAdapterConfig,
  },
  {
    adapterIdentity: "antd-tabs-reviewed-v1",
    displayName: "Ant Design",
    source: antdTabsSource,
    config: antdTabsAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedTabs(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(tabsRecipe, instance),
    envelope: compileTabsRecipe(instance),
  };
});

test("the writer plans three tabs sources without touching Figma", () => {
  const writer = emitTabsFigmaWriter(sources);
  assert.equal(writer.namespace, TABS_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Tabs \//);
  assert.match(writer.runIdentity, /-tabs-v1$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "tabs/variant/default");
    assert.equal(TABS_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateTabsFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Tooltip", () => {
  const writer = emitTabsFigmaWriter(sources);
  assert.match(writer.code, /TABS-MUST-NOT-WRITE-TOOLTIP-PAGE/);
  assert.match(writer.code, /TABS-MUST-NOT-WRITE-LINK-PAGE/);
  assert.match(writer.code, /TABS-MUST-NOT-WRITE-AVATAR-PAGE/);
  assert.match(writer.code, /TABS-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
