import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedMenu } from "./adapters/menu.js";
import {
  MENU_THREE_LIBRARY_PROOF_PROTOCOL,
  antdMenuAdapterConfig,
  antdMenuSource,
  astryxMenuAdapterConfig,
  astryxMenuSource,
  muiMenuAdapterConfig,
  muiMenuSource,
} from "./fixtures/library-menus.js";
import {
  collapseMenuRecipe,
  compileMenuRecipe,
  validateMenuStructure,
} from "./recipes/menu.js";

const PAIRS = [
  ["astryx", astryxMenuSource, astryxMenuAdapterConfig],
  ["mui", muiMenuSource, muiMenuAdapterConfig],
  ["antd", antdMenuSource, antdMenuAdapterConfig],
] as const;

test("menu@1 adapts Astryx DropdownMenu, MUI Menu, and AntD Dropdown from named package facts", () => {
  const astryx = adaptReviewedMenu(astryxMenuSource, astryxMenuAdapterConfig);
  const mui = adaptReviewedMenu(muiMenuSource, muiMenuAdapterConfig);
  const antd = adaptReviewedMenu(antdMenuSource, antdMenuAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.menu");
  assert.equal(astryx.tokens.panel.itemSpacing.fallback, 2);
  assert.equal(astryx.tokens.panel.radius.fallback, 12);
  assert.equal(astryx.tokens.item.paddingY.fallback, 6);
  // 0 since 2026-09-02: MenuItem.js minHeight 48 applies below theme.breakpoints.up("sm"); the capture (900px) is above, where it is auto.
  assert.equal(mui.tokens.item.minHeight.fallback, 0);
  assert.equal(mui.tokens.labelFontSize.fallback, 16);
  assert.equal(antd.tokens.panel.radius.fallback, 8);
  assert.equal(antd.tokens.item.paddingY.fallback, 5);
  assert.equal(MENU_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("menu@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedMenu(source, config);
    const first = compileMenuRecipe(instance);
    validateMenuStructure(first.ir);
    const collapsed = collapseMenuRecipe(first, instance.provenance.selection);
    const second = compileMenuRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "menu / dropdown", name);
    assert.equal(first.ir.kind, "component", name);
    assert.equal(
      first.ir.children.filter((child) => child.role === "menu/item").length,
      2,
      name,
    );
  }
});

test("menu@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/menu.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
