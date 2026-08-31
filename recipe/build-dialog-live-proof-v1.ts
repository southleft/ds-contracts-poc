import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

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

const EVIDENCE = "recipe/evidence/dialog-live-pivot-v1";
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
  ) + "\n",
);
writeFileSync(
  `${EVIDENCE}/receipt.json`,
  JSON.stringify(
    {
      artifactVersion: "dialog-live-pivot-v1-prepare",
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
