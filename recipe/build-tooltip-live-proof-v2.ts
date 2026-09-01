import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

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
import { compileTooltipRecipe, tooltipRecipe } from "./recipes/tooltip.js";

const EVIDENCE = "recipe/evidence/tooltip-live-pivot-v2";
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
const splitWriters = sources.map((source) => {
  const part = emitTooltipFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split tooltip writer must keep the three-library run identity");
  return { adapterIdentity: source.adapterIdentity, ...part };
});

mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(`${EVIDENCE}/writer.js`, writer.code);
for (const part of splitWriters)
  writeFileSync(`${EVIDENCE}/writer-${part.adapterIdentity}.js`, part.code);
writeFileSync(
  `${EVIDENCE}/plan.json`,
  JSON.stringify(
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
  ) + "\n",
);
writeFileSync(
  `${EVIDENCE}/receipt.json`,
  JSON.stringify(
    {
      artifactVersion: "tooltip-live-pivot-v2-prepare",
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
      liveFigma: false,
      humanGrade: "queued-for-TJ",
      overallSuccess: false,
      productV1: "INCOMPLETE",
    },
    null,
    2,
  ) + "\n",
);

if (process.argv.includes("--check")) {
  if (!writer.code.includes("TOOLTIP-MUST-NOT-WRITE-LINK-PAGE"))
    throw new Error("tooltip writer must refuse the Link stay page");
  if (writer.namespace === "ds.contracts.link.recipe.v1")
    throw new Error("tooltip writer must not reuse the Link namespace");
  if (writer.sourcePlans.length !== 3)
    throw new Error("tooltip prepare requires three library sources");
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
