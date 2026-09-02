import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedTooltip } from "./adapters/tooltip.js";
import { emitTooltipFigmaWriter } from "./tooltip-figma-writer.js";
import {
  antdTooltipAdapterConfig,
  antdTooltipSource,
  astryxTooltipAdapterConfig,
  astryxTooltipSource,
  muiTooltipAdapterConfig,
  muiTooltipSource,
} from "./fixtures/library-tooltips.js";
import { hashRecipeInstance } from "./recipe.js";
import { chakraTooltipAdapterConfig as chakraTooltipProposedConfig, chakraTooltipSource as chakraTooltipProposedSource } from "./fixtures/generated/tooltip.chakra.js";
import { antdTooltipAdapterConfig as antdTooltipProposedConfig, antdTooltipSource as antdTooltipProposedSource } from "./fixtures/generated/tooltip.antd.js";
import { muiTooltipAdapterConfig as muiTooltipProposedConfig, muiTooltipSource as muiTooltipProposedSource } from "./fixtures/generated/tooltip.mui.js";
import { shadcnTooltipAdapterConfig as shadcnTooltipProposedConfig, shadcnTooltipSource as shadcnTooltipProposedSource } from "./fixtures/generated/tooltip.shadcn.js";
import { compileTooltipRecipe, tooltipRecipe } from "./recipes/tooltip.js";

const EVIDENCE = "recipe/evidence/tooltip-live-pivot-v9";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-tooltip-reviewed-v1",
    displayName: "Astryx",
    source: astryxTooltipSource,
    config: astryxTooltipAdapterConfig,
  },
  {
    adapterIdentity: "mui-tooltip-reviewed-v1",
    displayName: "MUI",
    source: muiTooltipSource,
    config: muiTooltipAdapterConfig,
  },
  {
    adapterIdentity: "antd-tooltip-reviewed-v1",
    displayName: "Ant Design",
    source: antdTooltipSource,
    config: antdTooltipAdapterConfig,
  },
  {
    // PROPOSED by recipe/fixture-reader/propose-tooltip.ts from antd's capture.
    adapterIdentity: "antd-tooltip-proposed-v1",
    displayName: "antd (proposed)",
    source: antdTooltipProposedSource,
    config: antdTooltipProposedConfig,
  },
  {
    // PROPOSED by recipe/fixture-reader/propose-tooltip.ts from mui's capture.
    adapterIdentity: "mui-tooltip-proposed-v1",
    displayName: "mui (proposed)",
    source: muiTooltipProposedSource,
    config: muiTooltipProposedConfig,
  },
  {
    // PROPOSED by recipe/fixture-reader/propose-tooltip.ts from shadcn's capture.
    adapterIdentity: "shadcn-tooltip-proposed-v1",
    displayName: "shadcn (proposed)",
    source: shadcnTooltipProposedSource,
    config: shadcnTooltipProposedConfig,
  },
  {
    // PROPOSED from a capture made today through the portal path (Chakra's
    // Tooltip needs its Positioner in a Portal — the harness's single-root
    // fusion refused the in-stage form by name).
    adapterIdentity: "chakra-tooltip-proposed-v1",
    displayName: "Chakra (proposed)",
    source: chakraTooltipProposedSource,
    config: chakraTooltipProposedConfig,
  },
].map((entry) => {
  const instance = adaptReviewedTooltip(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(tooltipRecipe, instance),
    envelope: compileTooltipRecipe(instance),
  };
});

const writer = emitTooltipFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitTooltipFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitTooltipFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split tooltip writer must keep the three-library run identity");
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
        "tooltip@1 open bubble chrome from Astryx inverted body, MUI grey[700] 0.92, and AntD colorBgSpotlight; placement and arrow attachment are refusals",
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
      artifactVersion: "tooltip-live-pivot-v9-prepare",
      teaching:
        "One named default Tooltip bubble; no shared placement or arrow axis; attachment is receipted",
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
  if (!writer.code.includes("TOOLTIP-MUST-NOT-WRITE-LINK-PAGE"))
    throw new Error("tooltip writer must refuse the Link stay page");
  if (writer.namespace === "ds.contracts.link.recipe.v1")
    throw new Error("tooltip writer must not reuse the Link namespace");
  if (writer.sourcePlans.length !== 7)
    throw new Error("tooltip prepare requires 7 library sources (reviewed + proposed)");
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
