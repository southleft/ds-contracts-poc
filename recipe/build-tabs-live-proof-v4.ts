import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { adaptReviewedTabs } from "./adapters/tabs.js";
import { emitTabsFigmaWriter } from "./tabs-figma-writer.js";
import {
  antdTabsAdapterConfig,
  antdTabsSource,
  astryxTabsAdapterConfig,
  astryxTabsSource,
  muiTabsAdapterConfig,
  muiTabsSource,
} from "./fixtures/library-tabs.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileTabsRecipe, tabsRecipe } from "./recipes/tabs.js";

const EVIDENCE = "recipe/evidence/tabs-live-pivot-v4";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-tabs-reviewed-v1",
    displayName: "Astryx",
    source: astryxTabsSource,
    config: astryxTabsAdapterConfig,
  },
  {
    adapterIdentity: "mui-tabs-reviewed-v1",
    displayName: "MUI",
    source: muiTabsSource,
    config: muiTabsAdapterConfig,
  },
  {
    adapterIdentity: "antd-tabs-reviewed-v1",
    displayName: "Ant Design",
    source: antdTabsSource,
    config: antdTabsAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedTabs(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(tabsRecipe, instance),
    envelope: compileTabsRecipe(instance),
  };
});

const writer = emitTabsFigmaWriter(sources);
const splitWriters = sources.map((source) => {
  const part = emitTabsFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split tabs writer must keep the three-library run identity");
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
        "tabs@1 two-item rail from Astryx TabList, MUI Tabs, and AntD Tabs; indicator is a child of the selected tab; overlay ink-bar offsets are refusals",
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
      artifactVersion: "tabs-live-pivot-v4-prepare",
      teaching:
        "One named default Tabs rail; selected-child indicator; no invented overlay ink-bar offsets",
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
  if (!writer.code.includes("TABS-MUST-NOT-WRITE-TOOLTIP-PAGE"))
    throw new Error("tabs writer must refuse the Tooltip stay page");
  if (writer.namespace === "ds.contracts.tooltip.recipe.v1")
    throw new Error("tabs writer must not reuse the Tooltip namespace");
  if (writer.sourcePlans.length !== 3)
    throw new Error("tabs prepare requires three library sources");
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
