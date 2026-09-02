import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedRadio } from "./adapters/radio.js";
import { emitRadioFigmaWriter } from "./radio-figma-writer.js";
import {
  antdRadioAdapterConfig,
  antdRadioSource,
  astryxRadioAdapterConfig,
  astryxRadioSource,
  muiRadioAdapterConfig,
  muiRadioSource,
} from "./fixtures/library-radios.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileRadioRecipe, radioRecipe } from "./recipes/radio.js";

const EVIDENCE = "recipe/evidence/radio-live-pivot-v7";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-radio-reviewed-v1",
    displayName: "Astryx",
    source: astryxRadioSource,
    config: astryxRadioAdapterConfig,
  },
  {
    adapterIdentity: "mui-radio-reviewed-v1",
    displayName: "MUI",
    source: muiRadioSource,
    config: muiRadioAdapterConfig,
  },
  {
    adapterIdentity: "antd-radio-reviewed-v1",
    displayName: "Ant Design",
    source: antdRadioSource,
    config: antdRadioAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedRadio(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(radioRecipe, instance),
    envelope: compileRadioRecipe(instance),
  };
});

const writer = emitRadioFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitRadioFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitRadioFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split radio writer must keep the three-library run identity",
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
        "radio@1 AntD itemAlign compiles the painted control pairing (alignSelf center). Wrapper baseline + \\a0 strut receipted. Label lineHeight 14 × 1.5714285714 = 22. Old stay 183:75031 refused.",
      sources: writer.sourcePlans.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        variantCount: source.radioSet.children.length,
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
      artifactVersion: "radio-live-pivot-v7-prepare",
      teaching:
        "AntD Radio labels center to the 16px control via named alignSelf center + lineHeight 22; Figma BASELINE on the circle frame is not the CSS pairing",
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
  if (!writer.code.includes("RADIO-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("radio writer missing compile-label pin");
  if (!writer.code.includes("RADIO-MUST-NOT-WRITE-CHECKBOX-PAGE"))
    throw new Error("radio writer must refuse the Checkbox stay page");
  if (!writer.code.includes("RADIO-MUST-NOT-WRITE-RADIO-V1-PAGE"))
    throw new Error("radio writer must refuse the Radio v1 stay page");
  if (writer.sourcePlans.length !== 3)
    throw new Error("radio prepare requires three library sources");
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
