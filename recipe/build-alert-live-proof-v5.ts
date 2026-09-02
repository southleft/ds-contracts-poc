import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedAlert } from "./adapters/alert.js";
import { emitAlertFigmaWriter } from "./alert-figma-writer.js";
import {
  antdAlertAdapterConfig,
  antdAlertSource,
  astryxAlertAdapterConfig,
  astryxAlertSource,
  muiAlertAdapterConfig,
  muiAlertSource,
} from "./fixtures/library-alerts.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileAlertRecipe, alertRecipe } from "./recipes/alert.js";

const EVIDENCE = "recipe/evidence/alert-live-pivot-v5";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-alert-reviewed-v1",
    displayName: "Astryx",
    source: astryxAlertSource,
    config: astryxAlertAdapterConfig,
  },
  {
    adapterIdentity: "mui-alert-reviewed-v1",
    displayName: "MUI",
    source: muiAlertSource,
    config: muiAlertAdapterConfig,
  },
  {
    adapterIdentity: "antd-alert-reviewed-v1",
    displayName: "Ant Design",
    source: antdAlertSource,
    config: antdAlertAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedAlert(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(alertRecipe, instance),
    envelope: compileAlertRecipe(instance),
  };
});

const writer = emitAlertFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitAlertFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitAlertFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split alert writer must keep the three-library run identity",
    );
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
        "alert@1 in-page banner from named Astryx Banner, MUI Alert standard, and AntD Alert; Status is the only shared axis; defaults stay per-library (Astryx info / MUI success / AntD info); AlertDialog waits",
      sources: writer.sourcePlans.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        variantCount: source.alertSet.children.length,
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
      artifactVersion: "alert-live-pivot-v5-prepare",
      teaching:
        "Status info|success|warning|error compiled from named Banner/Alert facts; do not invent a shared default status; SVG glyphs receipted as colour+size boxes",
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
  if (!writer.code.includes("ALERT-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("alert writer missing compile-label pin");
  if (!writer.code.includes("ALERT-MUST-NOT-WRITE-TEXTAREA-PAGE"))
    throw new Error("alert writer must refuse the Textarea stay page");
  if (writer.sourcePlans.length !== 3)
    throw new Error("alert prepare requires three library sources");
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
