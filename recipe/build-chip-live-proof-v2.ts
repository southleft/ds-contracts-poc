import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { adaptReviewedChip } from "./adapters/chip.js";
import { emitChipFigmaWriter } from "./chip-figma-writer.js";
import {
  antdChipAdapterConfig,
  antdChipSource,
  astryxChipAdapterConfig,
  astryxChipSource,
  muiChipAdapterConfig,
  muiChipSource,
} from "./fixtures/library-chips.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileChipRecipe, chipRecipe } from "./recipes/chip.js";

const EVIDENCE = "recipe/evidence/chip-live-pivot-v2";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-chip-reviewed-v1",
    displayName: "Astryx",
    source: astryxChipSource,
    config: astryxChipAdapterConfig,
  },
  {
    adapterIdentity: "mui-chip-reviewed-v1",
    displayName: "MUI",
    source: muiChipSource,
    config: muiChipAdapterConfig,
  },
  {
    adapterIdentity: "antd-chip-reviewed-v1",
    displayName: "Ant Design",
    source: antdChipSource,
    config: antdChipAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedChip(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(chipRecipe, instance),
    envelope: compileChipRecipe(instance),
  };
});

const writer = emitChipFigmaWriter(sources);
const splitWriters = sources.map((source) => {
  const part = emitChipFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split chip writer must keep the three-library run identity");
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
        "chip@1 named default cell from Astryx Token, MUI Chip filled/default/medium, and AntD Tag bordered; color/size/closable are not axes; do not invent an Astryx Chip",
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
      artifactVersion: "chip-live-pivot-v2-prepare",
      teaching:
        "One named default Token/Chip/Tag cell; no shared Color/Size/Closable axis",
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
  if (!writer.code.includes("CHIP-MUST-NOT-WRITE-ALERT-PAGE"))
    throw new Error("chip writer must refuse the Alert stay page");
  if (writer.sourcePlans.length !== 3)
    throw new Error("chip prepare requires three library sources");
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
