import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedChip } from "./adapters/chip.js";
import {
  CHIP_THREE_LIBRARY_PROOF_PROTOCOL,
  antdChipAdapterConfig,
  antdChipSource,
  astryxChipAdapterConfig,
  astryxChipSource,
  muiChipAdapterConfig,
  muiChipSource,
} from "./fixtures/library-chips.js";
import {
  collapseChipRecipe,
  compileChipRecipe,
  validateChipStructure,
} from "./recipes/chip.js";

const PAIRS = [
  ["astryx", astryxChipSource, astryxChipAdapterConfig],
  ["mui", muiChipSource, muiChipAdapterConfig],
  ["antd", antdChipSource, antdChipAdapterConfig],
] as const;

test("chip@1 adapts Astryx Token, MUI Chip, and AntD Tag from named package facts", () => {
  const astryx = adaptReviewedChip(astryxChipSource, astryxChipAdapterConfig);
  const mui = adaptReviewedChip(muiChipSource, muiChipAdapterConfig);
  const antd = adaptReviewedChip(antdChipSource, antdChipAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.chip");
  assert.equal(astryx.tokens.box.height.fallback, 24, "32-8");
  assert.equal(astryx.tokens.box.paddingX.fallback, 8);
  assert.equal(astryx.tokens.box.radius.fallback, 4, "--radius-inner");
  assert.equal(astryx.tokens.box.borderWidth.fallback, 0);
  assert.equal(mui.tokens.box.height.fallback, 32);
  assert.equal(mui.tokens.box.paddingX.fallback, 12, "ChipLabel");
  assert.equal(mui.tokens.box.radius.fallback, 16);
  assert.equal(mui.tokens.labelFontSize.fallback, 13);
  assert.equal(antd.tokens.box.height.fallback, 22, "20+1*2");
  assert.equal(antd.tokens.box.paddingX.fallback, 7, "8-1");
  assert.equal(antd.tokens.box.radius.fallback, 4, "borderRadiusSM");
  assert.equal(antd.tokens.box.borderWidth.fallback, 1);
  assert.equal(CHIP_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("chip@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedChip(source, config);
    const first = compileChipRecipe(instance);
    validateChipStructure(first.ir);
    const collapsed = collapseChipRecipe(first, instance.provenance.selection);
    const second = compileChipRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "badge / tag / chip", name);
    assert.equal((first.ir as { children: unknown[] }).children.length, 1, name);
  }
});

test("chip@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/chip.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
