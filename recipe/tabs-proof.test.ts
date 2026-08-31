import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedTabs } from "./adapters/tabs.js";
import {
  TABS_THREE_LIBRARY_PROOF_PROTOCOL,
  antdTabsAdapterConfig,
  antdTabsSource,
  astryxTabsAdapterConfig,
  astryxTabsSource,
  muiTabsAdapterConfig,
  muiTabsSource,
} from "./fixtures/library-tabs.js";
import {
  collapseTabsRecipe,
  compileTabsRecipe,
  validateTabsStructure,
} from "./recipes/tabs.js";

const PAIRS = [
  ["astryx", astryxTabsSource, astryxTabsAdapterConfig],
  ["mui", muiTabsSource, muiTabsAdapterConfig],
  ["antd", antdTabsSource, antdTabsAdapterConfig],
] as const;

test("tabs@1 adapts Astryx TabList, MUI Tabs, and AntD Tabs from named package facts", () => {
  const astryx = adaptReviewedTabs(astryxTabsSource, astryxTabsAdapterConfig);
  const mui = adaptReviewedTabs(muiTabsSource, muiTabsAdapterConfig);
  const antd = adaptReviewedTabs(antdTabsSource, antdTabsAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.tabs");
  assert.equal(astryx.tokens.list.itemSpacing.fallback, 2);
  assert.equal(astryx.tokens.tab.paddingX.fallback, 12);
  assert.equal(astryx.tokens.indicator.fill.fallback, "#0064e0ff");
  assert.equal(mui.tokens.tab.minWidth.fallback, 90);
  assert.equal(mui.tokens.tab.minHeight.fallback, 48);
  assert.equal(mui.tokens.lineHeightUnit, "percent");
  assert.equal(mui.tokens.textCase, "upper");
  assert.equal(antd.tokens.list.itemSpacing.fallback, 32);
  assert.equal(antd.tokens.indicator.fill.fallback, "#1677ffff");
  assert.equal(TABS_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("tabs@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedTabs(source, config);
    const first = compileTabsRecipe(instance);
    validateTabsStructure(first.ir);
    const collapsed = collapseTabsRecipe(first, instance.provenance.selection);
    const second = compileTabsRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "tabs", name);
    assert.equal(first.ir.kind, "component", name);
    const selected = first.ir.children.find(
      (child) => child.role === "tabs/item/selected",
    );
    assert.ok(selected && selected.kind === "frame", name);
    assert.equal(
      selected.children.some((child) => child.role === "tabs/indicator"),
      true,
      name,
    );
  }
});

test("tabs@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/tabs.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
