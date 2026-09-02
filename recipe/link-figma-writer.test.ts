import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedLink } from "./adapters/link.js";
import {
  antdLinkAdapterConfig,
  antdLinkSource,
  astryxLinkAdapterConfig,
  astryxLinkSource,
  muiLinkAdapterConfig,
  muiLinkSource,
} from "./fixtures/library-links.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileLinkRecipe, linkRecipe } from "./recipes/link.js";
import {
  LINK_FIGMA_NAMESPACE,
  LINK_FIGMA_VARIANTS_PER_SOURCE,
  emitLinkFigmaWriter,
  validateLinkFigmaSourcePlans,
} from "./link-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-link-reviewed-v1",
    displayName: "Astryx",
    source: astryxLinkSource,
    config: astryxLinkAdapterConfig,
  },
  {
    adapterIdentity: "mui-link-reviewed-v1",
    displayName: "MUI",
    source: muiLinkSource,
    config: muiLinkAdapterConfig,
  },
  {
    adapterIdentity: "antd-link-reviewed-v1",
    displayName: "Ant Design",
    source: antdLinkSource,
    config: antdLinkAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedLink(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(linkRecipe, instance),
    envelope: compileLinkRecipe(instance),
  };
});

test("the writer plans three link sources without touching Figma", () => {
  const writer = emitLinkFigmaWriter(sources);
  assert.equal(writer.namespace, LINK_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Link \//);
  assert.match(writer.runIdentity, /-link-v7$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "link/variant/default");
    assert.equal(LINK_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateLinkFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Avatar", () => {
  const writer = emitLinkFigmaWriter(sources);
  assert.match(writer.code, /LINK-MUST-NOT-WRITE-AVATAR-PAGE/);
  assert.match(writer.code, /LINK-MUST-NOT-WRITE-BADGE-PAGE/);
  assert.match(writer.code, /LINK-MUST-NOT-WRITE-CHIP-PAGE/);
  assert.match(writer.code, /LINK-MUST-NOT-WRITE-ALERT-PAGE/);
  assert.match(writer.code, /LINK-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
