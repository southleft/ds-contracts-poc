import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedLink } from "./adapters/link.js";
import { emitLinkFigmaWriter } from "./link-figma-writer.js";
import {
  antdLinkAdapterConfig,
  antdLinkSource,
  astryxLinkAdapterConfig,
  astryxLinkSource,
  muiLinkAdapterConfig,
  muiLinkSource,
} from "./fixtures/library-links.js";
import { hashRecipeInstance } from "./recipe.js";
import { altitudeLinkAdapterConfig as altitudeLinkProposedConfig, altitudeLinkSource as altitudeLinkProposedSource } from "./fixtures/generated/link.altitude.js";
import { muiLinkAdapterConfig as muiLinkProposedConfig, muiLinkSource as muiLinkProposedSource } from "./fixtures/generated/link.mui.js";
import { compileLinkRecipe, linkRecipe } from "./recipes/link.js";

const EVIDENCE = "recipe/evidence/link-live-pivot-v7";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

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
  {
    // PROPOSED by recipe/fixture-reader/propose-link.ts from altitude's capture.
    adapterIdentity: "altitude-link-proposed-v1",
    displayName: "altitude (proposed)",
    source: altitudeLinkProposedSource,
    config: altitudeLinkProposedConfig,
  },
  {
    // PROPOSED by recipe/fixture-reader/propose-link.ts from mui's capture.
    adapterIdentity: "mui-link-proposed-v1",
    displayName: "mui (proposed)",
    source: muiLinkProposedSource,
    config: muiLinkProposedConfig,
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

const writer = emitLinkFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitLinkFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitLinkFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split link writer must keep the three-library run identity");
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
        "link@1 inline text decoration from Astryx Link (none), MUI Link (underline always), and AntD Typography.Link (none); underline-at-rest is not an axis",
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
      artifactVersion: "link-live-pivot-v7-prepare",
      teaching:
        "One named default Link cell; per-library rest decoration; no shared underline axis",
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
  if (!writer.code.includes("LINK-MUST-NOT-WRITE-AVATAR-PAGE"))
    throw new Error("link writer must refuse the Avatar stay page");
  if (writer.namespace === "ds.contracts.avatar.recipe.v1")
    throw new Error("link writer must not reuse the Avatar namespace");
  if (writer.sourcePlans.length !== 5)
    throw new Error("link prepare requires 5 library sources (reviewed + proposed)");
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
