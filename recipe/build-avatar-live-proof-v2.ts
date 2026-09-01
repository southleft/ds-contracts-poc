import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedAvatar } from "./adapters/avatar.js";
import { emitAvatarFigmaWriter } from "./avatar-figma-writer.js";
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

const EVIDENCE = "recipe/evidence/avatar-live-pivot-v2";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

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

const writer = emitAvatarFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitAvatarFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitAvatarFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split avatar writer must keep the three-library run identity");
  return { adapterIdentity: source.adapterIdentity, ...part };
});

const files: Record<string, string> = { "writer.js": writer.code, "writer.plugin.js": pluginWriter.code };
for (const part of splitWriters) files[`writer-${part.adapterIdentity}.js`] = part.code;
files["plan.json"] = JSON.stringify(
    {
      pageName: writer.pageName,
      runIdentity: writer.runIdentity,
      namespace: writer.namespace,
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      teaching:
        "avatar@1 circle-clipped JD initials from Astryx Avatar small 36, MUI Avatar 40, and AntD Avatar 32; size/shape are not axes; do not remint the Badge host",
      sources: writer.sourcePlans.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        variantCount: 1,
        variableCount: source.variables.length,
        comparedIrFacts: source.comparedIrFacts,
      })),
    },
    null,
    2,
  ) + "\n";
// Builder-owned receipt fields. Anything else already recorded in the
// committed receipt (liveFigma, pageId, url, humanGrade, live) is preserved
// by prepare and ignored by --check (recipe/live-proof-evidence.ts).
const receiptOwned = {
      artifactVersion: "avatar-live-pivot-v2-prepare",
      teaching:
        "One named default Avatar cell; circle-clipped initials JD; no shared Size/Shape axis",
      runIdentity: writer.runIdentity,
      pageName: writer.pageName,
      namespace: writer.namespace,
      recipeHashes: Object.fromEntries(
        writer.sourcePlans.map((source) => [
          source.displayName,
          source.recipeHash,
        ]),
      ),
      writerSha256: sha256(writer.code),
};
publishEvidence(EVIDENCE, files, receiptOwned, { check: process.argv.includes("--check") });

if (process.argv.includes("--check")) {
  if (!writer.code.includes("AVATAR-MUST-NOT-WRITE-BADGE-PAGE"))
    throw new Error("avatar writer must refuse the Badge stay page");
  if (writer.namespace === "ds.contracts.chip.recipe.v1")
    throw new Error("avatar writer must not reuse the Chip namespace");
  if (writer.sourcePlans.length !== 3)
    throw new Error("avatar prepare requires three library sources");
  console.log(
    JSON.stringify({
      check: "ok",
      runIdentity: writer.runIdentity,
      pageName: writer.pageName,
    }),
  );
} else {
  console.log(
    JSON.stringify({
      runIdentity: writer.runIdentity,
      pageName: writer.pageName,
      writer: `${EVIDENCE}/writer.js`,
      writerSha256: sha256(writer.code),
    }),
  );
}
