import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

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
import { chakraFieldTextareaAdapterConfig as chakraFieldTextareaProposedConfig, chakraFieldTextareaSource as chakraFieldTextareaProposedSource } from "./fixtures/generated/textarea.chakra-field.js";
import { muiTextareaAdapterConfig as muiTextareaProposedConfig, muiTextareaSource as muiTextareaProposedSource } from "./fixtures/generated/textarea.mui.js";
import { antdTextareaAdapterConfig as antdTextareaProposedConfig, antdTextareaSource as antdTextareaProposedSource } from "./fixtures/generated/textarea.antd.js";
import { chakraTextareaAdapterConfig as chakraTextareaProposedConfig, chakraTextareaSource as chakraTextareaProposedSource } from "./fixtures/generated/textarea.chakra.js";
import { compileTextareaRecipe, textareaRecipe } from "./recipes/textarea.js";

const EVIDENCE = "recipe/evidence/textarea-live-pivot-v13";
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
  {
    // PROPOSED from MUI's own capture (floating notched label from the label's transform; 38 read, 2 reviewed).
    adapterIdentity: "mui-textarea-proposed-v1",
    displayName: "MUI (proposed)",
    source: muiTextareaProposedSource,
    config: muiTextareaProposedConfig,
  },
  {
    // PROPOSED from AntD's own capture: the BARE cell (26 read, 0 invented).
    adapterIdentity: "antd-textarea-proposed-v1",
    displayName: "Ant Design (proposed)",
    source: antdTextareaProposedSource,
    config: antdTextareaProposedConfig,
  },
  {
    // HELD OUT: Chakra's Textarea, re-captured today with real screenshots; the bare cell (26 read, 0 invented).
    adapterIdentity: "chakra-textarea-proposed-v1",
    displayName: "Chakra (proposed)",
    source: chakraTextareaProposedSource,
    config: chakraTextareaProposedConfig,
  },
  {
    // HELD OUT: Chakra's Field + Label + Textarea (the stacked label plane), captured today with the value on the child (39 read, 0 invented).
    adapterIdentity: "chakra-field-textarea-proposed-v1",
    displayName: "Chakra Field (proposed)",
    source: chakraFieldTextareaProposedSource,
    config: chakraFieldTextareaProposedConfig,
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
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitTextareaFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
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

const files: Record<string, string> = { "writer.js": writer.code, "writer.plugin.js": pluginWriter.code };
for (const part of splitWriters) files[`writer-${part.adapterIdentity}.js`] = part.code;
files["plan.json"] = JSON.stringify(
    {
      pageName: writer.pageName,
      runIdentity: writer.runIdentity,
      namespace: writer.namespace,
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      teaching:
        "textarea@1 Content=focus is the named focused-empty column (InputLabel.js:197-199). Floating rest empty hides placeholder (InputBase.js:179-188). Do not remint Input 115:295378. Old stays 183:75495 and 198:77048 refused.",
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
  ) + "\n";
// Builder-owned receipt fields. Anything else already recorded in the
// committed receipt (liveFigma, pageId, url, humanGrade, live) is preserved
// by prepare and ignored by --check (recipe/live-proof-evidence.ts).
const receiptOwned = {
      artifactVersion: "textarea-live-pivot-v13-prepare",
      teaching:
        "MUI rest empty hides placeholder; Content=focus shrinks the label and shows placeholder. Stacked Astryx/AntD empty and focus look the same. No invented focus ring.",
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
  if (!writer.code.includes("TEXTAREA-WRITER-SET-NAME-CARRIES-COMPILE-LABEL"))
    throw new Error("textarea writer missing compile-label pin");
  if (!writer.code.includes("TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE"))
    throw new Error("textarea writer must refuse the Switch stay page");
  if (!writer.code.includes("TEXTAREA-MUST-NOT-WRITE-TEXTAREA-V1-PAGE"))
    throw new Error("textarea writer must refuse the Textarea v1 stay page");
  if (!writer.code.includes("TEXTAREA-MUST-NOT-WRITE-TEXTAREA-V2-PAGE"))
    throw new Error("textarea writer must refuse the Textarea v2 stay page");
  if (writer.sourcePlans.length !== 7)
    throw new Error("textarea prepare requires 7 library sources (reviewed + proposed)");
  for (const source of writer.sourcePlans)
    if (source.textareaSet.children.length !== 6)
      throw new Error("textarea v3 must compile empty/focus/value × disabled");
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
