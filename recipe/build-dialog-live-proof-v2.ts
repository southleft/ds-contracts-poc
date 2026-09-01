import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedDialog } from "./adapters/dialog.js";
import { emitDialogFigmaWriter } from "./dialog-figma-writer.js";
import {
  antdDialogAdapterConfig,
  antdDialogSource,
  astryxDialogAdapterConfig,
  astryxDialogSource,
  muiDialogAdapterConfig,
  muiDialogSource,
} from "./fixtures/library-dialogs.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileDialogRecipe, dialogRecipe } from "./recipes/dialog.js";

const EVIDENCE = "recipe/evidence/dialog-live-pivot-v2";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-dialog-reviewed-v1",
    displayName: "Astryx",
    source: astryxDialogSource,
    config: astryxDialogAdapterConfig,
  },
  {
    adapterIdentity: "mui-dialog-reviewed-v1",
    displayName: "MUI",
    source: muiDialogSource,
    config: muiDialogAdapterConfig,
  },
  {
    adapterIdentity: "antd-dialog-reviewed-v1",
    displayName: "Ant Design",
    source: antdDialogSource,
    config: antdDialogAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedDialog(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(dialogRecipe, instance),
    envelope: compileDialogRecipe(instance),
  };
});

const writer = emitDialogFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitDialogFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitDialogFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split dialog writer must keep the three-library run identity",
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
        "dialog@1 open paper plus title and body from Astryx Dialog, MUI Dialog, and AntD Modal; full-bleed scrim size is a refusal",
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
      artifactVersion: "dialog-live-pivot-v2-prepare",
      teaching:
        "One named default Dialog paper; title and body; full-bleed scrim size is receipted",
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
  if (!writer.code.includes("DIALOG-MUST-NOT-WRITE-MENU-PAGE"))
    throw new Error("dialog writer must refuse the Menu stay page");
  if (writer.namespace === "ds.contracts.menu.recipe.v1")
    throw new Error("dialog writer must not reuse the Menu namespace");
  if (writer.sourcePlans.length !== 3)
    throw new Error("dialog prepare requires three library sources");
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
