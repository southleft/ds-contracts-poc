import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

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

const EVIDENCE = "recipe/evidence/chip-live-pivot-v5";
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
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitChipFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitChipFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split chip writer must keep the three-library run identity");
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
  ) + "\n";
// Builder-owned receipt fields. Anything else already recorded in the
// committed receipt (liveFigma, pageId, url, humanGrade, live) is preserved
// by prepare and ignored by --check (recipe/live-proof-evidence.ts).
const receiptOwned = {
      artifactVersion: "chip-live-pivot-v5-prepare",
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
};
publishEvidence(EVIDENCE, files, receiptOwned, { check: process.argv.includes("--check") });

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
