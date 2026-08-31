import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { adaptReviewedSwitch } from "./adapters/switch.js";
import { emitSwitchFigmaWriter } from "./switch-figma-writer.js";
import {
  antdSwitchAdapterConfig,
  antdSwitchSource,
  astryxSwitchAdapterConfig,
  astryxSwitchSource,
  muiSwitchAdapterConfig,
  muiSwitchSource,
} from "./fixtures/library-switches.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileSwitchRecipe, switchRecipe } from "./recipes/switch.js";

const EVIDENCE = "recipe/evidence/switch-live-pivot-v1";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-switch-reviewed-v1",
    displayName: "Astryx",
    source: astryxSwitchSource,
    config: astryxSwitchAdapterConfig,
  },
  {
    adapterIdentity: "mui-switch-reviewed-v1",
    displayName: "MUI",
    source: muiSwitchSource,
    config: muiSwitchAdapterConfig,
  },
  {
    adapterIdentity: "antd-switch-reviewed-v1",
    displayName: "Ant Design",
    source: antdSwitchSource,
    config: antdSwitchAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedSwitch(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(switchRecipe, instance),
    envelope: compileSwitchRecipe(instance),
  };
});

const writer = emitSwitchFigmaWriter(sources);
const splitWriters = sources.map((source) => {
  const part = emitSwitchFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError(
      "split switch writer must keep the three-library run identity",
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
        "switch@1 standalone control + label from named Astryx Switch, MUI Switch.js, and AntD Switch tokens; size is not an axis; MUI sibling overlay receipted",
      sources: writer.sourcePlans.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelopeHash: source.envelopeHash,
        variantCount: source.switchSet.children.length,
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
      artifactVersion: "switch-live-pivot-v1-prepare",
      teaching:
        "Checked × Disabled switch compiled from named Astryx, MUI Switch.js @9.2.0, and AntD Switch facts; MUI source was present in the input-field sandbox",
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
  if (!writer.code.includes("SWITCH-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("switch writer missing compile-label pin");
  if (!writer.code.includes("SWITCH-MUST-NOT-WRITE-CHECKBOX-PAGE"))
    throw new Error("switch writer must refuse the Checkbox stay page");
  if (!writer.code.includes("SWITCH-MUST-NOT-WRITE-RADIO-PAGE"))
    throw new Error("switch writer must refuse the Radio stay page");
  if (writer.sourcePlans.length !== 3)
    throw new Error("switch prepare requires three library sources");
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
