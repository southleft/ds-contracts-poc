import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedTooltip } from "./adapters/tooltip.js";
import {
  antdTooltipAdapterConfig,
  antdTooltipSource,
  astryxTooltipAdapterConfig,
  astryxTooltipSource,
  muiTooltipAdapterConfig,
  muiTooltipSource,
} from "./fixtures/library-tooltips.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileTooltipRecipe, tooltipRecipe } from "./recipes/tooltip.js";
import {
  TOOLTIP_FIGMA_NAMESPACE,
  TOOLTIP_FIGMA_VARIANTS_PER_SOURCE,
  emitTooltipFigmaWriter,
  validateTooltipFigmaSourcePlans,
} from "./tooltip-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-tooltip-reviewed-v1",
    displayName: "Astryx",
    source: astryxTooltipSource,
    config: astryxTooltipAdapterConfig,
  },
  {
    adapterIdentity: "mui-tooltip-reviewed-v1",
    displayName: "MUI",
    source: muiTooltipSource,
    config: muiTooltipAdapterConfig,
  },
  {
    adapterIdentity: "antd-tooltip-reviewed-v1",
    displayName: "Ant Design",
    source: antdTooltipSource,
    config: antdTooltipAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedTooltip(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(tooltipRecipe, instance),
    envelope: compileTooltipRecipe(instance),
  };
});

test("the writer plans three tooltip sources without touching Figma", () => {
  const writer = emitTooltipFigmaWriter(sources);
  assert.equal(writer.namespace, TOOLTIP_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Tooltip \//);
  assert.match(writer.runIdentity, /-tooltip-v2$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "tooltip/variant/default");
    assert.equal(TOOLTIP_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateTooltipFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Avatar", () => {
  const writer = emitTooltipFigmaWriter(sources);
  assert.match(writer.code, /TOOLTIP-MUST-NOT-WRITE-LINK-PAGE/);
  assert.match(writer.code, /TOOLTIP-MUST-NOT-WRITE-AVATAR-PAGE/);
  assert.match(writer.code, /TOOLTIP-MUST-NOT-WRITE-BADGE-PAGE/);
  assert.match(writer.code, /TOOLTIP-MUST-NOT-WRITE-CHIP-PAGE/);
  assert.match(writer.code, /TOOLTIP-MUST-NOT-WRITE-ALERT-PAGE/);
  assert.match(writer.code, /TOOLTIP-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
