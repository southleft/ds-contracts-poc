import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedCombobox } from "./adapters/combobox.js";
import {
  COMBOBOX_FIGMA_NAMESPACE,
  COMBOBOX_FIGMA_RUN_SUFFIX,
  FORBIDDEN_INPUT_NAMESPACE,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_INPUT_RUN_IDENTITY,
  emitComboboxFigmaWriter,
  validateComboboxFigmaSourcePlans,
  type ComboboxFigmaWriterInput,
} from "./combobox-figma-writer.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import {
  antdComboboxAdapterConfig,
  antdComboboxSource,
  muiComboboxAdapterConfig,
  muiComboboxSource,
} from "./fixtures/library-comboboxes.js";
import { hashRecipeInstance } from "./recipe.js";
import { comboboxRecipe, compileComboboxRecipe } from "./recipes/combobox.js";
import type { IRNode } from "./figma-ir.js";

const walkStripRole = (node: IRNode, role: string): void => {
  if (node.role === role) node.role = "stripped";
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) walkStripRole(child, role);
  }
};

const inputs = (): ComboboxFigmaWriterInput[] =>
  [
    {
      adapterIdentity: "material-combobox-reviewed-v1",
      displayName: "Material Autocomplete",
      source: muiComboboxSource,
      config: muiComboboxAdapterConfig,
    },
    {
      adapterIdentity: "commerce-combobox-reviewed-v1",
      displayName: "Commerce Select",
      source: antdComboboxSource,
      config: antdComboboxAdapterConfig,
    },
  ].map(({ source, config, ...rest }) => {
    const instance = adaptReviewedCombobox(source, config);
    return {
      ...rest,
      recipeHash: hashRecipeInstance(comboboxRecipe, instance),
      envelope: compileComboboxRecipe(instance),
    };
  });

test("Combobox writer plans two complete 64+8 primitive-IR sets without source branches", () => {
  const writer = emitComboboxFigmaWriter(inputs());
  assert.equal(writer.sourcePlans.length, 2);
  assert.equal(writer.namespace, COMBOBOX_FIGMA_NAMESPACE);
  assert.match(writer.runIdentity, new RegExp(`-${COMBOBOX_FIGMA_RUN_SUFFIX}$`));
  assert.match(writer.pageName, /^Recipe Pivot \/ Combobox \/ /);
  assert.notEqual(writer.namespace, FORBIDDEN_INPUT_NAMESPACE);
  assert.notEqual(writer.runIdentity, FORBIDDEN_INPUT_RUN_IDENTITY);
  assert.notEqual(writer.runIdentity, "70c24cbd-d27f2e85-combobox-v1");
  assert.equal(writer.pageName.includes(FORBIDDEN_INPUT_PAGE_ID), false);
  assert.match(writer.code, /COMBOBOX-V41-IDENTITY-REUSE/);
  assert.match(writer.code, /163:35981/);
  assert.equal(
    writer.sourcePlans.reduce(
      (sum, source) => sum + source.comboboxCells.length + source.optionCells.length,
      0,
    ),
    144,
  );
  assert.equal(
    writer.sourcePlans.every(
      (source) =>
        source.variables.length > 0 &&
        source.comparedIrFacts > 0 &&
        source.comboboxSet.kind === "component-set" &&
        source.optionSet.kind === "component-set",
    ),
    true,
  );
  const generic = readFileSync("recipe/combobox-figma-writer.ts", "utf8").toLowerCase();
  for (const identity of ["@mui", "mui.", "antd", "ant-design"]) {
    assert.equal(generic.includes(identity), false, identity);
  }
  assert.match(writer.code, /COMBOBOX-WRITER-FIRST-SEGMENT-BIND/);
  assert.match(writer.code, /COMBOBOX-WRITER-HIDDEN-FILL-OCCUPANCY/);
  assert.match(writer.code, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  assert.match(writer.code, /addComponentProperty\("Label","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Value","TEXT"/);
  assert.match(writer.code, /addComponentProperty\("Disabled","BOOLEAN"/);
  assert.match(writer.code, /COMBOBOX-OPTION-ARIA-SOURCE-ABSENT/);
  assert.equal(
    writer.sourcePlans.every(
      (source) =>
        source.optionAriaDefaults.Label === "Ada Lovelace" &&
        source.optionAriaDefaults.Value === "ada" &&
        source.optionAriaDefaults.Disabled === false,
    ),
    true,
  );
  assert.equal(writer.code.includes("Ada Lovelace".toLowerCase()), false);
  assert.match(writer.code, /COMBOBOX-OVERLAY-DECLARATION-INCOMPLETE/);
  assert.equal(writer.code.includes("node.letterSpacing"), false);
  assert.equal(writer.code.includes("node.textCase"), false);
  assert.equal(writer.code.includes("node.textDecoration"), false);
  assert.match(writer.code, /COMBOBOX-INPUT-IDENTITY-REUSE/);
  assert.match(writer.code, /COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE/);
});

test("Combobox writer planted structure and API plans fail closed", async () => {
  const writer = emitComboboxFigmaWriter(inputs());
  const omitted = structuredClone(writer.sourcePlans);
  walkStripRole(omitted[0]!.comboboxSet, "combobox/trigger");
  assert.match(
    validateComboboxFigmaSourcePlans(omitted).join("\n"),
    /missing combobox\/trigger/,
  );
  const zeroVariables = structuredClone(writer.sourcePlans);
  zeroVariables[0]!.variables = [];
  assert.match(
    validateComboboxFigmaSourcePlans(zeroVariables).join("\n"),
    /variables denominator is zero/,
  );
  const plantedApi = writer.code.replace(
    "figma.createText()",
    "figma.createImaginaryText()",
  );
  assert.notEqual(plantedApi, writer.code);
  const conformance = await validateFigmaWriterConformance(plantedApi, {
    variants: 144,
    writerVersion: 1,
    requiredMarkers: ["COMBOBOX-TEXT-GEOMETRY", "COMBOBOX-FAKE-LAYOUT"],
  });
  assert.equal(conformance.ok, false);
  assert.match(conformance.failures.join("\n"), /createImaginaryText/);
});

test("Combobox writer mock-mints 144 variants under a Combobox identity", async () => {
  const writer = emitComboboxFigmaWriter(inputs());
  const conformance = await validateFigmaWriterConformance(writer.code, {
    variants: 144,
    writerVersion: 1,
    requiredMarkers: [
      "COMBOBOX-TEXT-GEOMETRY",
      "COMBOBOX-FAKE-LAYOUT",
      "COMBOBOX-WRITER-FIRST-SEGMENT-BIND",
      "COMBOBOX-WRITER-HIDDEN-FILL-OCCUPANCY",
      "COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES",
    ],
  });
  assert.equal(conformance.ok, true, conformance.failures.join("\n"));
  assert.equal(conformance.result?.namespace, COMBOBOX_FIGMA_NAMESPACE);
  assert.equal(conformance.result?.runIdentity.endsWith(COMBOBOX_FIGMA_RUN_SUFFIX), true);
  assert.equal(conformance.result?.pageId === FORBIDDEN_INPUT_PAGE_ID, false);
});
