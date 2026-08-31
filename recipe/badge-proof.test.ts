import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedBadge } from "./adapters/badge.js";
import {
  BADGE_OVERLAY_PROOF_PROTOCOL,
  antdBadgeAdapterConfig,
  antdBadgeSource,
  astryxBadgeOverlayRefusal,
  muiBadgeAdapterConfig,
  muiBadgeSource,
} from "./fixtures/library-badges.js";
import {
  collapseBadgeRecipe,
  compileBadgeRecipe,
  validateBadgeStructure,
} from "./recipes/badge.js";

const PAIRS = [
  ["mui", muiBadgeSource, muiBadgeAdapterConfig],
  ["antd", antdBadgeSource, antdBadgeAdapterConfig],
] as const;

test("badge@1 adapts MUI and AntD overlay from named package facts", () => {
  const mui = adaptReviewedBadge(muiBadgeSource, muiBadgeAdapterConfig);
  const antd = adaptReviewedBadge(antdBadgeSource, antdBadgeAdapterConfig);
  assert.equal(mui.identity.id, "mui.badge");
  assert.equal(mui.tokens.indicator.height.fallback, 20);
  assert.equal(mui.tokens.indicator.paddingX.fallback, 6);
  assert.equal(mui.tokens.indicator.fill.fallback, "#00000000");
  assert.equal(mui.tokens.host.size.fallback, 40);
  assert.equal(antd.tokens.indicator.height.fallback, 20);
  assert.equal(antd.tokens.indicator.fill.fallback, "#ff4d4fff");
  assert.equal(antd.tokens.host.size.fallback, 32);
  assert.equal(antd.tokens.indicator.borderWidth.fallback, 1);
  assert.equal(BADGE_OVERLAY_PROOF_PROTOCOL.totalCells, 2);
  assert.equal(BADGE_OVERLAY_PROOF_PROTOCOL.namedRefusals, 1);
  assert.match(astryxBadgeOverlayRefusal.reason, /inline status label/);
});

test("badge@1 compile is two-cycle fixed-point on overlay libraries", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedBadge(source, config);
    const first = compileBadgeRecipe(instance);
    validateBadgeStructure(first.ir);
    const collapsed = collapseBadgeRecipe(first, instance.provenance.selection);
    const second = compileBadgeRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal((first.ir as { children: unknown[] }).children.length, 2, name);
  }
});

test("badge@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/badge.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
