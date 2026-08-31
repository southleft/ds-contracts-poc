import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedTooltip } from "./adapters/tooltip.js";
import {
  TOOLTIP_THREE_LIBRARY_PROOF_PROTOCOL,
  antdTooltipAdapterConfig,
  antdTooltipSource,
  astryxTooltipAdapterConfig,
  astryxTooltipSource,
  muiTooltipAdapterConfig,
  muiTooltipSource,
} from "./fixtures/library-tooltips.js";
import {
  collapseTooltipRecipe,
  compileTooltipRecipe,
  validateTooltipStructure,
} from "./recipes/tooltip.js";

const PAIRS = [
  ["astryx", astryxTooltipSource, astryxTooltipAdapterConfig],
  ["mui", muiTooltipSource, muiTooltipAdapterConfig],
  ["antd", antdTooltipSource, antdTooltipAdapterConfig],
] as const;

test("tooltip@1 adapts Astryx, MUI, and AntD Tooltip bubbles from named package facts", () => {
  const astryx = adaptReviewedTooltip(astryxTooltipSource, astryxTooltipAdapterConfig);
  const mui = adaptReviewedTooltip(muiTooltipSource, muiTooltipAdapterConfig);
  const antd = adaptReviewedTooltip(antdTooltipSource, antdTooltipAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.tooltip");
  assert.equal(astryx.tokens.box.radius.fallback, 12);
  assert.equal(astryx.tokens.box.paddingY.fallback, 4);
  assert.equal(astryx.tokens.rest.boxFill.fallback, "#0a1317ff");
  assert.equal(mui.tokens.box.radius.fallback, 4);
  assert.equal(mui.tokens.labelFontSize.fallback, 11);
  assert.equal(mui.tokens.lineHeightUnit, "auto");
  assert.equal(mui.tokens.rest.boxFill.fallback, "#616161eb");
  assert.equal(antd.tokens.box.paddingY.fallback, 6);
  assert.equal(antd.tokens.box.radius.fallback, 6);
  assert.equal(antd.tokens.rest.boxFill.fallback, "#000000d9");
  assert.equal(TOOLTIP_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("tooltip@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedTooltip(source, config);
    const first = compileTooltipRecipe(instance);
    validateTooltipStructure(first.ir);
    const collapsed = collapseTooltipRecipe(first, instance.provenance.selection);
    const second = compileTooltipRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "tooltip / popover", name);
    assert.equal(first.ir.kind, "component", name);
  }
});

test("tooltip@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/tooltip.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
