import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { adaptReviewedAvatar } from "./adapters/avatar.js";
import {
  AVATAR_THREE_LIBRARY_PROOF_PROTOCOL,
  antdAvatarAdapterConfig,
  antdAvatarSource,
  astryxAvatarAdapterConfig,
  astryxAvatarSource,
  muiAvatarAdapterConfig,
  muiAvatarSource,
} from "./fixtures/library-avatars.js";
import {
  collapseAvatarRecipe,
  compileAvatarRecipe,
  validateAvatarStructure,
} from "./recipes/avatar.js";

const PAIRS = [
  ["astryx", astryxAvatarSource, astryxAvatarAdapterConfig],
  ["mui", muiAvatarSource, muiAvatarAdapterConfig],
  ["antd", antdAvatarSource, antdAvatarAdapterConfig],
] as const;

test("avatar@1 adapts Astryx, MUI, and AntD Avatar from named package facts", () => {
  const astryx = adaptReviewedAvatar(astryxAvatarSource, astryxAvatarAdapterConfig);
  const mui = adaptReviewedAvatar(muiAvatarSource, muiAvatarAdapterConfig);
  const antd = adaptReviewedAvatar(antdAvatarSource, antdAvatarAdapterConfig);
  assert.equal(astryx.identity.id, "astryx.avatar");
  assert.equal(astryx.tokens.box.height.fallback, 36, "small");
  assert.equal(astryx.tokens.box.paddingX.fallback, 0);
  assert.equal(astryx.tokens.box.radius.fallback, 9999, "--radius-full");
  assert.equal(astryx.tokens.box.borderWidth.fallback, 0);
  assert.equal(astryx.tokens.labelFontSize.fallback, 14.4);
  assert.equal(mui.tokens.box.height.fallback, 40);
  assert.equal(mui.tokens.box.paddingX.fallback, 0);
  assert.equal(mui.tokens.box.radius.fallback, 20);
  assert.equal(mui.tokens.labelFontSize.fallback, 20);
  assert.equal(antd.tokens.box.height.fallback, 32, "controlHeight");
  assert.equal(antd.tokens.box.paddingX.fallback, 0);
  assert.equal(antd.tokens.box.radius.fallback, 16);
  assert.equal(antd.tokens.box.borderWidth.fallback, 1);
  assert.equal(AVATAR_THREE_LIBRARY_PROOF_PROTOCOL.totalCells, 3);
});

test("avatar@1 compile is two-cycle fixed-point on every library", () => {
  for (const [name, source, config] of PAIRS) {
    const instance = adaptReviewedAvatar(source, config);
    const first = compileAvatarRecipe(instance);
    validateAvatarStructure(first.ir);
    const collapsed = collapseAvatarRecipe(first, instance.provenance.selection);
    const second = compileAvatarRecipe(collapsed);
    assert.equal(
      first.integrity.canonicalHash,
      second.integrity.canonicalHash,
      name,
    );
    assert.equal(first.archetype, "avatar", name);
    assert.equal((first.ir as { children: unknown[] }).children.length, 1, name);
  }
});

test("avatar@1 recipe compile has no if (library) and no invented Inter", () => {
  const recipe = readFileSync("recipe/recipes/avatar.ts", "utf8");
  assert.equal(recipe.includes("if (library)"), false);
  assert.equal(recipe.includes("Inter"), false);
  assert.equal(recipe.includes("Polar"), false);
});
