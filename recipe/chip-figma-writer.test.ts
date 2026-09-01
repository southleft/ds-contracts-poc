import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedChip } from "./adapters/chip.js";
import {
  antdChipAdapterConfig,
  antdChipSource,
  astryxChipAdapterConfig,
  astryxChipSource,
  muiChipAdapterConfig,
  muiChipSource,
} from "./fixtures/library-chips.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileChipRecipe, chipRecipe } from "./recipes/chip.js";
import {
  CHIP_FIGMA_NAMESPACE,
  CHIP_FIGMA_VARIANTS_PER_SOURCE,
  emitChipFigmaWriter,
  validateChipFigmaSourcePlans,
} from "./chip-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-chip-reviewed-v1",
    displayName: "Astryx",
    source: astryxChipSource,
    config: astryxChipAdapterConfig,
  },
  {
    adapterIdentity: "mui-chip-reviewed-v1",
    displayName: "MUI",
    source: muiChipSource,
    config: muiChipAdapterConfig,
  },
  {
    adapterIdentity: "antd-chip-reviewed-v1",
    displayName: "Ant Design",
    source: antdChipSource,
    config: antdChipAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedChip(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(chipRecipe, instance),
    envelope: compileChipRecipe(instance),
  };
});

test("the writer plans three chip sources without touching Figma", () => {
  const writer = emitChipFigmaWriter(sources);
  assert.equal(writer.namespace, CHIP_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Chip \//);
  assert.match(writer.runIdentity, /-chip-v2$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "chip/variant/default");
    assert.equal(CHIP_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateChipFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Alert", () => {
  const writer = emitChipFigmaWriter(sources);
  assert.match(writer.code, /CHIP-MUST-NOT-WRITE-ALERT-PAGE/);
  assert.match(writer.code, /CHIP-MUST-NOT-WRITE-TEXTAREA-PAGE/);
  assert.match(writer.code, /CHIP-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
