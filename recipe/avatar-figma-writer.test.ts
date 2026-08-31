import assert from "node:assert/strict";
import test from "node:test";

import { adaptReviewedAvatar } from "./adapters/avatar.js";
import {
  antdAvatarAdapterConfig,
  antdAvatarSource,
  astryxAvatarAdapterConfig,
  astryxAvatarSource,
  muiAvatarAdapterConfig,
  muiAvatarSource,
} from "./fixtures/library-avatars.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileAvatarRecipe, avatarRecipe } from "./recipes/avatar.js";
import {
  AVATAR_FIGMA_NAMESPACE,
  AVATAR_FIGMA_VARIANTS_PER_SOURCE,
  emitAvatarFigmaWriter,
  validateAvatarFigmaSourcePlans,
} from "./avatar-figma-writer.js";

const sources = [
  {
    adapterIdentity: "astryx-avatar-reviewed-v1",
    displayName: "Astryx",
    source: astryxAvatarSource,
    config: astryxAvatarAdapterConfig,
  },
  {
    adapterIdentity: "mui-avatar-reviewed-v1",
    displayName: "MUI",
    source: muiAvatarSource,
    config: muiAvatarAdapterConfig,
  },
  {
    adapterIdentity: "antd-avatar-reviewed-v1",
    displayName: "Ant Design",
    source: antdAvatarSource,
    config: antdAvatarAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedAvatar(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(avatarRecipe, instance),
    envelope: compileAvatarRecipe(instance),
  };
});

test("the writer plans three avatar sources without touching Figma", () => {
  const writer = emitAvatarFigmaWriter(sources);
  assert.equal(writer.namespace, AVATAR_FIGMA_NAMESPACE);
  assert.match(writer.pageName, /^Recipe Pivot \/ Avatar \//);
  assert.match(writer.runIdentity, /-avatar-v1$/);
  assert.equal(writer.sourcePlans.length, 3);
  for (const plan of writer.sourcePlans) {
    assert.equal(plan.chip.kind, "component");
    assert.equal(plan.chip.role, "avatar/variant/default");
    assert.equal(AVATAR_FIGMA_VARIANTS_PER_SOURCE, 1);
    assert.ok(plan.variables.length > 0);
  }
  assert.equal(validateAvatarFigmaSourcePlans(writer.sourcePlans).length, 0);
});

test("the writer refuses signed pages including Alert", () => {
  const writer = emitAvatarFigmaWriter(sources);
  assert.match(writer.code, /AVATAR-MUST-NOT-WRITE-ALERT-PAGE/);
  assert.match(writer.code, /AVATAR-MUST-NOT-WRITE-CHIP-PAGE/);
  assert.match(writer.code, /AVATAR-MUST-NOT-WRITE-BADGE-PAGE/);
  assert.match(writer.code, /AVATAR-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.equal(writer.code.includes("Inter"), false);
});
