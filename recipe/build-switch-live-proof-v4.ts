import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

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

const EVIDENCE = "recipe/evidence/switch-live-pivot-v4";
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
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitSwitchFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
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

const files: Record<string, string> = { "writer.js": writer.code, "writer.plugin.js": pluginWriter.code };
for (const part of splitWriters) files[`writer-${part.adapterIdentity}.js`] = part.code;
files["plan.json"] = JSON.stringify(
    {
      pageName: writer.pageName,
      runIdentity: writer.runIdentity,
      namespace: writer.namespace,
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      teaching:
        "switch@1 AntD thumb.travel is the delta 22 (track 44 − handle 18 − 2×padding 2), not the ON inset 24. Old stay 183:75302 refused.",
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
  ) + "\n";
// Builder-owned receipt fields. Anything else already recorded in the
// committed receipt (liveFigma, pageId, url, humanGrade, live) is preserved
// by prepare and ignored by --check (recipe/live-proof-evidence.ts).
const receiptOwned = {
      artifactVersion: "switch-live-pivot-v4-prepare",
      teaching:
        "AntD Switch ON inset matches OFF: compile travel 22 from named handle travel calc(100% - handleSize - trackPadding)",
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
  if (!writer.code.includes("SWITCH-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("switch writer missing compile-label pin");
  if (!writer.code.includes("SWITCH-MUST-NOT-WRITE-CHECKBOX-PAGE"))
    throw new Error("switch writer must refuse the Checkbox stay page");
  if (!writer.code.includes("SWITCH-MUST-NOT-WRITE-RADIO-PAGE"))
    throw new Error("switch writer must refuse the Radio stay page");
  if (!writer.code.includes("SWITCH-MUST-NOT-WRITE-SWITCH-V1-PAGE"))
    throw new Error("switch writer must refuse the Switch v1 stay page");
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
