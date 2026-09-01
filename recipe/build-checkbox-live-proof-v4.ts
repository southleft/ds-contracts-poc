import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedCheckbox } from "./adapters/checkbox.js";
import { emitCheckboxFigmaWriter } from "./checkbox-figma-writer.js";
import {
  antdCheckboxAdapterConfig,
  antdCheckboxSource,
  astryxCheckboxAdapterConfig,
  astryxCheckboxSource,
  muiCheckboxAdapterConfig,
  muiCheckboxSource,
} from "./fixtures/library-checkboxes.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  checkboxRecipe,
  compileCheckboxRecipe,
} from "./recipes/checkbox.js";

const EVIDENCE = "recipe/evidence/checkbox-live-pivot-v4";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-checkbox-reviewed-v1",
    displayName: "Astryx",
    source: astryxCheckboxSource,
    config: astryxCheckboxAdapterConfig,
  },
  {
    adapterIdentity: "mui-checkbox-reviewed-v1",
    displayName: "MUI",
    source: muiCheckboxSource,
    config: muiCheckboxAdapterConfig,
  },
  {
    adapterIdentity: "antd-checkbox-reviewed-v1",
    displayName: "Ant Design",
    source: antdCheckboxSource,
    config: antdCheckboxAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedCheckbox(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(checkboxRecipe, instance),
    envelope: compileCheckboxRecipe(instance),
  };
});

const writer = emitCheckboxFigmaWriter(sources);
const splitWriters = sources.map((source) => {
  const part = emitCheckboxFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split checkbox writer must keep the three-library run identity",
    );
  return { adapterIdentity: source.adapterIdentity, ...part };
});

const files: Record<string, string> = { "writer.js": writer.code };
for (const part of splitWriters) files[`writer-${part.adapterIdentity}.js`] = part.code;
files["plan.json"] = JSON.stringify(
    {
      pageName: writer.pageName,
      runIdentity: writer.runIdentity,
      namespace: writer.namespace,
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      teaching:
        "checkbox@1 MUI CheckBox.js even-odd icon (no white overlay, no leftover stroke). AntD ::after L baked to a check path (rotation 0). AntD indeterminate is fontSizeLG/2 × lineWidthBold dash. Old stays 183:74742 and 196:76370 refused.",
      sources: writer.sourcePlans.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        variantCount: source.checkboxSet.children.length,
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
      artifactVersion: "checkbox-live-pivot-v4-prepare",
      teaching:
        "MUI even-odd primary icon on paper; AntD pre-rotated L is a check; AntD dash is 8×2 not an 8×8 tile",
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
  if (!writer.code.includes("CHECKBOX-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("checkbox writer missing compile-label pin");
  if (!writer.code.includes("CHECKBOX-WRITER-VECTOR-PATH"))
    throw new Error("checkbox writer must emit createVector for named glyphs");
  if (!writer.code.includes("CHECKBOX-MUST-NOT-WRITE-CHECKBOX-V1-PAGE"))
    throw new Error("checkbox writer must refuse the Checkbox v1 stay page");
  if (!writer.code.includes("CHECKBOX-MUST-NOT-WRITE-CHECKBOX-V2-PAGE"))
    throw new Error("checkbox writer must refuse the Checkbox v2 stay page");
  if (writer.sourcePlans.length !== 3)
    throw new Error("checkbox prepare requires three library sources");
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
