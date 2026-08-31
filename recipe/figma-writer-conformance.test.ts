import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import { adaptReviewedButton } from "./adapters/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import {
  buildFigmaVariableNameMap,
  emitButtonFigmaWriter,
  sanitizeFigmaVariableName,
} from "./interpret.js";
import { hashRecipeInstance } from "./recipe.js";
import { buttonRecipe, compileButtonRecipe } from "./recipes/button.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const build = () =>
  emitButtonFigmaWriter(
    [
      {
        adapterIdentity: "altitude-button-reviewed-v2",
        displayName: "Altitude",
        contract: "examples/altitude/contracts/button.contract.json",
        config: altitudeButtonAdapterConfig,
      },
      {
        adapterIdentity: "fluent-button-reviewed-v2",
        displayName: "Fluent",
        contract: "examples/fluent/contracts/button.contract.json",
        config: fluentButtonAdapterConfig,
      },
    ].map((source) => {
      const instance = adaptReviewedButton(
        readJson(source.contract),
        source.config,
      );
      return {
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: hashRecipeInstance(buttonRecipe, instance),
        envelope: compileButtonRecipe(instance),
      };
    }),
  );

test("v4 writer is deterministic and typings/live-mock conformant", async () => {
  const first = build();
  const second = build();
  assert.equal(first.code, second.code);
  assert.equal(first.pageName, second.pageName);
  assert.match(first.pageName, /-v4$/);

  const report = await validateFigmaWriterConformance(first.code);
  assert.deepEqual(report.failures, []);
  assert.equal(report.typingsVersion, "1.135.0");
  assert.equal(report.counts.variants, 288);
  assert.ok(report.counts.variables > 0);
  assert.ok(report.counts.pluginDataWrites > 0);
  assert.ok(report.counts.propertyWrites > 0);
  assert.ok(report.counts.bindings > 0);
});

test("conformance rejects all three historical Plugin API defects", async () => {
  const writer = build().code;
  const unsupported = await validateFigmaWriterConformance(
    writer.replace(
      "const pageName = PLAN.pageName;",
      "figma.createAutoLayout();\nconst pageName = PLAN.pageName;",
    ),
  );
  assert.match(unsupported.failures.join("\n"), /createAutoLayout/);

  const badNamespace = await validateFigmaWriterConformance(
    writer.replace(
      'const NS = "ds.contracts.recipe.v4";',
      'const NS = "ds-contracts-recipe-v4";',
    ),
  );
  assert.match(
    badNamespace.failures.join("\n"),
    /shared-plugin-data namespace/,
  );

  const badVariableName = await validateFigmaWriterConformance(
    writer.replace(
      "figma.variables.createVariable(variableName, collection, type)",
      "figma.variables.createVariable(bound.variable, collection, type)",
    ),
  );
  assert.match(
    badVariableName.failures.join("\n"),
    /createVariable rejected invalid Figma variable name/,
  );
});

test("variable names are stable, reversible, and collision-free", () => {
  assert.equal(
    sanitizeFigmaVariableName(
      "imported.button.root.background-color.state:hover",
      "COLOR",
    ),
    "token/color/id-696d706f727465642e627574746f6e2e726f6f742e6261636b67726f756e642d636f6c6f722e73746174653a686f766572",
  );
  assert.deepEqual(
    [
      ...buildFigmaVariableNameMap([
        { tokenIdentity: "size.16", type: "FLOAT" },
        { tokenIdentity: "color.brand", type: "COLOR" },
      ]),
    ],
    [
      ["FLOAT:size.16", "token/float/id-73697a652e3136"],
      ["COLOR:color.brand", "token/color/id-636f6c6f722e6272616e64"],
    ],
  );
  assert.doesNotThrow(() =>
    buildFigmaVariableNameMap([
      { tokenIdentity: "color.brand", type: "COLOR" },
      { tokenIdentity: "color-brand", type: "COLOR" },
    ]),
  );
});
