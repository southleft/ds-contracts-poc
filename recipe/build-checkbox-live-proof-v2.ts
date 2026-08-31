import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

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

const EVIDENCE = "recipe/evidence/checkbox-live-pivot-v2";
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
const splitWriters = sources.map((source, index) => {
  const part = emitCheckboxFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split checkbox writer must keep the three-library run identity",
    );
  return { index, adapterIdentity: source.adapterIdentity, ...part };
});

mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(`${EVIDENCE}/writer.js`, writer.code);
for (const part of splitWriters)
  writeFileSync(
    `${EVIDENCE}/writer-${part.adapterIdentity}.js`,
    part.code,
  );
writeFileSync(
  `${EVIDENCE}/plan.json`,
  JSON.stringify(
    {
      pageName: writer.pageName,
      runIdentity: writer.runIdentity,
      namespace: writer.namespace,
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      teaching:
        "checkbox@1 VECTOR glyphs from named package paths: Astryx stroke check, MUI even-odd hole overlay, AntD ::after rotate(45deg) L. Writer v2 createVector. Old stay 183:74742 refused.",
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
  ) + "\n",
);
writeFileSync(
  `${EVIDENCE}/receipt.json`,
  JSON.stringify(
    {
      artifactVersion: "checkbox-live-pivot-v2-prepare",
      teaching:
        "Visible check from named package SVG/CSS; MUI indeterminate dashFill white so checked ≠ indeterminate; AntD L-stroke compiled",
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
  if (!writer.code.includes("CHECKBOX-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("checkbox writer missing compile-label pin");
  if (!writer.code.includes("CHECKBOX-WRITER-VECTOR-PATH"))
    throw new Error("checkbox writer must emit createVector for named glyphs");
  if (!writer.code.includes("CHECKBOX-MUST-NOT-WRITE-CHECKBOX-V1-PAGE"))
    throw new Error("checkbox writer must refuse the Checkbox v1 stay page");
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
