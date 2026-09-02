import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedBadge } from "./adapters/badge.js";
import { emitBadgeFigmaWriter } from "./badge-figma-writer.js";
import {
  antdBadgeAdapterConfig,
  antdBadgeSource,
  muiBadgeAdapterConfig,
  muiBadgeSource,
} from "./fixtures/library-badges.js";
import { hashRecipeInstance } from "./recipe.js";
import { muiBadgeAdapterConfig as muiBadgeProposedConfig, muiBadgeSource as muiBadgeProposedSource } from "./fixtures/generated/badge.mui.js";
import { antdBadgeAdapterConfig as antdBadgeProposedConfig, antdBadgeSource as antdBadgeProposedSource } from "./fixtures/generated/badge.antd.js";
import { compileBadgeRecipe, badgeRecipe } from "./recipes/badge.js";

const EVIDENCE = "recipe/evidence/badge-live-pivot-v11";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

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
  {
    // PROPOSED from MUI's own capture — the library's DEFAULT cell (transparent pip, black count); 19 read, 0 invented.
    adapterIdentity: "mui-badge-proposed-v1",
    displayName: "MUI (proposed)",
    source: muiBadgeProposedSource,
    config: muiBadgeProposedConfig,
  },
  {
    // PROPOSED from AntD's own capture — the white ring read from the outset box-shadow; 19 read, 0 invented.
    adapterIdentity: "antd-badge-proposed-v1",
    displayName: "Ant Design (proposed)",
    source: antdBadgeProposedSource,
    config: antdBadgeProposedConfig,
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

const writer = emitBadgeFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitBadgeFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitBadgeFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split badge writer must keep the overlay-library run identity");
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
        "badge@1 MUI proof cell is the documented Color demo color=error (palette.error.main #d32f2f / contrast #fff). color=default has no palette fill and is receipted. Astryx overlay remains refused. Old stay 183:76022 refused.",
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
      artifactVersion: "badge-live-pivot-v11-prepare",
      teaching:
        "MUI Badge proof is color=error from the docs Color demo; do not paint a fake pill on color=default",
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
  if (!writer.code.includes("BADGE-MUST-NOT-WRITE-CHIP-PAGE"))
    throw new Error("badge writer must refuse the Chip stay page");
  if (!writer.code.includes("BADGE-MUST-NOT-WRITE-BADGE-V1-PAGE"))
    throw new Error("badge writer must refuse the Badge v1 stay page");
  if (writer.sourcePlans.length !== 4)
    throw new Error("badge prepare requires 4 library sources (reviewed + proposed)");
  if (writer.namespace === "ds.contracts.chip.recipe.v1")
    throw new Error("badge writer must not reuse the Chip namespace");
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
