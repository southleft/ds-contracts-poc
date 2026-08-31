import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { adaptReviewedTextarea } from "./adapters/textarea.js";
import { emitTextareaFigmaWriter } from "./textarea-figma-writer.js";
import {
  antdTextareaAdapterConfig,
  antdTextareaSource,
  astryxTextareaAdapterConfig,
  astryxTextareaSource,
  muiTextareaAdapterConfig,
  muiTextareaSource,
} from "./fixtures/library-textareas.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileTextareaRecipe, textareaRecipe } from "./recipes/textarea.js";

const EVIDENCE = "recipe/evidence/textarea-live-pivot-v2";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-textarea-reviewed-v1",
    displayName: "Astryx",
    source: astryxTextareaSource,
    config: astryxTextareaAdapterConfig,
  },
  {
    adapterIdentity: "mui-textarea-reviewed-v1",
    displayName: "MUI",
    source: muiTextareaSource,
    config: muiTextareaAdapterConfig,
  },
  {
    adapterIdentity: "antd-textarea-reviewed-v1",
    displayName: "Ant Design",
    source: antdTextareaSource,
    config: antdTextareaAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedTextarea(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(textareaRecipe, instance),
    envelope: compileTextareaRecipe(instance),
  };
});

const writer = emitTextareaFigmaWriter(sources);
const splitWriters = sources.map((source) => {
  const part = emitTextareaFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split textarea writer must keep the three-library run identity",
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
        "textarea@1 MUI outlined InputLabel floating/notched from named translate(14px, 16px) rest and translate(14px, -9px) scale(0.75) shrink. Astryx/AntD stay stacked. Do not remint Input 115:295378. Old stay 183:75495 refused.",
      sources: writer.sourcePlans.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        variantCount: source.textareaSet.children.length,
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
      artifactVersion: "textarea-live-pivot-v2-prepare",
      teaching:
        "MUI TextField multiline compiles the named floating InputLabel + notch fill palette.background.paper; stacked Astryx/AntD unchanged",
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
  if (!writer.code.includes("TEXTAREA-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("textarea writer missing compile-label pin");
  if (!writer.code.includes("TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE"))
    throw new Error("textarea writer must refuse the Switch stay page");
  if (!writer.code.includes("TEXTAREA-MUST-NOT-WRITE-TEXTAREA-V1-PAGE"))
    throw new Error("textarea writer must refuse the Textarea v1 stay page");
  if (writer.sourcePlans.length !== 3)
    throw new Error("textarea prepare requires three library sources");
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
