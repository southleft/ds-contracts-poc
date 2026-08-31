import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedLink } from "./adapters/link.js";
import {
  LINK_THREE_LIBRARY_PROOF_PROTOCOL,
  antdLinkAdapterConfig,
  antdLinkSource,
  astryxLinkAdapterConfig,
  astryxLinkSource,
  muiLinkAdapterConfig,
  muiLinkSource,
} from "./fixtures/library-links.js";
import {
  collapseLinkRecipe,
  compileLinkRecipe,
  validateLinkStructure,
} from "./recipes/link.js";

const PAIRS = [
  ["astryx", astryxLinkSource, astryxLinkAdapterConfig],
  ["mui", muiLinkSource, muiLinkAdapterConfig],
  ["antd", antdLinkSource, antdLinkAdapterConfig],
] as const;

test("link@1 adapts Astryx Link, MUI Link, and AntD Typography.Link from named package facts", () => {
  const astryx = adaptReviewedLink(astryxLinkSource, astryxLinkAdapterConfig);
  const mui = adaptReviewedLink(muiLinkSource, muiLinkAdapterConfig);
  const antd = adaptReviewedLink(antdLinkSource, antdLinkAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.link");
  assert.equal(astryx.tokens.decoration, "none");
  assert.equal(astryx.tokens.labelFontSize.fallback, 14);
  assert.equal(astryx.tokens.labelLineHeight.fallback, 20);
  assert.equal(astryx.tokens.rest.label.fallback, "#0064e0ff");
  assert.equal(mui.tokens.decoration, "underline");
  assert.equal(mui.tokens.lineHeightUnit, "auto");
  assert.equal(mui.tokens.labelFontSize.fallback, 14);
  assert.equal(mui.tokens.rest.label.fallback, "#1976d2ff");
  assert.equal(antd.tokens.decoration, "none");
  assert.equal(antd.tokens.labelLineHeight.fallback, 22);
  assert.equal(antd.tokens.rest.label.fallback, "#1677ffff");
  assert.equal(LINK_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("link@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedLink(source, config);
    const first = compileLinkRecipe(instance);
    validateLinkStructure(first.ir);
    const collapsed = collapseLinkRecipe(first, instance.provenance.selection);
    const second = compileLinkRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "none", name);
    assert.equal(first.ir.kind, "component", name);
  }
});

test("link@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/link.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
