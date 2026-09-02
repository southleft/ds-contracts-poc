import { createHash } from "node:crypto";
import { publishEvidence } from "./live-proof-evidence.js";

import { adaptReviewedMenu } from "./adapters/menu.js";
import { emitMenuFigmaWriter } from "./menu-figma-writer.js";
import {
  antdMenuAdapterConfig,
  antdMenuSource,
  astryxMenuAdapterConfig,
  astryxMenuSource,
  muiMenuAdapterConfig,
  muiMenuSource,
} from "./fixtures/library-menus.js";
import { hashRecipeInstance } from "./recipe.js";
import { compileMenuRecipe, menuRecipe } from "./recipes/menu.js";

const EVIDENCE = "recipe/evidence/menu-live-pivot-v6";
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const sources = [
  {
    adapterIdentity: "astryx-menu-reviewed-v1",
    displayName: "Astryx",
    source: astryxMenuSource,
    config: astryxMenuAdapterConfig,
  },
  {
    adapterIdentity: "mui-menu-reviewed-v1",
    displayName: "MUI",
    source: muiMenuSource,
    config: muiMenuAdapterConfig,
  },
  {
    adapterIdentity: "antd-menu-reviewed-v1",
    displayName: "Ant Design",
    source: antdMenuSource,
    config: antdMenuAdapterConfig,
  },
].map((entry) => {
  const instance = adaptReviewedMenu(entry.source, entry.config);
  return {
    adapterIdentity: entry.adapterIdentity,
    displayName: entry.displayName,
    recipeHash: hashRecipeInstance(menuRecipe, instance),
    envelope: compileMenuRecipe(instance),
  };
});

const writer = emitMenuFigmaWriter(sources);
// The product-path program: same plan, no Scratch pin, no page list — what a
// user pastes into the shipped plugin's Paste-a-script verb in their own file.
const pluginWriter = emitMenuFigmaWriter(sources, { runIdentity: `${writer.runIdentity}-plugin`, target: "plugin" });
const splitWriters = sources.map((source) => {
  const part = emitMenuFigmaWriter([source], {
    runIdentity: writer.runIdentity,
  });
  if (part.pageName !== writer.pageName || part.runIdentity !== writer.runIdentity)
    throw new TypeError("split menu writer must keep the three-library run identity");
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
        "menu@1 open panel plus two items from Astryx DropdownMenu, MUI Menu, and AntD Dropdown; placement is a refusal",
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
      artifactVersion: "menu-live-pivot-v6-prepare",
      teaching:
        "One named default Menu panel; two items; placement is receipted",
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
  if (!writer.code.includes("MENU-MUST-NOT-WRITE-TABS-PAGE"))
    throw new Error("menu writer must refuse the Tabs stay page");
  if (writer.namespace === "ds.contracts.tabs.recipe.v1")
    throw new Error("menu writer must not reuse the Tooltip namespace");
  if (writer.sourcePlans.length !== 3)
    throw new Error("tabs prepare requires three library sources");
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
