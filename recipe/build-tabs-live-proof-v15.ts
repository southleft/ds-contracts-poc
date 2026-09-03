import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

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
import { muiTabsAdapterConfig as muiTabsProposedConfig, muiTabsSource as muiTabsProposedSource } from "./fixtures/generated/tabs.mui.js";
import { carbonTabsAdapterConfig as carbonTabsProposedConfig, carbonTabsSource as carbonTabsProposedSource } from "./fixtures/generated/tabs.carbon.js";
import { compileTabsRecipe, tabsRecipe } from "./recipes/tabs.js";

const EVIDENCE = "recipe/evidence/tabs-live-pivot-v15";
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
  {
    // PROPOSED by recipe/fixture-reader/propose-tabs.ts from mui's capture.
    adapterIdentity: "mui-tabs-proposed-v1",
    displayName: "mui (proposed)",
    source: muiTabsProposedSource,
    config: muiTabsProposedConfig,
  },
  {
    // PROPOSED by recipe/fixture-reader/propose-tabs.ts from carbon's capture.
    adapterIdentity: "carbon-tabs-proposed-v1",
    displayName: "carbon (proposed)",
    source: carbonTabsProposedSource,
    config: carbonTabsProposedConfig,
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
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitTabsFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitTabsFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split tabs writer must keep the three-library run identity");
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
  ) + "\n";
// Builder-owned receipt fields. Anything else already recorded in the
// committed receipt (liveFigma, pageId, url, humanGrade, live) is preserved
// by prepare and ignored by --check (recipe/live-proof-evidence.ts).
const receiptOwned = {
      artifactVersion: "tabs-live-pivot-v15-prepare",
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
};
publishEvidence(EVIDENCE, files, receiptOwned, { check: process.argv.includes("--check") });

if (process.argv.includes("--check")) {
  if (!writer.code.includes("TABS-MUST-NOT-WRITE-TOOLTIP-PAGE"))
    throw new Error("tabs writer must refuse the Tooltip stay page");
  if (writer.namespace === "ds.contracts.tooltip.recipe.v1")
    throw new Error("tabs writer must not reuse the Tooltip namespace");
  if (writer.sourcePlans.length !== 5)
    throw new Error("tabs prepare requires 5 library sources (reviewed + proposed)");
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
