import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedBadge } from "./adapters/badge.js";
import {
  antdBadgeAdapterConfig,
  antdBadgeSource,
  muiBadgeAdapterConfig,
  muiBadgeSource,
} from "./fixtures/library-badges.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileBadgeRecipe, badgeRecipe } from "./recipes/badge.js";
import {
  BADGE_FIGMA_NAMESPACE,
  BADGE_FIGMA_VARIANTS_PER_SOURCE,
  emitBadgeFigmaWriter,
  validateBadgeFigmaSourcePlans,
} from "./badge-figma-writer.js";

const sources = [
  {
    adapterIdentity: "mui-badge-reviewed-v1",
    displayName: "MUI",
    source: muiBadgeSource,
    config: muiBadgeAdapterConfig,
  },
  {
    adapterIdentity: "antd-badge-reviewed-v1",
    displayName: "Ant Design",
    source: antdBadgeSource,
    config: antdBadgeAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedBadge(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(badgeRecipe, instance),
    envelope: compileBadgeRecipe(instance),
  };
});

test("the writer plans two overlay badge sources without touching Figma", () => {
  const writer = emitBadgeFigmaWriter(sources);
  assert.equal(writer.namespace, BADGE_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Badge \//);
  assert.match(writer.runIdentity, /-badge-v2$/);
  assert.equal(writer.sourcePlans.length, 2);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.badge.kind, "component");
    assert.equal(plan.badge.role, "badge/variant/default");
    assert.equal(BADGE_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateBadgeFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Chip", () => {
  const writer = emitBadgeFigmaWriter(sources);
  assert.match(writer.code, /BADGE-MUST-NOT-WRITE-CHIP-PAGE/);
  assert.match(writer.code, /BADGE-MUST-NOT-WRITE-ALERT-PAGE/);
  assert.match(writer.code, /BADGE-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
  assert.equal(writer.namespace.includes("chip"), false);
});
