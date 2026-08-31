import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import React, { Children } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { auditInputFieldAccounting } from "./accounting.js";
import {
  adaptReviewedInputField,
  auditReviewedInputFieldAcquisition,
  type ReviewedInputFieldAdapterConfig,
} from "./adapters/input-field.js";
import { canonicalInputFieldRecipeInstance } from "./fixtures/input-field.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { emitInputFieldOutputs } from "./output/input-field.js";
import { assertSafeOutputFiles } from "./output-safety.js";
import { measureInputFieldRequiredFacts } from "./required-facts.js";
import { compileInputFieldRecipe } from "./recipes/input-field.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const nodeRequire = createRequire(import.meta.url);

const sources = [
  {
    path: "examples/mui/contracts/text-field.contract.json",
    config: muiInputFieldAdapterConfig,
  },
  {
    path: "examples/polaris/contracts/text-field.contract.json",
    config: polarisInputFieldAdapterConfig,
  },
] as const;

test("two real source targets populate one generic recipe without identity branches", () => {
  const instances = sources.map(({ path, config }) =>
    adaptReviewedInputField(readJson(path), config),
  );
  const reports = instances.map((instance, index) =>
    auditInputFieldAccounting(instance, compileInputFieldRecipe(instance)),
  );
  assert.equal(
    reports.reduce((total, report) => total + report.factsCompared, 0) > 200,
    true,
  );
  assert.equal(
    reports.every((report) => report.failures.length === 0),
    true,
  );
  assert.equal(
    instances.every(
      (instance) =>
        instance.provenance.selection.mechanism === "reviewed-config" &&
        instance.provenance.selection.manualCost.value > 0,
    ),
    true,
  );

  const genericSources = [
    "recipe/recipes/input-field.ts",
    "recipe/adapters/input-field.ts",
    "recipe/output/input-field.ts",
  ].map((path) => readFileSync(path, "utf8").toLowerCase());
  for (const identity of [
    "mui",
    "polaris",
    "@mui/material",
    "@shopify/polaris",
    "mui.text-field",
    "polaris.text-field",
    "material#textfield",
    "shopify",
  ]) {
    assert.equal(
      genericSources.some((source) => source.includes(identity)),
      false,
      `${identity} must remain reviewed fixture data`,
    );
  }

  const changed = structuredClone(
    muiInputFieldAdapterConfig,
  ) as ReviewedInputFieldAdapterConfig;
  changed.parameters.states.default.background = {
    variable: "synthetic.input.background",
    fallback: "#123456ff",
  };
  const counterexample = adaptReviewedInputField(
    readJson(sources[0].path),
    changed,
  );
  const baseline = instances[0]!;
  assert.notDeepEqual(
    compileInputFieldRecipe(counterexample).ir,
    compileInputFieldRecipe(baseline).ir,
    "parameters, not source identity, must control output",
  );
});

test("reviewed acquisition records cost, setup, unsupported cells, and planted omissions", () => {
  for (const { path, config } of sources) {
    const source = readJson(path);
    const instance = adaptReviewedInputField(source, config);
    const clean = auditReviewedInputFieldAcquisition(source, config, instance);
    assert.ok(clean.factsSelected >= clean.parameterFields);
    assert.ok(clean.parameterFields > 0);
    assert.ok(clean.mappingCount >= clean.factsSelected);
    assert.equal(
      Object.values(clean.byField).every((count) => count > 0),
      true,
    );
    assert.ok(clean.setupSeconds > 0);
    assert.ok(clean.unsupportedCells > 0);
    assert.deepEqual(clean.failures, []);

    for (const category of [
      "geometry",
      "typography",
      "fill",
      "state",
      "semantics",
    ] as const) {
      const planted = structuredClone(
        config,
      ) as ReviewedInputFieldAdapterConfig;
      const index = planted.sourceFacts.findIndex(
        (fact) => fact.category === category,
      );
      assert.notEqual(index, -1);
      const facts = [...planted.sourceFacts];
      facts[index] = {
        ...facts[index]!,
        landing: `tokens.omitted.${category}`,
      };
      planted.sourceFacts = facts;
      assert.match(
        auditReviewedInputFieldAcquisition(
          source,
          planted,
          instance,
        ).failures.join("\n"),
        new RegExp(
          `parameter landing tokens\\.omitted\\.${category} is absent`,
        ),
      );
    }

    const omitted = structuredClone(config) as ReviewedInputFieldAdapterConfig;
    const omittedLanding = "tokens.sizes.medium.inputFontSize";
    omitted.sourceFacts = omitted.sourceFacts.filter(
      (fact) => fact.landing !== omittedLanding,
    );
    assert.match(
      auditReviewedInputFieldAcquisition(
        source,
        omitted,
        instance,
      ).failures.join("\n"),
      /tokens\.sizes\.medium\.inputFontSize: explicit source parameter accounting is zero/,
    );

    const mislabeled = structuredClone(
      config,
    ) as ReviewedInputFieldAdapterConfig;
    const mislabeledIndex = mislabeled.sourceFacts.findIndex(
      (fact) =>
        fact.landing === "tokens.sizes.medium.inputFontSize" &&
        fact.fact.channel.startsWith("reviewed-"),
    );
    assert.notEqual(mislabeledIndex, -1);
    const mislabeledFacts = [...mislabeled.sourceFacts];
    mislabeledFacts[mislabeledIndex] = {
      ...mislabeledFacts[mislabeledIndex]!,
      category: "geometry",
    };
    mislabeled.sourceFacts = mislabeledFacts;
    assert.match(
      auditReviewedInputFieldAcquisition(
        source,
        mislabeled,
        instance,
      ).failures.join("\n"),
      /category geometry mislabels tokens\.sizes\.medium\.inputFontSize; expected typography/,
    );
  }
});

test("acquisition catches omitted and mislabeled disabled/error ink roles", () => {
  const source = readJson("examples/mui/contracts/text-field.contract.json");
  const instance = adaptReviewedInputField(source, muiInputFieldAdapterConfig);
  for (const landing of [
    "tokens.states.disabled.background",
    "tokens.states.disabled.adornmentText",
    "tokens.states.disabled.requiredIndicatorText",
    "tokens.states.error.placeholderText",
  ]) {
    const omitted = structuredClone(
      muiInputFieldAdapterConfig,
    ) as ReviewedInputFieldAdapterConfig;
    omitted.sourceFacts = omitted.sourceFacts.filter(
      (fact) => fact.landing !== landing,
    );
    assert.match(
      auditReviewedInputFieldAcquisition(
        source,
        omitted,
        instance,
      ).failures.join("\n"),
      new RegExp(
        `${landing.replaceAll(".", "\\.")}: explicit source parameter accounting is zero`,
      ),
    );

    const mislabeled = structuredClone(
      muiInputFieldAdapterConfig,
    ) as ReviewedInputFieldAdapterConfig;
    const index = mislabeled.sourceFacts.findIndex(
      (fact) =>
        fact.landing === landing && fact.fact.channel.startsWith("reviewed-"),
    );
    assert.notEqual(index, -1);
    const facts = [...mislabeled.sourceFacts];
    facts[index] = { ...facts[index]!, category: "fill" };
    mislabeled.sourceFacts = facts;
    assert.match(
      auditReviewedInputFieldAcquisition(
        source,
        mislabeled,
        instance,
      ).failures.join("\n"),
      new RegExp(`category fill mislabels ${landing.replaceAll(".", "\\.")}`),
    );
  }
});

test("adornment/font acquisition catches omission, mislabel, and duplicate plants", () => {
  const source = readJson("examples/mui/contracts/text-field.contract.json");
  const instance = adaptReviewedInputField(source, muiInputFieldAdapterConfig);
  const landing = "slots.leading.payload.content.text";
  const omitted = structuredClone(
    muiInputFieldAdapterConfig,
  ) as ReviewedInputFieldAdapterConfig;
  omitted.sourceFacts = omitted.sourceFacts.filter(
    (fact) => fact.landing !== landing,
  );
  assert.match(
    auditReviewedInputFieldAcquisition(source, omitted, instance).failures.join(
      "\n",
    ),
    /slots\.leading\.payload\.content\.text: explicit source parameter accounting is zero/,
  );

  const mislabeled = structuredClone(
    muiInputFieldAdapterConfig,
  ) as ReviewedInputFieldAdapterConfig;
  const fontIndex = mislabeled.sourceFacts.findIndex(
    (fact) =>
      fact.landing === "tokens.typography.input.requestedFamily" &&
      fact.fact.channel.startsWith("reviewed-"),
  );
  assert.notEqual(fontIndex, -1);
  const mislabeledFacts = [...mislabeled.sourceFacts];
  mislabeledFacts[fontIndex] = {
    ...mislabeledFacts[fontIndex]!,
    category: "geometry",
  };
  mislabeled.sourceFacts = mislabeledFacts;
  assert.match(
    auditReviewedInputFieldAcquisition(
      source,
      mislabeled,
      instance,
    ).failures.join("\n"),
    /category geometry mislabels tokens\.typography\.input\.requestedFamily; expected typography/,
  );

  const duplicate = structuredClone(
    muiInputFieldAdapterConfig,
  ) as ReviewedInputFieldAdapterConfig;
  duplicate.sourceFacts = [
    ...duplicate.sourceFacts,
    duplicate.sourceFacts.find((fact) => fact.landing === landing)!,
  ];
  assert.match(
    auditReviewedInputFieldAcquisition(
      source,
      duplicate,
      instance,
    ).failures.join("\n"),
    /duplicate selected source fact/,
  );
});

test("independent accounting has a nonzero denominator and catches omission and mislabel plants", () => {
  const envelope = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  const clean = auditInputFieldAccounting(
    canonicalInputFieldRecipeInstance,
    envelope,
  );
  assert.deepEqual(
    {
      factsCompared: clean.factsCompared,
      measuredLandings: clean.measuredLandings,
      carried: clean.carried,
      extensions: clean.extensions,
      receipts: clean.receipts,
    },
    {
      factsCompared: 17,
      measuredLandings: 17,
      carried: 10,
      extensions: 6,
      receipts: 1,
    },
  );
  assert.deepEqual(clean.failures, []);

  const omitted = structuredClone(envelope);
  assert.equal(omitted.ir.kind, "component-set");
  const first = omitted.ir.children[0]!;
  first.children = first.children.filter(
    (child) => child.role !== "input-field/label-row",
  );
  assert.match(
    auditInputFieldAccounting(
      canonicalInputFieldRecipeInstance,
      omitted,
    ).failures.join("\n"),
    /root#label: claimed CARRIED has no measured landing/,
  );

  const mislabeled = structuredClone(envelope);
  const association = mislabeled.extensions.find(
    (extension) => extension.id === "input-field/label-input-association",
  );
  assert.ok(association);
  association.id = "input-field/association-mislabeled";
  assert.match(
    auditInputFieldAccounting(
      canonicalInputFieldRecipeInstance,
      mislabeled,
    ).failures.join("\n"),
    /root#label-input-association: claimed EXTENSION has no measured landing/,
  );
});

test("every legacy input required fact maps to a measured recipe invariant", () => {
  const envelope = compileInputFieldRecipe(canonicalInputFieldRecipeInstance);
  assert.equal(envelope.ir.kind, "component-set");
  const measured = measureInputFieldRequiredFacts(envelope.ir);
  assert.deepEqual(
    measured.map((fact) => fact.requiredFactId),
    [
      "input/box-grammar",
      "input/padding-inline",
      "input/type-fact",
      "input/width-rule",
      "input/height",
      "input/adornment-payload",
      "input/font-provenance",
    ],
  );
  assert.equal(
    measured.every((fact) => fact.status === "measured"),
    true,
  );

  const planted = structuredClone(envelope.ir);
  const surface = planted.children[0]!.children.find(
    (child) => child.role === "input-field/surface",
  );
  assert.equal(surface?.kind, "frame");
  if (surface?.kind !== "frame") throw new Error("surface missing");
  surface.layout.padding.left = 0;
  assert.equal(
    measureInputFieldRequiredFacts(planted).find(
      (fact) => fact.requiredFactId === "input/padding-inline",
    )?.status,
    "missing",
  );
});

const loadReactOutput = () => {
  const bundle = emitInputFieldOutputs(
    compileInputFieldRecipe(canonicalInputFieldRecipeInstance),
    canonicalInputFieldRecipeInstance.provenance.selection,
  );
  const source = bundle.react.find((file) =>
    file.path.endsWith("InputField.tsx"),
  )!.contents;
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  Function(
    "require",
    "module",
    "exports",
    transpiled,
  )(
    (id: string): unknown => {
      if (id === "react") return React;
      if (id === "react/jsx-runtime") {
        return nodeRequire("react/jsx-runtime") as unknown;
      }
      throw new Error(`unexpected generated React import ${id}`);
    },
    module,
    module.exports,
  );
  return { bundle, InputField: module.exports.InputField as React.ElementType };
};

const findElement = (
  node: unknown,
  predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | undefined => {
  if (!React.isValidElement<Record<string, unknown>>(node)) return undefined;
  if (predicate(node)) return node;
  for (const child of Children.toArray(
    node.props.children as React.ReactNode,
  )) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return undefined;
};

test("React output has semantic DOM, ARIA, content policy, events, and byte identity", () => {
  const first = loadReactOutput();
  const second = emitInputFieldOutputs(
    compileInputFieldRecipe(canonicalInputFieldRecipeInstance),
    canonicalInputFieldRecipeInstance.provenance.selection,
  );
  assert.deepEqual(first.bundle, second);
  assert.equal(
    first.bundle.react.every(
      (file, index) =>
        sha256(file.contents) === sha256(second.react[index]!.contents),
    ),
    true,
  );

  const html = renderToStaticMarkup(
    React.createElement(first.InputField, {
      id: "account-name",
      label: "Account name",
      value: "Jaded Pixel",
      placeholder: "Enter a value",
      required: true,
      errorText: "Enter a valid name",
      leadingAdornment: "$",
      trailingAdornment: "USD",
      onChange() {},
    }),
  );
  assert.match(html, /<label[^>]+for="account-name"/);
  assert.match(html, /<input[^>]+id="account-name"/);
  assert.match(html, /required=""/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="account-name-message"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /data-content="value"/);
  assert.doesNotMatch(
    html,
    />Enter a value<\/[^>]+>.*>Jaded Pixel</,
    "placeholder and value must never render as two visible content nodes",
  );

  const css = first.bundle.react.find((file) =>
    file.path.endsWith(".css"),
  )!.contents;
  const references = [...css.matchAll(/var\((--[^)]+)\)/g)].map(
    (match) => match[1],
  );
  const definitions = new Set(
    [...css.matchAll(/^\s*(--[^:]+):/gm)].map((match) => match[1]),
  );
  assert.ok(references.length > 0);
  assert.equal(
    references.every((reference) => definitions.has(reference)),
    true,
  );
});

test("Web Component output uses stable DOM patching and explicit ARIA", () => {
  const bundle = emitInputFieldOutputs(
    compileInputFieldRecipe(canonicalInputFieldRecipeInstance),
    canonicalInputFieldRecipeInstance.provenance.selection,
  );
  const source = bundle.webComponent.find((file) =>
    file.path.endsWith("recipe-input-field.js"),
  )!.contents;
  assert.doesNotMatch(source, /shadowRoot\.innerHTML|setAttribute\("value"/);
  assert.match(source, /this\.inputNode\.value !== this\.currentValue/);
  assert.match(source, /assignedNodes\(\{ flatten: true \}\)/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /value-input/);
  assert.match(source, /value-change/);
});

test("generated CSS and output paths refuse injection and collisions", () => {
  for (const attack of [
    "Inter; } body{display:none}/*",
    'Inter" , serif',
    "Inter\\evil",
    "Inter\u0000evil",
    "url(https://invalid.test/font)",
    "var(--attacker)",
  ]) {
    const planted = structuredClone(canonicalInputFieldRecipeInstance);
    for (const role of ["input", "label", "message"] as const) {
      planted.tokens.typography[role].requestedFamily = attack;
      planted.tokens.typography[role].resolvedFamily = attack;
      planted.tokens.typography[role].fallbackChain[0]!.family = attack;
    }
    assert.throws(
      () =>
        emitInputFieldOutputs(
          compileInputFieldRecipe(planted),
          planted.provenance.selection,
        ),
      /unsafe font-family|invalid font-family|control characters|unterminated/,
      attack,
    );
  }

  const collision = structuredClone(canonicalInputFieldRecipeInstance);
  collision.tokens.states.default.background.variable = "collision.a";
  collision.tokens.states.default.border.variable = "collision-a";
  assert.throws(
    () =>
      emitInputFieldOutputs(
        compileInputFieldRecipe(collision),
        collision.provenance.selection,
      ),
    /token-name collision collision-a and collision\.a|token-name collision collision\.a and collision-a/,
  );
  assert.throws(
    () => assertSafeOutputFiles([{ path: "react/../../outside.ts" }], "react"),
    /escapes react/,
  );
  assert.throws(
    () => assertSafeOutputFiles([{ path: "/tmp/outside.ts" }], "react"),
    /escapes react/,
  );
});

test("source boundary keeps Input/Field ungraded and names the next capture setup", () => {
  for (const config of [
    muiInputFieldAdapterConfig,
    polarisInputFieldAdapterConfig,
  ]) {
    assert.match(config.benchmark.version, /^\d+\.\d+\.\d+$/);
    assert.ok(config.benchmark.captureCommand.length > 0);
    assert.ok(config.benchmark.unsupportedCells.length > 0);
    assert.equal(
      "grade" in config.benchmark || "screenshots" in config.benchmark,
      false,
    );
  }
});
